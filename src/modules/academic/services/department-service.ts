/**
 * Department Service
 * Manages college academic departments and branches.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, DepartmentStatus } from "@/types/database";

export type DepartmentRow = Database["public"]["Tables"]["departments"]["Row"];

export interface CreateDepartmentInput {
  tenantId: string;
  name: string;
  code: string;
  status?: DepartmentStatus;
}

export class DepartmentService {
  /**
   * List all departments for a tenant
   */
  static async listByTenant(tenantId: string): Promise<DepartmentRow[]> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to list departments: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Create a new department
   */
  static async create(input: CreateDepartmentInput): Promise<DepartmentRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .insert({
        tenant_id: input.tenantId,
        name: input.name.trim(),
        code: input.code.trim().toUpperCase(),
        status: input.status || "ACTIVE",
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`Department code '${input.code.toUpperCase()}' already exists.`);
      }
      throw new Error(`Failed to create department: ${error.message}`);
    }

    return data;
  }

  /**
   * Get department by ID
   */
  static async getById(tenantId: string, id: string): Promise<DepartmentRow | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get department: ${error.message}`);
    }

    return data;
  }
}
