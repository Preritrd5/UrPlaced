/**
 * Student Service
 * Handles student records, search, filters, pagination, and profile management.
 */

import { createAdminClient } from "@/lib/supabase/admin";
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

    if (!params.includeArchived) {
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
   * Archive / deactivate a student
   */
  static async archive(tenantId: string, id: string): Promise<StudentRow> {
    const supabase = createAdminClient();
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
      throw new Error(`Failed to archive student: ${error.message}`);
    }

    return data;
  }
}
