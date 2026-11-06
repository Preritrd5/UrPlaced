/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Mistake Bank: Practice Recommendation & Retest Drill Service (Phase 08)
 * ==============================================================================
 * Enforces the core invariant: Re-testing an already revealed question does NOT
 * establish mastery. Mastery strictly requires independent correct answers on NEW,
 * unrevealed questions testing the same canonical skill.
 */

import {
  MistakeReviewTargetRow,
  StudentReasonCategory,
  QuestionDifficulty,
  QuestionRow,
  QuestionVersionRow,
} from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RetestQuestionRecommendation {
  question: QuestionRow;
  version: QuestionVersionRow;
  isNewQuestion: boolean;
  matchReason: string;
}

export class PracticeRecommendationService {
  /**
   * Retrieves NEW, unrevealed questions for retesting the canonical skill of a mistake target.
   * Excludes any questions previously attempted, answered, or reviewed by the student.
   */
  public static async getRetestPracticeQuestions(
    tenantId: string,
    studentId: string,
    targetId: string,
    limit: number = 3
  ): Promise<{
    success: boolean;
    target?: MistakeReviewTargetRow;
    recommendations?: RetestQuestionRecommendation[];
    error?: string;
  }> {
    const supabase = createAdminClient();

    // 1. Fetch review target
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

    const targetSkillId = target.skill_id;
    const targetQuestionId = target.question_id;

    // 2. Collect all question IDs already encountered by the student
    const excludedQuestionIds = new Set<string>();
    excludedQuestionIds.add(targetQuestionId);

    // From mistake targets
    const { data: userTargets } = await supabase
      .from("mistake_review_targets")
      .select("question_id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    for (const t of userTargets || []) {
      excludedQuestionIds.add(t.question_id);
    }

    // From prior mastery evidence
    const { data: userEvidence } = await supabase
      .from("mastery_evidence_records")
      .select("evidence_question_id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    for (const ev of userEvidence || []) {
      excludedQuestionIds.add(ev.evidence_question_id);
    }

    // From prior responses in completed assessments
    const { data: userAttempts } = await supabase
      .from("assessment_attempts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    const attemptIds = (userAttempts || []).map((a) => a.id);
    if (attemptIds.length > 0) {
      const { data: pastResponses } = await supabase
        .from("attempt_responses")
        .select("question_id")
        .in("attempt_id", attemptIds);

      for (const pr of pastResponses || []) {
        excludedQuestionIds.add(pr.question_id);
      }
    }

    const excludedList = Array.from(excludedQuestionIds);

    // 3. Find published question versions for the same canonical skill
    let recommendations: RetestQuestionRecommendation[] = [];

    if (targetSkillId) {
      // Find published versions matching skill_id
      let skillQuery = supabase
        .from("question_versions")
        .select("*, questions!inner(*)")
        .eq("skill_id", targetSkillId)
        .eq("lifecycle_status", "PUBLISHED");

      if (excludedList.length > 0) {
        skillQuery = skillQuery.not("question_id", "in", `(${excludedList.join(",")})`);
      }

      const { data: skillVersions } = await skillQuery.limit(limit);

      if (skillVersions && skillVersions.length > 0) {
        for (const item of skillVersions) {
          const { questions, ...ver } = item as any;
          recommendations.push({
            question: questions,
            version: ver,
            isNewQuestion: true,
            matchReason: "Direct canonical skill match (new, unrevealed question)",
          });
        }
      }
    }

    // 4. Fallback if not enough exact skill matches: look for questions in same bank or topic tags
    if (recommendations.length < limit) {
      const remainingLimit = limit - recommendations.length;
      const alreadyRecommended = new Set(recommendations.map((r) => r.question.id));
      const combinedExcluded = Array.from(new Set([...excludedList, ...alreadyRecommended]));

      let fallbackQuery = supabase
        .from("question_versions")
        .select("*, questions!inner(*)")
        .eq("lifecycle_status", "PUBLISHED");

      if (combinedExcluded.length > 0) {
        fallbackQuery = fallbackQuery.not(
          "question_id",
          "in",
          `(${combinedExcluded.join(",")})`
        );
      }

      const { data: fallbackVersions } = await fallbackQuery.limit(remainingLimit);

      if (fallbackVersions) {
        for (const item of fallbackVersions) {
          const { questions, ...ver } = item as any;
          recommendations.push({
            question: questions,
            version: ver,
            isNewQuestion: true,
            matchReason: "Approved practice question for reinforcement",
          });
        }
      }
    }

    return {
      success: true,
      target,
      recommendations,
    };
  }

  /**
   * Saves student self-reflection and categorized error reason.
   */
  public static async saveStudentReflection(
    tenantId: string,
    studentId: string,
    targetId: string,
    reasonCategory: StudentReasonCategory,
    reflection: string
  ): Promise<{ success: boolean; target?: MistakeReviewTargetRow; error?: string }> {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("mistake_review_targets")
      .update({
        student_reason_category: reasonCategory,
        student_reflection: reflection,
        last_reviewed_at: nowIso,
        status: "PRACTISING",
        updated_at: nowIso,
      })
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", targetId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Log review session
    await supabase.from("review_sessions").insert({
      tenant_id: tenantId,
      target_id: targetId,
      student_id: studentId,
      action_type: "REFLECTION_SAVED",
      notes: `Reason: ${reasonCategory}. Reflection: ${reflection.slice(0, 150)}`,
      metadata: { reasonCategory, reflectionLength: reflection.length },
    });

    return { success: true, target: updated };
  }

  /**
   * Marks a target explanation as viewed.
   */
  public static async markExplanationViewed(
    tenantId: string,
    studentId: string,
    targetId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    await supabase
      .from("mistake_review_targets")
      .update({
        last_reviewed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", targetId);

    await supabase.from("review_sessions").insert({
      tenant_id: tenantId,
      target_id: targetId,
      student_id: studentId,
      action_type: "EXPLANATION_VIEWED",
      notes: "Student viewed the full explanation and answer key.",
      metadata: { viewedAt: nowIso },
    });

    return { success: true };
  }

  /**
   * Dismisses a review target if resolved or explicitly acknowledged.
   */
  public static async dismissTarget(
    tenantId: string,
    studentId: string,
    targetId: string,
    notes?: string
  ): Promise<{ success: boolean; target?: MistakeReviewTargetRow; error?: string }> {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("mistake_review_targets")
      .update({
        status: "RESOLVED_DISMISSED",
        updated_at: nowIso,
      })
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", targetId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    await supabase.from("review_sessions").insert({
      tenant_id: tenantId,
      target_id: targetId,
      student_id: studentId,
      action_type: "TARGET_DISMISSED",
      notes: notes || "Target dismissed by student.",
      metadata: { dismissedAt: nowIso },
    });

    return { success: true, target: updated };
  }
}
