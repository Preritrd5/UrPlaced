/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Training: Training Session & Before/After Evaluation Service (Phase 09)
 * ==============================================================================
 * Manages workshops/bootcamps, enrollment vs verified attendance distinction,
 * and paired before/after assessment score evaluation with causal disclaimers.
 */

import {
  TrainingSessionRow,
  TrainingAttendanceRow,
  TrainingBeforeAfterComparisonRow,
  TrainingSessionStatus,
  TrainingEnrollmentStatus,
  TrainingAttendanceStatus,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const MANDATORY_TRAINING_CAUSAL_DISCLAIMER =
  "Correlation does not imply causation. Score improvements reflect observed performance differences between the baseline and follow-up assessments for paired attendees. Performance changes may also be influenced by self-study, repeated exposure, or test variation.";

export interface CreateTrainingSessionInput {
  title: string;
  description?: string | null;
  skillId?: string | null;
  topic: string;
  trainerId?: string | null;
  sessionDate: string;
  durationMinutes?: number;
  baselineAssessmentId?: string | null;
  followUpAssessmentId?: string | null;
  status?: TrainingSessionStatus;
}

export interface MarkAttendanceInput {
  studentId: string;
  attendanceStatus: TrainingAttendanceStatus;
  notes?: string | null;
}

export class TrainingSessionService {
  /**
   * Creates a structured training session or workshop.
   */
  public static async createSession(
    tenantId: string,
    input: CreateTrainingSessionInput
  ): Promise<{ success: boolean; session?: TrainingSessionRow; error?: string }> {
    if (!input.title || !input.topic || !input.sessionDate) {
      return { success: false, error: "Missing required training session parameters." };
    }

    const supabase = await createServerSupabaseClient();

    const insertPayload = {
      tenant_id: tenantId,
      title: input.title.trim(),
      description: input.description || null,
      skill_id: input.skillId || null,
      topic: input.topic.trim(),
      trainerId: input.trainerId || null,
      session_date: input.sessionDate,
      duration_minutes: input.durationMinutes || 60,
      baseline_assessment_id: input.baselineAssessmentId || null,
      follow_up_assessment_id: input.followUpAssessmentId || null,
      status: input.status || "SCHEDULED",
    };

    const { data: session, error } = await supabase
      .from("training_sessions")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !session) {
      return { success: false, error: error?.message || "Failed to create training session." };
    }

    return { success: true, session };
  }

  /**
   * Lists training sessions for a tenant.
   */
  public static async listSessions(
    tenantId: string,
    status?: TrainingSessionStatus
  ): Promise<{ success: boolean; sessions: TrainingSessionRow[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("training_sessions")
      .select("*, skills(name)")
      .eq("tenant_id", tenantId);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("session_date", { ascending: false });

    if (error) {
      return { success: false, sessions: [], error: error.message };
    }

    return { success: true, sessions: data || [] };
  }

  /**
   * Retrieves single training session details including baseline and follow-up assessments.
   */
  public static async getSessionById(
    tenantId: string,
    sessionId: string
  ): Promise<{ success: boolean; session?: TrainingSessionRow; error?: string }> {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("training_sessions")
      .select("*, skills(name)")
      .eq("tenant_id", tenantId)
      .eq("id", sessionId)
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Training session not found." };
    }

    return { success: true, session: data };
  }

  /**
   * Enrolls students into a training session (distinguishing registration from attendance).
   */
  public static async enrollStudents(
    tenantId: string,
    sessionId: string,
    studentIds: string[]
  ): Promise<{ success: boolean; enrolledCount: number; error?: string }> {
    if (!studentIds || studentIds.length === 0) {
      return { success: false, enrolledCount: 0, error: "No student IDs provided." };
    }

    const supabase = await createServerSupabaseClient();

    const payloads = studentIds.map((sid) => ({
      tenant_id: tenantId,
      session_id: sessionId,
      student_id: sid,
      enrollment_status: "ENROLLED" as TrainingEnrollmentStatus,
      attendance_status: "ABSENT" as TrainingAttendanceStatus, // default until marked
    }));

    const { data, error } = await supabase
      .from("training_attendance")
      .upsert(payloads, { onConflict: "session_id,student_id" })
      .select();

    if (error) {
      return { success: false, enrolledCount: 0, error: error.message };
    }

    return { success: true, enrolledCount: data?.length || 0 };
  }

  /**
   * Records verified physical/virtual attendance for enrolled students.
   */
  public static async markAttendance(
    tenantId: string,
    sessionId: string,
    attendanceList: MarkAttendanceInput[]
  ): Promise<{ success: boolean; updatedCount: number; error?: string }> {
    const supabase = await createServerSupabaseClient();
    let updatedCount = 0;

    for (const item of attendanceList) {
      const { error } = await supabase
        .from("training_attendance")
        .update({
          attendance_status: item.attendanceStatus,
          notes: item.notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .eq("session_id", sessionId)
        .eq("student_id", item.studentId);

      if (!error) {
        updatedCount++;
      }
    }

    return { success: true, updatedCount };
  }

  /**
   * Computes rigorous Paired Observation Before/After score comparisons.
   * Only includes students who:
   * 1. Were marked ATTENDED for the session.
   * 2. Completed a valid attempt for the baseline assessment.
   * 3. Completed a valid attempt for the follow-up assessment.
   */
  public static async computeBeforeAfterComparison(
    tenantId: string,
    sessionId: string
  ): Promise<{
    success: boolean;
    comparison?: TrainingBeforeAfterComparisonRow;
    error?: string;
  }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch training session
    const { data: session, error: sessErr } = await supabase
      .from("training_sessions")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", sessionId)
      .single();

    if (sessErr || !session) {
      return { success: false, error: sessErr?.message || "Training session not found." };
    }

    if (!session.baseline_assessment_id || !session.follow_up_assessment_id) {
      return {
        success: false,
        error: "Both baseline and follow-up assessments must be linked to calculate before/after impact.",
      };
    }

    // 2. Fetch attended students
    const { data: attendees, error: attErr } = await supabase
      .from("training_attendance")
      .select("student_id, attendance_status, enrollment_status")
      .eq("tenant_id", tenantId)
      .eq("session_id", sessionId);

    if (attErr) {
      return { success: false, error: attErr.message };
    }

    const totalEnrolled = attendees?.length || 0;
    const attendedStudentIds = (attendees || [])
      .filter((a) => a.attendance_status === "ATTENDED")
      .map((a) => a.student_id);

    if (attendedStudentIds.length === 0) {
      return {
        success: false,
        error: "No students are marked as ATTENDED for this training session.",
      };
    }

    // 3. Fetch baseline attempts for attendees
    const { data: baselineAttempts, error: baseErr } = await supabase
      .from("assessment_attempts")
      .select("student_id, score_percentage, status")
      .eq("tenant_id", tenantId)
      .eq("assessment_id", session.baseline_assessment_id)
      .in("student_id", attendedStudentIds)
      .in("status", ["SUBMITTED", "GRADED"]);

    if (baseErr) {
      return { success: false, error: baseErr.message };
    }

    // 4. Fetch follow-up attempts for attendees
    const { data: followUpAttempts, error: followErr } = await supabase
      .from("assessment_attempts")
      .select("student_id, score_percentage, status")
      .eq("tenant_id", tenantId)
      .eq("assessment_id", session.follow_up_assessment_id)
      .in("student_id", attendedStudentIds)
      .in("status", ["SUBMITTED", "GRADED"]);

    if (followErr) {
      return { success: false, error: followErr.message };
    }

    // 5. Match paired students (must have both baseline and follow-up)
    const baselineMap = new Map<string, number>();
    (baselineAttempts || []).forEach((a) => {
      if (a.score_percentage !== null) {
        baselineMap.set(a.student_id, a.score_percentage);
      }
    });

    const pairedData: Array<{ studentId: string; pre: number; post: number }> = [];
    (followUpAttempts || []).forEach((f) => {
      if (f.score_percentage !== null && baselineMap.has(f.student_id)) {
        pairedData.push({
          studentId: f.student_id,
          pre: baselineMap.get(f.student_id)!,
          post: f.score_percentage,
        });
      }
    });

    const pairedCount = pairedData.length;
    if (pairedCount === 0) {
      return {
        success: false,
        error: "Insufficient data: No attending students have completed both baseline and follow-up assessments.",
      };
    }

    // 6. Compute mathematical averages
    const sumPre = pairedData.reduce((acc, p) => acc + p.pre, 0);
    const sumPost = pairedData.reduce((acc, p) => acc + p.post, 0);

    const baselineAvg = Number((sumPre / pairedCount).toFixed(2));
    const followupAvg = Number((sumPost / pairedCount).toFixed(2));
    const absoluteDelta = Number((followupAvg - baselineAvg).toFixed(2));
    const relativePctDelta =
      baselineAvg > 0 ? Number((((followupAvg - baselineAvg) / baselineAvg) * 100).toFixed(2)) : null;

    // Also update individual attendance pre/post scores
    for (const p of pairedData) {
      await supabase
        .from("training_attendance")
        .update({
          pre_score: p.pre,
          post_score: p.post,
        })
        .eq("tenant_id", tenantId)
        .eq("session_id", sessionId)
        .eq("student_id", p.studentId);
    }

    // 7. Persist into training_before_after_comparisons
    const insertPayload = {
      tenant_id: tenantId,
      session_id: sessionId,
      skill_id: session.skill_id,
      baseline_assessment_id: session.baseline_assessment_id,
      follow_up_assessment_id: session.follow_up_assessment_id,
      eligible_students_count: totalEnrolled,
      paired_students_count: pairedCount,
      baseline_avg_score: baselineAvg,
      followup_avg_score: followupAvg,
      absolute_delta: absoluteDelta,
      relative_percentage_delta: relativePctDelta,
      limitations_disclaimer: MANDATORY_TRAINING_CAUSAL_DISCLAIMER,
      generated_at: new Date().toISOString(),
    };

    const { data: comparison, error: saveErr } = await supabase
      .from("training_before_after_comparisons")
      .insert(insertPayload)
      .select()
      .single();

    if (saveErr || !comparison) {
      return { success: false, error: saveErr?.message || "Failed to persist before/after comparison." };
    }

    return { success: true, comparison };
  }
}
