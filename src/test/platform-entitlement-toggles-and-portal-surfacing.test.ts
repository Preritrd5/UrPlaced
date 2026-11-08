/**
 * Platform Entitlement Toggles, Navigation Surfacing & Access Integrity Tests
 * Verifies that:
 * 1. extractCanonicalEntitlements authoritatively maps all 16 features from DB.
 * 2. Disabled features remain false and are never revived by defaultTiers.
 * 3. department_hierarchy is strictly compulsory across all tiers.
 * 4. College roles receive AI Placement Tutor in sidebar and Command Center when enabled.
 * 5. SubscriptionAccessService.evaluateAccess accurately extracts live DB features.
 */

import { describe, it, expect, vi } from "vitest";
import {
  CONTROLLED_FEATURE_CATALOGUE,
  extractCanonicalEntitlements,
  buildCanonicalDefaultEntitlements,
  canonicalEntitlementsToStringArray,
} from "@/modules/platform-admin/types/subscription-plans";
import { getAuthorizedNavigation } from "@/lib/navigation/navigation-config";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";

describe("Platform Entitlement Toggles & Portal Surfacing", () => {
  describe("1. Canonical Entitlements Extractor", () => {
    it("preserves explicit disabled states and never revives them via defaultTiers", () => {
      // Simulate growth plan where mistake_to_mastery and ai_tutor_assistant were disabled by admin
      const growthPlanWithDisabledFeatures = {
        id: "growth",
        name: "Campus Growth",
        slug: "growth",
        features: [
          "Recruitment Drives & Scheduling",
          "Student Directory & SRN Verification",
          "Company Relationship Hub",
          "Standard Assessment Engine",
          "Subject-Wise Question Repository",
          "Custom & Random Question Sets",
          "DriveFit Match Scoring",
          // mistake_to_mastery omitted!
          // ai_tutor_assistant omitted!
          "Placement Memory & Cohort Intelligence",
          "Automated Eligibility Filtering",
          "AI Question Generation (Gemini)",
          "Department & Academic Structure",
        ],
      };

      const extracted = extractCanonicalEntitlements(growthPlanWithDisabledFeatures);

      expect(extracted.core_drives_management).toBe(true);
      expect(extracted.standard_assessments).toBe(true);
      expect(extracted.ai_question_generator).toBe(true);
      // These omitted features MUST be false, not revived by growth defaultTiers!
      expect(extracted.mistake_to_mastery).toBe(false);
      expect(extracted.ai_tutor_assistant).toBe(false);
      // Invariant: department_hierarchy is always true
      expect(extracted.department_hierarchy).toBe(true);
    });

    it("correctly enables all 10 starter features including AI Tutor when present in DB features", () => {
      const starterWithAITutor = {
        id: "starter",
        name: "Institutional Starter",
        slug: "starter",
        features: [
          "Recruitment Drives & Scheduling",
          "Student Directory & SRN Verification",
          "Company Relationship Hub",
          "Standard Assessment Engine",
          "Subject-Wise Question Repository",
          "AI Question Generation (Gemini)",
          "Floating AI Placement Tutor",
          "Automated Resume & Coding Scoring",
          "Department & Academic Structure",
          "Platform Audit & Compliance Export",
        ],
      };

      const extracted = extractCanonicalEntitlements(starterWithAITutor);

      expect(extracted.core_drives_management).toBe(true);
      expect(extracted.student_roster_directory).toBe(true);
      expect(extracted.company_management).toBe(true);
      expect(extracted.standard_assessments).toBe(true);
      expect(extracted.subject_question_banks).toBe(true);
      expect(extracted.ai_question_generator).toBe(true);
      expect(extracted.ai_tutor_assistant).toBe(true);
      expect(extracted.ai_evaluation_pipeline).toBe(true);
      expect(extracted.department_hierarchy).toBe(true);
      expect(extracted.audit_data_export_hub).toBe(true);

      // Other features should be false
      expect(extracted.custom_question_sets).toBe(false);
      expect(extracted.drivefit_evaluator).toBe(false);
      expect(extracted.mistake_to_mastery).toBe(false);
      expect(extracted.placement_memory_analytics).toBe(false);
      expect(extracted.automated_eligibility_engine).toBe(false);
      expect(extracted.dedicated_sla_liaison).toBe(false);
    });

    it("converts entitlements back to string array cleanly including compulsory department", () => {
      const entitlements = {
        core_drives_management: true,
        ai_tutor_assistant: true,
      };

      const strArray = canonicalEntitlementsToStringArray(entitlements as any);
      expect(strArray).toContain("Recruitment Drives & Scheduling");
      expect(strArray).toContain("Floating AI Placement Tutor");
      expect(strArray).toContain("Department & Academic Structure");
    });
  });

  describe("2. Navigation Surfacing for College Roles", () => {
    it("surfaces AI Placement Tutor under Preparation & Training for PLACEMENT_HEAD when enabled", () => {
      const sections = getAuthorizedNavigation(
        "PLACEMENT_HEAD",
        false,
        undefined,
        "ACTIVE",
        false,
        {
          ai_tutor_assistant: true,
          core_drives_management: true,
          department_hierarchy: true,
        }
      );

      const prepSection = sections.find((s) => s.title === "Preparation & Training");
      expect(prepSection).toBeDefined();

      const tutorItem = prepSection!.items.find((item) => item.id === "college-tutor");
      expect(tutorItem).toBeDefined();
      expect(tutorItem!.name).toBe("AI Placement Tutor");
      expect(tutorItem!.href).toBe("/dashboard/student/tutor");
      expect(tutorItem!.badge).toBe("AI");
    });

    it("hides AI Placement Tutor for PLACEMENT_HEAD when ai_tutor_assistant is false", () => {
      const sections = getAuthorizedNavigation(
        "PLACEMENT_HEAD",
        false,
        undefined,
        "ACTIVE",
        false,
        {
          ai_tutor_assistant: false,
          core_drives_management: true,
          department_hierarchy: true,
        }
      );

      const prepSection = sections.find((s) => s.title === "Preparation & Training");
      expect(prepSection).toBeDefined();

      const tutorItem = prepSection!.items.find((item) => item.id === "college-tutor");
      expect(tutorItem).toBeUndefined();
    });

    it("surfaces Academic Structure under College Administration", () => {
      const sections = getAuthorizedNavigation(
        "PLACEMENT_HEAD",
        false,
        undefined,
        "ACTIVE",
        false,
        {
          department_hierarchy: true,
        }
      );

      const adminSection = sections.find((s) => s.title === "College Administration");
      expect(adminSection).toBeDefined();

      const academicItem = adminSection!.items.find((item) => item.id === "college-academic");
      expect(academicItem).toBeDefined();
      expect(academicItem!.href).toBe("/dashboard/settings/academic");
    });
  });

  describe("3. SubscriptionAccessService Live Evaluation", () => {
    it("authoritatively retrieves AI Tutor when joined plan record has features array", async () => {
      const mockAdmin = {
        from: vi.fn((table: string) => {
          if (table === "college_subscriptions") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "sub-123",
                      tenant_id: "tenant-demo",
                      status: "ACTIVE",
                      plan_id: "starter",
                      subscription_plans: {
                        id: "starter",
                        name: "Institutional Starter",
                        features: [
                          "Recruitment Drives & Scheduling",
                          "Floating AI Placement Tutor",
                          "AI Question Generation (Gemini)",
                          "Department & Academic Structure",
                        ],
                      },
                    },
                    error: null,
                  }),
                }),
              }),
            };
          }
          if (table === "platform_invoices") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: "inv-1", status: "PAID" }],
                }),
              }),
            };
          }
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }),
      };

      const result = await SubscriptionAccessService.evaluateAccess({
        tenantId: "tenant-demo",
        userRole: "PLACEMENT_HEAD",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe("ALLOW");
      expect(result.entitlements?.ai_tutor_assistant).toBe(true);
      expect(result.entitlements?.ai_question_generator).toBe(true);
      expect(result.entitlements?.department_hierarchy).toBe(true);
    });
  });
});
