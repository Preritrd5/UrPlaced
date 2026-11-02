/**
 * Student Service
 * Handles student records, search, filters, pagination, and profile management.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { UserDeletionService } from "@/modules/identity-access/services/user-deletion-service";
import type { Database, AcademicStatus } from "@/types/database";

export type StudentRow = Database["public"]["Tables"]["students"]["Row"];
export type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];
export type StudentUpdate = Database["public"]["Tables"]["students"]["Update"];

export interface StudentFilterParams {
  tenantId: string;
  search?: string;
  departmentId?: string;
  graduationYear?: number;
  academicStatus?: AcademicStatus;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "full_name" | "enrollment_number" | "cgpa" | "graduation_year" | "created_at";
  sortOrder?: "asc" | "desc";
}

export interface StudentListResult {
  students: (StudentRow & { department?: { name: string; code: string } })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StudentDeletionEligibility {
  eligible: boolean;
  student: StudentRow;
  blockingReasons: string[];
  dependencies: {
    hasUserAccount: boolean;
    applicationsCount: number;
    offersCount: number;
    assessmentAttemptsCount: number;
    mistakeBankCount: number;
    trainingCount: number;
  };
}

export interface BulkDeletePreviewResult {
  totalStudents: number;
  eligibleCount: number;
  protectedCount: number;
  breakdown: {
    withUserAccounts: number;
    withApplicationsOrOffers: number;
    withAssessmentsOrTraining: number;
  };
  sampleEligibleSrns: string[];
}

export interface BulkDeleteExecutionResult {
  success: boolean;
  deletedCount: number;
  protectedCount: number;
  totalBefore: number;
  message?: string;
}

export type FindEligibleRosterStatus =
  | "FOUND"
  | "NOT_FOUND"
  | "ALREADY_CLAIMED"
  | "AMBIGUOUS"
  | "INVALID_SRN";

export interface FindEligibleRosterResult {
  status: FindEligibleRosterStatus;
  roster?: StudentRow;
  matchesCount: number;
  message?: string;
}

export interface ClaimStudentRosterParams {
  srn: string;
  userId: string;
  fullName?: string;
  email?: string;
  tenantId?: string;
}

export type ClaimStudentRosterCode =
  | "CLAIMED_SUCCESSFULLY"
  | "INVALID_SRN"
  | "INVALID_USER"
  | "INVALID_NAME"
  | "INVALID_EMAIL"
  | "ROLE_CONFLICT"
  | "MEMBERSHIP_SUSPENDED"
  | "TENANT_MISMATCH"
  | "USER_ALREADY_HAS_ROSTER"
  | "ALREADY_CLAIMED"
  | "SRN_NOT_FOUND"
  | "AMBIGUOUS_SRN"
  | "CONCURRENT_CLAIM_CONFLICT"
  | "CLAIM_FAILED";

export interface ClaimStudentRosterResult {
  success: boolean;
  code: ClaimStudentRosterCode;
  message: string;
  studentId?: string;
  tenantId?: string;
  enrollmentNumber?: string;
  student?: StudentRow;
}

export class StudentService {
  /**
   * List students with filtering, search, sorting, and pagination
   */
  static async list(params: StudentFilterParams): Promise<StudentListResult> {
    const supabase = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("students")
      .select("*, department:departments(name, code)", { count: "exact" })
      .eq("tenant_id", params.tenantId);

    if (params.archivedOnly) {
      query = query.eq("is_archived", true);
    } else if (!params.includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (params.departmentId) {
      query = query.eq("department_id", params.departmentId);
    }

    if (params.graduationYear) {
      query = query.eq("graduation_year", params.graduationYear);
    }

    if (params.academicStatus) {
      query = query.eq("academic_status", params.academicStatus);
    }

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(
        `full_name.ilike.${term},enrollment_number.ilike.${term},email.ilike.${term}`
      );
    }

    const sortBy = params.sortBy || "full_name";
    const sortOrder = params.sortOrder || "asc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    query = query.range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      if (
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        return {
          students: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        };
      }
      throw new Error(`Failed to list students: ${error.message}`);
    }

    const total = count || 0;
    const studentsList = (data as any[]) || [];

    return {
      students: studentsList,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Get student by ID
   */
  static async getById(
    tenantId: string,
    id: string
  ): Promise<(StudentRow & { department?: { name: string; code: string } }) | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("students")
      .select("*, department:departments(name, code)")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get student: ${error.message}`);
    }

    return (data as any) || null;
  }

  /**
   * Get student by authenticated User ID
   */
  static async getByUserId(
    tenantId: string,
    userId: string
  ): Promise<(StudentRow & { department?: { name: string; code: string } }) | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("students")
      .select("*, department:departments(name, code)")
      .eq("tenant_id", tenantId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get student profile: ${error.message}`);
    }

    return (data as any) || null;
  }

  /**
   * Create a new student record
   */
  static async create(student: StudentInsert): Promise<StudentRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("students")
      .insert({
        ...student,
        email: student.email.trim().toLowerCase(),
        enrollment_number: student.enrollment_number.trim(),
        full_name: student.full_name.trim(),
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        if (error.message.includes("enrollment")) {
          throw new Error(`Enrollment number '${student.enrollment_number}' is already registered in this college.`);
        }
        if (error.message.includes("email")) {
          throw new Error(`Email '${student.email}' is already registered in this college.`);
        }
      }
      throw new Error(`Failed to create student: ${error.message}`);
    }

    return data;
  }

  /**
   * Update student details
   */
  static async update(
    tenantId: string,
    id: string,
    updates: StudentUpdate
  ): Promise<StudentRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("students")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update student: ${error.message}`);
    }

    return data;
  }

  /**
   * Deactivate a student (soft remove from active directory).
   * Preserves all auth, placement, application, and assessment data.
   */
  static async deactivate(tenantId: string, id: string, actorId?: string): Promise<StudentRow> {
    const supabase = createAdminClient();
    const existing = await this.getById(tenantId, id);
    if (!existing) {
      throw new Error("Student not found in your college roster.");
    }

    const { data, error } = await supabase
      .from("students")
      .update({
        is_archived: true,
        academic_status: "WITHDRAWN",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to deactivate student: ${error.message}`);
    }

    await AuditService.log({
      tenantId,
      actorId,
      action: "STUDENT_DEACTIVATED",
      resourceType: "student",
      resourceId: id,
      beforeState: {
        is_archived: existing.is_archived,
        academic_status: existing.academic_status,
        enrollment_number: existing.enrollment_number,
        full_name: existing.full_name,
      },
      afterState: {
        is_archived: true,
        academic_status: "WITHDRAWN",
      },
    });

    return data;
  }

  /**
   * Reactivate a previously archived student.
   */
  static async reactivate(tenantId: string, id: string, actorId?: string): Promise<StudentRow> {
    const supabase = createAdminClient();
    const existing = await this.getById(tenantId, id);
    if (!existing) {
      throw new Error("Student not found in your college roster.");
    }

    const { data, error } = await supabase
      .from("students")
      .update({
        is_archived: false,
        academic_status: "ACTIVE",
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to reactivate student: ${error.message}`);
    }

    await AuditService.log({
      tenantId,
      actorId,
      action: "STUDENT_REACTIVATED",
      resourceType: "student",
      resourceId: id,
      beforeState: {
        is_archived: existing.is_archived,
        academic_status: existing.academic_status,
      },
      afterState: {
        is_archived: false,
        academic_status: "ACTIVE",
      },
    });

    return data;
  }

  /**
   * Backward-compatible alias for deactivate.
   */
  static async archive(tenantId: string, id: string, actorId?: string): Promise<StudentRow> {
    return this.deactivate(tenantId, id, actorId);
  }

  /**
   * Inspect dependencies and check whether a student record is eligible
   * for permanent deletion without corrupting dependent data.
   */
  static async checkStudentDeletionEligibility(
    tenantId: string,
    id: string
  ): Promise<StudentDeletionEligibility> {
    const supabase = createAdminClient();
    const student = await this.getById(tenantId, id);
    if (!student) {
      throw new Error("Student record not found in your college.");
    }

    const hasUserAccount = Boolean(student.user_id);

    // Check drive applications
    let applicationsCount = 0;
    try {
      const { count } = await supabase
        .from("drive_applications")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("student_id", id);
      applicationsCount = count || 0;
    } catch {
      // Graceful fallback
    }

    // Check placement offers
    let offersCount = 0;
    try {
      const { count } = await supabase
        .from("placement_offers")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("student_id", id);
      offersCount = count || 0;
    } catch {
      // Graceful fallback
    }

    // Check assessment attempts
    let assessmentAttemptsCount = 0;
    try {
      const { count } = await (supabase as any)
        .from("assessment_attempts")
        .select("id", { count: "exact", head: true })
        .eq("student_id", id);
      assessmentAttemptsCount = count || 0;
    } catch {
      // Graceful fallback
    }

    // Check mistake bank
    let mistakeBankCount = 0;
    try {
      const { count } = await (supabase as any)
        .from("mistake_bank")
        .select("id", { count: "exact", head: true })
        .eq("student_id", id);
      mistakeBankCount = count || 0;
    } catch {
      // Graceful fallback
    }

    // Check training attendance
    let trainingCount = 0;
    try {
      const { count } = await (supabase as any)
        .from("training_attendance")
        .select("id", { count: "exact", head: true })
        .eq("student_id", id);
      trainingCount = count || 0;
    } catch {
      // Graceful fallback
    }

    const blockingReasons: string[] = [];

    if (hasUserAccount) {
      blockingReasons.push(
        "Student has a registered UrPlaced account with active authentication credentials."
      );
    }
    if (applicationsCount > 0) {
      blockingReasons.push(
        `Student has ${applicationsCount} active or historical campus drive application(s).`
      );
    }
    if (offersCount > 0) {
      blockingReasons.push(
        `Student has ${offersCount} recorded placement offer(s).`
      );
    }
    if (assessmentAttemptsCount > 0) {
      blockingReasons.push(
        `Student has ${assessmentAttemptsCount} assessment attempt(s) recorded in the assessment engine.`
      );
    }
    if (mistakeBankCount > 0) {
      blockingReasons.push(
        `Student has ${mistakeBankCount} Mistake-to-Mastery review record(s).`
      );
    }
    if (trainingCount > 0) {
      blockingReasons.push(
        `Student has ${trainingCount} training session record(s).`
      );
    }

    return {
      eligible: blockingReasons.length === 0,
      student,
      blockingReasons,
      dependencies: {
        hasUserAccount,
        applicationsCount,
        offersCount,
        assessmentAttemptsCount,
        mistakeBankCount,
        trainingCount,
      },
    };
  }

  /**
   * Permanently delete an eligible standalone student record.
   * Requires exact typed SRN confirmation and verified absence of dependencies.
   */
  static async deletePermanently(
    tenantId: string,
    id: string,
    confirmedSrn: string,
    actorId?: string
  ): Promise<{ success: boolean; deletedStudent: StudentRow }> {
    const supabase = createAdminClient();
    const eligibility = await this.checkStudentDeletionEligibility(tenantId, id);

    if (!eligibility.eligible) {
      throw new Error(
        `Permanent deletion blocked: ${eligibility.blockingReasons.join(" ")} To remove this student from the active directory without losing academic records, use 'Remove from Active Directory'.`
      );
    }

    const expectedSrn = eligibility.student.enrollment_number.trim().toUpperCase();
    const enteredSrn = (confirmedSrn || "").trim().toUpperCase();

    if (expectedSrn !== enteredSrn) {
      throw new Error(
        `Confirmation enrollment ID mismatch. Expected '${eligibility.student.enrollment_number}', but received '${confirmedSrn}'.`
      );
    }

    // If student has a registered login account, permanently delete their Auth user, storage, and memberships
    if (eligibility.student.user_id) {
      try {
        await UserDeletionService.executePermanentDeletion({
          targetUserId: eligibility.student.user_id,
          actorUserId: actorId || "SYSTEM",
          actorRole: "PLACEMENT_HEAD",
          tenantId,
          reason: `Student account permanently deleted by Placement Head (SRN: ${eligibility.student.enrollment_number})`,
          adminClient: supabase,
        });
      } catch (userDelErr: any) {
        console.warn("[StudentService] Notice on UserDeletionService execution:", userDelErr?.message || userDelErr);
      }
    }

    const { error } = await supabase
      .from("students")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to permanently delete student: ${error.message}`);
    }

    await AuditService.log({
      tenantId,
      actorId,
      action: "STUDENT_PERMANENTLY_DELETED",
      resourceType: "student",
      resourceId: id,
      beforeState: {
        id: eligibility.student.id,
        enrollment_number: eligibility.student.enrollment_number,
        full_name: eligibility.student.full_name,
        email: eligibility.student.email,
        academic_status: eligibility.student.academic_status,
        department_id: eligibility.student.department_id,
        cgpa: eligibility.student.cgpa,
      },
    });

    return { success: true, deletedStudent: eligibility.student };
  }

  /**
   * Computes an impact preview for college-scoped bulk deletion.
   * Strictly isolates to caller's tenantId and categorizes eligible vs protected records.
   */
  static async getBulkDeletePreview(tenantId: string): Promise<BulkDeletePreviewResult> {
    const supabase = createAdminClient();

    // 1. Fetch all students for tenant
    const { data: students, error: studentsErr } = await supabase
      .from("students")
      .select("id, enrollment_number, full_name, user_id")
      .eq("tenant_id", tenantId);

    if (studentsErr) {
      throw new Error(`Failed to fetch college student records: ${studentsErr.message}`);
    }

    const allStudents = students || [];
    if (allStudents.length === 0) {
      return {
        totalStudents: 0,
        eligibleCount: 0,
        protectedCount: 0,
        breakdown: {
          withUserAccounts: 0,
          withApplicationsOrOffers: 0,
          withAssessmentsOrTraining: 0,
        },
        sampleEligibleSrns: [],
      };
    }

    const studentIds = allStudents.map((s) => s.id);

    const protectedIds = new Set<string>();
    const withApplicationsOrOffersIds = new Set<string>();
    const withAssessmentsOrTrainingIds = new Set<string>();

    try {
      const { data: appData } = await supabase
        .from("drive_applications")
        .select("student_id")
        .eq("tenant_id", tenantId);
      (appData || []).forEach((row: any) => {
        if (row.student_id) {
          protectedIds.add(row.student_id);
          withApplicationsOrOffersIds.add(row.student_id);
        }
      });
    } catch {}

    try {
      const { data: offerData } = await supabase
        .from("placement_offers")
        .select("student_id")
        .eq("tenant_id", tenantId);
      (offerData || []).forEach((row: any) => {
        if (row.student_id) {
          protectedIds.add(row.student_id);
          withApplicationsOrOffersIds.add(row.student_id);
        }
      });
    } catch {}

    try {
      const { data: assessData } = await (supabase as any)
        .from("assessment_attempts")
        .select("student_id")
        .in("student_id", studentIds);
      (assessData || []).forEach((row: any) => {
        if (row.student_id) {
          protectedIds.add(row.student_id);
          withAssessmentsOrTrainingIds.add(row.student_id);
        }
      });
    } catch {}

    try {
      const { data: mistakeData } = await (supabase as any)
        .from("mistake_bank")
        .select("student_id")
        .in("student_id", studentIds);
      (mistakeData || []).forEach((row: any) => {
        if (row.student_id) {
          protectedIds.add(row.student_id);
          withAssessmentsOrTrainingIds.add(row.student_id);
        }
      });
    } catch {}

    try {
      const { data: trainingData } = await (supabase as any)
        .from("training_attendance")
        .select("student_id")
        .in("student_id", studentIds);
      (trainingData || []).forEach((row: any) => {
        if (row.student_id) {
          protectedIds.add(row.student_id);
          withAssessmentsOrTrainingIds.add(row.student_id);
        }
      });
    } catch {}

    let withUserAccounts = 0;
    const eligibleStudents: typeof allStudents = [];

    for (const s of allStudents) {
      if (s.user_id) {
        withUserAccounts++;
        protectedIds.add(s.id);
      } else if (protectedIds.has(s.id)) {
        // already counted
      } else {
        eligibleStudents.push(s);
      }
    }

    const eligibleCount = eligibleStudents.length;
    const protectedCount = allStudents.length - eligibleCount;

    return {
      totalStudents: allStudents.length,
      eligibleCount,
      protectedCount,
      breakdown: {
        withUserAccounts,
        withApplicationsOrOffers: withApplicationsOrOffersIds.size,
        withAssessmentsOrTraining: withAssessmentsOrTrainingIds.size,
      },
      sampleEligibleSrns: eligibleStudents.slice(0, 5).map((s) => s.enrollment_number),
    };
  }

  /**
   * Executes college-scoped bulk deletion of eligible student records.
   * Strictly enforces confirmation phrase 'DELETE ALL STUDENTS' and protects
   * all students with user accounts or dependent placement/assessment data.
   */
  static async executeBulkDelete(
    tenantId: string,
    confirmationPhrase: string,
    actorId?: string
  ): Promise<BulkDeleteExecutionResult> {
    if ((confirmationPhrase || "").trim() !== "DELETE ALL STUDENTS") {
      throw new Error(
        "Invalid confirmation phrase. You must type 'DELETE ALL STUDENTS' exactly to proceed."
      );
    }

    const preview = await this.getBulkDeletePreview(tenantId);

    if (preview.eligibleCount === 0) {
      return {
        success: true,
        deletedCount: 0,
        protectedCount: preview.protectedCount,
        totalBefore: preview.totalStudents,
        message: "No eligible standalone records found. All student records are protected by registered accounts or placement/assessment history.",
      };
    }

    const supabase = createAdminClient();

    // Re-fetch all students to determine the exact eligible IDs
    const { data: students } = await supabase
      .from("students")
      .select("id, enrollment_number, user_id")
      .eq("tenant_id", tenantId);

    const allStudents = students || [];
    const studentIds = allStudents.map((s) => s.id);

    const protectedIds = new Set<string>();
    for (const s of allStudents) {
      if (s.user_id) protectedIds.add(s.id);
    }

    try {
      const { data: appData } = await supabase
        .from("drive_applications")
        .select("student_id")
        .eq("tenant_id", tenantId);
      (appData || []).forEach((row: any) => {
        if (row.student_id) protectedIds.add(row.student_id);
      });
    } catch {}

    try {
      const { data: offerData } = await supabase
        .from("placement_offers")
        .select("student_id")
        .eq("tenant_id", tenantId);
      (offerData || []).forEach((row: any) => {
        if (row.student_id) protectedIds.add(row.student_id);
      });
    } catch {}

    try {
      const { data: assessData } = await (supabase as any)
        .from("assessment_attempts")
        .select("student_id")
        .in("student_id", studentIds);
      (assessData || []).forEach((row: any) => {
        if (row.student_id) protectedIds.add(row.student_id);
      });
    } catch {}

    try {
      const { data: mistakeData } = await (supabase as any)
        .from("mistake_bank")
        .select("student_id")
        .in("student_id", studentIds);
      (mistakeData || []).forEach((row: any) => {
        if (row.student_id) protectedIds.add(row.student_id);
      });
    } catch {}

    try {
      const { data: trainingData } = await (supabase as any)
        .from("training_attendance")
        .select("student_id")
        .in("student_id", studentIds);
      (trainingData || []).forEach((row: any) => {
        if (row.student_id) protectedIds.add(row.student_id);
      });
    } catch {}

    const eligibleIds = allStudents
      .filter((s) => !protectedIds.has(s.id))
      .map((s) => s.id);

    if (eligibleIds.length === 0) {
      return {
        success: true,
        deletedCount: 0,
        protectedCount: allStudents.length,
        totalBefore: allStudents.length,
        message: "No eligible standalone records found.",
      };
    }

    // Delete in chunks of 50
    const chunkSize = 50;
    let deletedCount = 0;
    for (let i = 0; i < eligibleIds.length; i += chunkSize) {
      const chunk = eligibleIds.slice(i, i + chunkSize);
      const { error: delErr } = await supabase
        .from("students")
        .delete()
        .eq("tenant_id", tenantId)
        .in("id", chunk);

      if (delErr) {
        throw new Error(`Failed during bulk deletion: ${delErr.message}`);
      }
      deletedCount += chunk.length;
    }

    const retainedCount = allStudents.length - deletedCount;

    await AuditService.log({
      tenantId,
      actorId,
      action: "STUDENTS_BULK_DELETED",
      resourceType: "tenant",
      resourceId: tenantId,
      beforeState: {
        totalStudents: allStudents.length,
        eligibleCount: eligibleIds.length,
        protectedCount: retainedCount,
      },
      afterState: {
        deletedCount,
        retainedCount,
      },
    });

    return {
      success: true,
      deletedCount,
      protectedCount: retainedCount,
      totalBefore: allStudents.length,
    };
  }

  /**
   * Normalizes an SRN:
   * - Trims whitespace
   * - Preserves leading zeros and case formatting
   * - Never casts to numeric type
   */
  static normalizeSrn(srn: string): string {
    if (!srn || typeof srn !== "string") return "";
    return srn.trim();
  }

  /**
   * Finds an eligible unclaimed roster record for a given SRN.
   * Enforces:
   * - Valid non-empty SRN
   * - Rejects already-claimed records
   * - Requires active, non-archived status
   * - Rejects ambiguous SRNs that appear across multiple colleges
   */
  static async findEligibleRosterBySrn(
    srn: string,
    tenantId?: string
  ): Promise<FindEligibleRosterResult> {
    const cleanSrn = StudentService.normalizeSrn(srn);
    if (!cleanSrn) {
      return {
        status: "INVALID_SRN",
        matchesCount: 0,
        message: "A valid Student Registration Number (SRN) is required.",
      };
    }

    const supabase = createAdminClient();

    // If tenantId is provided, isolate the query strictly to that college
    if (tenantId) {
      // 1. Check if already claimed in this specific college
      const { data: claimedRecords, error: claimedError } = await supabase
        .from("students")
        .select("id, tenant_id, enrollment_number, user_id")
        .ilike("enrollment_number", cleanSrn)
        .not("user_id", "is", null)
        .eq("tenant_id", tenantId);

      if (claimedError) {
        throw new Error(`Failed to check claimed roster records: ${claimedError.message}`);
      }

      if (claimedRecords && claimedRecords.length > 0) {
        return {
          status: "ALREADY_CLAIMED",
          matchesCount: claimedRecords.length,
          message: "This Student Registration Number (SRN) has already been claimed by a registered account.",
        };
      }

      // 2. Query unclaimed active record in this specific college
      const { data: matches, error: matchError } = await supabase
        .from("students")
        .select("*, department:departments(name, code)")
        .ilike("enrollment_number", cleanSrn)
        .is("user_id", null)
        .eq("is_archived", false)
        .eq("academic_status", "ACTIVE")
        .eq("tenant_id", tenantId);

      if (matchError) {
        throw new Error(`Failed to query student roster: ${matchError.message}`);
      }

      if (!matches || matches.length === 0) {
        return {
          status: "NOT_FOUND",
          matchesCount: 0,
          message: "No active, eligible student roster record found for the provided SRN in the selected college.",
        };
      }

      if (matches.length > 1) {
        return {
          status: "AMBIGUOUS",
          matchesCount: matches.length,
          message: "This SRN matches multiple institutional rosters. Please contact your college placement cell.",
        };
      }

      return {
        status: "FOUND",
        roster: matches[0] as StudentRow,
        matchesCount: 1,
        message: "Eligible roster record found.",
      };
    }

    // When tenantId is NOT provided:
    // Check both claimed and unclaimed records to detect cross-institution collision vs single-tenant match
    const { data: claimedRecords, error: claimedError } = await supabase
      .from("students")
      .select("id, tenant_id, enrollment_number, user_id")
      .ilike("enrollment_number", cleanSrn)
      .not("user_id", "is", null);

    if (claimedError) {
      throw new Error(`Failed to check claimed roster records: ${claimedError.message}`);
    }

    const { data: matches, error: matchError } = await supabase
      .from("students")
      .select("*, department:departments(name, code)")
      .ilike("enrollment_number", cleanSrn)
      .is("user_id", null)
      .eq("is_archived", false)
      .eq("academic_status", "ACTIVE");

    if (matchError) {
      throw new Error(`Failed to query student roster: ${matchError.message}`);
    }

    const claimedTenants = new Set((claimedRecords || []).map((r) => r.tenant_id));
    const unclaimedTenants = new Set((matches || []).map((r) => r.tenant_id));
    const allTenants = new Set([...claimedTenants, ...unclaimedTenants]);

    // If SRN matches across multiple distinct colleges, fail closed with AMBIGUOUS
    if (allTenants.size > 1) {
      return {
        status: "AMBIGUOUS",
        matchesCount: allTenants.size,
        message: "This SRN matches multiple institutional rosters. Please select your college or contact your placement cell.",
      };
    }

    // If already claimed in the single matching college
    if (claimedRecords && claimedRecords.length > 0) {
      return {
        status: "ALREADY_CLAIMED",
        matchesCount: claimedRecords.length,
        message: "This Student Registration Number (SRN) has already been claimed by a registered account.",
      };
    }

    if (!matches || matches.length === 0) {
      return {
        status: "NOT_FOUND",
        matchesCount: 0,
        message: "No active, eligible student roster record found for the provided SRN.",
      };
    }

    if (matches.length > 1) {
      return {
        status: "AMBIGUOUS",
        matchesCount: matches.length,
        message: "This SRN matches multiple institutional rosters. Please contact your college placement cell.",
      };
    }

    return {
      status: "FOUND",
      roster: matches[0] as StudentRow,
      matchesCount: 1,
      message: "Eligible roster record found.",
    };
  }

  /**
   * Claims an eligible student roster record for an authenticated student user.
   * - Enforces 1:1 binding (user cannot claim multiple records; record cannot be claimed multiple times)
   * - Derives tenant_id from authoritative roster record
   * - Updates public.students with user_id and claimed_at
   * - Preserves all academic records, name, and email strictly untouched
   * - Upserts tenant_memberships (role = 'STUDENT', status = 'ACTIVE')
   * - Updates user app_metadata in Supabase Auth
   * - Logs secure audit trail
   */
  static async claimStudentRosterRecord(
    params: ClaimStudentRosterParams
  ): Promise<ClaimStudentRosterResult> {
    const cleanSrn = StudentService.normalizeSrn(params.srn);
    if (!cleanSrn) {
      return {
        success: false,
        code: "INVALID_SRN",
        message: "Student Registration Number (SRN) cannot be empty.",
      };
    }

    if (!params.userId) {
      return {
        success: false,
        code: "INVALID_USER",
        message: "Authenticated user ID is required.",
      };
    }

    const cleanFullName = (params.fullName || "").trim();
    if (!cleanFullName) {
      return {
        success: false,
        code: "INVALID_NAME",
        message: "Full name is required to claim a student roster record.",
      };
    }

    const cleanEmail = (params.email || "").trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      return {
        success: false,
        code: "INVALID_EMAIL",
        message: "A valid email address is required to claim a student roster record.",
      };
    }

    const supabase = createAdminClient();

    // 1. Enforce 1:1 Account-to-Roster Invariant & Single-College Ownership:
    // Check if this user account holds an active or existing membership in another college or role
    if (typeof supabase?.from === "function") {
      try {
        const tmQuery = supabase.from("tenant_memberships");
        if (tmQuery && typeof tmQuery.select === "function") {
          const { data: userMemberships } = await tmQuery
            .select("id, tenant_id, role, status")
            .eq("user_id", params.userId);

          if (userMemberships && userMemberships.length > 0) {
            if (params.tenantId) {
              const otherCollege = userMemberships.find((m: any) => m.tenant_id !== params.tenantId);
              if (otherCollege) {
                return {
                  success: false,
                  code: "TENANT_MISMATCH",
                  message: "This account is already associated with another college.",
                };
              }
            }
            const staffOrAdmin = userMemberships.find((m: any) =>
              m.role === "PLACEMENT_HEAD" || m.role === "PLACEMENT_STAFF" || m.role === "TRAINER"
            );
            if (staffOrAdmin) {
              return {
                success: false,
                code: "ROLE_CONFLICT",
                message: `This account already holds an institutional role (${staffOrAdmin.role}) and cannot claim a student roster record.`,
              };
            }
          }
        }
      } catch {
        // Fallback to database procedure guards
      }
    }

    // Check if this user account has already claimed another roster record
    const { data: existingUserClaim } = await supabase
      .from("students")
      .select("id, tenant_id, enrollment_number, full_name, email")
      .eq("user_id", params.userId)
      .maybeSingle();

    if (existingUserClaim) {
      // If this user already claimed this exact same SRN, confirm the existing association idempotently.
      // Official roster name, email, and academic data remain strictly authoritative and are never overwritten.
      if (
        StudentService.normalizeSrn(existingUserClaim.enrollment_number).toUpperCase() ===
        cleanSrn.toUpperCase()
      ) {
        if (params.tenantId && params.tenantId !== existingUserClaim.tenant_id) {
          return {
            success: false,
            code: "TENANT_MISMATCH",
            message: "This account is already associated with another college.",
            studentId: existingUserClaim.id,
            tenantId: existingUserClaim.tenant_id,
            enrollmentNumber: existingUserClaim.enrollment_number,
          };
        }

        return {
          success: true,
          code: "CLAIMED_SUCCESSFULLY",
          message: "Roster record already linked to this student account.",
          studentId: existingUserClaim.id,
          tenantId: existingUserClaim.tenant_id,
          enrollmentNumber: existingUserClaim.enrollment_number,
          student: existingUserClaim as any,
        };
      }

      return {
        success: false,
        code: "USER_ALREADY_HAS_ROSTER",
        message: `This account is already linked to student record ${existingUserClaim.enrollment_number}.`,
        studentId: existingUserClaim.id,
        tenantId: existingUserClaim.tenant_id,
        enrollmentNumber: existingUserClaim.enrollment_number,
      };
    }

    // 2. Canonical PostgreSQL Transactional Procedure (claim_student_roster)
    // Atomically enforces 1:1 account binding, row-level locking, eligibility verification,
    // mandatory name/email synchronization, tenant role protection,
    // and tenant membership creation inside a SINGLE database transaction.
    // If ANY mandatory step fails, PostgreSQL aborts the transaction and rolls back all changes.
    // In accordance with critical transaction safety rules, the service fails closed if the RPC
    // is unavailable or fails, preventing any partial writes across students or tenant_memberships.
    try {
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc("claim_student_roster", {
        p_srn: cleanSrn,
        p_user_id: params.userId,
        p_full_name: cleanFullName,
        p_email: cleanEmail,
        p_tenant_id: params.tenantId || null,
      });

      if (rpcError) {
        // Detailed server-side diagnostic logging (distinguishes schema mismatch, permissions, or DB connection)
        console.error("[StudentService.claimStudentRosterRecord] Database RPC execution error:", {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
          requestedParams: {
            p_srn: cleanSrn,
            p_user_id: params.userId,
            p_full_name: cleanFullName,
            p_email: cleanEmail,
            p_tenant_id: params.tenantId || null,
          },
        });

        // Translate low-level PostgREST schema cache or function mismatch errors into safe user-facing message
        const isSystemError =
          rpcError.code === "PGRST202" ||
          rpcError.code === "42883" ||
          rpcError.code === "42501" ||
          rpcError.code === "PGRST200" ||
          rpcError.message?.includes("schema cache") ||
          rpcError.message?.includes("function") ||
          rpcError.message?.includes("does not exist");

        return {
          success: false,
          code: "CLAIM_FAILED",
          message: isSystemError
            ? "The student registration service is temporarily unavailable due to a pending system migration. Please contact your campus placement cell or try again in a few moments."
            : rpcError.message ||
              "Failed to claim student roster record atomically. Please try again or contact your administrator.",
        };
      }

      if (!rpcData || rpcData.length === 0) {
        return {
          success: false,
          code: "CLAIM_FAILED",
          message: "Empty response from student roster claiming procedure.",
        };
      }

      const result = rpcData[0];
      if (result.success) {
        // Sync Auth app_metadata
        try {
          await supabase.auth.admin.updateUserById(params.userId, {
            app_metadata: {
              tenant_id: result.tenant_id,
              role: "STUDENT",
              account_category: "STUDENT",
            },
          });
        } catch {}

        // Record secure audit log
        try {
          await AuditService.log({
            tenantId: result.tenant_id,
            actorId: params.userId,
            action: "STUDENT_ROSTER_CLAIMED",
            resourceType: "student",
            resourceId: result.student_id,
            afterState: {
              studentId: result.student_id,
              tenantId: result.tenant_id,
              enrollmentNumber: result.enrollment_number,
              claimedBy: params.userId,
              fullName: cleanFullName,
              email: cleanEmail,
            },
          });
        } catch {}

        return {
          success: true,
          code: "CLAIMED_SUCCESSFULLY",
          message: result.message || "Roster record successfully claimed and synchronized.",
          studentId: result.student_id,
          tenantId: result.tenant_id,
          enrollmentNumber: result.enrollment_number,
        };
      }

      // Propagate explicit failure code from the database transaction:
      // e.g. ALREADY_CLAIMED, AMBIGUOUS_SRN, SRN_NOT_FOUND, USER_ALREADY_HAS_ROSTER, CONCURRENT_CLAIM_CONFLICT
      return {
        success: false,
        code: (result.code as ClaimStudentRosterCode) || "CLAIM_FAILED",
        message: result.message || "Unable to claim roster record.",
        studentId: result.student_id,
        tenantId: result.tenant_id,
        enrollmentNumber: result.enrollment_number,
      };
    } catch (err: any) {
      console.error("[StudentService.claimStudentRosterRecord] Transactional RPC execution failed:", err);
      // Fail closed: Never perform an unsafe multi-step fallback that could leave partial state
      return {
        success: false,
        code: "CLAIM_FAILED",
        message:
          err?.message ||
          "The student roster claiming service is unavailable. Please try again later or contact support.",
      };
    }
  }
}
