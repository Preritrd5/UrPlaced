/**
 * Recruitment Drive Service
 * Manages drive lifecycles, configuration, publishing validations, and state machine transitions.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";
import type { Database, DriveStatus, RecruitmentType } from "@/types/database";

export type DriveRow = Database["public"]["Tables"]["recruitment_drives"]["Row"];
export type DriveInsert = Database["public"]["Tables"]["recruitment_drives"]["Insert"];
export type DriveUpdate = Database["public"]["Tables"]["recruitment_drives"]["Update"];

export interface DriveFilterParams {
  tenantId: string;
  companyId?: string;
  academicYearId?: string;
  status?: DriveStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DriveListResult {
  drives: (DriveRow & {
    company?: { id: string; name: string; industry: string | null };
    academic_year?: { id: string; name: string };
    applicants_count?: number;
  })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class DriveService {
  /**
   * Allowed state transitions for recruitment drives
   */
  private static readonly VALID_TRANSITIONS: Record<DriveStatus, DriveStatus[]> = {
    DRAFT: ["PUBLISHED", "CANCELLED"],
    PUBLISHED: ["REGISTRATION_OPEN", "IN_PROGRESS", "CANCELLED"],
    REGISTRATION_OPEN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: ["ARCHIVED"],
    CANCELLED: ["ARCHIVED"],
    ARCHIVED: [],
  };

  /**
   * List drives with filter, search, and pagination
   */
  static async list(params: DriveFilterParams): Promise<DriveListResult> {
    const supabase = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("recruitment_drives")
      .select(
        "*, company:companies(id, name, industry), academic_year:academic_years(id, name), applications:drive_applications(count)",
        { count: "exact" }
      )
      .eq("tenant_id", params.tenantId);

    if (params.status) {
      query = query.eq("status", params.status);
    }

    if (params.companyId) {
      query = query.eq("company_id", params.companyId);
    }

    if (params.academicYearId) {
      query = query.eq("academic_year_id", params.academicYearId);
    }

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`title.ilike.${term},role_title.ilike.${term}`);
    }

    query = query.order("created_at", { ascending: false }).range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new Error(`Failed to list recruitment drives: ${error.message}`);
    }

    const total = count || 0;
    const drives = ((data as any) || []).map((d: any) => ({
      ...d,
      applicants_count: d.applications?.[0]?.count || 0,
    }));

    return {
      drives,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Get drive by ID with associated stages, company, and eligibility criteria
   */
  static async getById(tenantId: string, id: string): Promise<any | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("recruitment_drives")
      .select(
        "*, company:companies(*), academic_year:academic_years(*), stages:drive_stages(*), criteria:drive_eligibility_criteria(*), applications:drive_applications(count)"
      )
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get recruitment drive: ${error.message}`);
    }

    if (!data) return null;

    return {
      ...data,
      applicants_count: data.applications?.[0]?.count || 0,
      stages: (data.stages || []).sort((a: any, b: any) => a.stage_order - b.stage_order),
      criteria: data.criteria?.[0] || null,
    };
  }

  /**
   * Create a new recruitment drive (starts as DRAFT)
   */
  static async create(drive: {
    tenantId: string;
    companyId: string;
    academicYearId: string;
    title: string;
    roleTitle: string;
    recruitmentType?: RecruitmentType;
    jobDescription?: string | null;
    location?: string | null;
    compensationRange?: string | null;
    registrationStart?: string | null;
    registrationDeadline?: string | null;
    internalNotes?: string | null;
    createdBy?: string | null;
  }): Promise<DriveRow> {
    const supabase = createAdminClient();

    if (
      drive.registrationStart &&
      drive.registrationDeadline &&
      new Date(drive.registrationStart) > new Date(drive.registrationDeadline)
    ) {
      throw new Error("Registration start date must precede the registration deadline.");
    }

    const { data, error } = await supabase
      .from("recruitment_drives")
      .insert({
        tenant_id: drive.tenantId,
        company_id: drive.companyId,
        academic_year_id: drive.academicYearId,
        title: drive.title.trim(),
        role_title: drive.roleTitle.trim(),
        recruitment_type: drive.recruitmentType || "FULL_TIME",
        job_description: drive.jobDescription || null,
        location: drive.location || null,
        compensation_range: drive.compensationRange || null,
        status: "DRAFT",
        registration_start: drive.registrationStart || null,
        registration_deadline: drive.registrationDeadline || null,
        internal_notes: drive.internalNotes || null,
        created_by: drive.createdBy || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create recruitment drive: ${error.message}`);
    }

    return data;
  }

  /**
   * Transition drive lifecycle status with state machine checks
   */
  static async transitionStatus(
    tenantId: string,
    driveId: string,
    targetStatus: DriveStatus,
    reason?: string
  ): Promise<DriveRow> {
    const currentDrive = await this.getById(tenantId, driveId);
    if (!currentDrive) {
      throw new Error("Recruitment drive not found.");
    }

    const allowed = this.VALID_TRANSITIONS[currentDrive.status as DriveStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(
        `Invalid status transition from '${currentDrive.status}' to '${targetStatus}'. Allowed: ${allowed.join(", ") || "None"}.`
      );
    }

    // Specific validation for publishing
    if (targetStatus === "PUBLISHED" || targetStatus === "REGISTRATION_OPEN") {
      if (!currentDrive.criteria) {
        throw new Error("Cannot publish drive without configuring eligibility criteria.");
      }
      if (!currentDrive.role_title) {
        throw new Error("Drive role title is required before publication.");
      }
    }

    const supabase = createAdminClient();
    const payload: any = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (targetStatus === "CANCELLED" && reason) {
      payload.cancellation_reason = reason.trim();
    }

    const { data, error } = await supabase
      .from("recruitment_drives")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("id", driveId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to transition drive status: ${error.message}`);
    }

    return data;
  }

  /**
   * Update drive details (only permitted in safe states)
   */
  static async update(
    tenantId: string,
    id: string,
    updates: Partial<{
      title: string;
      roleTitle: string;
      jobDescription: string | null;
      location: string | null;
      compensationRange: string | null;
      registrationStart: string | null;
      registrationDeadline: string | null;
      internalNotes: string | null;
    }>
  ): Promise<DriveRow> {
    const supabase = createAdminClient();
    const payload: any = { updated_at: new Date().toISOString() };

    if (updates.title) payload.title = updates.title.trim();
    if (updates.roleTitle) payload.role_title = updates.roleTitle.trim();
    if (updates.jobDescription !== undefined) payload.job_description = updates.jobDescription;
    if (updates.location !== undefined) payload.location = updates.location;
    if (updates.compensationRange !== undefined) payload.compensation_range = updates.compensationRange;
    if (updates.registrationStart !== undefined) payload.registration_start = updates.registrationStart;
    if (updates.registrationDeadline !== undefined) payload.registration_deadline = updates.registrationDeadline;
    if (updates.internalNotes !== undefined) payload.internal_notes = updates.internalNotes;

    const { data, error } = await supabase
      .from("recruitment_drives")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update drive: ${error.message}`);
    }

    return data;
  }
}
