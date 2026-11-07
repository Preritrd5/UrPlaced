/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Placement Memory: Report Moderation Service (Phase 09)
 * ==============================================================================
 * Moderates student-submitted recruitment debriefs and experience reports.
 * Enforces candidate anonymity, audit trails, and automatic promotion to
 * verified institutional memory.
 */

import {
  RecruitmentExperienceReportRow,
  ExperienceReportModerationLogRow,
  ModerationStatus,
  Json,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { HistoricalRecruitmentService } from "./historical-recruitment-service";

export interface SubmitExperienceReportInput {
  companyId?: string;
  companyName?: string;
  driveId?: string | null;
  academicYearId?: string | null;
  roleTitle: string;
  recruitmentCycle: string;
  roundsDescribed: Array<{
    roundNumber: number;
    roundName: string;
    description: string;
    topicsCovered?: string[];
    difficulty?: string;
  }>;
  keyTopics?: string[];
  isAnonymous?: boolean;
  notes?: string | null;
}

export class ReportModerationService {
  /**
   * Submits a student recruitment experience debrief into the moderation queue.
   */
  public static async submitReport(
    tenantId: string,
    studentId: string,
    input: SubmitExperienceReportInput
  ): Promise<{ success: boolean; report?: RecruitmentExperienceReportRow; error?: string }> {
    if ((!input.companyId && !input.companyName) || !input.roleTitle || !input.recruitmentCycle || !input.roundsDescribed) {
      return { success: false, error: "Missing required recruitment report fields." };
    }

    const supabase = createAdminClient();

    let resolvedCompanyId = input.companyId;

    if (resolvedCompanyId) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("id", resolvedCompanyId)
        .maybeSingle();
      if (!existing) {
        resolvedCompanyId = undefined;
      }
    }

    if (!resolvedCompanyId) {
      const targetName = (input.companyName || "Hiring Partner").trim();
      const { data: compByName } = await supabase
        .from("companies")
        .select("id")
        .eq("tenant_id", tenantId)
        .ilike("name", targetName)
        .maybeSingle();

      if (compByName) {
        resolvedCompanyId = compByName.id;
      } else {
        const { data: createdComp } = await supabase
          .from("companies")
          .insert({
            tenant_id: tenantId,
            name: targetName,
            industry: "Technology",
          })
          .select("id")
          .single();
        resolvedCompanyId = createdComp?.id;
      }
    }

    if (!resolvedCompanyId) {
      return { success: false, error: "Unable to associate report with a valid company." };
    }

    const insertPayload = {
      tenant_id: tenantId,
      company_id: resolvedCompanyId,
      drive_id: input.driveId || null,
      academic_year_id: input.academicYearId || null,
      role_title: input.roleTitle.trim(),
      recruitment_cycle: input.recruitmentCycle.trim(),
      report_origin: "STUDENT_SUBMITTED" as const,
      rounds_described: input.roundsDescribed as unknown as Json,
      key_topics: input.keyTopics || [],
      moderation_status: "PENDING" as ModerationStatus,
      is_anonymous: input.isAnonymous ?? true,
      student_id: studentId,
      notes: input.notes || null,
    };

    const { data: report, error } = await supabase
      .from("recruitment_experience_reports")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !report) {
      return { success: false, error: error?.message || "Failed to submit recruitment experience report." };
    }

    // Log moderation action: initial submission
    await supabase.from("experience_report_moderation_logs").insert({
      tenant_id: tenantId,
      report_id: report.id,
      previous_status: "DRAFT",
      new_status: "PENDING",
      moderated_by: studentId,
      moderation_notes: "Initial submission by student candidate",
    });

    return { success: true, report };
  }

  /**
   * Lists experience reports awaiting review for staff/admin.
   */
  public static async listPendingReports(
    tenantId: string
  ): Promise<{ success: boolean; reports: RecruitmentExperienceReportRow[]; error?: string }> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("recruitment_experience_reports")
      .select("*, companies(name), students(full_name, enrollment_number)")
      .eq("tenant_id", tenantId)
      .eq("moderation_status", "PENDING")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, reports: [], error: error.message };
    }

    return { success: true, reports: data || [] };
  }

  /**
   * Moderates an experience report (APPROVE or REJECT) and logs the decision.
   * If approved, optionally creates an institutional historical recruitment record.
   */
  public static async moderateReport(
    tenantId: string,
    moderatorId: string,
    reportId: string,
    decision: ModerationStatus,
    notes?: string,
    promoteToMemory?: boolean
  ): Promise<{
    success: boolean;
    report?: RecruitmentExperienceReportRow;
    auditLog?: ExperienceReportModerationLogRow;
    error?: string;
  }> {
    const supabase = createAdminClient();

    // 1. Fetch current report
    const { data: currentReport, error: fetchErr } = await supabase
      .from("recruitment_experience_reports")
      .select("*")
      .eq("id", reportId)
      .eq("tenant_id", tenantId)
      .single();

    if (fetchErr || !currentReport) {
      return { success: false, error: fetchErr?.message || "Report not found." };
    }

    const previousStatus = currentReport.moderation_status;

    // 2. Update report status
    const { data: updatedReport, error: updateErr } = await supabase
      .from("recruitment_experience_reports")
      .update({
        moderation_status: decision,
        verified_by: moderatorId,
        verified_at: new Date().toISOString(),
        notes: notes || currentReport.notes,
      })
      .eq("id", reportId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (updateErr || !updatedReport) {
      return { success: false, error: updateErr?.message || "Failed to update moderation status." };
    }

    // 3. Insert audit log
    const { data: auditLog } = await supabase
      .from("experience_report_moderation_logs")
      .insert({
        tenant_id: tenantId,
        report_id: reportId,
        previous_status: previousStatus,
        new_status: decision,
        moderated_by: moderatorId,
        moderation_notes: notes || `Moderation decision: ${decision}`,
      })
      .select()
      .single();

    // 4. Promote to institutional memory if approved and requested
    if (decision === "APPROVED" && promoteToMemory) {
      await HistoricalRecruitmentService.createRecord(tenantId, moderatorId, {
        companyId: currentReport.company_id,
        roleTitle: currentReport.role_title,
        recruitmentYear: new Date().getFullYear().toString(),
        recruitmentCycle: currentReport.recruitment_cycle,
        historicalDriveId: currentReport.drive_id,
        recordType: "CANDIDATE_REPORTED",
        reliabilityLabel: "CANDIDATE_REPORTED",
        processSummary: notes || "Moderated and approved candidate recruitment debrief",
        reportedRounds: Array.isArray(currentReport.rounds_described)
          ? (currentReport.rounds_described as unknown as Array<Record<string, unknown>>)
          : [],
        verificationStatus: "VERIFIED",
        sharingScope: "COLLEGE_PRIVATE",
      });
    }

    return {
      success: true,
      report: updatedReport,
      auditLog: auditLog || undefined,
    };
  }

  /**
   * Retrieves approved reports for a company or drive, masking student details
   * if anonymous and the requester is a student.
   */
  public static async getApprovedReports(
    tenantId: string,
    filter: { companyId?: string; driveId?: string },
    isStaff: boolean
  ): Promise<{ success: boolean; reports: Partial<RecruitmentExperienceReportRow>[]; error?: string }> {
    const supabase = createAdminClient();

    let query = supabase
      .from("recruitment_experience_reports")
      .select("*, companies(name), students(full_name, enrollment_number)")
      .eq("tenant_id", tenantId)
      .eq("moderation_status", "APPROVED");

    if (filter.companyId) {
      query = query.eq("company_id", filter.companyId);
    }
    if (filter.driveId) {
      query = query.eq("drive_id", filter.driveId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      return { success: false, reports: [], error: error.message };
    }

    // Mask anonymity for students
    const sanitizedReports = (data || []).map((rep) => {
      if (rep.is_anonymous && !isStaff) {
        return {
          ...rep,
          student_id: null,
          students: { full_name: "Anonymous Candidate", enrollment_number: "REDACTED", roll_number: "REDACTED" },
        };
      }
      return rep;
    });

    return { success: true, reports: sanitizedReports };
  }
}
