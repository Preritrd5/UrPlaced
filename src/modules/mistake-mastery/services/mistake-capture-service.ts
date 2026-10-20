/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Mistake Bank: Mistake Capture Service (Phase 08)
 * ==============================================================================
 * Idempotently ingests student attempt evidence into deduplicated review targets
 * and granular historical occurrences without duplicate bloat.
 */

import {
  MistakeReviewTargetRow,
  MistakeOccurrenceRow,
  MistakePrimaryReason,
  MistakeCaptureReason,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CaptureResultSummary {
  attemptId: string;
  studentId: string;
  targetsCreated: number;
  targetsUpdated: number;
  occurrencesCaptured: number;
  targetIds: string[];
}

export class MistakeCaptureService {
  /**
   * Idempotently ingests all incorrect, skipped, and flagged items from a submitted attempt.
   */
  public static async captureFromAttempt(
    tenantId: string,
    attemptId: string
  ): Promise<{ success: boolean; summary?: CaptureResultSummary; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // 1. Fetch attempt and student info
    const { data: attempt, error: attemptErr } = await supabase
      .from("assessment_attempts")
      .select("id, tenant_id, student_id, assessment_id")
      .eq("tenant_id", tenantId)
      .eq("id", attemptId)
      .single();

    if (attemptErr || !attempt) {
      return { success: false, error: attemptErr?.message || "Assessment attempt not found." };
    }

    const studentId = attempt.student_id;
    const assessmentId = attempt.assessment_id;

    // 2. Fetch assessment to know the question_set_id
    let questionSetId: string | null = null;
    if (assessmentId) {
      const { data: assessment } = await supabase
        .from("assessments")
        .select("question_set_id")
        .eq("id", assessmentId)
        .single();
      questionSetId = assessment?.question_set_id || null;
    }

    // 3. Fetch all question set items to account for questions presented
    let setItemMap: Map<string, { questionId: string; versionId: string }> = new Map();
    if (questionSetId) {
      const { data: setItems } = await supabase
        .from("question_set_items")
        .select("question_id, version_id")
        .eq("question_set_id", questionSetId);

      if (setItems) {
        for (const item of setItems) {
          setItemMap.set(item.question_id, {
            questionId: item.question_id,
            versionId: item.version_id,
          });
        }
      }
    }

    // 4. Fetch all responses for this attempt
    const { data: responses, error: respErr } = await supabase
      .from("attempt_responses")
      .select("*")
      .eq("attempt_id", attemptId);

    if (respErr) {
      return { success: false, error: respErr.message };
    }

    const responseMap = new Map<string, (typeof responses)[0]>();
    for (const resp of responses || []) {
      responseMap.set(resp.question_id, resp);
    }

    // 5. Build candidate items to evaluate for mistake capture
    // An item is eligible if:
    // - Response is incorrect (is_correct === false)
    // - Response was skipped / unanswered (is_answered === false)
    // - Question in set had no response recorded (skipped)
    // - Response was explicitly flagged by student (is_flagged === true)
    interface CaptureCandidate {
      questionId: string;
      versionId: string;
      responseId: string | null;
      captureReason: MistakeCaptureReason;
      primaryReason: MistakePrimaryReason;
      submittedPayload: any;
      pointsAwarded: number;
    }

    const candidates: CaptureCandidate[] = [];

    // Check existing responses
    for (const resp of responses || []) {
      const isIncorrect = resp.is_correct === false;
      const isUnanswered = !resp.is_answered;
      const isFlagged = !!resp.is_flagged;

      if (isIncorrect) {
        candidates.push({
          questionId: resp.question_id,
          versionId: resp.version_id,
          responseId: resp.id,
          captureReason: "INCORRECT_ANSWER",
          primaryReason: "INCORRECT_ANSWER",
          submittedPayload: resp.response_payload || {},
          pointsAwarded: resp.points_awarded || 0,
        });
      } else if (isUnanswered) {
        candidates.push({
          questionId: resp.question_id,
          versionId: resp.version_id,
          responseId: resp.id,
          captureReason: "SKIPPED_UNANSWERED",
          primaryReason: "SKIPPED_UNANSWERED",
          submittedPayload: resp.response_payload || {},
          pointsAwarded: 0,
        });
      } else if (isFlagged) {
        // Correct or partially correct, but student flagged it for revision
        candidates.push({
          questionId: resp.question_id,
          versionId: resp.version_id,
          responseId: resp.id,
          captureReason: resp.is_correct ? "CORRECT_REVIEW_LATER" : "STUDENT_FLAGGED",
          primaryReason: resp.is_correct ? "CORRECT_REVIEW_LATER" : "STUDENT_FLAGGED",
          submittedPayload: resp.response_payload || {},
          pointsAwarded: resp.points_awarded || 0,
        });
      }
    }

    // Check unattempted set items (skipped without even opening/saving)
    for (const [qId, item] of setItemMap.entries()) {
      if (!responseMap.has(qId)) {
        candidates.push({
          questionId: item.questionId,
          versionId: item.versionId,
          responseId: null,
          captureReason: "SKIPPED_UNANSWERED",
          primaryReason: "SKIPPED_UNANSWERED",
          submittedPayload: {},
          pointsAwarded: 0,
        });
      }
    }

    if (candidates.length === 0) {
      return {
        success: true,
        summary: {
          attemptId,
          studentId,
          targetsCreated: 0,
          targetsUpdated: 0,
          occurrencesCaptured: 0,
          targetIds: [],
        },
      };
    }

    // 6. Fetch skill_id for versions
    const versionIds = Array.from(new Set(candidates.map((c) => c.versionId)));
    const { data: versions } = await supabase
      .from("question_versions")
      .select("id, skill_id")
      .in("id", versionIds);

    const versionSkillMap = new Map<string, string | null>();
    for (const v of versions || []) {
      versionSkillMap.set(v.id, v.skill_id);
    }

    let targetsCreated = 0;
    let targetsUpdated = 0;
    let occurrencesCaptured = 0;
    const targetIds: string[] = [];

    const nowIso = new Date().toISOString();

    // 7. Process each candidate item
    for (const cand of candidates) {
      const skillId = versionSkillMap.get(cand.versionId) || null;

      // Find existing target for (tenant_id, student_id, question_id, version_id)
      const { data: existingTarget } = await supabase
        .from("mistake_review_targets")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("student_id", studentId)
        .eq("question_id", cand.questionId)
        .eq("version_id", cand.versionId)
        .maybeSingle();

      let targetId: string;

      if (existingTarget) {
        targetId = existingTarget.id;
        // Update occurrence_count and reactivate if it was dismissed or provisional
        const newStatus =
          existingTarget.status === "RESOLVED_DISMISSED" ||
          existingTarget.status === "PROVISIONAL_MASTERY" ||
          existingTarget.status === "MASTERY_DEMONSTRATED"
            ? "NEEDS_REVIEW"
            : existingTarget.status;

        await supabase
          .from("mistake_review_targets")
          .update({
            occurrence_count: existingTarget.occurrence_count + 1,
            last_observed_at: nowIso,
            status: newStatus,
            skill_id: existingTarget.skill_id || skillId,
            updated_at: nowIso,
          })
          .eq("id", targetId);

        targetsUpdated++;
      } else {
        // Create new review target
        const { data: newTarget, error: insertTargetErr } = await supabase
          .from("mistake_review_targets")
          .insert({
            tenant_id: tenantId,
            student_id: studentId,
            question_id: cand.questionId,
            version_id: cand.versionId,
            skill_id: skillId,
            primary_reason: cand.primaryReason,
            status: "NEEDS_REVIEW",
            occurrence_count: 1,
            revision_stage: 1,
            next_due_at: nowIso,
            first_observed_at: nowIso,
            last_observed_at: nowIso,
          })
          .select("id")
          .single();

        if (insertTargetErr || !newTarget) {
          continue; // skip if collision or error
        }

        targetId = newTarget.id;
        targetsCreated++;
      }

      targetIds.push(targetId);

      // Record occurrence idempotently (uq_occurrence_attempt_question)
      const { data: existingOcc } = await supabase
        .from("mistake_occurrences")
        .select("id")
        .eq("attempt_id", attemptId)
        .eq("question_id", cand.questionId)
        .maybeSingle();

      if (!existingOcc) {
        const { error: occErr } = await supabase.from("mistake_occurrences").insert({
          tenant_id: tenantId,
          target_id: targetId,
          student_id: studentId,
          attempt_id: attemptId,
          response_id: cand.responseId,
          question_id: cand.questionId,
          version_id: cand.versionId,
          capture_reason: cand.captureReason,
          submitted_payload: cand.submittedPayload,
          points_awarded: cand.pointsAwarded,
          occurred_at: nowIso,
        });

        if (!occErr) {
          occurrencesCaptured++;
        }
      }

      // Initialize or bump student skill mastery record
      if (skillId) {
        await this.syncSkillMistakeCounts(tenantId, studentId, skillId);
      }
    }

    return {
      success: true,
      summary: {
        attemptId,
        studentId,
        targetsCreated,
        targetsUpdated,
        occurrencesCaptured,
        targetIds,
      },
    };
  }

  /**
   * Directly records a review item manually (e.g. from practice drills or self-flagged).
   */
  public static async recordManualMistake(
    tenantId: string,
    studentId: string,
    questionId: string,
    versionId: string,
    skillId: string | null,
    reason: MistakePrimaryReason,
    reflection?: string
  ): Promise<{ success: boolean; target?: MistakeReviewTargetRow; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const nowIso = new Date().toISOString();

    const { data: existingTarget } = await supabase
      .from("mistake_review_targets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("question_id", questionId)
      .eq("version_id", versionId)
      .maybeSingle();

    if (existingTarget) {
      const { data: updated, error } = await supabase
        .from("mistake_review_targets")
        .update({
          occurrence_count: existingTarget.occurrence_count + 1,
          last_observed_at: nowIso,
          status: "NEEDS_REVIEW",
          student_reflection: reflection || existingTarget.student_reflection,
          updated_at: nowIso,
        })
        .eq("id", existingTarget.id)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      if (skillId) await this.syncSkillMistakeCounts(tenantId, studentId, skillId);
      return { success: true, target: updated };
    }

    const { data: created, error } = await supabase
      .from("mistake_review_targets")
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        question_id: questionId,
        version_id: versionId,
        skill_id: skillId,
        primary_reason: reason,
        status: "NEEDS_REVIEW",
        occurrence_count: 1,
        revision_stage: 1,
        next_due_at: nowIso,
        first_observed_at: nowIso,
        last_observed_at: nowIso,
        student_reflection: reflection || null,
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };
    if (skillId) await this.syncSkillMistakeCounts(tenantId, studentId, skillId);
    return { success: true, target: created };
  }

  /**
   * Recalculates mistake counts on the student_skill_mastery record.
   */
  private static async syncSkillMistakeCounts(
    tenantId: string,
    studentId: string,
    skillId: string
  ): Promise<void> {
    const supabase = await createServerSupabaseClient();

    const { data: targets } = await supabase
      .from("mistake_review_targets")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("skill_id", skillId);

    const totalMistakes = targets?.length || 0;
    const activeReviews =
      targets?.filter((t) =>
        ["NEEDS_REVIEW", "PRACTISING", "REVISION_DUE"].includes(t.status)
      ).length || 0;

    const { data: existing } = await supabase
      .from("student_skill_mastery")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("skill_id", skillId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("student_skill_mastery")
        .update({
          total_mistakes_count: totalMistakes,
          active_review_count: activeReviews,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("student_skill_mastery").insert({
        tenant_id: tenantId,
        student_id: studentId,
        skill_id: skillId,
        mastery_status: "NEEDS_REVIEW",
        total_mistakes_count: totalMistakes,
        active_review_count: activeReviews,
        independent_correct_count: 0,
        independent_attempts_count: 0,
        accuracy_percentage: 0,
      });
    }
  }
}
