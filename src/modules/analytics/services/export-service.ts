/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Analytics: Secure Export Engine (Phase 09)
 * ==============================================================================
 * Implements tenant-scoped CSV reporting with strict formula injection sanitization.
 * Prevents execution of malicious expressions (=, +, -, @) in spreadsheet tools.
 */

import {
  AnalyticsReportType,
  AnalyticsExportJobRow,
  Json,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AnalyticsMetricService } from "./analytics-metric-service";
import { TrainingSessionService } from "@/modules/training/services/training-session-service";

export class ExportService {
  /**
   * Sanitizes a cell value to prevent CSV Formula Injection (CWE-1236).
   * If a value begins with =, +, -, @, \t, or \r, prepend a single quote (').
   */
  public static sanitizeCell(value: unknown): string {
    if (value === null || value === undefined) {
      return "";
    }
    let str = String(value);
    if (/^[=+\-@\t\r]/.test(str) || /^\s*[=+\-@]/.test(str)) {
      str = `'${str}`;
    }
    // Escape double quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Formats a 2D array of rows into a sanitized CSV string.
   */
  public static toCsv(rows: Array<Array<unknown>>): string {
    return rows.map((row) => row.map((cell) => this.sanitizeCell(cell)).join(",")).join("\n");
  }

  /**
   * Initiates and completes an export job, returning the generated CSV content.
   */
  public static async generateReportCsv(
    tenantId: string,
    requestedBy: string,
    reportType: AnalyticsReportType,
    filterPayload: Record<string, unknown> = {}
  ): Promise<{
    success: boolean;
    csvContent?: string;
    fileName?: string;
    job?: AnalyticsExportJobRow;
    error?: string;
  }> {
    const supabase = await createServerSupabaseClient();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `${reportType.toLowerCase()}_${timestamp}.csv`;

    // 1. Create audit record for export job
    const { data: job, error: jobErr } = await supabase
      .from("analytics_export_jobs")
      .insert({
        tenant_id: tenantId,
        requested_by: requestedBy,
        report_type: reportType,
        filter_payload: filterPayload as Json,
        file_name: fileName,
        status: "PROCESSING",
        record_count: 0,
      })
      .select()
      .single();

    if (jobErr || !job) {
      return { success: false, error: jobErr?.message || "Failed to initialize export job." };
    }

    try {
      let rows: Array<Array<unknown>> = [];

      switch (reportType) {
        case "PLACEMENT_OUTCOMES": {
          const metrics = await AnalyticsMetricService.getCohortPlacementMetrics(tenantId);
          rows = [
            ["Metric Name", "Value", "Notes"],
            ["Total Eligible Students", metrics.totalEligibleStudents, "Enrolled cohort denominator"],
            ["Unique Placed Students", metrics.uniquePlacedStudents, "Distinct students with confirmed/accepted offers"],
            ["Placement Rate (%)", metrics.placementRatePercentage ?? "N/A", "Unique Placed / Total Eligible * 100"],
            ["Total Applications", metrics.totalApplications, "Total candidate drive registrations"],
            ["Total Offers Extended", metrics.totalOffersExtended, "Total offer letters issued"],
            ["Accepted Offers Count", metrics.acceptedOffersCount, "Offers formally accepted by candidates"],
            ["Average Offers / Placed Student", metrics.averageOffersPerPlacedStudent ?? "N/A", "Multiple offer distribution"],
          ];
          break;
        }

        case "DRIVE_COMPARISONS": {
          const { data: drives } = await supabase
            .from("recruitment_drives")
            .select("id, role_title, status, companies(name)")
            .eq("tenant_id", tenantId);

          rows = [["Drive ID", "Company", "Role Title", "Status"]];
          for (const d of drives || []) {
            const comp = d.companies as { name?: string } | null;
            rows.push([d.id, comp?.name || "N/A", d.role_title, d.status]);
          }
          break;
        }

        case "TRAINING_BEFORE_AFTER": {
          const { sessions } = await TrainingSessionService.listSessions(tenantId);
          rows = [["Session ID", "Title", "Topic", "Session Date", "Duration (Mins)", "Status"]];
          for (const s of sessions) {
            rows.push([s.id, s.title, s.topic, s.session_date, s.duration_minutes, s.status]);
          }
          break;
        }

        case "COHORT_SKILL_GAPS": {
          const { heatmap } = await AnalyticsMetricService.getTopicWeaknessHeatmap(tenantId);
          rows = [
            ["Topic", "Skill Category", "Total Attempts", "Correct Attempts", "Accuracy (%)", "Severity"],
          ];
          for (const h of heatmap) {
            rows.push([
              h.topic,
              h.skillName || "General",
              h.totalAttempts,
              h.correctAttempts,
              `${h.accuracyPercentage}%`,
              h.weaknessSeverity,
            ]);
          }
          break;
        }

        case "HISTORICAL_DRIVES": {
          const { data: records } = await supabase
            .from("historical_recruitment_records")
            .select("id, role_title, recruitment_year, recruitment_cycle, reliability_label, companies(name)")
            .eq("tenant_id", tenantId);

          rows = [["Record ID", "Company", "Role Title", "Year", "Cycle", "Reliability"]];
          for (const r of records || []) {
            const comp = r.companies as { name?: string } | null;
            rows.push([r.id, comp?.name || "N/A", r.role_title, r.recruitment_year, r.recruitment_cycle, r.reliability_label]);
          }
          break;
        }

        case "CANDIDATE_REPORTS": {
          const { data: reports } = await supabase
            .from("recruitment_experience_reports")
            .select("id, role_title, recruitment_cycle, moderation_status, companies(name)")
            .eq("tenant_id", tenantId);

          rows = [["Report ID", "Company", "Role Title", "Cycle", "Moderation Status"]];
          for (const rep of reports || []) {
            const comp = rep.companies as { name?: string } | null;
            rows.push([rep.id, comp?.name || "N/A", rep.role_title, rep.recruitment_cycle, rep.moderation_status]);
          }
          break;
        }

        case "STUDENT_PERFORMANCE": {
          const prep = await AnalyticsMetricService.getAssessmentPreparationMetrics(tenantId);
          rows = [
            ["Metric Name", "Value"],
            ["Total Assigned Assessments", prep.totalAssigned],
            ["Total Completed Submissions", prep.totalCompleted],
            ["Completion Rate (%)", prep.completionRatePercentage ?? "N/A"],
            ["Average Cohort Score (%)", prep.averageCohortScore ?? "N/A"],
            ["Total Practice Sessions", prep.totalPracticeSessions],
          ];
          break;
        }

        default:
          throw new Error(`Unsupported export report type: ${reportType}`);
      }

      const csvContent = this.toCsv(rows);
      const recordCount = Math.max(0, rows.length - 1);

      // Update job to COMPLETED
      await supabase
        .from("analytics_export_jobs")
        .update({
          status: "COMPLETED",
          record_count: recordCount,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return {
        success: true,
        csvContent,
        fileName,
        job: { ...job, status: "COMPLETED", record_count: recordCount },
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Export generation failed.";
      await supabase
        .from("analytics_export_jobs")
        .update({
          status: "FAILED",
          error_message: errorMsg,
          completed_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      return { success: false, error: errorMsg };
    }
  }
}
