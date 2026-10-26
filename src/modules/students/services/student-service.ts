/**
 * Student Service
 * Handles student records, search, filters, pagination, and profile management.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { AuditService } from "@/modules/identity-access/services/audit-service";
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
    return {
      students: (data as any) || [],
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
}
