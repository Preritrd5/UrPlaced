import { GeminiClient } from "../gemini-client";
import { createAdminClient } from "@/lib/supabase/admin";

export interface PlacementIntelligenceReport {
  tenantId: string;
  generatedAt: string;
  cohortSummary: {
    totalStudents: number;
    totalDrivesActive: number;
    readinessIndex: number; // 0-100
  };
  keyInsights: {
    category: "COHORT_STRENGTH" | "SKILL_DEFICIENCY" | "DRIVE_ALIGNMENT" | "TRAINING_NEED";
    title: string;
    description: string;
    evidenceMetrics: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }[];
  recommendedInterventions: {
    title: string;
    targetDomain: string;
    format: "BOOTCAMP" | "MOCK_ASSESSMENT" | "REMEDIAL_WORKSHOP";
    impactPotential: string;
  }[];
  hasSufficientData: boolean;
}

export class AIPlacementIntelligenceService {
  /**
   * Generates institutional placement intelligence insights for College / Cell leadership.
   * STRICT PRIVACY GUARANTEE: Operates solely on aggregated metrics. Zero student PII is ever sent to AI.
   */
  public static async generateCohortInsights(params: {
    tenantId: string;
    userId: string;
    cohortMetricsOverride?: {
      totalStudents?: number;
      activeDrivesCount?: number;
      commonMistakes?: { category: string; count: number }[];
    };
  }): Promise<PlacementIntelligenceReport> {
    const admin = createAdminClient();

    // 1. Fetch aggregate metrics for this tenant (Strictly tenant-scoped)
    let totalStudents = params.cohortMetricsOverride?.totalStudents ?? 0;
    if (params.cohortMetricsOverride?.totalStudents === undefined) {
      try {
        const { count } = await admin
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", params.tenantId);
        totalStudents = count || 0;
      } catch {
        // Metric fallback
      }
    }

    let activeDrivesCount = params.cohortMetricsOverride?.activeDrivesCount ?? 0;
    if (params.cohortMetricsOverride?.activeDrivesCount === undefined) {
      try {
        const { count } = await admin
          .from("recruitment_drives")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", params.tenantId)
          .eq("status", "ACTIVE");
        activeDrivesCount = count || 0;
      } catch {
        // Metric fallback
      }
    }

    // 2. Fetch aggregate mistake frequency across the tenant's cohort (NO student IDs or names)
    let commonMistakeCategories: { category: string; count: number }[] =
      params.cohortMetricsOverride?.commonMistakes ?? [];
    if (!params.cohortMetricsOverride?.commonMistakes) {
      try {
        const { data: mistakeRows } = await admin
          .from("mistake_review_targets")
          .select(`
            primary_reason,
            canonical_skills (
              category
            )
          `)
          .eq("tenant_id", params.tenantId)
          .limit(100);

        if (mistakeRows && mistakeRows.length > 0) {
          const counts: Record<string, number> = {};
          for (const row of mistakeRows) {
            const cat = (row.canonical_skills as any)?.category || row.primary_reason || "GENERAL";
            counts[cat] = (counts[cat] || 0) + 1;
          }
          commonMistakeCategories = Object.entries(counts).map(([category, count]) => ({
            category,
            count,
          }));
        }
      } catch {
        // Metric fallback
      }
    }

    // Check if sufficient data exists
    const hasSufficientData = totalStudents > 0 || activeDrivesCount > 0 || commonMistakeCategories.length > 0;

    if (!hasSufficientData) {
      return {
        tenantId: params.tenantId,
        generatedAt: new Date().toISOString(),
        cohortSummary: {
          totalStudents: 0,
          totalDrivesActive: 0,
          readinessIndex: 50,
        },
        keyInsights: [
          {
            category: "DRIVE_ALIGNMENT",
            title: "Insufficient Cohort Data",
            description: "No student profiles, assessments, or recruitment drives are currently recorded for this college cell. Onboard students and configure recruitment drives to unlock automated institutional placement intelligence.",
            evidenceMetrics: "0 active drives, 0 student profiles",
            priority: "LOW",
          },
        ],
        recommendedInterventions: [
          {
            title: "Student Cohort Onboarding",
            targetDomain: "Platform Administration",
            format: "REMEDIAL_WORKSHOP",
            impactPotential: "Required to enable placement readiness analytics",
          },
        ],
        hasSufficientData: false,
      };
    }

    // 3. Assemble strictly anonymized aggregate payload for Gemini
    const aggregatedPayload = {
      tenantStudentsRegistered: totalStudents,
      activeRecruitmentDrives: activeDrivesCount,
      cohortErrorDistribution: commonMistakeCategories,
    };

    const promptText = `You are UrPlaced's AI Placement Intelligence Strategic Advisor.
Analyze the following aggregated institutional metrics for a college placement cell.
CRITICAL PRIVACY RULE: All data is aggregated and anonymized.

AGGREGATED COHORT DATA:
${JSON.stringify(aggregatedPayload, null, 2)}

TASK:
1. Synthesize 3-4 strategic placement insights based purely on the evidence.
2. Formulate 2-3 high-impact training interventions (e.g. bootcamps, workshops, targeted practice).
3. Compute an overall Placement Readiness Index (0-100).
4. Return strictly valid JSON matching this schema:
{
  "readinessIndex": 72,
  "keyInsights": [
    {
      "category": "COHORT_STRENGTH | SKILL_DEFICIENCY | DRIVE_ALIGNMENT | TRAINING_NEED",
      "title": "Clear insight headline",
      "description": "Evidence-backed rationale...",
      "evidenceMetrics": "e.g. 45% errors concentrated in Logical Reasoning",
      "priority": "HIGH | MEDIUM | LOW"
    }
  ],
  "recommendedInterventions": [
    {
      "title": "Intervention title",
      "targetDomain": "Domain / Topic",
      "format": "BOOTCAMP | MOCK_ASSESSMENT | REMEDIAL_WORKSHOP",
      "impactPotential": "Expected outcome on placement conversion"
    }
  ]
}`;

    const systemInstruction = `You are an executive university placement advisor. Provide factual, evidence-backed strategic recommendations. Never hallucinate college metrics or student names.`;

    const result = await GeminiClient.generate({
      prompt: promptText,
      systemInstruction,
      temperature: 0.1,
      responseMimeType: "application/json",
      feature: "PLACEMENT_INTELLIGENCE",
      userId: params.userId,
      tenantId: params.tenantId,
    });

    let parsedOutput: any = {};
    try {
      parsedOutput = JSON.parse(result.text);
    } catch {
      parsedOutput = {
        readinessIndex: 70,
        keyInsights: [],
        recommendedInterventions: [],
      };
    }

    const readiness = typeof parsedOutput.readinessIndex === "number"
      ? Math.min(100, Math.max(0, parsedOutput.readinessIndex))
      : 70;

    return {
      tenantId: params.tenantId,
      generatedAt: new Date().toISOString(),
      cohortSummary: {
        totalStudents,
        totalDrivesActive: activeDrivesCount,
        readinessIndex: readiness,
      },
      keyInsights: Array.isArray(parsedOutput.keyInsights) ? parsedOutput.keyInsights : [],
      recommendedInterventions: Array.isArray(parsedOutput.recommendedInterventions) ? parsedOutput.recommendedInterventions : [],
      hasSufficientData: true,
    };
  }
}
