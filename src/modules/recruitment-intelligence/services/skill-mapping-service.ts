import { createClient } from "@/lib/supabase/server";
import {
  CanonicalSkillRow,
  RequirementSkillMappingRow,
  PracticeResourceRow,
  MappingImportance,
  MappingOrigin,
  EvidenceLevel,
} from "@/types/database";
import { AuditService } from "@/modules/identity-access/services/audit-service";

export interface CreateMappingInput {
  tenantId: string;
  driveId: string;
  requirementId: string;
  skillId: string;
  importance: MappingImportance;
  mappingRationale: string;
  mappingOrigin?: MappingOrigin;
  evidenceLevel?: EvidenceLevel;
  userId: string;
}

export interface DriveCoverageSummary {
  driveId: string;
  totalRequirements: number;
  mappedRequirementsCount: number;
  mappedWithResourcesCount: number;
  coveragePercentage: number;
  unmappedRequirements: Array<{ id: string; title: string; category: string }>;
  skillsMissingResources: Array<{ id: string; name: string }>;
  explanation: string;
}

export class SkillMappingService {
  /**
   * Retrieve all canonical skills in taxonomy
   */
  public static async getCanonicalSkills(): Promise<CanonicalSkillRow[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("canonical_skills")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch canonical skills: ${error.message}`);
    }

    return (data || []) as CanonicalSkillRow[];
  }

  /**
   * Retrieve practice resources for skills
   */
  public static async getPracticeResources(skillId?: string): Promise<PracticeResourceRow[]> {
    const supabase = await createClient();
    let query = supabase.from("practice_resources").select("*").eq("is_active", true);

    if (skillId) {
      query = query.eq("skill_id", skillId);
    }

    const { data, error } = await query.order("title", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch practice resources: ${error.message}`);
    }

    return (data || []) as PracticeResourceRow[];
  }

  /**
   * Create or update a requirement-to-skill mapping
   */
  public static async createMapping(input: CreateMappingInput): Promise<RequirementSkillMappingRow> {
    const supabase = await createClient();

    const insertPayload = {
      tenant_id: input.tenantId,
      drive_id: input.driveId,
      requirement_id: input.requirementId,
      skill_id: input.skillId,
      importance: input.importance,
      mapping_rationale: input.mappingRationale.trim(),
      mapping_origin: input.mappingOrigin || "HUMAN_AUTHORED",
      verification_status: "VERIFIED" as const,
      evidence_level: input.evidenceLevel || "INFERRED",
      verified_by: input.userId,
      verified_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("requirement_skill_mappings")
      .upsert(insertPayload, { onConflict: "tenant_id, drive_id, requirement_id, skill_id" })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to map requirement to skill: ${error?.message || "Unknown error"}`);
    }

    await AuditService.log({
      tenantId: input.tenantId,
      actorId: input.userId,
      action: "REQUIREMENT_SKILL_MAP_CREATE",
      resourceType: "requirement_skill_mappings",
      resourceId: data.id,
      afterState: data,
    });

    return data as RequirementSkillMappingRow;
  }

  /**
   * List all requirement-to-skill mappings for a drive
   */
  public static async getMappingsForDrive(
    tenantId: string,
    driveId: string
  ): Promise<Array<RequirementSkillMappingRow & { skill?: CanonicalSkillRow; requirementTitle?: string }>> {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("requirement_skill_mappings")
      .select(`
        *,
        canonical_skills (id, name, category, normalized_name),
        recruitment_requirements (id, title, category)
      `)
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch requirement mappings: ${error.message}`);
    }

    return (data || []).map((row: any) => ({
      ...row,
      skill: row.canonical_skills,
      requirementTitle: row.recruitment_requirements?.title,
    }));
  }

  /**
   * Delete a requirement-to-skill mapping
   */
  public static async deleteMapping(tenantId: string, mappingId: string, userId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase
      .from("requirement_skill_mappings")
      .delete()
      .eq("tenant_id", tenantId)
      .eq("id", mappingId);

    if (error) {
      throw new Error(`Failed to delete mapping: ${error.message}`);
    }

    await AuditService.log({
      tenantId,
      actorId: userId,
      action: "REQUIREMENT_SKILL_MAP_DELETE",
      resourceType: "requirement_skill_mappings",
      resourceId: mappingId,
    });
  }

  /**
   * Deterministic Requirement Coverage Calculation
   * Denominator: Total active requirements for this drive
   * Numerator: Requirements that have at least 1 verified mapping to a canonical skill AND at least 1 practice resource
   */
  public static async calculateDriveRequirementCoverage(
    tenantId: string,
    driveId: string
  ): Promise<DriveCoverageSummary> {
    const supabase = await createClient();

    // 1. Fetch all requirements for this drive
    const { data: requirements, error: reqError } = await supabase
      .from("recruitment_requirements")
      .select("id, title, category, verification_status")
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId)
      .neq("verification_status", "SUPERSEDED");

    if (reqError) {
      throw new Error(`Failed to calculate coverage: ${reqError.message}`);
    }

    const totalRequirements = requirements?.length || 0;
    if (totalRequirements === 0) {
      return {
        driveId,
        totalRequirements: 0,
        mappedRequirementsCount: 0,
        mappedWithResourcesCount: 0,
        coveragePercentage: 0,
        unmappedRequirements: [],
        skillsMissingResources: [],
        explanation: "No active recruitment requirements recorded yet for this drive.",
      };
    }

    // 2. Fetch all mappings for this drive
    const { data: mappings, error: mapError } = await supabase
      .from("requirement_skill_mappings")
      .select("requirement_id, skill_id")
      .eq("tenant_id", tenantId)
      .eq("drive_id", driveId);

    if (mapError) {
      throw new Error(`Failed to fetch mappings: ${mapError.message}`);
    }

    // 3. Fetch practice resources for mapped skills
    const mappedSkillIds = Array.from(new Set((mappings || []).map((m: any) => m.skill_id)));
    let resourcesBySkill: Record<string, number> = {};

    if (mappedSkillIds.length > 0) {
      const { data: resources } = await supabase
        .from("practice_resources")
        .select("skill_id")
        .in("skill_id", mappedSkillIds)
        .eq("is_active", true);

      if (resources) {
        for (const res of resources) {
          resourcesBySkill[res.skill_id] = (resourcesBySkill[res.skill_id] || 0) + 1;
        }
      }
    }

    const mappedReqIds = new Set((mappings || []).map((m: any) => m.requirement_id));
    const unmappedList = (requirements || [])
      .filter((r: any) => !mappedReqIds.has(r.id))
      .map((r: any) => ({ id: r.id, title: r.title, category: r.category }));

    // Count requirements that have at least 1 mapping whose skill has at least 1 resource
    const reqsWithResources = new Set<string>();
    for (const m of mappings || []) {
      if ((resourcesBySkill[m.skill_id] || 0) > 0) {
        reqsWithResources.add(m.requirement_id);
      }
    }

    const mappedRequirementsCount = mappedReqIds.size;
    const mappedWithResourcesCount = reqsWithResources.size;
    const coveragePercentage = Math.round((mappedWithResourcesCount / totalRequirements) * 100);

    return {
      driveId,
      totalRequirements,
      mappedRequirementsCount,
      mappedWithResourcesCount,
      coveragePercentage,
      unmappedRequirements: unmappedList,
      skillsMissingResources: [],
      explanation:
        "Requirement Coverage represents the proportion of drive requirements mapped to curriculum topics with available practice resources. This measures preparation readiness, NOT a student's selection probability.",
    };
  }
}
