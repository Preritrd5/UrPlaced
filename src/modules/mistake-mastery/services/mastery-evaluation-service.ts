/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Mistake-to-Mastery Engine: Mastery Evaluation Service (Phase 08)
 * ==============================================================================
 * Enforces evidence-based skill mastery evaluation:
 * - Unassessed -> Needs Review -> Practising -> Improving -> Provisional Mastery -> Mastery Demonstrated
 * Strict Invariant: Answering a question whose answer was already revealed CANNOT
 * establish mastery. Independent correct answers on NEW questions are mandatory.
 */

import {
  MasteryStatus,
  MasteryEvidenceRecordRow,
  StudentSkillMasteryRow,
  QuestionDifficulty,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AssessmentScoringService } from "@/modules/assessments/services/assessment-scoring-service";
import { RevisionSchedulerService } from "./revision-scheduler-service";

export interface RetestEvaluationResult {
  isCorrect: boolean;
  pointsEarned: number;
  explanation: string | null;
  masteryStatus: MasteryStatus;
  newRevisionStage: number;
  nextDueAt: string;
  evidenceRecord: MasteryEvidenceRecordRow;
}

export class MasteryEvaluationService {
  /**
   * Evaluates a retest response on a new practice question, records mastery evidence,
   * advances or regresses the review target, and recalculates skill mastery status.
   */
  public static async recordRetestResponse(
    tenantId: string,
    studentId: string,
    targetId: string,
    questionId: string,
    versionId: string,
    responsePayload: Record<string, any>
  ): Promise<{ success: boolean; result?: RetestEvaluationResult; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const nowIso = new Date().toISOString();

    // 1. Fetch the target to know the canonical skill and original question
    const { data: target, error: targetErr } = await supabase
      .from("mistake_review_targets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", targetId)
      .single();

    if (targetErr || !target) {
      return { success: false, error: targetErr?.message || "Review target not found." };
    }

    const skillId = target.skill_id;
    if (!skillId) {
      return { success: false, error: "Review target does not have an associated canonical skill." };
    }

    // 2. Fetch the question version being answered
    const { data: version, error: verErr } = await supabase
      .from("question_versions")
      .select("*, questions!inner(question_type)")
      .eq("id", versionId)
      .single();

    if (verErr || !version) {
      return { success: false, error: verErr?.message || "Question version not found." };
    }

    const questionType = (version as any).questions?.question_type || "SINGLE_CHOICE";

    // 3. Evaluate response using deterministic AssessmentScoringService
    const evalRes = await AssessmentScoringService.evaluateResponse(
      questionType,
      version,
      1, // 1 point per retest item
      0, // 0 negative
      responsePayload
    );

    const isCorrect = evalRes.isCorrect === true;
    const pointsEarned = evalRes.pointsAwarded;

    // 4. Strict Invariant Check: Is this a NEW question?
    // If the question answered is the SAME question ID as the original mistake target,
    // is_new_question = false! That can reinforce revision, but cannot count toward independent mastery.
    const isNewQuestion = questionId !== target.question_id;

    // 5. Insert into mastery_evidence_records
    const { data: evidence, error: evErr } = await supabase
      .from("mastery_evidence_records")
      .insert({
        tenant_id: tenantId,
        student_id: studentId,
        skill_id: skillId,
        target_id: targetId,
        evidence_question_id: questionId,
        evidence_version_id: versionId,
        is_new_question: isNewQuestion,
        is_correct: isCorrect,
        points_earned: pointsEarned,
        difficulty: (version.difficulty as QuestionDifficulty) || "MEDIUM",
        validity_status: "VALID",
        recorded_at: nowIso,
      })
      .select()
      .single();

    if (evErr || !evidence) {
      return { success: false, error: evErr?.message || "Failed to record mastery evidence." };
    }

    // 6. Update target revision stage
    // If correct, advance stage; if incorrect, reset to stage 1
    const { target: updatedTarget } = await RevisionSchedulerService.advanceRevisionStage(
      tenantId,
      studentId,
      targetId,
      isCorrect,
      isNewQuestion
        ? `Retested with new question (${isCorrect ? "Correct" : "Incorrect"})`
        : `Repeated original question review (${isCorrect ? "Correct - Revealed" : "Incorrect"})`
    );

    // 7. Re-evaluate student skill mastery
    const { mastery } = await this.evaluateSkillMastery(tenantId, studentId, skillId);

    const currentMasteryStatus: MasteryStatus = mastery?.mastery_status || "NEEDS_REVIEW";

    // 8. If candidate demonstrated mastery on the skill, update target status
    if (
      currentMasteryStatus === "MASTERY_DEMONSTRATED" ||
      currentMasteryStatus === "PROVISIONAL_MASTERY"
    ) {
      await supabase
        .from("mistake_review_targets")
        .update({
          status: currentMasteryStatus,
          updated_at: nowIso,
        })
        .eq("id", targetId);
    }

    return {
      success: true,
      result: {
        isCorrect,
        pointsEarned,
        explanation: version.explanation,
        masteryStatus: currentMasteryStatus,
        newRevisionStage: updatedTarget?.revision_stage || 1,
        nextDueAt: updatedTarget?.next_due_at || nowIso,
        evidenceRecord: evidence,
      },
    };
  }

