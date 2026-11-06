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
import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Normalizes an answer/option token for resilient semantic comparison.
 * Trims whitespace, removes trailing zeros/periods, normalizes Unicode symbols (e.g. currency ₹, $, €),
 * and case-folds.
 */
export function normalizeAnswerToken(raw: any): string {
  if (raw === null || raw === undefined) return "";
  let s = String(raw).trim().toLowerCase();
  // Strip currency symbols and commas for numeric/currency comparisons (e.g. ₹2,550 -> 2550)
  s = s.replace(/[₹$,]/g, "").trim();
  // Normalize double quotes / apostrophes
  s = s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"');
  return s;
}

/**
 * Resolves a raw candidate token (which might be an option ID like 'opt_a',
 * option text like '₹2,550', or letter index like 'A' or '0') against the version's options array.
 * Returns the canonical option ID if resolved, or the raw token normalized.
 */
export function resolveOptionTokenToId(candidate: any, options?: any[]): string {
  if (candidate === null || candidate === undefined) return "";
  const rawStr = String(candidate).trim();
  const normStr = normalizeAnswerToken(candidate);

  if (!Array.isArray(options) || options.length === 0) {
    return rawStr;
  }

  // 1. Direct ID match (case-insensitive)
  const idMatch = options.find(
    (opt) => opt && opt.id && String(opt.id).trim().toLowerCase() === rawStr.toLowerCase()
  );
  if (idMatch) return String(idMatch.id);

  // 2. Exact or normalized text match (e.g. "₹2,550" matches opt.text = "₹2,550" or "2550")
  const textMatch = options.find((opt) => {
    if (!opt) return false;
    const optText = opt.text || opt.option_text || opt.title || "";
    if (String(optText).trim().toLowerCase() === rawStr.toLowerCase()) return true;
    if (normalizeAnswerToken(optText) === normStr && normStr.length > 0) return true;
    return false;
  });
  if (textMatch) return String(textMatch.id);

  // 3. Option letter index match (e.g. 'a' -> index 0, 'b' -> index 1)
  const letters = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const letterIdx = letters.indexOf(rawStr.toLowerCase());
  if (letterIdx >= 0 && letterIdx < options.length && options[letterIdx]?.id) {
    return String(options[letterIdx].id);
  }

  // 4. Numeric 0-based or 1-based index match
  const numIdx = parseInt(rawStr, 10);
  if (!isNaN(numIdx)) {
    if (numIdx >= 0 && numIdx < options.length && options[numIdx]?.id) {
      return String(options[numIdx].id);
    }
    if (numIdx >= 1 && numIdx <= options.length && options[numIdx - 1]?.id) {
      return String(options[numIdx - 1].id);
    }
  }

  return rawStr;
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
    const optionsList = Array.isArray(version.options) ? (version.options as any[]) : [];

    switch (questionType) {
      case "SINGLE_CHOICE": {
        const studentRaw =
          responsePayload.selected_option ??
          responsePayload.selected_option_id ??
          responsePayload.selectedOption ??
          responsePayload.selectedOptionId ??
          responsePayload.option_id ??
          responsePayload.optionId ??
          responsePayload.answer ??
          (Array.isArray(responsePayload.selected_options) ? responsePayload.selected_options[0] : null);

        const correctRaw =
          answerKey.correct_option_id ??
          answerKey.correct_option ??
          answerKey.correctOptionId ??
          answerKey.correctOption ??
          answerKey.correct_answer ??
          answerKey.answer ??
          (Array.isArray(answerKey.correct_option_ids) ? answerKey.correct_option_ids[0] : null) ??
          (Array.isArray(answerKey.correct_options) ? answerKey.correct_options[0] : null);

        if (!studentRaw) {
          return {
            isCorrect: false,
            pointsAwarded: 0,
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "No option selected",
          };
        }

        const studentResolvedId = resolveOptionTokenToId(studentRaw, optionsList);
        const correctResolvedId = resolveOptionTokenToId(correctRaw, optionsList);

        // Check ID match or normalized text match
        let isCorrect =
          studentResolvedId.toLowerCase() === correctResolvedId.toLowerCase() ||
          normalizeAnswerToken(studentRaw) === normalizeAnswerToken(correctRaw);

        // Boolean normalization fallback (for True/False questions authored as SINGLE_CHOICE)
        if (!isCorrect) {
          const normalizeBool = (v: any): boolean | null => {
            if (typeof v === "boolean") return v;
            const s = String(v).trim().toLowerCase();
            if (["true", "t", "yes", "1"].includes(s)) return true;
            if (["false", "f", "no", "0"].includes(s)) return false;
            return null;
          };
          const bStudent = normalizeBool(studentRaw);
          const bCorrect = normalizeBool(correctRaw);
          if (bStudent !== null && bCorrect !== null && bStudent === bCorrect) {
            isCorrect = true;
          }
        }

        // Resilient fallback: check if student answer matches text of the correct option or vice-versa
        if (!isCorrect && optionsList.length > 0) {
          const correctOptObj = optionsList.find(
            (o: any) =>
              o &&
              (String(o.id).toLowerCase() === correctResolvedId.toLowerCase() ||
                String(o.id).toLowerCase() === String(correctRaw).toLowerCase())
          );
          if (correctOptObj) {
            const correctOptText = (correctOptObj as any).text || (correctOptObj as any).option_text || "";
            if (
              normalizeAnswerToken(studentRaw) === normalizeAnswerToken(correctOptText) ||
              String(studentRaw).trim().toLowerCase() === String(correctOptText).trim().toLowerCase()
            ) {
              isCorrect = true;
            }
          }
        }

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
        const studentRawList: any[] = Array.isArray(responsePayload.selected_options)
          ? responsePayload.selected_options
          : Array.isArray(responsePayload.selected_option_ids)
          ? responsePayload.selected_option_ids
          : responsePayload.selected_option
          ? [responsePayload.selected_option]
          : [];

        const correctRawList: any[] = Array.isArray(answerKey.correct_option_ids)
          ? answerKey.correct_option_ids
          : Array.isArray(answerKey.correct_options)
          ? answerKey.correct_options
          : answerKey.correct_option_id
          ? [answerKey.correct_option_id]
          : answerKey.correct_option
          ? [answerKey.correct_option]
          : [];

        if (studentRawList.length === 0) {
          return {
            isCorrect: false,
            pointsAwarded: 0,
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "No options selected",
          };
        }

        const studentResolvedIds = Array.from(
          new Set(studentRawList.map((s) => resolveOptionTokenToId(s, optionsList).toLowerCase()))
        ).sort();

        const correctResolvedIds = Array.from(
          new Set(correctRawList.map((c) => resolveOptionTokenToId(c, optionsList).toLowerCase()))
        ).sort();

        const isMatch =
          studentResolvedIds.length === correctResolvedIds.length &&
          studentResolvedIds.every((val, idx) => val === correctResolvedIds[idx]);

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
        const rawStudentVal =
          responsePayload.numeric_value ??
          responsePayload.value ??
          responsePayload.answer;
        const rawCorrectVal =
          answerKey.value ??
          answerKey.correct_value ??
          answerKey.answer;
        const tolerance = Number(answerKey.tolerance ?? answerKey.numeric_tolerance ?? 0);

        const parseNum = (v: any): number => {
          if (v === null || v === undefined) return NaN;
          if (typeof v === "number") return v;
          const cleaned = String(v).replace(/[^0-9.-]/g, "");
          return parseFloat(cleaned);
        };

        const studentVal = parseNum(rawStudentVal);
        const correctVal = parseNum(rawCorrectVal);

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
        const studentText = String(responsePayload.text ?? responsePayload.answer ?? "").trim();
        const expectedSample = String(answerKey.sample_answer ?? answerKey.correct_answer ?? "").trim();

        if (expectedSample && studentText.toLowerCase() === expectedSample.toLowerCase()) {
          return {
            isCorrect: true,
            pointsAwarded: Number(points),
            scoringStatus: "AUTOMATICALLY_SCORED",
            notes: "Exact match with sample answer.",
          };
        }

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
    const supabase = createAdminClient();

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
          options,
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

    // Ingest into Phase 08 Mistake Bank & Sync Skill Mastery
    try {
      const { MistakeCaptureService } = await import(
        "@/modules/mistake-mastery/services/mistake-capture-service"
      );
      await MistakeCaptureService.captureFromAttempt(tenantId, attemptId);

      // Record evidence and sync skill mastery for correctly answered items
      const { data: canonicalSkills } = await supabase
        .from("canonical_skills")
        .select("id, name, normalized_name, tags");

      const { MasteryEvaluationService } = await import(
        "@/modules/mistake-mastery/services/mastery-evaluation-service"
      );

      const skillsToSync = new Set<string>();

      for (const item of setQuestions) {
        const studentResp = responseMap.get(item.question_id);
        if (!studentResp || !studentResp.is_answered) continue;

        const evalItem = evaluatedItems.find((e) => e.questionId === item.question_id);
        const ver = (item.version as any) as QuestionVersionRow;
        let skillId = ver.skill_id;

        if (!skillId && canonicalSkills && canonicalSkills.length > 0) {
          const tags: string[] = Array.isArray(ver.topic_tags) ? ver.topic_tags : [];
          for (const t of tags) {
            const match = canonicalSkills.find((cs: any) =>
              cs.normalized_name?.toLowerCase() === t.toLowerCase() ||
              cs.name?.toLowerCase().includes(t.toLowerCase()) ||
              (Array.isArray(cs.tags) && cs.tags.some((cstag: string) => cstag.toLowerCase() === t.toLowerCase()))
            );
            if (match) { skillId = match.id; break; }
          }
          if (!skillId) {
            const fallback = canonicalSkills.find((cs: any) =>
              cs.normalized_name?.includes("logic") || cs.name?.toLowerCase().includes("reasoning")
            ) || canonicalSkills[0];
            skillId = fallback?.id || null;
          }
        }

        if (skillId) {
          skillsToSync.add(skillId);
          if (evalItem && evalItem.isCorrect === true) {
            await supabase.from("mastery_evidence_records").insert({
              tenant_id: tenantId,
              student_id: attempt.student_id,
              skill_id: skillId,
              evidence_question_id: item.question_id,
              evidence_version_id: item.version_id,
              is_new_question: true,
              is_correct: true,
              points_earned: evalItem.pointsAwarded,
              difficulty: ver.difficulty || "MEDIUM",
              validity_status: "VALID",
              recorded_at: new Date().toISOString(),
            });
          }
        }
      }

      for (const skId of skillsToSync) {
        await MasteryEvaluationService.evaluateSkillMastery(tenantId, attempt.student_id, skId);
      }
    } catch {
      // Non-fatal if mistake capture or mastery sync throws during attempt completion
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

  /**
   * Authoritatively regrades a candidate attempt using the corrected evaluation engine,
   * updates granular response records, recalculates attempt scores, reconciles false Mistake Bank
   * occurrences, and logs an auditable entry in audit_logs.
   */
  public static async regradeAttempt(
    tenantId: string,
    attemptId: string,
    performedByUserId?: string
  ): Promise<{
    success: boolean;
    attemptId: string;
    oldScorePercentage: number;
    newScorePercentage: number;
    oldPassed: boolean;
    newPassed: boolean;
    mistakesPurged: number;
    error?: string;
  }> {
    const supabase = createAdminClient();

    // 1. Fetch attempt and question set items
    const { data: attempt, error: attErr } = await supabase
      .from("assessment_attempts")
      .select(`
        id,
        tenant_id,
        assessment_id,
        student_id,
        status,
        total_points,
        earned_points,
        score_percentage,
        is_passed,
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
      return {
        success: false,
        attemptId,
        oldScorePercentage: 0,
        newScorePercentage: 0,
        oldPassed: false,
        newPassed: false,
        mistakesPurged: 0,
        error: attErr?.message || "Attempt not found",
      };
    }

    const assessment = (attempt as any).assessment;
    const passPercentage = Number(assessment.pass_percentage ?? 60.0);
    const oldScorePercentage = Number(attempt.score_percentage ?? 0);
    const oldPassed = !!attempt.is_passed;

    // 2. Fetch question set items with immutable versions INCLUDING options
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
          options,
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
      return {
        success: false,
        attemptId,
        oldScorePercentage,
        newScorePercentage: oldScorePercentage,
        oldPassed,
        newPassed: oldPassed,
        mistakesPurged: 0,
        error: "Question set items not found",
      };
    }

    // 3. Fetch candidate's saved responses
    const { data: responses, error: respErr } = await supabase
      .from("attempt_responses")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("attempt_id", attemptId);

    if (respErr) {
      return {
        success: false,
        attemptId,
        oldScorePercentage,
        newScorePercentage: oldScorePercentage,
        oldPassed,
        newPassed: oldPassed,
        mistakesPurged: 0,
        error: respErr.message,
      };
    }

    const responseMap = new Map<string, AttemptResponseRow>();
    (responses || []).forEach((r) => responseMap.set(r.question_id, r));

    let totalPoints = 0;
    let earnedPoints = 0;
    let hasManualReview = false;
    let mistakesPurged = 0;

    for (const item of setQuestions) {
      const q = item.question as any;
      const ver = item.version as any;
      const qId = item.question_id;
      const itemPoints = Number(item.points || 1.0);
      const itemNegPoints = Number(item.negative_points || 0.0);

      totalPoints += itemPoints;

      const studentResp = responseMap.get(qId);
      const payload = (studentResp?.response_payload as Record<string, any>) || null;
      const previousIsCorrect = studentResp?.is_correct;

      const evalRes = await this.evaluateResponse(
        q.question_type as QuestionType,
        ver,
        itemPoints,
        itemNegPoints,
        payload
      );

      if (evalRes.scoringStatus === "MANUAL_REVIEW_REQUIRED") {
        hasManualReview = true;
      }

      earnedPoints += evalRes.pointsAwarded;

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

        // Reconcile Mistake Bank: If previously marked incorrect, but is now CORRECT
        if (previousIsCorrect === false && evalRes.isCorrect === true) {
          try {
            const { data: occList } = await supabase
              .from("mistake_occurrences")
              .select("id, target_id")
              .eq("attempt_id", attemptId)
              .eq("question_id", qId);

            if (occList && occList.length > 0) {
              for (const occ of occList) {
                // Delete false mistake occurrence
                await supabase.from("mistake_occurrences").delete().eq("id", occ.id);
                mistakesPurged++;

                // Recalculate remaining occurrences for this review target
                const { data: remainingOccs } = await supabase
                  .from("mistake_occurrences")
                  .select("id")
                  .eq("target_id", occ.target_id);

                if (!remainingOccs || remainingOccs.length === 0) {
                  // No occurrences remain: clean up target
                  await supabase.from("mistake_review_targets").delete().eq("id", occ.target_id);
                } else {
                  await supabase
                    .from("mistake_review_targets")
                    .update({
                      occurrence_count: remainingOccs.length,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", occ.target_id);
                }
              }
            }
          } catch (mistakeErr) {
            console.error("[Regrade Reconciliation Error]:", mistakeErr);
          }
        }
      }
    }

    const finalEarnedPoints = Math.max(0, earnedPoints);
    const newScorePercentage =
      totalPoints > 0 ? Number(((finalEarnedPoints / totalPoints) * 100).toFixed(2)) : 0;
    const newPassed = newScorePercentage >= passPercentage;
    const scoringStatus: AttemptScoringStatus = hasManualReview ? "PROVISIONAL" : "FINAL";

    const releasePolicy = assessment.release_policy;
    const finalAttemptStatus =
      releasePolicy === "IMMEDIATE" && !hasManualReview ? "RESULT_RELEASED" : "SCORED";

    // 5. Update assessment_attempts record
    await supabase
      .from("assessment_attempts")
      .update({
        total_points: totalPoints,
        earned_points: finalEarnedPoints,
        score_percentage: newScorePercentage,
        is_passed: newPassed,
        scoring_status: scoringStatus,
        status: attempt.status === "RESULT_RELEASED" ? "RESULT_RELEASED" : finalAttemptStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", attemptId);

    // 6. Audit log
    try {
      await supabase.from("audit_logs").insert({
        tenant_id: tenantId,
        actor_user_id: performedByUserId || null,
        action: "ASSESSMENT_ATTEMPT_REGRADED",
        entity_name: "assessment_attempts",
        entity_id: attemptId,
        details: {
          assessmentId: assessment.id,
          oldScorePercentage,
          newScorePercentage,
          oldPassed,
          newPassed,
          mistakesPurged,
          reason: "Automated authoritative grading reconciliation",
        },
      });
    } catch {
      // Audit log optional
    }

    return {
      success: true,
      attemptId,
      oldScorePercentage,
      newScorePercentage,
      oldPassed,
      newPassed,
      mistakesPurged,
    };
  }

  /**
   * Bulk regrades all submitted or scored attempts for a tenant or specific assessment.
   */
  public static async regradeAllTenantAttempts(
    tenantId: string,
    assessmentId?: string,
    performedByUserId?: string
  ): Promise<{
    success: boolean;
    totalAttempts: number;
    regradedCount: number;
    mistakesPurgedTotal: number;
    results: any[];
  }> {
    const supabase = createAdminClient();

    let query = supabase
      .from("assessment_attempts")
      .select("id")
      .eq("tenant_id", tenantId)
      .in("status", ["SUBMITTED", "SCORED", "RESULT_RELEASED", "EXPIRED"]);

    if (assessmentId) {
      query = query.eq("assessment_id", assessmentId);
    }

    const { data: attempts, error } = await query;
    if (error || !attempts) {
      return {
        success: false,
        totalAttempts: 0,
        regradedCount: 0,
        mistakesPurgedTotal: 0,
        results: [],
      };
    }

    const results: any[] = [];
    let mistakesPurgedTotal = 0;

    for (const att of attempts) {
      const res = await this.regradeAttempt(tenantId, att.id, performedByUserId);
      if (res.success) {
        mistakesPurgedTotal += res.mistakesPurged;
        results.push(res);
      }
    }

    return {
      success: true,
      totalAttempts: attempts.length,
      regradedCount: results.length,
      mistakesPurgedTotal,
      results,
    };
  }
}
