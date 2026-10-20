/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Analytics: Defensible Metric Catalogue Service (Phase 09)
 * ==============================================================================
 * Implements strict mathematical definitions for institutional placement analytics,
 * assessment completion rates, mistake-to-mastery progression, and topic heatmaps.
 * Zero fabricated percentages: returns null or INSUFFICIENT_DATA when records are absent.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CohortPlacementMetrics {
  totalEligibleStudents: number;
  uniquePlacedStudents: number;
  placementRatePercentage: number | null;
  totalApplications: number;
  totalOffersExtended: number;
  acceptedOffersCount: number;
  averageOffersPerPlacedStudent: number | null;
  dataSource: {
    calculatedAt: string;
    hasSufficientData: boolean;
  };
}

export interface AssessmentPreparationMetrics {
  totalAssigned: number;
  totalCompleted: number;
  completionRatePercentage: number | null;
  averageCohortScore: number | null;
  totalPracticeSessions: number;
  dataSource: {
    calculatedAt: string;
    hasSufficientData: boolean;
  };
}

export interface MasteryProgressionMetrics {
  totalMistakesCaptured: number;
  activeMistakesCount: number;
  masteredMistakesCount: number;
  masteryResolutionRatePercentage: number | null;
}

export interface TopicWeaknessItem {
  topic: string;
  skillName?: string;
  totalAttempts: number;
  correctAttempts: number;
  accuracyPercentage: number;
  weaknessSeverity: "CRITICAL_WEAKNESS" | "MODERATE_WEAKNESS" | "COMPETENT" | "STRONG";
}

export class AnalyticsMetricService {
  /**
   * Computes institutional placement metrics strictly derived from candidate outcomes.
   */
  public static async getCohortPlacementMetrics(
    tenantId: string,
    academicYearId?: string
  ): Promise<CohortPlacementMetrics> {
    const supabase = await createServerSupabaseClient();

    // 1. Total participating/registered students
    let studentQuery = supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    if (academicYearId) {
      studentQuery = studentQuery.eq("academic_year_id", academicYearId);
    }
    const { count: studentCount } = await studentQuery;
    const totalEligible = studentCount || 0;

    // 2. Candidates & outcomes
    let candidateQuery = supabase
      .from("recruitment_candidates")
      .select("id, student_id, status, offer_details")
      .eq("tenant_id", tenantId);

    const { data: candidates } = await candidateQuery;
    const candidateList = candidates || [];

    const totalApplications = candidateList.length;

    // 3. Unique placed students & offer counts
    const placedStudentIds = new Set<string>();
    let totalOffers = 0;
    let acceptedOffers = 0;

    for (const c of candidateList) {
      const offer = c.offer_details as { status?: string; is_accepted?: boolean } | null;
      if (offer || c.status === "OFFER_EXTENDED" || c.status === "HIRED" || c.status === "OFFERED") {
        totalOffers++;
        placedStudentIds.add(c.student_id);
        if (offer?.is_accepted || c.status === "HIRED") {
          acceptedOffers++;
        }
      }
    }

    const uniquePlaced = placedStudentIds.size;
    const placementRate = totalEligible > 0 ? Number(((uniquePlaced / totalEligible) * 100).toFixed(2)) : null;
    const avgOffersPerPlaced = uniquePlaced > 0 ? Number((totalOffers / uniquePlaced).toFixed(2)) : null;

    return {
      totalEligibleStudents: totalEligible,
      uniquePlacedStudents: uniquePlaced,
      placementRatePercentage: placementRate,
      totalApplications: totalApplications,
      totalOffersExtended: totalOffers,
      acceptedOffersCount: acceptedOffers,
      averageOffersPerPlacedStudent: avgOffersPerPlaced,
      dataSource: {
        calculatedAt: new Date().toISOString(),
        hasSufficientData: totalEligible > 0,
      },
    };
  }

