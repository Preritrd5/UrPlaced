/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Assessment Engine: Deterministic Server-Side Scoring Service
 * ==============================================================================
 * Enforces server-authoritative scoring across objective types, manual review markers
 * for subjective types, and pre-conditions for Phase 08 Mistake Bank integration.
 */

import {
  AttemptResponseRow,
  QuestionVersionRow,
  QuestionType,
  ResponseScoringStatus,
  AttemptScoringStatus,
} from "@/types/database";
import { IsolatedRunnerBoundary } from "./isolated-runner-boundary";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface ItemEvaluationResult {
  questionId: string;
  versionId: string;
  isCorrect: boolean | null;
  pointsAwarded: number;
  scoringStatus: ResponseScoringStatus;
  notes?: string;
}

export interface AttemptScoringSummary {
  attemptId: string;
  totalPoints: number;
  earnedPoints: number;
  scorePercentage: number;
  isPassed: boolean;
  scoringStatus: AttemptScoringStatus;
  items: ItemEvaluationResult[];
  mistakeBankEntries: Array<{
    questionId: string;
    versionId: string;
    skillId: string | null;
    topicTags: string[];
    prompt: string;
    difficulty: string;
    studentAnswer: any;
    explanation: string | null;
  }>;
}

export class AssessmentScoringService {
  /**
   * Deterministically evaluates an objective or coding question response.
   */
  public static async evaluateResponse(
    questionType: QuestionType,
    version: QuestionVersionRow,
    points: number,
    negativePoints: number,
    responsePayload: Record<string, any> | null
  ): Promise<{
    isCorrect: boolean | null;
    pointsAwarded: number;
    scoringStatus: ResponseScoringStatus;
    notes?: string;
  }> {
    if (!responsePayload || Object.keys(responsePayload).length === 0) {
      // Unanswered question
      return {
        isCorrect: false,
        pointsAwarded: 0,
        scoringStatus: "AUTOMATICALLY_SCORED",
        notes: "Unanswered",
      };
    }

    const answerKey = (version.answer_key || {}) as Record<string, any>;

    switch (questionType) {
      case "SINGLE_CHOICE": {
        const studentChoice =
          responsePayload.selected_option ??
          (Array.isArray(responsePayload.selected_options)
            ? responsePayload.selected_options[0]
            : null);

        const correctChoice =
          answerKey.correct_option ??
          (Array.isArray(answerKey.correct_options)
            ? answerKey.correct_options[0]
            : null);

        if (!studentChoice) {
          return {
            isCorrect: false,
            pointsAwarded: 0,
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "No option selected",
          };
        }

        const isCorrect = String(studentChoice).trim() === String(correctChoice).trim();
        const pointsAwarded = isCorrect
          ? Number(points)
          : negativePoints > 0
          ? -Number(negativePoints)
          : 0;

        return {
          isCorrect,
          pointsAwarded,
          scoringStatus: "AUTOMATICALLY_SCORED",
        };
      }

      case "MULTIPLE_SELECT": {
        const studentChoices: string[] = Array.isArray(responsePayload.selected_options)
          ? responsePayload.selected_options.map((s) => String(s).trim()).sort()
          : [];

        const correctChoices: string[] = Array.isArray(answerKey.correct_options)
          ? answerKey.correct_options.map((s) => String(s).trim()).sort()
          : [];

        if (studentChoices.length === 0) {
          return {
            isCorrect: false,
            pointsAwarded: 0,
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "No options selected",
          };
        }

        const isMatch =
          studentChoices.length === correctChoices.length &&
          studentChoices.every((val, idx) => val === correctChoices[idx]);

        const pointsAwarded = isMatch
          ? Number(points)
          : negativePoints > 0
          ? -Number(negativePoints)
          : 0;

        return {
          isCorrect: isMatch,
          pointsAwarded,
          scoringStatus: "AUTOMATICALLY_SCORED",
        };
      }

      case "NUMERIC": {
        const studentVal = Number(responsePayload.numeric_value);
        const correctVal = Number(answerKey.correct_value);
        const tolerance = Number(answerKey.tolerance ?? 0);

        if (isNaN(studentVal) || isNaN(correctVal)) {
          return {
            isCorrect: false,
            pointsAwarded: 0,
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "Invalid numeric entry",
          };
        }

        const isCorrect = Math.abs(studentVal - correctVal) <= tolerance;
        const pointsAwarded = isCorrect
          ? Number(points)
          : negativePoints > 0
          ? -Number(negativePoints)
          : 0;

        return {
          isCorrect,
          pointsAwarded,
          scoringStatus: "AUTOMATICALLY_SCORED",
        };
      }

      case "SHORT_ANSWER": {
        return {
          isCorrect: null,
          pointsAwarded: 0,
          scoringStatus: "MANUAL_REVIEW_REQUIRED",
          notes: "Awaiting staff manual evaluation.",
        };
      }

      case "CODING": {
        const language = responsePayload.language || "python";
        const code = responsePayload.code || "";
        const testCases = Array.isArray(answerKey.test_cases)
          ? answerKey.test_cases
          : [];

        if (!code || code.trim() === "") {
          return {
            isCorrect: false,
            pointsAwarded: 0,
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "No code submitted",
          };
        }

        const runResult = await IsolatedRunnerBoundary.executeCode(
          language,
          code,
          testCases
        );

        if (!runResult.runnerAvailable) {
          return {
            isCorrect: null,
            pointsAwarded: 0,
            scoringStatus: "MANUAL_REVIEW_REQUIRED",
            notes: runResult.message,
          };
        }

        const isCorrect = runResult.allPassed;
        const pointsAwarded = isCorrect ? Number(points) : 0;

        return {
          isCorrect,
          pointsAwarded,
          scoringStatus: "AUTOMATICALLY_SCORED",
          notes: runResult.message,
        };
      }

      default:
        return {
          isCorrect: null,
          pointsAwarded: 0,
          scoringStatus: "MANUAL_REVIEW_REQUIRED",
        };
    }
  }

