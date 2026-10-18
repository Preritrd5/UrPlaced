import { createClient } from "@/lib/supabase/server";
import { RecruitmentSourceRow, SourceType, AccessClassification, VerificationStatus } from "@/types/database";
import { AuditService } from "@/modules/identity-access/services/audit-service";

export interface CreateSourceInput {
  tenantId: string;
  companyId: string;
  driveId?: string | null;
  title: string;
  publisher: string;
  sourceType: SourceType;
  canonicalUrl?: string | null;
  documentRef?: string | null;
  publishedAt?: string | null;
  effectiveAt?: string | null;
  accessClassification?: AccessClassification;
  rawContent?: string | null;
  excerpt?: string | null;
  userId: string;
}

export interface SourceConflict {
  field: string;
  sourceA: { id: string; title: string; value: any };
  sourceB: { id: string; title: string; value: any };
  conflictDescription: string;
}

export class SourceService {
  /**
   * Create a new recruitment source record
   */
  public static async createSource(input: CreateSourceInput): Promise<RecruitmentSourceRow> {
    const supabase = await createClient();

    const insertPayload = {
      tenant_id: input.tenantId,
      company_id: input.companyId,
      drive_id: input.driveId || null,
      title: input.title.trim(),
      publisher: input.publisher.trim(),
      source_type: input.sourceType,
      canonical_url: input.canonicalUrl?.trim() || null,
      document_ref: input.documentRef || null,
      published_at: input.publishedAt || null,
      effective_at: input.effectiveAt || null,
      access_classification: input.accessClassification || "TENANT_CONFIDENTIAL",
      raw_content: input.rawContent || null,
      excerpt: input.excerpt || null,
      verification_status: "PENDING_REVIEW" as VerificationStatus,
      created_by: input.userId,
    };

    const { data, error } = await supabase
      .from("recruitment_sources")
      .insert(insertPayload)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create recruitment source: ${error?.message || "Unknown error"}`);
    }

    await AuditService.log({
      tenantId: input.tenantId,
      actorId: input.userId,
      action: "INTELLIGENCE_SOURCE_CREATE",
      resourceType: "recruitment_sources",
      resourceId: data.id,
      afterState: data,
    });

    return data as RecruitmentSourceRow;
  }

  /**
   * Retrieve sources for a specific drive or company
   */
  public static async getSources(
    tenantId: string,
    filters: { companyId?: string; driveId?: string; verificationStatus?: VerificationStatus }
  ): Promise<RecruitmentSourceRow[]> {
    const supabase = await createClient();

    let query = supabase
      .from("recruitment_sources")
      .select("*")
      .eq("tenant_id", tenantId);

    if (filters.driveId) {
      query = query.eq("drive_id", filters.driveId);
    } else if (filters.companyId) {
      query = query.eq("company_id", filters.companyId);
    }

    if (filters.verificationStatus) {
      query = query.eq("verification_status", filters.verificationStatus);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch recruitment sources: ${error.message}`);
    }

    return (data || []) as RecruitmentSourceRow[];
  }

  /**
   * Update source verification status (Staff only)
   */
  public static async updateVerificationStatus(
    tenantId: string,
    sourceId: string,
    userId: string,
    status: VerificationStatus,
    reviewNotes?: string
  ): Promise<RecruitmentSourceRow> {
    const supabase = await createClient();

    const { data: current } = await supabase
      .from("recruitment_sources")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("id", sourceId)
      .single();

    if (!current) {
      throw new Error("Recruitment source not found.");
    }

    const { data, error } = await supabase
      .from("recruitment_sources")
      .update({
        verification_status: status,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || current.review_notes,
        last_checked_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("id", sourceId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update source status: ${error?.message || "Unknown error"}`);
    }

    await AuditService.log({
      tenantId,
      actorId: userId,
      action: "INTELLIGENCE_SOURCE_VERIFY",
      resourceType: "recruitment_sources",
      resourceId: sourceId,
      beforeState: current,
      afterState: data,
    });

    return data as RecruitmentSourceRow;
  }

  /**
   * Evaluates freshness / staleness for a source.
   * If older than 180 days without reverification, marked as stale.
   */
  public static isSourceStale(source: RecruitmentSourceRow): { isStale: boolean; reason?: string } {
    const lastChecked = new Date(source.last_checked_at).getTime();
    const now = Date.now();
    const daysSinceCheck = Math.floor((now - lastChecked) / (1000 * 60 * 60 * 24));

    if (daysSinceCheck > 180) {
      return {
        isStale: true,
        reason: `Source evidence was last verified ${daysSinceCheck} days ago (> 180 days limit). Re-verification required.`,
      };
    }

    if (source.verification_status === "SUPERSEDED") {
      return {
        isStale: true,
        reason: "Source has been superseded by a newer official notice.",
      };
    }

    return { isStale: false };
  }
}
