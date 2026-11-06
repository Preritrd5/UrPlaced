/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Server-Authoritative Attempt Lifecycle Service
 * ==============================================================================
 * Enforces start eligibility, window restrictions, attempt limits, server countdowns,
 * expiration transitions, and secure answer release policies.
 */

import {
  AssessmentRow,
  AssessmentAttemptRow,
  AttemptStatus,
  QuestionVersionRow,
  QuestionType,
  AssessmentViolationType,
} from "@/types/database";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { AssessmentScoringService } from "./assessment-scoring-service";
import {
  studentMatchesCohort,
  StudentCohortProfile,
} from "./assignment-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface StartAttemptResult {
  success: boolean;
  attempt?: AssessmentAttemptRow;
  questions?: Array<{
    questionId: string;
    versionId: string;
    questionType: QuestionType;
    sequenceOrder: number;
    points: number;
    negativePoints: number;
    prompt: string;
    contentFormat: string;
    options: any;
    difficulty: string;
    topicTags: string[];
  }>;
  remainingSeconds?: number | null;
  error?: string;
}

export interface AttemptWorkspaceState {
  attempt: AssessmentAttemptRow;
  assessment: {
    id: string;
    title: string;
    description: string | null;
    timeLimitMinutes: number | null;
    passPercentage: number;
    reviewPolicy: string;
    releasePolicy: string;
  };
  remainingSeconds: number | null;
  questions: Array<{
    questionId: string;
    versionId: string;
    questionType: QuestionType;
    sequenceOrder: number;
    points: number;
    negativePoints: number;
    prompt: string;
    contentFormat: string;
    options: any;
    difficulty: string;
    topicTags: string[];
    savedResponse: {
      payload: any;
      saveSequence: number;
      isFlagged: boolean;
      isAnswered: boolean;
      lastSavedAt: string;
    } | null;
  }>;
}