  /**
   * Scores an entire attempt from database records, persists granular question scores,
   * updates the overall attempt record, and prepares Mistake Bank entries.
   */
  public static async scoreAttempt(
    tenantId: string,
    attemptId: string
  ): Promise<{ success: boolean; summary?: AttemptScoringSummary; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch attempt and parent assessment
    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select(`
        id,
        tenant_id,
        assessment_id,
        student_id,
        status,
        assessment:assessments!inner(
          id,
          pass_percentage,
          release_policy,
          question_set_id
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("id", attemptId)
      .single();

    if (attErr || !attempt) {
      return { success: false, error: "Assessment attempt not found." };
    }

    const assessment = (attempt as any).assessment;
    const passPercentage = Number(assessment.pass_percentage ?? 60.0);

    // 2. Fetch question set items with their immutable versions
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
          answer_key,
          explanation,
          difficulty,
          skill_id,
          topic_tags
        )
      `)
      .eq("tenant_id", tenantId)
      .eq("set_id", assessment.question_set_id);

    if (setErr || !setQuestions || setQuestions.length === 0) {
      return { success: false, error: "Unable to retrieve question set items for scoring." };
    }

    // 3. Fetch candidate's saved responses
    const { data: responses, error: respErr } = await supabase
      .from("attempt_responses")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("attempt_id", attemptId);

    if (respErr) {
      return { success: false, error: respErr.message };
    }

    const responseMap = new Map<string, AttemptResponseRow>();
    (responses || []).forEach((r) => responseMap.set(r.question_id, r));

    // 4. Calculate total points and evaluate each question
    let totalPoints = 0;
    let earnedPoints = 0;
    let hasManualReview = false;
    const evaluatedItems: ItemEvaluationResult[] = [];
    const mistakeBankEntries: AttemptScoringSummary["mistakeBankEntries"] = [];

    for (const item of setQuestions) {
      const qId = item.question_id;
      const qType = (item.question as any).question_type as QuestionType;
      const ver = (item.version as any) as QuestionVersionRow;
      const maxPts = Number(item.points || 1.0);
      const negPts = Number(item.negative_points || 0.0);
      totalPoints += maxPts;

      const studentResp = responseMap.get(qId);
      const payload = (studentResp?.response_payload as Record<string, any>) || null;

      const evalRes = await this.evaluateResponse(qType, ver, maxPts, negPts, payload);

      if (evalRes.scoringStatus === "MANUAL_REVIEW_REQUIRED") {
        hasManualReview = true;
      }

      earnedPoints += evalRes.pointsAwarded;

      evaluatedItems.push({
        questionId: qId,
        versionId: item.version_id,
        isCorrect: evalRes.isCorrect,
        pointsAwarded: evalRes.pointsAwarded,
        scoringStatus: evalRes.scoringStatus,
        notes: evalRes.notes,
      });

      // Update attempt_responses record
      if (studentResp) {
        await supabase
          .from("attempt_responses")
          .update({
            points_awarded: evalRes.pointsAwarded,
            is_correct: evalRes.isCorrect,
            scoring_status: evalRes.scoringStatus,
            manual_notes: evalRes.notes || null,
          })
          .eq("id", studentResp.id);
      }

      // Collect mistake bank items: where student answered and is incorrect
      if (evalRes.isCorrect === false && payload) {
        mistakeBankEntries.push({
          questionId: qId,
          versionId: item.version_id,
          skillId: ver.skill_id,
          topicTags: ver.topic_tags || [],
          prompt: ver.prompt,
          difficulty: ver.difficulty,
          studentAnswer: payload,
          explanation: ver.explanation,
        });
      }
    }

    // Clamp earned points to 0 if negative
    const finalEarnedPoints = Math.max(0, earnedPoints);
    const scorePercentage =
      totalPoints > 0 ? Number(((finalEarnedPoints / totalPoints) * 100).toFixed(2)) : 0;
    const isPassed = scorePercentage >= passPercentage;
    const scoringStatus: AttemptScoringStatus = hasManualReview ? "PROVISIONAL" : "FINAL";

    const releasePolicy = assessment.release_policy;
    const finalAttemptStatus =
      releasePolicy === "IMMEDIATE" && !hasManualReview
        ? "RESULT_RELEASED"
        : "SCORED";

    // 5. Update assessment_attempts record
    const { error: updateErr } = await supabase
      .from("assessment_attempts")
      .update({
        total_points: totalPoints,
        earned_points: finalEarnedPoints,
        score_percentage: scorePercentage,
        is_passed: isPassed,
        scoring_status: scoringStatus,
        status: finalAttemptStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attemptId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Ingest into Phase 08 Mistake Bank
    try {
      const { MistakeCaptureService } = await import(
        "@/modules/mistake-mastery/services/mistake-capture-service"
      );
      await MistakeCaptureService.captureFromAttempt(tenantId, attemptId);
    } catch {
      // Non-fatal if mistake capture throws during attempt completion
    }

    const summary: AttemptScoringSummary = {
      attemptId,
      totalPoints,
      earnedPoints: finalEarnedPoints,
      scorePercentage,
      isPassed,
      scoringStatus,
      items: evaluatedItems,
      mistakeBankEntries,
    };

    return { success: true, summary };
  }
}
