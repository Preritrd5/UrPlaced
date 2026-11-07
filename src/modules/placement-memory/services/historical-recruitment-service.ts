/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Placement Memory: Historical Recruitment Service (Phase 09)
 * ==============================================================================
 * Manages institutional recruitment records, verified rounds, provenance tracking,
 * and reliable labeling (OFFICIAL_CONFIRMED, VERIFIED_HISTORICAL, etc.).
 */

import {
  HistoricalRecruitmentRecordRow,
  HistoricalRecordType,
  HistoricalReliabilityLabel,
  VerificationStatus,
  Json,
} from "@/types/database";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CreateHistoricalRecordInput {
  companyId: string;
  roleTitle: string;
  recruitmentYear: string;
  recruitmentCycle: string;
  historicalDriveId?: string | null;
  sourceId?: string | null;
  recordType?: HistoricalRecordType;
  reliabilityLabel?: HistoricalReliabilityLabel;
  processSummary?: string | null;
  eligibilityCriteriaSnapshot?: Record<string, unknown> | null;
  confirmedRounds?: Array<Record<string, unknown>> | null;
  reportedRounds?: Array<Record<string, unknown>> | null;
  relevantQuestionSetId?: string | null;
  verificationStatus?: VerificationStatus;
  sourceDate?: string | null;
  sharingScope?: "COLLEGE_PRIVATE" | "GLOBAL_SHARED";
}

export interface HistoricalRecordFilter {
  companyId?: string;
  roleTitle?: string;
  recruitmentYear?: string;
  reliabilityLabel?: HistoricalReliabilityLabel;
  recordType?: HistoricalRecordType;
  sharingScope?: "COLLEGE_PRIVATE" | "GLOBAL_SHARED";
}

export class HistoricalRecruitmentService {
  /**
   * Creates a historical recruitment record with explicit provenance and reliability classification.
   */
  public static async createRecord(
    tenantId: string,
    createdBy: string,
    input: CreateHistoricalRecordInput
  ): Promise<{ success: boolean; record?: HistoricalRecruitmentRecordRow; error?: string }> {
    if (!input.companyId || !input.roleTitle || !input.recruitmentYear || !input.recruitmentCycle) {
      return { success: false, error: "Missing required recruitment record fields." };
    }

    const supabase = createAdminClient();

    const insertPayload = {
      tenant_id: tenantId,
      company_id: input.companyId,
      role_title: input.roleTitle.trim(),
      recruitment_year: input.recruitmentYear.trim(),
      recruitment_cycle: input.recruitmentCycle.trim(),
      historical_drive_id: input.historicalDriveId || null,
      source_id: input.sourceId || null,
      record_type: input.recordType || "COLLEGE_CONFIRMED",
      reliability_label: input.reliabilityLabel || "VERIFIED_HISTORICAL",
      process_summary: input.processSummary || null,
      eligibility_criteria_snapshot: (input.eligibilityCriteriaSnapshot || {}) as Json,
      confirmed_rounds: (input.confirmedRounds || []) as unknown as Json,
      reported_rounds: (input.reportedRounds || []) as unknown as Json,
      relevant_question_set_id: input.relevantQuestionSetId || null,
      verification_status: input.verificationStatus || "UNVERIFIED",
      source_date: input.sourceDate || new Date().toISOString(),
      last_verified_at: input.verificationStatus === "VERIFIED" ? new Date().toISOString() : null,
      is_superseded: false,
      superseded_by: null,
      sharing_scope: input.sharingScope || "COLLEGE_PRIVATE",
      created_by: createdBy,
    };

    const { data, error } = await supabase
      .from("historical_recruitment_records")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Failed to persist historical recruitment record." };
    }

    return { success: true, record: data };
  }

  /**
   * Retrieves historical records for a college tenant (own private records + global shared records).
   */
  public static async listRecords(
    tenantId: string,
    filter?: HistoricalRecordFilter
  ): Promise<{ success: boolean; records: HistoricalRecruitmentRecordRow[]; error?: string }> {
    const supabase = createAdminClient();

    let query = supabase
      .from("historical_recruitment_records")
      .select("*, companies(name, website)")
      .or(`tenant_id.eq.${tenantId},sharing_scope.eq.GLOBAL_SHARED`);

    if (filter?.companyId) {
      query = query.eq("company_id", filter.companyId);
    }
    if (filter?.recruitmentYear) {
      query = query.eq("recruitment_year", filter.recruitmentYear);
    }
    if (filter?.reliabilityLabel) {
      query = query.eq("reliability_label", filter.reliabilityLabel);
    }
    if (filter?.recordType) {
      query = query.eq("record_type", filter.recordType);
    }
    if (filter?.roleTitle) {
      query = query.ilike("role_title", `%${filter.roleTitle}%`);
    }

    const { data, error } = await query.order("recruitment_year", { ascending: false });

    if (error) {
      return { success: false, records: [], error: error.message };
    }

    return { success: true, records: data || [] };
  }

  /**
   * Gets a specific historical recruitment record by ID.
   */
  public static async getRecordById(
    tenantId: string,
    recordId: string
  ): Promise<{ success: boolean; record?: HistoricalRecruitmentRecordRow; error?: string }> {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("historical_recruitment_records")
      .select("*, companies(name, website)")
      .eq("id", recordId)
      .or(`tenant_id.eq.${tenantId},sharing_scope.eq.GLOBAL_SHARED`)
      .single();

    if (error || !data) {
      return { success: false, error: error?.message || "Historical record not found or inaccessible." };
    }

    return { success: true, record: data };
  }

  /**
   * Links a verified Question Set to a historical recruitment record for realistic preparation.
   */
  public static async linkQuestionSet(
    tenantId: string,
    recordId: string,
    questionSetId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("historical_recruitment_records")
      .update({
        relevant_question_set_id: questionSetId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("tenant_id", tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  /**
   * Marks a historical record as superseded by a newer version/pattern.
   */
  public static async supersedeRecord(
    tenantId: string,
    recordId: string,
    supersededById: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from("historical_recruitment_records")
      .update({
        is_superseded: true,
        superseded_by: supersededById,
        reliability_label: "SUPERSEDED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", recordId)
      .eq("tenant_id", tenantId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }
}