export class AttemptLifecycleService {
  /**
   * Starts or resumes an assessment attempt for an authorized student.
   * Server strictly enforces time limits, window intervals, and attempt limits.
   */
  public static async startAttempt(
    tenantId: string,
    studentId: string,
    assessmentId: string,
    clientMeta: Record<string, any> = {}
  ): Promise<StartAttemptResult> {
    const supabase = createAdminClient();
    const now = new Date();

    // 0. Verify candidate is an active, non-archived student in this college tenant
    const { data: studentRecord, error: studentErr } = await supabase
      .from("students")
      .select(`
        id,
        is_archived,
        academic_status,
        department_id,
        graduation_year,
        degree,
        department:departments(name, code)
      `)
      .eq("tenant_id", tenantId)
      .eq("id", studentId)
      .maybeSingle();

    if (studentErr || !studentRecord || studentRecord.is_archived || studentRecord.academic_status !== "ACTIVE") {
      return {
        success: false,
        error: "Student profile not found, inactive, or not authorized for this college.",
      };
    }

    const rawDept = (studentRecord as any).department;
    const dept = Array.isArray(rawDept) ? rawDept[0] : rawDept;
    const studentProfile: StudentCohortProfile = {
      id: studentRecord.id,
      is_archived: studentRecord.is_archived,
      academic_status: studentRecord.academic_status,
      department_id: (studentRecord as any).department_id,
      graduation_year: (studentRecord as any).graduation_year,
      degree: (studentRecord as any).degree,
      department: dept,
    };

    // 1. Fetch assessment
    const { data: assessment, error: assErr } = await supabase
      .from("assessments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", assessmentId)
      .single();

    if (assErr || !assessment) {
      return { success: false, error: "Assessment not found." };
    }

    if (assessment.status !== "PUBLISHED") {
      return {
        success: false,
        error: "This assessment is not currently published for taking.",
      };
    }

    // 2. Check assignment window and attempt limits
    const { data: assignments } = await supabase
      .from("assessment_assignments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId)
      .eq("status", "ACTIVE")
      .or(`student_id.eq.${studentId},student_id.is.null`);

    if (!assignments || assignments.length === 0) {
      return {
        success: false,
        error: "You are not assigned to this assessment.",
      };
    }

    // Filter assignments that this student is actually eligible for:
    // Either directly assigned to this student, or matching cohort criteria
    const eligibleAssignments = assignments.filter((item: any) => {
      if (item.student_id === studentId) {
        return true;
      }
      if (item.student_id == null) {
        return studentMatchesCohort(studentProfile, item.cohort_name);
      }
      return false;
    });

    if (eligibleAssignments.length === 0) {
      return {
        success: false,
        error: "You are not assigned to this assessment.",
      };
    }

    // Direct student assignment takes precedence over cohort-wide
    const direct = eligibleAssignments.find((a) => a.student_id === studentId);
    const assignment = direct || eligibleAssignments[0];
    const matchedAssignmentId = assignment.id;

    let maxAllowedAttempts = assessment.allowed_attempts ?? 1;
    let windowStart: Date | null = null;
    let windowEnd: Date | null = null;

    if (assignment.max_attempts_override != null) {
      maxAllowedAttempts = assignment.max_attempts_override;
    }
    if (assignment.window_start) {
      windowStart = new Date(assignment.window_start);
    }
    if (assignment.window_end) {
      windowEnd = new Date(assignment.window_end);
    }

    if (windowStart && now < windowStart) {
      return {
        success: false,
        error: `Assessment window has not opened yet. Begins at ${windowStart.toISOString()}.`,
      };
    }

    if (windowEnd && now > windowEnd) {
      return {
        success: false,
        error: `Assessment window has closed. Ended at ${windowEnd.toISOString()}.`,
      };
    }

    // 3. Check existing attempts for this student
    const { data: existingAttempts } = await supabase
      .from("assessment_attempts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId)
      .eq("student_id", studentId)
      .order("attempt_number", { ascending: true });

    const attemptsList = existingAttempts || [];

    // Check if there is an active IN_PROGRESS attempt
    const activeAttempt = attemptsList.find((a) => a.status === "IN_PROGRESS");
    if (activeAttempt) {
      // Check if server timer expired while candidate was away
      if (activeAttempt.expires_at && new Date(activeAttempt.expires_at) < now) {
        // Auto-close expired attempt and trigger scoring
        await supabase
          .from("assessment_attempts")
          .update({
            status: "EXPIRED",
            submitted_at: activeAttempt.expires_at,
            updated_at: now.toISOString(),
          })
          .eq("id", activeAttempt.id);

        await AssessmentScoringService.scoreAttempt(tenantId, activeAttempt.id);
      } else {
        // Active attempt is valid; resume it
        const workspace = await this.getAttemptState(tenantId, studentId, activeAttempt.id);
        if (!workspace.success || !workspace.state) {
          return { success: false, error: workspace.error || "Failed to resume attempt." };
        }

        return {
          success: true,
          attempt: activeAttempt,
          questions: workspace.state.questions,
          remainingSeconds: workspace.state.remainingSeconds,
        };
      }
    }

    // 4. Re-evaluate attempt limits (re-fetch after potential auto-close)
    const { count: freshCount } = await supabase
      .from("assessment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .eq("assessment_id", assessmentId)
      .eq("student_id", studentId);

    const takenCount = freshCount || 0;
    if (takenCount >= maxAllowedAttempts) {
      return {
        success: false,
        error: `Maximum attempts limit reached (${maxAllowedAttempts} allowed).`,
      };
    }

    // 5. Compute server timestamps
    const startedAt = now.toISOString();
    const timeLimitMinutes = assessment.time_limit_minutes;
    const expiresAt = timeLimitMinutes
      ? new Date(now.getTime() + timeLimitMinutes * 60 * 1000).toISOString()
      : null;

    const newAttemptNumber = takenCount + 1;

    // 6. Insert new attempt
    const baseAttemptPayload: any = {
      tenant_id: tenantId,
      assessment_id: assessmentId,
      assignment_id: matchedAssignmentId,
      student_id: studentId,
      attempt_number: newAttemptNumber,
      status: "IN_PROGRESS",
      started_at: startedAt,
      expires_at: expiresAt,
      client_meta: {
        ...clientMeta,
        fullscreen_enforced: true,
        is_fullscreen_enforced: true,
        violation_count: 0,
        submission_reason: null,
      },
    };

    let newAttempt: any = null;
    let insErr: any = null;

    // Try extended schema with top-level security columns first
    try {
      const res1 = await supabase
        .from("assessment_attempts")
        .insert({
          ...baseAttemptPayload,
          is_fullscreen_enforced: true,
          violation_count: 0,
          submission_reason: null,
        })
        .select("*")
        .single();

      if (!res1.error && res1.data) {
        newAttempt = res1.data;
      } else {
        // Fallback to base canonical schema (storing security flags in client_meta)
        const res2 = await supabase
          .from("assessment_attempts")
          .insert(baseAttemptPayload)
          .select("*")
          .single();

        if (!res2.error && res2.data) {
          newAttempt = res2.data;
        } else {
          insErr = res2.error || res1.error;
        }
      }
    } catch (e: any) {
      const res2 = await supabase
        .from("assessment_attempts")
        .insert(baseAttemptPayload)
        .select("*")
        .single();

      if (!res2.error && res2.data) {
        newAttempt = res2.data;
      } else {
        insErr = res2.error || e;
      }
    }

    if (insErr || !newAttempt) {
      return { success: false, error: insErr?.message || "Failed to initialize attempt." };
    }

    // 7. Load question set items
    const { data: setQuestions, error: setErr } = await supabase
      .from("question_set_items")
      .select(`
        question_id,
        version_id,
        sequence_order,
        points,
        negative_points,
        question:questions!inner(
          id,
          question_type
        ),
        version:question_versions!inner(
          id,
          prompt,
          content_format,
          options,
          answer_key,
          difficulty,
          topic_tags
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", assessment.question_set_id)
      .order("sequence_order", { ascending: true });

    if (setErr || !setQuestions || setQuestions.length === 0) {
      return { success: false, error: "Question set is empty or missing." };
    }

    let itemsToPresent = [...setQuestions];
    if (assessment.shuffle_questions) {
      // Fisher-Yates shuffle
      for (let i = itemsToPresent.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [itemsToPresent[i], itemsToPresent[j]] = [itemsToPresent[j], itemsToPresent[i]];
      }
    }

    // 8. Pre-create blank attempt_responses rows to guarantee fast autosave matching
    const initialResponses = itemsToPresent.map((item, idx) => ({
      tenant_id: tenantId,
      attempt_id: newAttempt.id,
      question_id: item.question_id,
      version_id: item.version_id,
      response_payload: {},
      save_sequence: 1,
      is_flagged: false,
      is_answered: false,
    }));

    await supabase.from("attempt_responses").insert(initialResponses);

    // 9. Format sanitized questions (zero answer-key / explanation leakage to student)
    const sanitizedQuestions = itemsToPresent.map((item, idx) => {
      const q = item.question as any;
      const v = item.version as any;
      const sanitizedVer = QuestionService.sanitizeForStudent(v, q.question_type);

      return {
        questionId: item.question_id,
        versionId: item.version_id,
        questionType: q.question_type as QuestionType,
        sequenceOrder: idx + 1,
        points: Number(item.points || 1.0),
        negativePoints: Number(item.negative_points || 0.0),
        prompt: sanitizedVer.prompt,
        contentFormat: sanitizedVer.content_format || "MARKDOWN",
        options: sanitizedVer.options,
        difficulty: sanitizedVer.difficulty,
        topicTags: sanitizedVer.topic_tags || [],
      };
    });

    const remainingSeconds = expiresAt
      ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
      : null;

    return {
      success: true,
      attempt: newAttempt,
      questions: sanitizedQuestions,
      remainingSeconds,
    };
  }

  /**
   * Retrieves the current taking workspace state for a candidate attempt.
   */
  public static async getAttemptState(
    tenantId: string,
    studentId: string,
    attemptId: string
  ): Promise<{ success: boolean; state?: AttemptWorkspaceState; error?: string }> {
    const supabase = createAdminClient();
    const now = new Date();

    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select(`
        *,
        assessment:assessments!inner(
          id,
          title,
          description,
          time_limit_minutes,
          pass_percentage,
          review_policy,
          release_policy,
          question_set_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("id", attemptId)
      .single();

    if (attErr || !attempt) {
      return { success: false, error: "Attempt not found." };
    }

    if (attempt.student_id !== studentId) {
      return { success: false, error: "Unauthorized access to this attempt." };
    }

    const assessment = (attempt as any).assessment;

    // Check expiration if still in progress
    if (attempt.status === "IN_PROGRESS" && attempt.expires_at) {
      if (new Date(attempt.expires_at) < now) {
        await supabase
          .from("assessment_attempts")
          .update({
            status: "EXPIRED",
            submitted_at: attempt.expires_at,
            updated_at: now.toISOString(),
          })
          .eq("id", attemptId);

        await AssessmentScoringService.scoreAttempt(tenantId, attemptId);
        attempt.status = "EXPIRED";
      }
    }

    // Fetch question set items
    const { data: setQuestions } = await supabase
      .from("question_set_items")
      .select(`
        question_id,
        version_id,
        sequence_order,
        points,
        negative_points,
        question:questions!inner(
          id,
          question_type
        ),
        version:question_versions!inner(
          id,
          prompt,
          content_format,
          options,
          answer_key,
          difficulty,
          topic_tags
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", assessment.question_set_id)
      .order("sequence_order", { ascending: true });

    // Fetch candidate's saved responses
    const { data: responses } = await supabase
      .from("attempt_responses")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("attempt_id", attemptId);

    const respMap = new Map<string, any>();
    (responses || []).forEach((r) => respMap.set(r.question_id, r));

    const sanitizedQuestions = (setQuestions || []).map((item, idx) => {
      const q = item.question as any;
      const v = item.version as any;
      const sanitizedVer = QuestionService.sanitizeForStudent(v, q.question_type);
      const saved = respMap.get(item.question_id);

      return {
        questionId: item.question_id,
        versionId: item.version_id,
        questionType: q.question_type as QuestionType,
        sequenceOrder: idx + 1,
        points: Number(item.points || 1.0),
        negativePoints: Number(item.negative_points || 0.0),
        prompt: sanitizedVer.prompt,
        contentFormat: sanitizedVer.content_format || "MARKDOWN",
        options: sanitizedVer.options,
        difficulty: sanitizedVer.difficulty,
        topicTags: sanitizedVer.topic_tags || [],
        savedResponse: saved
          ? {
              payload: saved.response_payload,
              saveSequence: Number(saved.save_sequence || 1),
              isFlagged: Boolean(saved.is_flagged),
              isAnswered: Boolean(saved.is_answered),
              lastSavedAt: saved.last_saved_at,
            }
          : null,
      };
    });

    const remainingSeconds = attempt.expires_at
      ? Math.max(0, Math.floor((new Date(attempt.expires_at).getTime() - Date.now()) / 1000))
      : null;

    const state: AttemptWorkspaceState = {
      attempt,
      assessment: {
        id: assessment.id,
        title: assessment.title,
        description: assessment.description,
        timeLimitMinutes: assessment.time_limit_minutes,
        passPercentage: Number(assessment.pass_percentage ?? 60.0),
        reviewPolicy: assessment.review_policy,
        releasePolicy: assessment.release_policy,
      },
      remainingSeconds,
      questions: sanitizedQuestions,
    };

    return { success: true, state };
  }

  /**
   * Finalizes and submits an assessment attempt, triggering automatic scoring.
   */
  /**
   * Finalizes and submits an assessment attempt, triggering automatic scoring.
   * Fully idempotent: returns the finalized attempt if already submitted.
   */
  public static async submitAttempt(
    tenantId: string,
    studentId: string,
    attemptId: string,
    submissionReason: string = "MANUAL",
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; attempt?: AssessmentAttemptRow; alreadySubmitted?: boolean; error?: string }> {
    const supabase = createAdminClient();
    const now = new Date();

    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", attemptId)
      .single();

    if (attErr || !attempt) {
      return { success: false, error: "Attempt not found." };
    }

    if (attempt.student_id !== studentId) {
      return { success: false, error: "Unauthorized: not your attempt." };
    }

    // Idempotency: If attempt is already submitted/expired/scored, return existing record
    if (attempt.status !== "IN_PROGRESS") {
      return {
        success: true,
        attempt,
        alreadySubmitted: true,
      };
    }

    const isExpired = attempt.expires_at && new Date(attempt.expires_at) < now;
    const finalStatus: AttemptStatus = isExpired ? "EXPIRED" : "SUBMITTED";
    const effectiveReason = isExpired && submissionReason === "MANUAL" ? "TIMEOUT" : submissionReason;

    const existingMeta =
      typeof attempt.client_meta === "object" && attempt.client_meta !== null
        ? (attempt.client_meta as Record<string, any>)
        : {};

    const baseUpdatePayload: any = {
      status: finalStatus,
      submitted_at: now.toISOString(),
      updated_at: now.toISOString(),
      client_meta: {
        ...existingMeta,
        ...metadata,
        submission_reason: effectiveReason,
        final_submission_reason: effectiveReason,
        finalized_at: now.toISOString(),
      },
    };

    let updatedAttempt: any = null;
    let upErr: any = null;

    try {
      const upRes1 = await supabase
        .from("assessment_attempts")
        .update({
          ...baseUpdatePayload,
          submission_reason: effectiveReason,
        })
        .eq("id", attemptId)
        .select("*")
        .single();

      if (!upRes1.error && upRes1.data) {
        updatedAttempt = upRes1.data;
      } else {
        const upRes2 = await supabase
          .from("assessment_attempts")
          .update(baseUpdatePayload)
          .eq("id", attemptId)
          .select("*")
          .single();

        if (!upRes2.error && upRes2.data) {
          updatedAttempt = upRes2.data;
        } else {
          upErr = upRes2.error || upRes1.error;
        }
      }
    } catch {
      const upRes2 = await supabase
        .from("assessment_attempts")
        .update(baseUpdatePayload)
        .eq("id", attemptId)
        .select("*")
        .single();

      if (!upRes2.error && upRes2.data) {
        updatedAttempt = upRes2.data;
      } else {
        upErr = upRes2.error;
      }
    }

    if (upErr || !updatedAttempt) {
      return { success: false, error: upErr?.message || "Failed to submit attempt." };
    }

    // Trigger server-side scoring
    await AssessmentScoringService.scoreAttempt(tenantId, attemptId);

    // Re-fetch scored attempt
    const { data: finalScored } = await supabase
      .from("assessment_attempts")
      .select("*")
      .eq("id", attemptId)
      .single();

    return { success: true, attempt: finalScored || updatedAttempt };
  }

  /**
   * Records an examination security violation and optionally triggers immediate auto-submission.
   */
  public static async recordViolation(
    tenantId: string,
    studentId: string,
    input: {
      attemptId: string;
      violationType: AssessmentViolationType;
      metadata?: Record<string, any>;
      autoSubmit?: boolean;
    }
  ): Promise<{
    success: boolean;
    violationId?: string;
    autoSubmitted?: boolean;
    attempt?: AssessmentAttemptRow;
    alreadySubmitted?: boolean;
    error?: string;
  }> {
    const supabase = createAdminClient();
    const now = new Date();

    // 1. Fetch attempt and verify ownership
    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select("id, tenant_id, assessment_id, student_id, status, client_meta")
      .eq("tenant_id", tenantId)
      .eq("id", input.attemptId)
      .single();

    if (attErr || !attempt) {
      return { success: false, error: "Attempt not found." };
    }

    if (attempt.student_id !== studentId) {
      return { success: false, error: "Unauthorized: not your attempt." };
    }

    // If attempt is already submitted/closed, avoid duplicate violations & submissions
    if (attempt.status !== "IN_PROGRESS") {
      return {
        success: true,
        alreadySubmitted: true,
        autoSubmitted: false,
        attempt: attempt as any,
      };
    }

    // Configured violations that trigger automatic submission
    const AUTO_SUBMIT_VIOLATIONS: AssessmentViolationType[] = [
      "TAB_SWITCH",
      "DOCUMENT_HIDDEN",
      "WINDOW_FOCUS_LOST",
      "WINDOW_BLUR",
      "FULLSCREEN_EXIT",
      "NAVIGATION_AWAY",
      "PAGE_HIDDEN",
    ];

    const shouldAutoSubmit =
      input.autoSubmit === true || AUTO_SUBMIT_VIOLATIONS.includes(input.violationType);

    const existingMeta =
      typeof attempt.client_meta === "object" && attempt.client_meta !== null
        ? (attempt.client_meta as Record<string, any>)
        : {};
    const existingViolations = Array.isArray(existingMeta.violations) ? existingMeta.violations : [];
    const currentCount = Number(existingMeta.violation_count || existingViolations.length || 0) + 1;

    let violationId: string = crypto.randomUUID();

    // 2. Insert violation record (if assessment_violations table exists in remote DB)
    try {
      const { data: vData } = await supabase
        .from("assessment_violations")
        .insert({
          tenant_id: tenantId,
          attempt_id: input.attemptId,
          assessment_id: attempt.assessment_id,
          student_id: studentId,
          violation_type: input.violationType,
          metadata: input.metadata || {},
          triggered_submission: shouldAutoSubmit,
        })
        .select("id")
        .single();
      if (vData?.id) {
        violationId = vData.id;
      }
    } catch {
      // Table may not exist in remote DB; violation is safely recorded in client_meta
    }

    // 3. Update violation count and log in client_meta & attempt
    const updatedMeta = {
      ...existingMeta,
      violation_count: currentCount,
      violations: [
        ...existingViolations,
        {
          id: violationId,
          violation_type: input.violationType,
          timestamp: now.toISOString(),
          metadata: input.metadata || {},
          triggered_submission: shouldAutoSubmit,
        },
      ],
      last_violation_at: now.toISOString(),
    };

    try {
      await supabase
        .from("assessment_attempts")
        .update({
          violation_count: currentCount,
          client_meta: updatedMeta,
          updated_at: now.toISOString(),
        })
        .eq("id", input.attemptId);
    } catch {
      await supabase
        .from("assessment_attempts")
        .update({
          client_meta: updatedMeta,
          updated_at: now.toISOString(),
        })
        .eq("id", input.attemptId);
    }

    // 4. Trigger auto-submission if required
    if (shouldAutoSubmit) {
      const subRes = await this.submitAttempt(
        tenantId,
        studentId,
        input.attemptId,
        `AUTO:${input.violationType}`,
        {
          triggering_violation_id: violationId,
          violation_type: input.violationType,
          ...input.metadata,
        }
      );

      return {
        success: true,
        violationId,
        autoSubmitted: true,
        attempt: subRes.attempt,
      };
    }

    return {
      success: true,
      violationId,
      autoSubmitted: false,
    };
  }

  /**
   * Retrieves results and question-level review while strictly respecting
   * the assessment release policy.
   */
  public static async getAttemptResult(
    tenantId: string,
    userId: string,
    attemptId: string,
    isStaff: boolean
  ): Promise<{
    success: boolean;
    isReleased: boolean;
    isScoreReleased?: boolean;
    isReviewable?: boolean;
    isAnswerKeyReleased?: boolean;
    reviewPolicy?: string;
    releasePolicy?: string;
    deadline?: string | null;
    attempt?: AssessmentAttemptRow;
    breakdown?: any;
    error?: string;
  }> {
    const supabase = createAdminClient();

    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select(`
        *,
        assessment:assessments!inner(
          id,
          title,
          pass_percentage,
          review_policy,
          release_policy,
          question_set_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("id", attemptId)
      .single();

    if (attErr || !attempt) {
      return { success: false, isReleased: false, error: "Attempt not found." };
    }

    if (!isStaff) {
      let currentStudentId: string | null = null;
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (student) {
        currentStudentId = student.id;
      }

      if (!currentStudentId || currentStudentId !== attempt.student_id) {
        return {
          success: false,
          isReleased: false,
          error: "Unauthorized: You cannot access another student's attempt.",
        };
      }
    }

    const assessment = (attempt as any).assessment;
    const releasePolicy = assessment?.release_policy || "IMMEDIATE";
    const reviewPolicy = assessment?.review_policy || "IMMEDIATE";

    // Resolve assignment deadline window
    let assignmentWindowEnd: string | null = null;
    if (attempt.assignment_id) {
      const { data: directAss } = await supabase
        .from("assessment_assignments")
        .select("window_end")
        .eq("id", attempt.assignment_id)
        .maybeSingle();
      if (directAss?.window_end) {
        assignmentWindowEnd = directAss.window_end;
      }
    }
    if (!assignmentWindowEnd && assessment?.id) {
      try {
        let q: any = supabase
          .from("assessment_assignments")
          .select("window_end")
          .eq("tenant_id", tenantId)
          .eq("assessment_id", assessment.id);

        if (typeof q.or === "function") {
          q = q.or(`student_id.eq.${attempt.student_id},student_id.is.null`);
        }
        if (typeof q.order === "function") {
          q = q.order("student_id", { ascending: false, nullsFirst: false });
        }
        if (typeof q.limit === "function") {
          q = q.limit(1);
        }

        const res = typeof q.maybeSingle === "function" ? await q.maybeSingle() : await q;
        const fallbackData = res?.data;
        if (Array.isArray(fallbackData) && fallbackData[0]?.window_end) {
          assignmentWindowEnd = fallbackData[0].window_end;
        } else if (fallbackData?.window_end) {
          assignmentWindowEnd = fallbackData.window_end;
        }
      } catch {
        // Fallback for mock environments where chained filters are not fully implemented
      }
    }

    const now = new Date();
    const isDeadlinePassed = assignmentWindowEnd ? now >= new Date(assignmentWindowEnd) : false;

    // 1. Release Policy: Governs when scores, marks, and pass/fail metrics are released to candidate
    let isScoreReleased = isStaff;
    if (!isStaff) {
      if (releasePolicy === "IMMEDIATE") {
        isScoreReleased = ["SCORED", "RESULT_RELEASED"].includes(attempt.status);
      } else if (releasePolicy === "MANUAL_STAFF_RELEASE") {
        isScoreReleased = attempt.status === "RESULT_RELEASED";
      } else if (releasePolicy === "AFTER_DEADLINE") {
        isScoreReleased = isDeadlinePassed || attempt.status === "RESULT_RELEASED";
      }
    }

    // 2. Review Policy: Governs when detailed question-level breakdown and submitted answers can be reviewed
    let isReviewable = isStaff;
    if (!isStaff) {
      if (reviewPolicy === "IMMEDIATE") {
        isReviewable = true;
      } else if (reviewPolicy === "AFTER_DEADLINE") {
        isReviewable = isDeadlinePassed || attempt.status === "RESULT_RELEASED";
      } else if (reviewPolicy === "NEVER") {
        isReviewable = false;
      }
    }

    // 3. Answer Key Release: Solutions and explanations require BOTH score release and review permission
    const isAnswerKeyReleased = isStaff || (isScoreReleased && isReviewable);

    // Backward compatibility: isReleased reflects score release
    const isReleased = isScoreReleased;

    // Fetch responses with question and version data
    const { data: responses } = await supabase
      .from("attempt_responses")
      .select(`
        id,
        question_id,
        version_id,
        response_payload,
        is_flagged,
        is_answered,
        points_awarded,
        is_correct,
        scoring_status,
        manual_notes,
        question:questions!inner(
          id,
          question_type
        ),
        version:question_versions!inner(
          id,
          prompt,
          content_format,
          options,
          answer_key,
          explanation,
          difficulty,
          topic_tags,
          skill_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("attempt_id", attemptId);

    const formattedResponses = (responses || []).map((r) => {
      const q = r.question as any;
      const v = r.version as any;
      const payload = r.response_payload || {};

      const formatOptionText = (options: any, raw: any): string => {
        if (raw === null || raw === undefined || raw === "") return "None";
        const idStr = String(raw).trim();
        if (Array.isArray(options)) {
          const match = options.find(
            (opt: any) =>
              opt &&
              (String(opt.id).toLowerCase() === idStr.toLowerCase() ||
                String(opt.text).trim().toLowerCase() === idStr.toLowerCase())
          );
          if (match) {
            return match.text || match.option_text || match.label || idStr;
          }
        }
        return idStr;
      };

      let studentAnswerText = "None";
      if (q.question_type === "SINGLE_CHOICE") {
        const rawChoice = payload.selected_option ?? payload.selected_option_id;
        studentAnswerText = rawChoice !== undefined && rawChoice !== null ? formatOptionText(v.options, rawChoice) : "None";
      } else if (q.question_type === "MULTIPLE_SELECT") {
        const rawList = Array.isArray(payload.selected_options) ? payload.selected_options : [];
        studentAnswerText =
          rawList.length > 0
            ? rawList.map((id: string) => formatOptionText(v.options, id)).join(", ")
            : "None";
      } else if (q.question_type === "NUMERIC") {
        studentAnswerText = payload.numeric_value !== undefined ? String(payload.numeric_value) : "None";
      } else if (q.question_type === "SHORT_ANSWER") {
        studentAnswerText = payload.text || payload.answer || "No response";
      } else if (q.question_type === "CODING") {
        studentAnswerText = payload.code || "No code submitted";
      }

      const safePointsAwarded = (isScoreReleased || isStaff) ? r.points_awarded : null;
      const safeIsCorrect = (isScoreReleased || isStaff) ? r.is_correct : null;
      const safeScoringStatus = (isScoreReleased || isStaff) ? r.scoring_status : "PENDING_RELEASE";

      if (!isAnswerKeyReleased && !isStaff) {
        // Mask answer keys and explanations; also mask points if score is not released
        return {
          questionId: r.question_id,
          questionType: q.question_type,
          prompt: v.prompt,
          contentFormat: v.content_format,
          options: v.options,
          isAnswered: r.is_answered,
          studentAnswer: r.response_payload,
          studentAnswerText,
          pointsAwarded: safePointsAwarded,
          isCorrect: safeIsCorrect,
          scoringStatus: safeScoringStatus,
          answerKey: null,
          correctAnswerText: null,
          explanation: null,
        };
      }

      // Full released review
      const ak = v.answer_key || {};
      let correctAnswerText = "";
      if (q.question_type === "SINGLE_CHOICE") {
        const rawCorrect = ak.correct_option_id ?? ak.correct_option ?? ak.correctOptionId;
        correctAnswerText = rawCorrect ? formatOptionText(v.options, rawCorrect) : "";
      } else if (q.question_type === "MULTIPLE_SELECT") {
        const rawCorrectList = Array.isArray(ak.correct_option_ids)
          ? ak.correct_option_ids
          : Array.isArray(ak.correct_options)
          ? ak.correct_options
          : [];
        correctAnswerText = rawCorrectList.map((id: string) => formatOptionText(v.options, id)).join(", ");
      } else if (q.question_type === "NUMERIC") {
        correctAnswerText = String((ak.value !== undefined ? ak.value : ak.correct_value) ?? "");
      }

      return {
        questionId: r.question_id,
        questionType: q.question_type,
        prompt: v.prompt,
        contentFormat: v.content_format,
        options: v.options,
        isAnswered: r.is_answered,
        studentAnswer: r.response_payload,
        studentAnswerText,
        pointsAwarded: safePointsAwarded,
        isCorrect: safeIsCorrect,
        scoringStatus: safeScoringStatus,
        manualNotes: (isStaff || isScoreReleased) ? r.manual_notes : null,
        answerKey: v.answer_key,
        correctAnswerText,
        explanation: v.explanation,
        difficulty: v.difficulty,
        topicTags: v.topic_tags,
      };
    });

    // Fetch security violations recorded for this attempt
    let violations: any[] = [];
    try {
      const { data: vList } = await supabase
        .from("assessment_violations")
        .select("id, violation_type, triggered_submission, created_at, metadata")
        .eq("tenant_id", tenantId)
        .eq("attempt_id", attemptId)
        .order("created_at", { ascending: true });
      if (vList) violations = vList;
    } catch {
      // Table may not exist; fallback to client_meta
    }

    const clientMeta = (attempt.client_meta && typeof attempt.client_meta === "object") ? attempt.client_meta : {};
    if (violations.length === 0 && Array.isArray((clientMeta as any).violations)) {
      violations = (clientMeta as any).violations;
    }

    // If candidate review is locked or not permitted by review policy, withhold questions array
    const safeQuestions = (isReviewable || isStaff) ? formattedResponses : [];

    const safeTotalPoints = Number(attempt.total_points ?? 0);
    const safeEarnedPoints = (isScoreReleased || isStaff) ? Number(attempt.earned_points ?? 0) : null;
    const safeScorePercentage = (isScoreReleased || isStaff) ? Number(attempt.score_percentage ?? 0) : null;
    const safeIsPassed = (isScoreReleased || isStaff) ? Boolean(attempt.is_passed) : null;
    const safeScoringStatus = (isScoreReleased || isStaff) ? attempt.scoring_status : "PENDING_RELEASE";

    return {
      success: true,
      isReleased: isScoreReleased,
      isScoreReleased,
      isReviewable,
      isAnswerKeyReleased,
      reviewPolicy,
      releasePolicy,
      deadline: assignmentWindowEnd,
      attempt: {
        ...attempt,
        earned_points: safeEarnedPoints,
        score_percentage: safeScorePercentage,
        is_passed: safeIsPassed,
        scoring_status: safeScoringStatus,
      },
      breakdown: {
        assessmentTitle: assessment.title,
        passPercentage: Number(assessment.pass_percentage ?? 60.0),
        totalPoints: safeTotalPoints,
        earnedPoints: safeEarnedPoints,
        scorePercentage: safeScorePercentage,
        isPassed: safeIsPassed,
        scoringStatus: safeScoringStatus,
        isScoreReleased,
        isReviewable,
        isAnswerKeyReleased,
        reviewPolicy,
        releasePolicy,
        deadline: assignmentWindowEnd,
        submissionReason: (attempt as any).submission_reason || (clientMeta as any).submission_reason || "MANUAL",
        violationCount: Number((attempt as any).violation_count ?? (clientMeta as any).violation_count ?? violations.length),
        violations: violations || [],
        questions: safeQuestions,
      },
    };
  }
}
