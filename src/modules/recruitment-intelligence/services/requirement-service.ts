import { createClient } from "@/lib/supabase/server";
import {
  RecruitmentRequirementRow,
  RequirementCategory,
  EvidenceLevel,
  ScopeLevel,
  VerificationStatus,
} from "@/types/database";
import { AuditService } from "@/modules/identity-access/services/audit-service";

export interface CreateRequirementInput {
  tenantId: string;
  companyId: string;
  driveId?: string | null;
  sourceId?: string | null;
  scopeLevel: ScopeLevel;
  category: RequirementCategory;
  title: string;
  description?: string | null;
  structuredValue?: Record<string, any> | null;
  sourceExcerpt?: string | null;
  evidenceLevel: EvidenceLevel;
  userId: string;
}

export class RequirementService {
  /**
   * Create a structured recruitment requirement
   */
  public static async createRequirement(input: CreateRequirementInput): Promise<RecruitmentRequirementRow> {
    const supabase = await createClient();

    // Check for potential conflicts with existing requirements in the same drive & category
    let hasConflict = false;
    let conflictDetails: Record<string, any> | null = null;

    if (input.driveId) {
      const { data: existing } = await supabase
        .from("recruitment_requirements")
        .select("*")
        .eq("tenant_id", input.tenantId)
        .eq("drive_id", input.driveId)
        .eq("category", input.category);

      if (existing && existing.length > 0) {
        for (const item of existing) {
          // Check CGPA conflict
          if (
            input.category === "ELIGIBILITY" &&
            input.structuredValue?.min_cgpa &&
            item.structured_value?.min_cgpa &&
            input.structuredValue.min_cgpa !== item.structured_value.min_cgpa
          ) {
            hasConflict = true;
            conflictDetails = {
              type: "CGPA_MISMATCH",
              conflictingRequirementId: item.id,
              existingValue: item.structured_value.min_cgpa,
              newValue: input.structuredValue.min_cgpa,
              message: `Conflicting minimum CGPA detected: ${input.structuredValue.min_cgpa} vs existing ${item.structured_value.min_cgpa}`,
            };
            break;
          }
        }
      }
    }

    const insertPayload = {
      tenant_id: input.tenantId,
      company_id: input.companyId,
      drive_id: input.driveId || null,
      source_id: input.sourceId || null,
      scope_level: input.scopeLevel,
      category: input.category,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      structured_value: input.structuredValue || null,
      source_excerpt: input.sourceExcerpt?.trim() || null,
      evidence_level: input.evidenceLevel,
      verification_status: "DRAFT" as VerificationStatus,
      is_published_to_students: false,
      has_conflict: hasConflict,
      conflict_details: conflictDetails,
    };

    const { data, error } = await supabase
      .from("recruitment_requirements")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create requirement: ${error?.message || "Unknown error"}`);
    }

    await AuditService.log({
      tenantId: input.tenantId,
      actorId: input.userId,
      action: "RECRUITMENT_REQUIREMENT_CREATE",
      resourceType: "recruitment_requirements",
      resourceId: data.id,
      afterState: data,
    });

    return data as RecruitmentRequirementRow;
  }

  /**
   * List requirements for a drive with optional filters
   */
  public static async getRequirements(
    tenantId: string,
    filters: {
      driveId?: string;
      companyId?: string;
      category?: RequirementCategory;
      publishedOnly?: boolean;
    }
  ): Promise<RecruitmentRequirementRow[]> {
    const supabase = await createClient();

    let query = supabase
      .from("recruitment_requirements")
      .select("*")
      .eq("tenant_id", tenantId);

    if (filters.driveId) {
      query = query.eq("drive_id", filters.driveId);
    } else if (filters.companyId) {
      query = query.eq("company_id", filters.companyId);
    }

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.publishedOnly) {
      query = query.eq("is_published_to_students", true).eq("verification_status", "VERIFIED");
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch requirements: ${error.message}`);
    }

    return (data || []) as RecruitmentRequirementRow[];
  }

  /**
   * Verify a requirement (Staff only)
   */
  public static async verifyRequirement(
    tenantId: string,
    requirementId: string,
    userId: string,
    status: VerificationStatus = "VERIFIED"
  ): Promise<RecruitmentRequirementRow> {
    const supabase = await createClient();

    const { data: current } = await supabase
      .from("recruitment_requirements")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", requirementId)
      .single();

    if (!current) {
      throw new Error("Requirement not found.");
    }

    const { data, error } = await supabase
      .from("recruitment_requirements")
      .update({
        verification_status: status,
        verified_by: userId,
        verified_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", requirementId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to verify requirement: ${error?.message || "Unknown error"}`);
    }

    await AuditService.log({
      tenantId,
      actorId: userId,
      action: "RECRUITMENT_REQUIREMENT_VERIFY",
      resourceType: "recruitment_requirements",
      resourceId: requirementId,
      beforeState: current,
      afterState: data,
    });

    return data as RecruitmentRequirementRow;
  }

  /**
   * Publish or unpublish requirements to students
   */
  public static async setPublicationStatus(
    tenantId: string,
    requirementIds: string[],
    isPublished: boolean,
    userId: string
  ): Promise<{ updatedCount: number }> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("recruitment_requirements")
      .update({
        is_published_to_students: isPublished,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .in("id", requirementIds)
      .select();

    if (error) {
      throw new Error(`Failed to update publication status: ${error.message}`);
    }

    await AuditService.log({
      tenantId,
      actorId: userId,
      action: isPublished ? "REQUIREMENTS_PUBLISH_STUDENT" : "REQUIREMENTS_UNPUBLISH_STUDENT",
      resourceType: "recruitment_requirements",
      resourceId: requirementIds.join(","),
      afterState: { updatedCount: data?.length || 0, isPublished },
    });

    return { updatedCount: data?.length || 0 };
  }

  /**
   * Resolve a conflicting requirement
   */
  public static async resolveConflict(
    tenantId: string,
    requirementId: string,
    resolution: "KEEP_THIS" | "SUPERSEDE" | "EDIT_VALUE",
    newValue?: any,
    userId?: string
  ): Promise<RecruitmentRequirementRow> {
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {
      has_conflict: false,
      conflict_details: null,
      updated_at: new Date().toISOString(),
    };

    if (resolution === "SUPERSEDE") {
      updatePayload.verification_status = "SUPERSEDED";
    } else if (resolution === "EDIT_VALUE" && newValue) {
      updatePayload.structured_value = newValue;
      updatePayload.verification_status = "VERIFIED";
    }

    const { data, error } = await supabase
      .from("recruitment_requirements")
      .update(updatePayload)
      .eq("tenant_id", tenantId)
      .eq("id", requirementId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to resolve conflict: ${error?.message || "Unknown error"}`);
    }

    if (userId) {
      await AuditService.log({
        tenantId,
        actorId: userId,
        action: "REQUIREMENT_CONFLICT_RESOLVE",
        resourceType: "recruitment_requirements",
        resourceId: requirementId,
        afterState: data,
      });
    }

    return data as RecruitmentRequirementRow;
  }
}