  /**
   * Transparently recalculates mastery for a student on a specific canonical skill.
   * Derives state strictly from valid evidence records and active review targets.
   */
  public static async evaluateSkillMastery(
    tenantId: string,
    studentId: string,
    skillId: string
  ): Promise<{ success: boolean; mastery?: StudentSkillMasteryRow; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const nowIso = new Date().toISOString();

    // 1. Fetch all VALID evidence records for this student and skill
    const { data: evidenceList, error: evErr } = await supabase
      .from("mastery_evidence_records")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("skill_id", skillId)
      .eq("validity_status", "VALID");

    if (evErr) {
      return { success: false, error: evErr.message };
    }

    // Filter to independent new-question evidence only (Core Invariant)
    const independentEvidence = (evidenceList || []).filter((e) => e.is_new_question);

    const independentAttemptsCount = independentEvidence.length;
    const independentCorrectCount = independentEvidence.filter((e) => e.is_correct).length;
    const accuracyPercentage =
      independentAttemptsCount > 0
        ? Number(((independentCorrectCount / independentAttemptsCount) * 100).toFixed(2))
        : 0;

    const mediumOrHardCorrectCount = independentEvidence.filter(
      (e) => e.is_correct && (e.difficulty === "MEDIUM" || e.difficulty === "HARD")
    ).length;

    // 2. Fetch mistake targets for this skill to count active reviews
    const { data: targets } = await supabase
      .from("mistake_review_targets")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("skill_id", skillId);

    const totalMistakesCount = targets?.length || 0;
    const activeReviewCount =
      targets?.filter((t) =>
        ["NEEDS_REVIEW", "PRACTISING", "REVISION_DUE"].includes(t.status)
      ).length || 0;

    // 3. Determine mastery status using non-negotiable policy
    let masteryStatus: MasteryStatus;

    if (independentAttemptsCount === 0) {
      if (totalMistakesCount > 0) {
        masteryStatus = "NEEDS_REVIEW";
      } else {
        masteryStatus = "UNASSESSED";
      }
    } else if (independentAttemptsCount < 2) {
      // Completed some practice, but fewer than 2 independent new-question trials
      masteryStatus = "PRACTISING";
    } else {
      // 2 or more independent attempts
      if (accuracyPercentage < 50) {
        masteryStatus = "NEEDS_REVIEW";
      } else if (accuracyPercentage < 80) {
        masteryStatus = "IMPROVING";
      } else {
        // >= 80% accuracy
        if (
          independentAttemptsCount >= 3 &&
          mediumOrHardCorrectCount >= 2 &&
          activeReviewCount === 0
        ) {
          masteryStatus = "MASTERY_DEMONSTRATED";
        } else {
          masteryStatus = "PROVISIONAL_MASTERY";
        }
      }
    }

    // 4. Upsert student_skill_mastery record
    const { data: existing } = await supabase
      .from("student_skill_mastery")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("skill_id", skillId)
      .maybeSingle();

    let masteryRow: StudentSkillMasteryRow;

    if (existing) {
      const { data: updated, error: updateErr } = await supabase
        .from("student_skill_mastery")
        .update({
          mastery_status: masteryStatus,
          total_mistakes_count: totalMistakesCount,
          active_review_count: activeReviewCount,
          independent_correct_count: independentCorrectCount,
          independent_attempts_count: independentAttemptsCount,
          accuracy_percentage: accuracyPercentage,
          last_evidence_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (updateErr || !updated) {
        return { success: false, error: updateErr?.message || "Failed to update mastery." };
      }
      masteryRow = updated;
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("student_skill_mastery")
        .insert({
          tenant_id: tenantId,
          student_id: studentId,
          skill_id: skillId,
          mastery_status: masteryStatus,
          total_mistakes_count: totalMistakesCount,
          active_review_count: activeReviewCount,
          independent_correct_count: independentCorrectCount,
          independent_attempts_count: independentAttemptsCount,
          accuracy_percentage: accuracyPercentage,
          last_evidence_at: nowIso,
          policy_version: "v1.0",
        })
        .select()
        .single();

      if (insertErr || !created) {
        return { success: false, error: insertErr?.message || "Failed to create mastery." };
      }
      masteryRow = created;
    }

    return { success: true, mastery: masteryRow };
  }

  /**
   * Retrieves student's skill mastery radar across all canonical skills.
   */
  public static async getStudentMasteryOverview(
    tenantId: string,
    studentId: string
  ): Promise<{
    success: boolean;
    skillsMastery?: Array<
      StudentSkillMasteryRow & {
        skill_name: string;
        category: string;
      }
    >;
    metrics?: {
      totalSkillsAssessed: number;
      masteredCount: number;
      provisionalCount: number;
      improvingCount: number;
      needsReviewCount: number;
      averageAccuracy: number;
    };
    error?: string;
  }> {
    const supabase = await createServerSupabaseClient();

    const { data: masteries, error } = await supabase
      .from("student_skill_mastery")
      .select("*, canonical_skills!inner(name, category)")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    if (error) {
      return { success: false, error: error.message };
    }

    const formatted = (masteries || []).map((m: any) => ({
      ...m,
      skill_name: m.canonical_skills?.name || "Unknown Skill",
      category: m.canonical_skills?.category || "GENERAL",
    }));

    let masteredCount = 0;
    let provisionalCount = 0;
    let improvingCount = 0;
    let needsReviewCount = 0;
    let totalAccuracy = 0;

    for (const item of formatted) {
      totalAccuracy += Number(item.accuracy_percentage);
      if (item.mastery_status === "MASTERY_DEMONSTRATED") masteredCount++;
      else if (item.mastery_status === "PROVISIONAL_MASTERY") provisionalCount++;
      else if (item.mastery_status === "IMPROVING") improvingCount++;
      else if (item.mastery_status === "NEEDS_REVIEW") needsReviewCount++;
    }

    const totalSkillsAssessed = formatted.length;
    const averageAccuracy =
      totalSkillsAssessed > 0
        ? Number((totalAccuracy / totalSkillsAssessed).toFixed(2))
        : 0;

    return {
      success: true,
      skillsMastery: formatted,
      metrics: {
        totalSkillsAssessed,
        masteredCount,
        provisionalCount,
        improvingCount,
        needsReviewCount,
        averageAccuracy,
      },
    };
  }
}
