/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Mistake Bank: Revision Scheduler Service (Phase 08)
 * ==============================================================================
 * Implements deterministic, explainable spaced repetition scheduling:
 * Stage 1 (1d) -> Stage 2 (3d) -> Stage 3 (7d) -> Stage 4 (14d) -> Stage 5 (30d).
 */

import {
  MistakeReviewTargetRow,
  ReviewSessionRow,
  ReviewActionType,
  ReviewTargetStatus,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface SpacedStageConfig {
  stage: number;
  intervalDays: number;
  label: string;
}

export const REVISION_STAGES: Record<number, SpacedStageConfig> = {
  1: { stage: 1, intervalDays: 1, label: "Immediate Follow-up" },
  2: { stage: 2, intervalDays: 3, label: "Short-term Retention" },
  3: { stage: 3, intervalDays: 7, label: "Consolidation" },
  4: { stage: 4, intervalDays: 14, label: "Mastery Retention" },
  5: { stage: 5, intervalDays: 30, label: "Long-term Recall" },
};

export class RevisionSchedulerService {
  /**
   * Calculates next stage and next due timestamp based on performance.
   */
  public static calculateNextDueDate(
    currentStage: number,
    baseDate: Date | string = new Date(),
    success: boolean = true
  ): { nextStage: number; nextDueAt: Date; intervalDays: number } {
    const base = typeof baseDate === "string" ? new Date(baseDate) : baseDate;

    let nextStage: number;
    if (success) {
      nextStage = Math.min(Math.max(currentStage + 1, 2), 5);
    } else {
      // Regression on mistake: back to Stage 1
      nextStage = 1;
    }

    const intervalDays = REVISION_STAGES[nextStage]?.intervalDays || 1;
    const nextDueAt = new Date(base.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    return { nextStage, nextDueAt, intervalDays };
  }

  /**
   * Advances the revision stage for a target upon completion of a review or retest.
   */
  public static async advanceRevisionStage(
    tenantId: string,
    studentId: string,
    targetId: string,
    success: boolean,
    notes?: string
  ): Promise<{ success: boolean; target?: MistakeReviewTargetRow; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const now = new Date();
    const nowIso = now.toISOString();

    const { data: target, error: fetchErr } = await supabase
      .from("mistake_review_targets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .eq("id", targetId)
      .single();

    if (fetchErr || !target) {
      return { success: false, error: fetchErr?.message || "Review target not found." };
    }

    const { nextStage, nextDueAt } = this.calculateNextDueDate(
      target.revision_stage,
      now,
      success
    );

    let nextStatus: ReviewTargetStatus = target.status;
    if (success) {
      if (nextStage >= 4) {
        nextStatus = "PROVISIONAL_MASTERY";
      } else {
        nextStatus = "IMPROVING";
      }
    } else {
      nextStatus = "NEEDS_REVIEW";
    }

    const { data: updatedTarget, error: updateErr } = await supabase
      .from("mistake_review_targets")
      .update({
        revision_stage: nextStage,
        next_due_at: nextDueAt.toISOString(),
        last_reviewed_at: nowIso,
        status: nextStatus,
        updated_at: nowIso,
      })
      .eq("id", targetId)
      .select()
      .single();

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Log review session
    await supabase.from("review_sessions").insert({
      tenant_id: tenantId,
      target_id: targetId,
      student_id: studentId,
      action_type: "REVISION_RESCHEDULED",
      notes: notes || `Advanced to stage ${nextStage} (${success ? "success" : "retest needed"})`,
      metadata: {
        previousStage: target.revision_stage,
        nextStage,
        success,
        nextDueAt: nextDueAt.toISOString(),
      },
    });

    return { success: true, target: updatedTarget };
  }

  /**
   * Reschedules a review target to a custom date.
   */
  public static async rescheduleTarget(
    tenantId: string,
    studentId: string,
    targetId: string,
    customDueDate: Date | string,
    notes?: string
  ): Promise<{ success: boolean; target?: MistakeReviewTargetRow; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const dueAt = typeof customDueDate === "string" ? new Date(customDueDate) : customDueDate;

    if (isNaN(dueAt.getTime())) {
      return { success: false, error: "Invalid due date provided." };
    }

    const nowIso = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from("mistake_review_targets")
      .update({
        next_due_at: dueAt.toISOString(),
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
      action_type: "REVISION_RESCHEDULED",
      notes: notes || `Manually rescheduled to ${dueAt.toISOString()}`,
      metadata: { customDueDate: dueAt.toISOString() },
    });

    return { success: true, target: updated };
  }

  /**
   * Returns list of review items due for review on or before the given cutoff date.
   */
  public static async getDueReviews(
    tenantId: string,
    studentId: string,
    options?: { skillId?: string; limit?: number; cutoffDate?: Date }
  ): Promise<{ success: boolean; targets?: MistakeReviewTargetRow[]; error?: string }> {
    const supabase = await createServerSupabaseClient();
    const cutoffIso = (options?.cutoffDate || new Date()).toISOString();

    let query = supabase
      .from("mistake_review_targets")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId)
      .lte("next_due_at", cutoffIso)
      .not("status", "in", '("RESOLVED_DISMISSED","CONTENT_INVALIDATED")')
      .order("next_due_at", { ascending: true });

    if (options?.skillId) {
      query = query.eq("skill_id", options.skillId);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, targets: data || [] };
  }

  /**
   * Returns overview metrics for the student's spaced revision queue.
   */
  public static async getRevisionQueueMetrics(
    tenantId: string,
    studentId: string
  ): Promise<{
    dueTodayCount: number;
    overdueCount: number;
    upcomingWeekCount: number;
    totalActiveCount: number;
    masteredCount: number;
  }> {
    const supabase = await createServerSupabaseClient();
    const now = new Date();
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const endOfWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: targets } = await supabase
      .from("mistake_review_targets")
      .select("id, status, next_due_at")
      .eq("tenant_id", tenantId)
      .eq("student_id", studentId);

    let dueTodayCount = 0;
    let overdueCount = 0;
    let upcomingWeekCount = 0;
    let totalActiveCount = 0;
    let masteredCount = 0;

    for (const t of targets || []) {
      if (t.status === "CONTENT_INVALIDATED" || t.status === "RESOLVED_DISMISSED") {
        continue;
      }

      if (t.status === "MASTERY_DEMONSTRATED") {
        masteredCount++;
        continue;
      }

      totalActiveCount++;
      const dueDate = new Date(t.next_due_at);

      if (dueDate < oneDayAgo) {
        overdueCount++;
      }
      if (dueDate <= endOfDay) {
        dueTodayCount++;
      } else if (dueDate <= endOfWeek) {
        upcomingWeekCount++;
      }
    }

    return {
      dueTodayCount,
      overdueCount,
      upcomingWeekCount,
      totalActiveCount,
      masteredCount,
    };
  }
}