  /**
   * Computes assessment participation, completion, and cohort average scores.
   */
  public static async getAssessmentPreparationMetrics(
    tenantId: string
  ): Promise<AssessmentPreparationMetrics> {
    const supabase = await createServerSupabaseClient();

    // Total assignments
    const { count: assignedCount } = await supabase
      .from("assessment_assignments")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    // Completed attempts
    const { data: attempts } = await supabase
      .from("assessment_attempts")
      .select("id, score_percentage, status")
      .eq("tenant_id", tenantId)
      .in("status", ["SUBMITTED", "GRADED"]);

    const attemptList = attempts || [];
    const completedCount = attemptList.length;
    const assigned = assignedCount || 0;

    const completionRate =
      assigned > 0 ? Number(((completedCount / assigned) * 100).toFixed(2)) : null;

    let avgScore: number | null = null;
    if (completedCount > 0) {
      const scoredAttempts = attemptList.filter((a) => a.score_percentage !== null);
      if (scoredAttempts.length > 0) {
        const sumScore = scoredAttempts.reduce((acc, a) => acc + (a.score_percentage || 0), 0);
        avgScore = Number((sumScore / scoredAttempts.length).toFixed(2));
      }
    }

    // Practice sessions
    const { count: practiceCount } = await supabase
      .from("preparation_practice_sessions")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId);

    return {
      totalAssigned: assigned,
      totalCompleted: completedCount,
      completionRatePercentage: completionRate,
      averageCohortScore: avgScore,
      totalPracticeSessions: practiceCount || 0,
      dataSource: {
        calculatedAt: new Date().toISOString(),
        hasSufficientData: assigned > 0 || completedCount > 0,
      },
    };
  }

  /**
   * Computes Mistake-to-Mastery progress (captured vs resolved).
   */
  public static async getMasteryProgressionMetrics(
    tenantId: string
  ): Promise<MasteryProgressionMetrics> {
    const supabase = await createServerSupabaseClient();

    const { data: targets } = await supabase
      .from("mistake_review_targets")
      .select("id, mastery_state")
      .eq("tenant_id", tenantId);

    const list = targets || [];
    const total = list.length;
    const active = list.filter((t) => t.mastery_state === "ACTIVE" || t.mastery_state === "IN_PRACTICE").length;
    const mastered = list.filter((t) => t.mastery_state === "MASTERED").length;

    const resolutionRate = total > 0 ? Number(((mastered / total) * 100).toFixed(2)) : null;

    return {
      totalMistakesCaptured: total,
      activeMistakesCount: active,
      masteredMistakesCount: mastered,
      masteryResolutionRatePercentage: resolutionRate,
    };
  }

  /**
   * Computes topic weakness heatmap across cohort attempts.
   */
  public static async getTopicWeaknessHeatmap(
    tenantId: string
  ): Promise<{ success: boolean; heatmap: TopicWeaknessItem[]; error?: string }> {
    const supabase = await createServerSupabaseClient();

    // Query attempt responses joined with questions to aggregate by topic
    const { data: responses, error } = await supabase
      .from("attempt_responses")
      .select("is_correct, questions(topic, skill_id, skills(name))")
      .eq("tenant_id", tenantId);

    if (error) {
      return { success: false, heatmap: [], error: error.message };
    }

    const topicStats = new Map<string, { correct: number; total: number; skillName?: string }>();

    for (const r of responses || []) {
      const q = r.questions as { topic?: string; skills?: { name?: string } | null } | null;
      const topic = q?.topic?.trim() || "Uncategorized";
      const skillName = q?.skills?.name || undefined;

      const current = topicStats.get(topic) || { correct: 0, total: 0, skillName };
      current.total++;
      if (r.is_correct) {
        current.correct++;
      }
      topicStats.set(topic, current);
    }

    const heatmap: TopicWeaknessItem[] = [];

    for (const [topic, stats] of topicStats.entries()) {
      const accuracy = Number(((stats.correct / stats.total) * 100).toFixed(1));
      let severity: TopicWeaknessItem["weaknessSeverity"] = "COMPETENT";

      if (accuracy < 50) {
        severity = "CRITICAL_WEAKNESS";
      } else if (accuracy < 70) {
        severity = "MODERATE_WEAKNESS";
      } else if (accuracy >= 85) {
        severity = "STRONG";
      }

      heatmap.push({
        topic,
        skillName: stats.skillName,
        totalAttempts: stats.total,
        correctAttempts: stats.correct,
        accuracyPercentage: accuracy,
        weaknessSeverity: severity,
      });
    }

    // Sort by accuracy ascending (most critical weaknesses first)
    heatmap.sort((a, b) => a.accuracyPercentage - b.accuracyPercentage);

    return { success: true, heatmap };
  }
}
