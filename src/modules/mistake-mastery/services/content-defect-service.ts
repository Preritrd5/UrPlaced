/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Mistake Bank: Content Defect & Question Fairness Service (Phase 08)
 * ==============================================================================
 * Handles reporting, moderation, and unfair mistake invalidation for defective
 * questions or erroneous answer keys without penalizing students.
 */

import {
  QuestionDefectType,
  DefectReportStatus,
  QuestionDefectReportRow,
} from "@/types/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { MasteryEvaluationService } from "./mastery-evaluation-service";

export interface ReportDefectInput {
  questionId: string;
  versionId: string;
  defectType: QuestionDefectType;
  description: string;
}

export interface ResolveDefectInput {
  defectId: string;
  decision: "CONFIRMED_DEFECT" | "FALSE_ALARM" | "RESOLVED";
  resolutionNotes: string;
  invalidateStudentMistakes?: boolean;
}

export class ContentDefectService {
  /**
   * Files a question defect report from a student or staff member.
   */
  public static async reportDefect(
    tenantId: string,
    userId: string,
    input: ReportDefectInput
  ): Promise<{ success: boolean; report?: QuestionDefectReportRow; error?: string }> {
    const supabase = createAdminClient();

    if (!input.description || input.description.trim().length < 5) {
      return { success: false, error: "Please provide a detailed description (at least 5 characters)." };
    }

    const { data: report, error } = await supabase
      .from("question_defect_reports")
      .insert({
        tenant_id: tenantId,
        question_id: input.questionId,
        version_id: input.versionId,
        reported_by: userId,
        defect_type: input.defectType,
        description: input.description.trim(),
        status: "PENDING",
      })
      .select()
      .single();

    if (error || !report) {
      return { success: false, error: error?.message || "Failed to submit defect report." };
    }

    // Flag student's own review target as suspected defect
    await supabase
      .from("mistake_review_targets")
      .update({
        primary_reason: "CONTENT_DEFECT_SUSPECTED",
        status: "CONTENT_DEFECT_SUSPECTED",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("question_id", input.questionId)
      .eq("version_id", input.versionId);

    return { success: true, report };
  }

  /**
   * Resolves a defect report and conditionally invalidates unfair student mistakes.
   */
  public static async resolveDefect(
    tenantId: string,
    reviewerId: string,
    input: ResolveDefectInput
  ): Promise<{
    success: boolean;
    report?: QuestionDefectReportRow;
    invalidatedTargetsCount?: number;
    error?: string;
  }> {
    const supabase = createAdminClient();
    const nowIso = new Date().toISOString();

    // 1. Fetch defect report
    const { data: report, error: fetchErr } = await supabase
      .from("question_defect_reports")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", input.defectId)
      .single();

    if (fetchErr || !report) {
      return { success: false, error: fetchErr?.message || "Defect report not found." };
    }

    // 2. Update report status
    const { data: updatedReport, error: updateErr } = await supabase
      .from("question_defect_reports")
      .update({
        status: input.decision,
        reviewed_by: reviewerId,
        resolution_notes: input.resolutionNotes,
        resolved_at: nowIso,
      })
      .eq("id", input.defectId)
      .select()
      .single();

    if (updateErr || !updatedReport) {
      return { success: false, error: updateErr?.message || "Failed to resolve defect report." };
    }

    let invalidatedTargetsCount = 0;

    // 3. If defect is confirmed and mistakes should be invalidated:
    if (input.decision === "CONFIRMED_DEFECT" || input.invalidateStudentMistakes) {
      // Find all mistake review targets for this question version
      const { data: affectedTargets } = await supabase
        .from("mistake_review_targets")
        .select("id, student_id, skill_id")
        .eq("tenant_id", tenantId)
        .eq("question_id", report.question_id)
        .eq("version_id", report.version_id);

      if (affectedTargets && affectedTargets.length > 0) {
        // Invalidate targets
        await supabase
          .from("mistake_review_targets")
          .update({
            status: "CONTENT_INVALIDATED",
            updated_at: nowIso,
          })
          .eq("tenant_id", tenantId)
          .eq("question_id", report.question_id)
          .eq("version_id", report.version_id);

        invalidatedTargetsCount = affectedTargets.length;

        // Invalidate mastery evidence records that used this question version
        await supabase
          .from("mastery_evidence_records")
          .update({
            validity_status: "INVALIDATED_DEFECT",
            invalidation_reason: `Invalidated by staff resolution: ${input.resolutionNotes}`,
          })
          .eq("tenant_id", tenantId)
          .eq("evidence_question_id", report.question_id)
          .eq("evidence_version_id", report.version_id);

        // Recalculate skill mastery for all affected students
        const affectedStudentSkills = new Set<string>();
        for (const t of affectedTargets) {
          if (t.skill_id) {
            affectedStudentSkills.add(`${t.student_id}:${t.skill_id}`);
          }
        }

        for (const item of Array.from(affectedStudentSkills)) {
          const [sId, skId] = item.split(":");
          await MasteryEvaluationService.evaluateSkillMastery(tenantId, sId, skId);
        }
      }
    } else if (input.decision === "FALSE_ALARM") {
      // Restore targets from CONTENT_DEFECT_SUSPECTED back to NEEDS_REVIEW
      await supabase
        .from("mistake_review_targets")
        .update({
          status: "NEEDS_REVIEW",
          updated_at: nowIso,
        })
        .eq("tenant_id", tenantId)
        .eq("question_id", report.question_id)
        .eq("version_id", report.version_id)
        .eq("status", "CONTENT_DEFECT_SUSPECTED");
    }

    return {
      success: true,
      report: updatedReport,
      invalidatedTargetsCount,
    };
  }

  /**
   * Lists defect reports with optional status filtering.
   */
  public static async listReports(
    tenantId: string,
    filter?: { status?: DefectReportStatus; questionId?: string }
  ): Promise<{ success: boolean; reports?: QuestionDefectReportRow[]; error?: string }> {
    const supabase = createAdminClient();

    let query = supabase
      .from("question_defect_reports")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (filter?.status) {
      query = query.eq("status", filter.status);
    }
    if (filter?.questionId) {
      query = query.eq("question_id", filter.questionId);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, reports: data || [] };
  }
}
