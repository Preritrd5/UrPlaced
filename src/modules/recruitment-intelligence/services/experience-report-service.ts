import { createClient } from "@/lib/supabase/server";
import { RecruitmentExperienceReportRow, ReportOrigin, ModerationStatus } from "@/types/database";
import { AuditService } from "@/modules/identity-access/services/audit-service";

export interface SubmitExperienceReportInput {
  tenantId: string;
  companyId: string;
  driveId?: string | null;
  academicYearId?: string | null;
  roleTitle: string;
  recruitmentCycle: string;
  reportOrigin?: ReportOrigin;
  roundsDescribed: any[];
  keyTopics?: string[];
  isAnonymous?: boolean;
  notes?: string | null;
  studentId?: string | null;
  userId?: string;
}

export class ExperienceReportService {
  /**
   * Submit a historical experience report
   */
  public static async submitReport(input: SubmitExperienceReportInput): Promise<RecruitmentExperienceReportRow> {
    const supabase = await createClient();

    const insertPayload = {
      tenant_id: input.tenantId,
      company_id: input.companyId,
      drive_id: input.driveId || null,
      academic_year_id: input.academicYearId || null,
      role_title: input.roleTitle.trim(),
      recruitment_cycle: input.recruitmentCycle.trim(),
      report_origin: input.reportOrigin || "CANDIDATE_REPORTED",
      rounds_described: input.roundsDescribed || [],
      key_topics: input.keyTopics || [],
      moderation_status: "PENDING" as ModerationStatus,
      is_anonymous: input.isAnonymous ?? true,
      student_id: input.studentId || null,
      notes: input.notes?.trim() || null,
    };

    const { data, error } = await supabase
      .from("recruitment_experience_reports")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to submit experience report: ${error?.message || "Unknown error"}`);
    }

    if (input.userId) {
      await AuditService.log({
        tenantId: input.tenantId,
        actorId: input.userId,
        action: "EXPERIENCE_REPORT_SUBMIT",
        resourceType: "recruitment_experience_reports",
        resourceId: data.id,
        afterState: data,
      });
    }

    return data as RecruitmentExperienceReportRow;
  }

  /**
   * Moderate an experience report (Staff only)
   */
  public static async moderateReport(
    tenantId: string,
    reportId: string,
    status: ModerationStatus,
    userId: string
  ): Promise<RecruitmentExperienceReportRow> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("recruitment_experience_reports")
      .update({
        moderation_status: status,
        verified_by: userId,
        verified_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", reportId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to moderate report: ${error?.message || "Unknown error"}`);
    }

    await AuditService.log({
      tenantId,
      actorId: userId,
      action: "EXPERIENCE_REPORT_MODERATE",
      resourceType: "recruitment_experience_reports",
      resourceId: reportId,
      afterState: data,
    });

    return data as RecruitmentExperienceReportRow;
  }

  /**
   * List experience reports for a company or drive with student privacy scrubbing
   */
  public static async getReports(
    tenantId: string,
    filters: { companyId?: string; driveId?: string; approvedOnly?: boolean }
  ): Promise<RecruitmentExperienceReportRow[]> {
    const supabase = await createClient();

    let query = supabase
      .from("recruitment_experience_reports")
      .select("*")
      .eq("tenant_id", tenantId);

    if (filters.driveId) {
      query = query.eq("drive_id", filters.driveId);
    } else if (filters.companyId) {
      query = query.eq("company_id", filters.companyId);
    }

    if (filters.approvedOnly) {
      query = query.eq("moderation_status", "APPROVED");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch experience reports: ${error.message}`);
    }

    // Scrub student ID if marked anonymous or for public student views
    return (data || []).map((report: any) => {
      if (report.is_anonymous) {
        return { ...report, student_id: null };
      }
      return report;
    }) as RecruitmentExperienceReportRow[];
  }
}
