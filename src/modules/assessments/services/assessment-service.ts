/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Assessment Authoring & Management Service
 * ==============================================================================
 * Handles assessment blueprint creation, question-set binding, lifecycle publishing,
 * and result manual release management.
 */

import {
  AssessmentRow,
  AssessmentPurpose,
  AssessmentStatus,
  ReviewPolicy,
  ReleasePolicy,
} from "@/types/database";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CreateAssessmentInput {
  title: string;
  description?: string | null;
  purpose?: AssessmentPurpose;
  question_set_id: string;
  drive_id?: string | null;
  time_limit_minutes?: number | null;
  allowed_attempts?: number;
  review_policy?: ReviewPolicy;
  release_policy?: ReleasePolicy;
  shuffle_questions?: boolean;
  pass_percentage?: number;
}

export interface UpdateAssessmentInput {
  title?: string;
  description?: string | null;
  purpose?: AssessmentPurpose;
  drive_id?: string | null;
  time_limit_minutes?: number | null;
  allowed_attempts?: number;
  review_policy?: ReviewPolicy;
  release_policy?: ReleasePolicy;
  shuffle_questions?: boolean;
  pass_percentage?: number;
}

export class AssessmentService {
  /**
   * Creates a new assessment linked to a frozen/locked question set snapshot.
   */
  public static async createAssessment(
    tenantId: string,
    userId: string,
    input: CreateAssessmentInput
  ): Promise<{ success: boolean; assessment?: AssessmentRow; error?: string }> {
    const supabase = await createServerSupabaseClient();

    if (!input.title || input.title.trim().length < 3) {
      return { success: false, error: "Assessment title must be at least 3 characters." };
    }

    if (!input.question_set_id) {
      return { success: false, error: "A valid question set must be selected." };
    }

    // Verify question set
    const { data: qSet, error: setErr } = await supabase
      .from("question_sets")
      .select("id, is_locked, version_number, status")
      .eq("tenant_id", tenantId)
      .eq("id", input.question_set_id)
      .single();

    if (setErr || !qSet) {
      return { success: false, error: "Question set not found." };
    }

    // If set is not locked yet, lock and publish it to guarantee immutable snapshot
    if (!qSet.is_locked) {
      const lockRes = await QuestionSetService.lockAndPublishSet(
        tenantId,
        input.question_set_id
      );
      if (!lockRes.success) {
        return {
          success: false,
          error: `Failed to freeze question set: ${lockRes.error}`,
        };
      }
    }

    const { data: newAssessment, error: insErr } = await supabase
      .from("assessments")
      .insert({
        tenant_id: tenantId,
        title: input.title.trim(),
        description: input.description || null,
        purpose: input.purpose || "ASSESSMENT",
        question_set_id: input.question_set_id,
        set_version_id: qSet.version_number || 1,
        drive_id: input.drive_id || null,
        time_limit_minutes:
          input.time_limit_minutes && input.time_limit_minutes > 0
            ? Number(input.time_limit_minutes)
            : null,
        allowed_attempts: Math.max(1, Number(input.allowed_attempts || 1)),
        review_policy: input.review_policy || "IMMEDIATE",
        release_policy: input.release_policy || "IMMEDIATE",
        shuffle_questions: Boolean(input.shuffle_questions),
        pass_percentage: Number(input.pass_percentage ?? 60.0),
        status: "DRAFT",
        created_by: userId,
      })
      .select("*")
      .single();

    if (insErr || !newAssessment) {
      return { success: false, error: insErr?.message || "Failed to create assessment." };
    }

    return { success: true, assessment: newAssessment };
  }

