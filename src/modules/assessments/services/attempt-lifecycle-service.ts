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
} from "@/types/database";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { AssessmentScoringService } from "./assessment-scoring-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
    const supabase = await createServerSupabaseClient();
    const now = new Date();

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
      .or(`student_id.eq.${studentId},student_id.is.null`);

    let maxAllowedAttempts = assessment.allowed_attempts ?? 1;
    let windowStart: Date | null = null;
    let windowEnd: Date | null = null;
    let matchedAssignmentId: string | null = null;

    if (assignments && assignments.length > 0) {
      // Direct student assignment takes precedence over cohort-wide
      const direct = assignments.find((a) => a.student_id === studentId);
      const assignment = direct || assignments[0];
      matchedAssignmentId = assignment.id;

      if (assignment.max_attempts_override != null) {
        maxAllowedAttempts = assignment.max_attempts_override;
      }
      if (assignment.window_start) {
        windowStart = new Date(assignment.window_start);
      }
      if (assignment.window_end) {
        windowEnd = new Date(assignment.window_end);
      }
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
    const { data: newAttempt, error: insErr } = await supabase
      .from("assessment_attempts")
      .insert({
        tenant_id: tenantId,
        assessment_id: assessmentId,
        assignment_id: matchedAssignmentId,
        student_id: studentId,
        attempt_number: newAttemptNumber,
        status: "IN_PROGRESS",
        started_at: startedAt,
        expires_at: expiresAt,
        client_meta: clientMeta,
      })
      .select("*")
      .single();

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
    const supabase = await createServerSupabaseClient();
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
  public static async submitAttempt(
    tenantId: string,
    studentId: string,
    attemptId: string
  ): Promise<{ success: boolean; attempt?: AssessmentAttemptRow; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const now = new Date();

    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select("id, status, expires_at, student_id")
      .eq("tenant_id", tenantId)
      .eq("id", attemptId)
      .single();

    if (attErr || !attempt) {
      return { success: false, error: "Attempt not found." };
    }

    if (attempt.student_id !== studentId) {
      return { success: false, error: "Unauthorized: not your attempt." };
    }

    if (attempt.status !== "IN_PROGRESS") {
      return {
        success: false,
        error: `Attempt has already been submitted or closed (status: ${attempt.status}).`,
      };
    }

    const isExpired = attempt.expires_at && new Date(attempt.expires_at) < now;
    const finalStatus: AttemptStatus = isExpired ? "EXPIRED" : "SUBMITTED";

    const { data: updatedAttempt, error: upErr } = await supabase
      .from("assessment_attempts")
      .update({
        status: finalStatus,
        submitted_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", attemptId)
      .select("*")
      .single();

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
    attempt?: AssessmentAttemptRow;
    breakdown?: any;
    error?: string;
  }> {
    const supabase = await createServerSupabaseClient();

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
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("user_id", userId)
        .maybeSingle();

      if (student && student.id !== attempt.student_id) {
        return {
          success: false,
          isReleased: false,
          error: "Unauthorized: You cannot access another student's attempt.",
        };
      }
    }

    const assessment = (attempt as any).assessment;
    const releasePolicy = assessment.release_policy;

    let isReleased = isStaff; // Staff always has access
    if (!isStaff) {
      if (releasePolicy === "IMMEDIATE") {
        isReleased = ["SCORED", "RESULT_RELEASED"].includes(attempt.status);
      } else if (releasePolicy === "MANUAL_STAFF_RELEASE") {
        isReleased = attempt.status === "RESULT_RELEASED";
      } else if (releasePolicy === "AFTER_DEADLINE") {
        // Check assignment deadline
        const { data: assignment } = await supabase
          .from("assessment_assignments")
          .select("window_end")
          .eq("id", attempt.assignment_id || "")
          .maybeSingle();

        if (assignment?.window_end && new Date() >= new Date(assignment.window_end)) {
          isReleased = true;
        } else {
          isReleased = attempt.status === "RESULT_RELEASED";
        }
      }
    }

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

      if (!isReleased && !isStaff) {
        // Mask answer keys and explanations
        return {
          questionId: r.question_id,
          questionType: q.question_type,
          prompt: v.prompt,
          contentFormat: v.content_format,
          options: v.options,
          isAnswered: r.is_answered,
          studentAnswer: r.response_payload,
          pointsAwarded: r.points_awarded,
          isCorrect: r.is_correct,
          scoringStatus: r.scoring_status,
          answerKey: null,
          explanation: null,
        };
      }

      // Full released review
      return {
        questionId: r.question_id,
        questionType: q.question_type,
        prompt: v.prompt,
        contentFormat: v.content_format,
        options: v.options,
        isAnswered: r.is_answered,
        studentAnswer: r.response_payload,
        pointsAwarded: r.points_awarded,
        isCorrect: r.is_correct,
        scoringStatus: r.scoring_status,
        manualNotes: r.manual_notes,
        answerKey: v.answer_key,
        explanation: v.explanation,
        difficulty: v.difficulty,
        topicTags: v.topic_tags,
      };
    });

    return {
      success: true,
      isReleased,
      attempt,
      breakdown: {
        assessmentTitle: assessment.title,
        passPercentage: Number(assessment.pass_percentage ?? 60.0),
        totalPoints: Number(attempt.total_points ?? 0),
        earnedPoints: Number(attempt.earned_points ?? 0),
        scorePercentage: Number(attempt.score_percentage ?? 0),
        isPassed: Boolean(attempt.is_passed),
        scoringStatus: attempt.scoring_status,
        questions: formattedResponses,
      },
    };
  }
}
