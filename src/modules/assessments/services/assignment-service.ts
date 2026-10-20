/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Assignment & Cohort Scheduling Service
 * ==============================================================================
 * Handles scheduling availability windows, assigning cohorts and individual students,
 * and mapping active assessments to student preparation feeds.
 */

import {
  AssessmentAssignmentRow,
  AssignmentStatus,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AssignAssessmentInput {
  assessment_id: string;
  student_ids?: string[];
  cohort_name?: string;
  window_start?: string | null;
  window_end?: string | null;
  max_attempts_override?: number | null;
}

export class AssignmentService {
  /**
   * Assigns a published assessment to individual students or an entire cohort.
   */
  public static async assignAssessment(
    tenantId: string,
    assignedByUserId: string,
    input: AssignAssessmentInput
  ): Promise<{ success: boolean; createdCount: number; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Verify assessment exists and is PUBLISHED
    const { data: assessment, error: assErr } = await supabase
      .from("assessments")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("id", input.assessment_id)
      .single();

    if (assErr || !assessment) {
      return { success: false, createdCount: 0, error: "Assessment not found." };
    }

    if (assessment.status !== "PUBLISHED") {
      return {
        success: false,
        createdCount: 0,
        error: "Only published assessments can be assigned to students.",
      };
    }

    const rowsToInsert: Array<{
      tenant_id: string;
      assessment_id: string;
      student_id: string | null;
      cohort_name: string | null;
      window_start: string | null;
      window_end: string | null;
      max_attempts_override: number | null;
      status: AssignmentStatus;
      assigned_by: string;
    }> = [];

    if (Array.isArray(input.student_ids) && input.student_ids.length > 0) {
      for (const studentId of input.student_ids) {
        rowsToInsert.push({
          tenant_id: tenantId,
          assessment_id: input.assessment_id,
          student_id: studentId,
          cohort_name: input.cohort_name || null,
          window_start: input.window_start || null,
          window_end: input.window_end || null,
          max_attempts_override: input.max_attempts_override ?? null,
          status: "ACTIVE",
          assigned_by: assignedByUserId,
        });
      }
    } else {
      // Cohort-wide assignment (student_id is null)
      rowsToInsert.push({
        tenant_id: tenantId,
        assessment_id: input.assessment_id,
        student_id: null,
        cohort_name: input.cohort_name || "All Enrolled Students",
        window_start: input.window_start || null,
        window_end: input.window_end || null,
        max_attempts_override: input.max_attempts_override ?? null,
        status: "ACTIVE",
        assigned_by: assignedByUserId,
      });
    }

    const { data, error } = await supabase
      .from("assessment_assignments")
      .insert(rowsToInsert)
      .select("id");

    if (error) {
      return { success: false, createdCount: 0, error: error.message };
    }

    return { success: true, createdCount: data ? data.length : 0 };
  }

  /**
   * Lists all available and assigned assessments for a student,
   * enriched with window status and attempt records.
   */
  public static async listAssignmentsForStudent(
    tenantId: string,
    studentId: string
  ): Promise<{ success: boolean; assignments: any[]; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const now = new Date();

    // 1. Fetch active assignments matching student directly or cohort-wide
    const { data: assignments, error: assErr } = await supabase
      .from("assessment_assignments")
      .select(`
        id,
        assessment_id,
        student_id,
        cohort_name,
        window_start,
        window_end,
        max_attempts_override,
        status,
        created_at,
        assessment:assessments!inner(
          id,
          title,
          description,
          purpose,
          time_limit_minutes,
          allowed_attempts,
          pass_percentage,
          review_policy,
          release_policy,
          status,
          drive_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .eq("assessment.status", "PUBLISHED")
      .or(`student_id.eq.${studentId},student_id.is.null`);

    if (assErr) {
      return { success: false, assignments: [], error: assErr.message };
    }

    // 2. Fetch student's attempt records for these assessments
    const assessmentIds = Array.from(
      new Set((assignments || []).map((a: any) => a.assessment_id))
    );

    let attemptsByAssessment: Record<string, any[]> = {};
    if (assessmentIds.length > 0) {
      const { data: attempts } = await supabase
        .from("assessment_attempts")
        .select(`
          id,
          assessment_id,
          attempt_number,
          status,
          started_at,
          expires_at,
          submitted_at,
          earned_points,
          total_points,
          score_percentage,
          is_passed,
          scoring_status
        `)
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .in("assessment_id", assessmentIds);

      (attempts || []).forEach((att) => {
        if (!attemptsByAssessment[att.assessment_id]) {
          attemptsByAssessment[att.assessment_id] = [];
        }
        attemptsByAssessment[att.assessment_id].push(att);
      });
    }

    // 3. Format and enrich output
    const enriched = (assignments || []).map((item: any) => {
      const ass = item.assessment;
      const atts = attemptsByAssessment[item.assessment_id] || [];

      const maxAttempts = item.max_attempts_override ?? ass.allowed_attempts ?? 1;
      const attemptsCount = atts.length;

      let windowStatus: "UPCOMING" | "OPEN" | "CLOSED" = "OPEN";
      if (item.window_start && new Date(item.window_start) > now) {
        windowStatus = "UPCOMING";
      } else if (item.window_end && new Date(item.window_end) < now) {
        windowStatus = "CLOSED";
      }

      const activeAttempt = atts.find((a) => a.status === "IN_PROGRESS");
      const canAttempt =
        windowStatus === "OPEN" && (attemptsCount < maxAttempts || Boolean(activeAttempt));

      const highestScore = atts.reduce(
        (max, a) => Math.max(max, Number(a.score_percentage || 0)),
        0
      );

      const latestAttempt = atts.sort(
        (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
      )[0];

      return {
        assignmentId: item.id,
        assessmentId: ass.id,
        title: ass.title,
        description: ass.description,
        purpose: ass.purpose,
        timeLimitMinutes: ass.time_limit_minutes,
        allowedAttempts: maxAttempts,
        passPercentage: Number(ass.pass_percentage ?? 60.0),
        windowStart: item.window_start,
        windowEnd: item.window_end,
        windowStatus,
        cohortName: item.cohort_name,
        attemptsCount,
        canAttempt,
        hasActiveAttempt: Boolean(activeAttempt),
        activeAttemptId: activeAttempt?.id || null,
        highestScore: attemptsCount > 0 ? highestScore : null,
        latestAttempt: latestAttempt || null,
        driveId: ass.drive_id,
      };
    });

    return { success: true, assignments: enriched };
  }

  /**
   * Retrieves all assignments and participation metrics for a specific assessment.
   */
  public static async listAssignmentsForAssessment(
    tenantId: string,
    assessmentId: string
  ): Promise<{ success: boolean; assignments: any[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data: assignments, error } = await supabase
      .from("assessment_assignments")
      .select(`
        *,
        student:students(
          id,
          full_name,
          enrollment_number,
          department_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId)
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, assignments: [], error: error.message };
    }

    return { success: true, assignments: assignments || [] };
  }
}