  /**
   * Lists assessments for a tenant with attempt metrics and question set info.
   */
  public static async listAssessments(
    tenantId: string,
    filters?: {
      purpose?: AssessmentPurpose;
      status?: AssessmentStatus;
      driveId?: string;
    }
  ): Promise<{ success: boolean; assessments: any[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("assessments")
      .select(`
        *,
        question_set:question_sets(id, name, purpose, is_locked),
        attempts:assessment_attempts(count)
      `)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (filters?.purpose) {
      query = query.eq("purpose", filters.purpose);
    }
    if (filters?.status) {
      query = query.eq("status", filters.status);
    }
    if (filters?.driveId) {
      query = query.eq("drive_id", filters.driveId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, assessments: [], error: error.message };
    }

    const formatted = (data || []).map((row: any) => ({
      ...row,
      attemptCount: Array.isArray(row.attempts)
        ? row.attempts[0]?.count || 0
        : row.attempts?.count || 0,
    }));

    return { success: true, assessments: formatted };
  }

  /**
   * Retrieves single assessment details.
   */
  public static async getAssessmentById(
    tenantId: string,
    assessmentId: string
  ): Promise<{ success: boolean; assessment?: any; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("assessments")
      .select(`
        *,
        question_set:question_sets(
          id,
          name,
          description,
          purpose,
          is_locked,
          items:question_set_items(
            id,
            sequence_order,
            points,
            negative_points,
            question_id,
            version_id
          )
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("id", assessmentId)
      .single();

    if (error || !data) {
      return { success: false, error: "Assessment not found." };
    }

    return { success: true, assessment: data };
  }

  /**
   * Publishes an assessment to make it ready for assignment and student attempts.
   * Invariant: Requires verified Question Set belonging to the same tenant with at least one question.
   */
  public static async publishAssessment(
    tenantId: string,
    assessmentId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data: assessment, error: getErr } = await supabase
      .from("assessments")
      .select("id, question_set_id, status")
      .eq("tenant_id", tenantId)
      .eq("id", assessmentId)
      .single();

    if (getErr || !assessment) {
      return { success: false, error: "Assessment not found." };
    }

    // Verify question set belongs to tenant
    const { data: qSet, error: qSetErr } = await supabase
      .from("question_sets")
      .select("id, is_locked, status")
      .eq("tenant_id", tenantId)
      .eq("id", assessment.question_set_id)
      .single();

    if (qSetErr || !qSet) {
      return {
        success: false,
        error: "Question set not found or does not belong to this institution.",
      };
    }

    // Verify question set has at least one question
    const { count } = await supabase
      .from("question_set_items")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("set_id", assessment.question_set_id);

    if (!count || count === 0) {
      return {
        success: false,
        error: "Cannot publish an assessment with zero questions in its question set.",
      };
    }

    // Ensure question set is locked and published
    if (!qSet.is_locked || qSet.status !== "PUBLISHED") {
      const lockRes = await QuestionSetService.lockAndPublishSet(
        tenantId,
        assessment.question_set_id
      );
      if (!lockRes.success) {
        return {
          success: false,
          error: `Failed to verify and publish question set: ${lockRes.error}`,
        };
      }
    }

    const { error: upErr } = await supabase
      .from("assessments")
      .update({
        status: "PUBLISHED",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", assessmentId);

    if (upErr) {
      return { success: false, error: upErr.message };
    }

    return { success: true };
  }

  /**
   * Releases results to students for assessments configured with MANUAL_STAFF_RELEASE.
   */
  public static async releaseResults(
    tenantId: string,
    assessmentId: string
  ): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("assessment_attempts")
      .update({
        status: "RESULT_RELEASED",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId)
      .eq("status", "SCORED")
      .select("id");

    if (error) {
      return { success: false, updatedCount: 0, error: error.message };
    }

    return { success: true, updatedCount: data ? data.length : 0 };
  }

  /**
   * Deletes an unassigned draft assessment with zero student attempts.
   * Published assessments or assessments with student attempt history cannot be deleted.
   */
  public static async deleteAssessment(
    tenantId: string,
    assessmentId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch assessment
    const { data: assessment, error: fetchErr } = await supabase
      .from("assessments")
      .select("id, status, title")
      .eq("tenant_id", tenantId)
      .eq("id", assessmentId)
      .single();

    if (fetchErr || !assessment) {
      return { success: false, error: "Assessment not found." };
    }

    // 2. Invariant: Only DRAFT assessments can be permanently removed
    if (assessment.status !== "DRAFT") {
      return {
        success: false,
        error: "Only draft assessments can be deleted. Published assessments must be archived to preserve student records and compliance history.",
      };
    }

    // 3. Invariant: Cannot delete if student attempts exist
    const { count: attemptCount } = await supabase
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId);

    if (attemptCount && attemptCount > 0) {
      return {
        success: false,
        error: "Cannot delete assessment because student attempts have already been recorded.",
      };
    }

    // 4. Invariant: Cannot delete if cohort assignments exist
    const { count: assignCount } = await supabase
      .from("assessment_assignments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId);

    if (assignCount && assignCount > 0) {
      return {
        success: false,
        error: "Cannot delete assessment because it is currently assigned to one or more cohorts or students.",
      };
    }

    // 5. Delete assessment row
    const { error: delErr } = await supabase
      .from("assessments")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", assessmentId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    return { success: true };
  }
}
