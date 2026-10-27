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
   * Invariant: Only reviewed questions with verified answer keys (VERIFIED_CORRECT)
   * or approved lifecycle status can be added to question sets.
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

    // Validate all items before inserting to preserve integrity
    const itemsToInsert: Array<{
      tenant_id: string;
      set_id: string;
      question_id: string;
      version_id: string;
      sequence_order: number;
      points: number;
      negative_points: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const { data: q, error: qErr } = await supabase
        .from("questions")
        .select("id, current_version_id, lifecycle_status")
        .eq("tenant_id", tenantId)
        .eq("id", item.question_id)
        .single();

      if (qErr || !q) {
        return {
          success: false,
          addedCount: 0,
          error: `Question ${item.question_id} not found or does not belong to this institution.`,
        };
      }

      const versionId = item.version_id || q.current_version_id;
      if (!versionId) {
        return {
          success: false,
          addedCount: 0,
          error: `Question ${item.question_id} has no valid version.`,
        };
      }

      // Check version review eligibility
      const { data: ver, error: vErr } = await supabase
        .from("question_versions")
        .select("id, review_status")
        .eq("tenant_id", tenantId)
        .eq("id", versionId)
        .single();

      if (vErr || !ver) {
        return {
          success: false,
          addedCount: 0,
          error: `Question version not found for question ${item.question_id}.`,
        };
      }

      const isEligible =
        ver.review_status === "VERIFIED_CORRECT" &&
        ["APPROVED", "PUBLISHED"].includes(q.lifecycle_status);

      if (!isEligible) {
        return {
          success: false,
          addedCount: 0,
          error: `Cannot add question to set: Question ${item.question_id} is not eligible. Questions must have a verified answer key ('VERIFIED_CORRECT') and an approved or published lifecycle status ('APPROVED' or 'PUBLISHED'). Current review status: '${ver.review_status}', lifecycle: '${q.lifecycle_status}'.`,
        };
      }

      itemsToInsert.push({
        tenant_id: tenantId,
        set_id: setId,
        question_id: item.question_id,
        version_id: versionId,
        sequence_order: item.sequence_order || i + 1,
        points: item.points || 1.0,
        negative_points: item.negative_points || 0.0,
      });
    }

    let addedCount = 0;
    for (const row of itemsToInsert) {
      const { error: insErr } = await supabase
        .from("question_set_items")
        .insert(row);

      if (!insErr) {
        addedCount++;
      }
    }

    return { success: true, addedCount };
  }

  /**
   * Locks and publishes the question set, creating an immutable snapshot for assessments.
   * Invariant: Requires at least 1 question, and all questions must have verified answer keys.
   */
  public static async lockAndPublishSet(
    tenantId: string,
    setId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Verify set exists and belongs to tenant
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked, status")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, error: "Question set not found." };
    }

    // Check item count
    const { data: items, error: itemsErr } = await supabase
      .from("question_set_items")
      .select(`
        id,
        question_id,
        version_id,
        question:questions!inner(id, lifecycle_status),
        version:question_versions!inner(id, review_status)
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", setId);

    if (itemsErr || !items || items.length === 0) {
      return {
        success: false,
        error: "Cannot publish an empty question set. Please add at least one question.",
      };
    }

    // Verify all items are verified/approved
    for (const item of items) {
      const q = item.question as any;
      const v = item.version as any;
      const isEligible =
        v?.review_status === "VERIFIED_CORRECT" &&
        ["APPROVED", "PUBLISHED"].includes(q?.lifecycle_status);

      if (!isEligible) {
        return {
          success: false,
          error: `Cannot publish question set: Included question ${item.question_id} is not eligible. All questions must have a verified answer key ('VERIFIED_CORRECT') and an approved or published lifecycle status ('APPROVED' or 'PUBLISHED'). Current review status: '${v?.review_status}', lifecycle: '${q?.lifecycle_status}'.`,
        };
      }
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

  /**
   * Deletes an unlocked, draft question set and all its item bindings.
   * Locked snapshots and sets referenced by assessments cannot be deleted.
   */
  public static async deleteSet(
    tenantId: string,
    setId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Check if set exists and belongs to tenant
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked, status")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, error: "Question set not found." };
    }

    // 2. Invariant: Locked or published snapshots cannot be deleted
    if (set.is_locked || set.status === "PUBLISHED") {
      return {
        success: false,
        error: "Cannot delete a locked or published question set snapshot.",
      };
    }

    // 3. Invariant: Sets referenced by assessments cannot be deleted
    const { count: assessmentCount } = await supabase
      .from("assessments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("question_set_id", setId);

    if (assessmentCount && assessmentCount > 0) {
      return {
        success: false,
        error: "Cannot delete question set because it is referenced by one or more assessments.",
      };
    }

    // 4. Delete items first
    const { error: itemsDelErr } = await supabase
      .from("question_set_items")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("set_id", setId);

    if (itemsDelErr) {
      return { success: false, error: itemsDelErr.message };
    }

    // 5. Delete set
    const { error: setDelErr } = await supabase
      .from("question_sets")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", setId);

    if (setDelErr) {
      return { success: false, error: setDelErr.message };
    }

    return { success: true };
  }

  /**
   * Removes an individual question item from an unlocked draft question set.
   */
  public static async removeItemFromSet(
    tenantId: string,
    setId: string,
    itemId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Check set lock status
    const { data: set, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked")
      .eq("tenant_id", tenantId)
      .eq("id", setId)
      .single();

    if (setErr || !set) {
      return { success: false, error: "Question set not found." };
    }

    if (set.is_locked) {
      return {
        success: false,
        error: "Cannot remove items from a locked question set snapshot.",
      };
    }

    const { error: delErr } = await supabase
      .from("question_set_items")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("set_id", setId)
      .eq("id", itemId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  }
}
