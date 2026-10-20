/**
 * Academic Year Service
 * Manages institutional recruitment & academic cycles per college workspace.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, AcademicYearStatus } from "@/types/database";

export type AcademicYearRow = Database["public"]["Tables"]["academic_years"]["Row"];
export type AcademicYearInsert = Database["public"]["Tables"]["academic_years"]["Insert"];

export interface CreateAcademicYearInput {
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  status?: AcademicYearStatus;
}

export class AcademicYearService {
  /**
   * List all academic years for a tenant
   */
  static async listByTenant(tenantId: string): Promise<AcademicYearRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("academic_years")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("start_date", { ascending: false });

    if (error) {
      if (
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        return [];
      }
      throw new Error(`Failed to list academic years: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get active academic year for a tenant
   */
  static async getActiveYear(tenantId: string): Promise<AcademicYearRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("academic_years")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .maybeSingle();

    if (error) {
      if (
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        return null;
      }
      throw new Error(`Failed to get active academic year: ${error.message}`);
    }

    return data;
  }

  /**
   * Create an academic year
   */
  static async create(input: CreateAcademicYearInput): Promise<AcademicYearRow> {
    if (new Date(input.startDate) >= new Date(input.endDate)) {
      throw new Error("Academic year start date must precede end date.");
    }

    const supabase = createAdminClient();

    // If status is ACTIVE, demote existing active years for this tenant
    if (input.status === "ACTIVE") {
      await supabase
        .from("academic_years")
        .update({ status: "PLANNED" })
        .eq("tenant_id", input.tenantId)
        .eq("status", "ACTIVE");
    }

    const { data, error } = await supabase
      .from("academic_years")
      .insert({
        tenant_id: input.tenantId,
        name: input.name.trim(),
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status || "PLANNED",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Academic year '${input.name}' already exists.`);
      }
      throw new Error(`Failed to create academic year: ${error.message}`);
    }

    return data;
  }

  /**
   * Update status of an academic year
   */
  static async updateStatus(
    tenantId: string,
    id: string,
    status: AcademicYearStatus
  ): Promise<AcademicYearRow> {
    const supabase = createAdminClient();

    if (status === "ACTIVE") {
      await supabase
        .from("academic_years")
        .update({ status: "PLANNED" })
        .eq("tenant_id", tenantId)
        .eq("status", "ACTIVE");
    }

    const { data, error } = await supabase
      .from("academic_years")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update academic year status: ${error.message}`);
    }

    return data;
  }
}
