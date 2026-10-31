/**
 * Company Service
 * Manages organization profiles, recruiter contacts, and hiring partner directory.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

export type CompanyRow = Database["public"]["Tables"]["companies"]["Row"];
export type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
export type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];

export interface CompanyFilterParams {
  tenantId: string;
  search?: string;
  status?: "ACTIVE" | "ARCHIVED" | "ALL";
  includeArchived?: boolean;
  page?: number;
  pageSize?: number;
}

export interface CompanyListResult {
  companies: (CompanyRow & { drives_count?: number })[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class CompanyService {
  /**
   * Normalize company name for duplicate detection
   */
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, "");
  }

  /**
   * List companies for a college tenant
   */
  static async list(params: CompanyFilterParams): Promise<CompanyListResult> {
    const supabase = createAdminClient();
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 10));
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("companies")
      .select("*, drives:recruitment_drives(count)", { count: "exact" })
      .eq("tenant_id", params.tenantId);

    if (params.status === "ARCHIVED") {
      query = query.eq("is_archived", true);
    } else if (params.status === "ALL" || params.includeArchived) {
      // include all
    } else {
      query = query.eq("is_archived", false);
    }

    if (params.search && params.search.trim()) {
      const term = `%${params.search.trim()}%`;
      query = query.or(`name.ilike.${term},industry.ilike.${term}`);
    }

    query = query.order("name", { ascending: true }).range(offset, offset + pageSize - 1);

    const { data, count, error } = await query;

    if (error) {
      if (
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        return {
          companies: [],
          total: 0,
          page,
          pageSize,
          totalPages: 1,
        };
      }
      throw new Error(`Failed to list companies: ${error.message}`);
    }

    const total = count || 0;
    const companies = ((data as any) || []).map((c: any) => ({
      ...c,
      drives_count: c.drives?.[0]?.count || 0,
    }));

    return {
      companies,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  }

  /**
   * Get company by ID
   */
  static async getById(
    tenantId: string,
    id: string
  ): Promise<(CompanyRow & { drives?: any[] }) | null> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .select("*, drives:recruitment_drives(*)")
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to get company: ${error.message}`);
    }

    return (data as any) || null;
  }

  /**
   * Create a new company
   */
  static async create(company: {
    tenantId: string;
    name: string;
    website?: string | null;
    industry?: string | null;
    contactPerson?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    internalNotes?: string | null;
  }): Promise<CompanyRow> {
    const supabase = createAdminClient();
    const normalizedName = this.normalizeName(company.name);

    if (!normalizedName) {
      throw new Error("Company name cannot be empty.");
    }

    const { data, error } = await supabase
      .from("companies")
      .insert({
        tenant_id: company.tenantId,
        name: company.name.trim(),
        normalized_name: normalizedName,
        website: company.website ? company.website.trim() : null,
        industry: company.industry ? company.industry.trim() : null,
        contact_person: company.contactPerson ? company.contactPerson.trim() : null,
        contact_email: company.contactEmail ? company.contactEmail.trim() : null,
        contact_phone: company.contactPhone ? company.contactPhone.trim() : null,
        internal_notes: company.internalNotes ? company.internalNotes.trim() : null,
        is_archived: false,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(`A company with the name '${company.name}' is already registered in this college.`);
      }
      throw new Error(`Failed to create company: ${error.message}`);
    }

    return data;
  }

  /**
   * Update company details
   */
  static async update(
    tenantId: string,
    id: string,
    updates: Partial<{
      name: string;
      website: string | null;
      industry: string | null;
      contactPerson: string | null;
      contactEmail: string | null;
      contactPhone: string | null;
      internalNotes: string | null;
      isArchived: boolean;
    }>
  ): Promise<CompanyRow> {
    const supabase = createAdminClient();
    const payload: any = { updated_at: new Date().toISOString() };

    if (updates.name) {
      payload.name = updates.name.trim();
      payload.normalized_name = this.normalizeName(updates.name);
    }
    if (updates.website !== undefined) payload.website = updates.website;
    if (updates.industry !== undefined) payload.industry = updates.industry;
    if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson;
    if (updates.contactEmail !== undefined) payload.contact_email = updates.contactEmail;
    if (updates.contactPhone !== undefined) payload.contact_phone = updates.contactPhone;
    if (updates.internalNotes !== undefined) payload.internal_notes = updates.internalNotes;
    if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;

    const { data, error } = await supabase
      .from("companies")
      .update(payload)
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update company: ${error.message}`);
    }

    return data;
  }

  /**
   * Archive company with historical preservation
   */
  static async archive(tenantId: string, id: string): Promise<CompanyRow> {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("companies")
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq("tenant_id", tenantId)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to archive company: ${error.message}`);
    }

    return data;
  }
}
