/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- QuestionBank Sentinel: Question Set & Snapshot Service
-- ==============================================================================
*/

import { QuestionSetPurpose } from "@/types/database";
import { QuestionService } from "./question-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CreateQuestionSetInput {
  name: string;
  description?: string;
  purpose: QuestionSetPurpose;
}

export interface QuestionSetItemInput {
  question_id: string;
  version_id?: string;
  sequence_order?: number;
  points?: number;
  negative_points?: number;
}

export class QuestionSetService {
  /**
   * Creates a new question set container.
   */
  public static async createSet(
    tenantId: string,
    userId: string,
    input: CreateQuestionSetInput
  ) {
    const supabase = await createServerSupabaseClient();

    return supabase
      .from("question_sets")
      .insert({
        tenant_id: tenantId,
        name: input.name,
        description: input.description || null,
        purpose: input.purpose,
        status: "DRAFT",
        created_by: userId,
      })
      .select("*")
      .single();
  }

  /**
   * Binds questions to a question set using immutable version IDs.
   */
  public static async addItemsToSet(
    tenantId: string,
    setId: string,
    items: QuestionSetItemInput[]
  ): Promise<{ success: boolean; addedCount: number; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Verify set is not locked
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("is_locked, status")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, addedCount: 0, error: "Question set not found." };
    }

    if (set.is_locked) {
      return {
        success: false,
        addedCount: 0,
        error: "Question set is locked. Create a new revision to alter items.",
      };
    }

    let addedCount = 0;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // If version_id not provided, resolve current_version_id
      let versionId = item.version_id;
      if (!versionId) {
        const { data: q } = await supabase
          .from("questions")
          .select("current_version_id")
          .eq("tenant_id", tenantId)
          .eq("id", item.question_id)
          .single();

        if (!q?.current_version_id) continue;
        versionId = q.current_version_id;
      }

      const { error: insErr } = await supabase
        .from("question_set_items")
        .insert({
          tenant_id: tenantId,
          set_id: setId,
          question_id: item.question_id,
          version_id: versionId,
          sequence_order: item.sequence_order || i + 1,
          points: item.points || 1.0,
          negative_points: item.negative_points || 0.0,
        });

      if (!insErr) {
        addedCount++;
      }
    }

    return { success: true, addedCount };
  }

  /**
   * Locks and publishes the question set, creating an immutable snapshot for assessments.
   */
  public static async lockAndPublishSet(
    tenantId: string,
    setId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Check item count
    const { count } = await supabase
      .from("question_set_items")
      .select("id", { count: "exact", head: true })
      .eq("set_id", setId);

    if (!count || count === 0) {
      return {
        success: false,
        error: "Cannot publish an empty question set. Please add at least one question.",
      };
    }

    const { error: upErr } = await supabase
      .from("question_sets")
      .update({
        status: "PUBLISHED",
        is_locked: true,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", setId);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    return { success: true };
  }

  /**
   * Retrieves a question set with its questions and role-based security sanitization.
   */
  public static async getSetById(
    tenantId: string,
    userRole: string,
    setId: string
  ) {
    const supabase = await createServerSupabaseClient();

    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { set: null, items: [], error: "Question set not found." };
    }

    const { data: items, error: itemsErr } = await supabase
      .from("question_set_items")
      .select(`
        id,
        sequence_order,
        points,
        negative_points,
        question_id,
        version_id,
        question:questions!inner(
          id,
          question_type,
          lifecycle_status
        ),
        version:question_versions!inner(
          id,
          version_number,
          prompt,
          content_format,
          options,
          answer_key,
          explanation,
          difficulty,
          topic_tags,
          published_at
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", setId)
      .order("sequence_order", { ascending: true });

    if (itemsErr) {
      return { set, items: [], error: itemsErr.message };
    }

    const sanitizedItems = (items || []).map((item: any) => {
      let ver = item.version;
      const qType = item.question?.question_type;

      if (userRole === "STUDENT" && ver) {
        ver = QuestionService.sanitizeForStudent(ver, qType);
      }

      return {
        ...item,
        version: ver,
      };
    });

    return { set, items: sanitizedItems };
  }

  /**
   * Lists question sets for a tenant.
   */
  public static async listSets(
    tenantId: string,
    userRole: string,
    purpose?: QuestionSetPurpose
  ) {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("question_sets")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (userRole === "STUDENT") {
      query = query.eq("status", "PUBLISHED");
    }

    if (purpose) {
      query = query.eq("purpose", purpose);
    }

    return query;
  }
}
