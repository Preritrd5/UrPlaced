/**
 * UrPlaced — Centralized Subscription Entitlement Activation & Access Lockdown Suite
 * Verifies that subscription entitlement switches in Super Admin strictly control
 * actual feature availability, backend API execution, navigation visibility, and
 * active subscription propagation across institutional portals.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import {
  CONTROLLED_FEATURE_CATALOGUE,
  type PlanEntitlementsMap,
  type EntitlementsSnapshot,
} from "@/modules/platform-admin/types/subscription-plans";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { getAuthorizedNavigation } from "@/lib/navigation/navigation-config";

describe("Subscription Entitlement Architecture & Real Feature Controls", () => {
  let mockDatabase: Record<string, any[]>;

  function createMockAdmin() {
    return {
      from: (table: string) => ({
        select: (cols?: string) => ({
          eq: (field: string, val: any) => ({
            eq: (f2: string, v2: any) => ({
              maybeSingle: async () => {
                const row = (mockDatabase[table] || []).find((r: any) => r[field] === val && r[f2] === v2);
                return { data: row || null, error: null };
              },
              single: async () => {
                const row = (mockDatabase[table] || []).find((r: any) => r[field] === val && r[f2] === v2);
                if (!row) return { data: null, error: { message: "Not found" } };
                return { data: row, error: null };
              },
            }),
            maybeSingle: async () => {
              const row = (mockDatabase[table] || []).find((r: any) => r[field] === val);
              return { data: row || null, error: null };
            },
            single: async () => {
              const row = (mockDatabase[table] || []).find((r: any) => r[field] === val);
              if (!row) return { data: null, error: { message: "Not found" } };
              return { data: row, error: null };
            },
            in: async (f2: string, vals: any[]) => {
              const rows = (mockDatabase[table] || []).filter((r: any) => r[field] === val && vals.includes(r[f2]));
              return { data: rows || [], error: null };
            },
          }),
          or: (condition: string) => ({
            in: async (f2: string, vals: any[]) => {
              const rows = (mockDatabase[table] || []).filter((r: any) => vals.includes(r[f2]));
              return { data: rows || [], error: null };
            },
          }),
        }),
        insert: async (records: any) => {
          const list = Array.isArray(records) ? records : [records];
          if (!mockDatabase[table]) mockDatabase[table] = [];
          mockDatabase[table].push(...list);
          return { error: null };
        },
        update: (payload: any) => ({
          eq: (field: string, val: any) => {
            const list = mockDatabase[table] || [];
            const idx = list.findIndex((r: any) => r[field] === val);
            if (idx !== -1 && idx !== undefined) {
              list[idx] = { ...list[idx], ...payload };
            }
            const updatedRow = idx !== -1 ? list[idx] : null;
            return {
              error: null,
              data: updatedRow,
              select: () => ({
                single: async () => ({ data: updatedRow, error: null }),
              }),
              then: (resolve: any) => resolve({ error: null, data: updatedRow }),
            };
          },
        }),
      }),
    };
  }

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDatabase = {
      subscription_plans: [],
      college_subscriptions: [],
      platform_invoices: [],
      audit_logs: [],
    };
  });

  // =========================================================================
  // 1. Centralized Entitlement Catalogue & Key Stability
  // =========================================================================
  describe("1. Centralized Entitlement Catalogue & Permission Resolution", () => {
    it("maintains stable, canonical keys for all 16 controlled features", () => {
      expect(CONTROLLED_FEATURE_CATALOGUE.length).toBe(16);
      const keys = CONTROLLED_FEATURE_CATALOGUE.map((f) => f.key);

      expect(keys).toContain("core_drives_management");
      expect(keys).toContain("student_roster_directory");
      expect(keys).toContain("company_management");
      expect(keys).toContain("standard_assessments");
      expect(keys).toContain("subject_question_banks");
      expect(keys).toContain("custom_question_sets");
      expect(keys).toContain("drivefit_evaluator");
      expect(keys).toContain("mistake_to_mastery");
      expect(keys).toContain("placement_memory_analytics");
      expect(keys).toContain("automated_eligibility_engine");
      expect(keys).toContain("ai_question_generator");
      expect(keys).toContain("ai_tutor_assistant");
      expect(keys).toContain("ai_evaluation_pipeline");
      expect(keys).toContain("department_hierarchy");
      expect(keys).toContain("audit_data_export_hub");
      expect(keys).toContain("dedicated_sla_liaison");
    });

    it("accurately resolves canonical feature keys from real application permissions", () => {
      // Floating AI Placement Tutor
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.AI_STUDY_TUTOR_USE)).toBe(
        "ai_tutor_assistant"
      );
      // AI Question Generation
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.AI_QUESTIONS_GENERATE)).toBe(
        "ai_question_generator"
      );
      // DriveFit Match Scoring
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.AI_DRIVEFIT_EVALUATE)).toBe(
        "drivefit_evaluator"
      );
      // Automated Resume & Candidate Intelligence
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.AI_PLACEMENT_INTEL_READ)).toBe(
        "ai_evaluation_pipeline"
      );
      // Mistake-to-Mastery & Question Defects
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.MISTAKE_BANK_MANAGE_OWN)).toBe(
        "mistake_to_mastery"
      );
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.MISTAKE_BANK_READ_COHORT)).toBe(
        "mistake_to_mastery"
      );
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.AI_MISTAKE_MASTERY_USE)).toBe(
        "mistake_to_mastery"
      );
      // Placement Memory & Debriefs
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.PLACEMENT_MEMORY_READ)).toBe(
        "placement_memory_analytics"
      );
      // Department & Academic Structure
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.DEPARTMENTS_MANAGE)).toBe(
        "department_hierarchy"
      );
      // Assessment Engine & Banks
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.ASSESSMENTS_ATTEMPT)).toBe(
        "standard_assessments"
      );
      expect(SubscriptionAccessService.resolveFeatureKeyFromPermission(Permissions.QUESTIONS_MANAGE)).toBe(
        "subject_question_banks"
      );
    });
  });

  // =========================================================================
  // 2. Real Feature Gating: ON gives access, OFF blocks access
  // =========================================================================
  describe("2. Feature Entitlement Evaluation & Lock Enforcement", () => {
    it("allows operational access when feature is enabled in subscription snapshot", async () => {
      const mockAdmin = createMockAdmin();
      const snapshot: EntitlementsSnapshot = {
        planId: "growth",
        planName: "Campus Growth",
        planVersion: 1,
        priceInr: 9999,
        billingCycle: "ANNUAL",
        limits: { max_students: 2500, max_staff: 25, max_drives: 50, max_storage_gb: 100, max_assessments: 50, ai_tokens_monthly: 100000 },
        entitlements: {
          ai_tutor_assistant: true,
          ai_question_generator: true,
          drivefit_evaluator: true,
          mistake_to_mastery: true,
          department_hierarchy: true,
          core_drives_management: true,
        },
        snapshotAt: new Date().toISOString(),
      };

      mockDatabase.college_subscriptions.push({
        id: "sub-active-growth",
        tenant_id: "college-active-01",
        plan_id: "growth",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: snapshot,
        expiry_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      });

      const res = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-active-01",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });

      expect(res.decision).toBe("ALLOW");
      expect(res.allowed).toBe(true);
      expect(res.canAccessOperational).toBe(true);
      expect(res.entitlements?.ai_tutor_assistant).toBe(true);
    });

    it("strictly denies access with DENY_ENTITLEMENT when feature is turned OFF", async () => {
      const mockAdmin = createMockAdmin();
      const snapshot: EntitlementsSnapshot = {
        planId: "starter",
        planName: "Institutional Starter",
        planVersion: 1,
        priceInr: 1,
        billingCycle: "ANNUAL",
        limits: { max_students: 500, max_staff: 5, max_drives: 5, max_storage_gb: 20, max_assessments: 10, ai_tokens_monthly: 0 },
        entitlements: {
          core_drives_management: true,
          student_roster_directory: true,
          company_management: true,
          standard_assessments: true,
          subject_question_banks: true,
          ai_tutor_assistant: false, // Turn OFF AI Tutor
          ai_question_generator: false, // Turn OFF AI Question Gen
          drivefit_evaluator: false, // Turn OFF DriveFit
          mistake_to_mastery: false, // Turn OFF Mistake Bank
        },
        snapshotAt: new Date().toISOString(),
      };

      mockDatabase.college_subscriptions.push({
        id: "sub-starter",
        tenant_id: "college-starter-01",
        plan_id: "starter",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: snapshot,
      });

      // AI Tutor check
      const tutorCheck = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-starter-01",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });
      expect(tutorCheck.decision).toBe("DENY_ENTITLEMENT");
      expect(tutorCheck.allowed).toBe(false);
      expect(tutorCheck.reasonCode).toBe("FEATURE_NOT_IN_PLAN");

      // AI Question Gen check
      const qGenCheck = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-starter-01",
        featureKey: "ai_question_generator",
        admin: mockAdmin as any,
      });
      expect(qGenCheck.decision).toBe("DENY_ENTITLEMENT");
      expect(qGenCheck.allowed).toBe(false);

      // DriveFit check
      const drivefitCheck = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-starter-01",
        featureKey: "drivefit_evaluator",
        admin: mockAdmin as any,
      });
      expect(drivefitCheck.decision).toBe("DENY_ENTITLEMENT");
      expect(drivefitCheck.allowed).toBe(false);
    });

    it("assertFeatureEntitlement throws structured 403 Error when feature is disabled", async () => {
      const mockAdmin = createMockAdmin();
      const snapshot: EntitlementsSnapshot = {
        planId: "starter",
        planName: "Institutional Starter",
        planVersion: 1,
        priceInr: 1,
        billingCycle: "ANNUAL",
        limits: { max_students: 500, max_staff: 5, max_drives: 5, max_storage_gb: 20, max_assessments: 10, ai_tokens_monthly: 0 },
        entitlements: {
          ai_tutor_assistant: false,
        },
        snapshotAt: new Date().toISOString(),
      };

      mockDatabase.college_subscriptions.push({
        id: "sub-starter-assert",
        tenant_id: "col-assert-01",
        plan_id: "starter",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: snapshot,
      });

      await expect(
        SubscriptionAccessService.assertFeatureEntitlement(
          "col-assert-01",
          "ai_tutor_assistant",
          "STUDENT",
          undefined,
          mockAdmin as any
        )
      ).rejects.toThrow(/FORBIDDEN: FEATURE_NOT_IN_PLAN/);
    });

    it("verifies zero universal bypass: disabling department_hierarchy strictly fails closed", async () => {
      const mockAdmin = createMockAdmin();
      const snapshot: EntitlementsSnapshot = {
        planId: "custom",
        planName: "Restricted Plan",
        planVersion: 1,
        priceInr: 0,
        billingCycle: "ANNUAL",
        limits: { max_students: 100, max_staff: 2, max_drives: 2, max_storage_gb: 5, max_assessments: 2, ai_tokens_monthly: 0 },
        entitlements: {
          department_hierarchy: false, // Super Admin explicitly disabled department structure
        },
        snapshotAt: new Date().toISOString(),
      };

      mockDatabase.college_subscriptions.push({
        id: "sub-restricted",
        tenant_id: "col-restricted-01",
        plan_id: "custom",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: snapshot,
      });

      const res = await SubscriptionAccessService.evaluateAccess({
        tenantId: "col-restricted-01",
        featureKey: "department_hierarchy",
        admin: mockAdmin as any,
      });

      expect(res.decision).toBe("DENY_ENTITLEMENT");
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe("FEATURE_NOT_IN_PLAN");
    });
  });

  // =========================================================================
  // 3. Plan Update Propagation to Subscribed Colleges
  // =========================================================================
  describe("3. Plan Update Propagation & Live Synchronization", () => {
    it("propagates updated entitlements to active college subscriptions upon plan save", async () => {
      const mockAdmin = createMockAdmin();

      // Seed published plan with AI Tutor disabled
      mockDatabase.subscription_plans.push({
        id: "starter",
        slug: "starter",
        name: "Institutional Starter",
        status: "PUBLISHED",
        version: 1,
        price_inr: 1,
        currency: "INR",
        billing_interval: "ANNUAL",
        student_limit: 500,
        staff_limit: 5,
        storage_limit_gb: 20,
        limits: { max_students: 500, max_staff: 5, max_drives: 5, max_storage_gb: 20, max_assessments: 10, ai_tokens_monthly: 0 },
        entitlements: {
          core_drives_management: true,
          ai_tutor_assistant: false, // initially OFF
        },
        features: ["core_drives_management"],
        subscribers_count: 1,
        is_active: true,
      });

      // Subscribed college has snapshot v1 with ai_tutor_assistant = false
      mockDatabase.college_subscriptions.push({
        id: "sub-college-propagate",
        tenant_id: "college-xyz",
        plan_id: "starter",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: {
          planId: "starter",
          planName: "Institutional Starter",
          planVersion: 1,
          entitlements: {
            core_drives_management: true,
            ai_tutor_assistant: false,
          },
          limits: { max_students: 500, max_staff: 5, max_drives: 5, max_storage_gb: 20, max_assessments: 10, ai_tokens_monthly: 0 },
        },
      });

      // Before update: college evaluates to DENY_ENTITLEMENT for ai_tutor_assistant
      const beforeRes = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-xyz",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });
      expect(beforeRes.allowed).toBe(false);

      // Super Admin edits plan and turns ON Floating AI Placement Tutor
      const updatedPlan = await PlatformSubscriptionService.updatePlan({
        id: "starter",
        entitlements: {
          core_drives_management: true,
          ai_tutor_assistant: true, // Switched ON!
        },
        adminId: "super-admin-01",
        admin: mockAdmin as any,
      });

      expect(updatedPlan.version).toBe(2);
      expect(updatedPlan.entitlements.ai_tutor_assistant).toBe(true);

      // Verify the subscribed college's subscription row was automatically updated with new version & snapshot!
      const updatedCollegeSub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-college-propagate");
      expect(updatedCollegeSub.plan_version).toBe(2);
      expect(updatedCollegeSub.entitlements_snapshot.entitlements.ai_tutor_assistant).toBe(true);

      // After update: college evaluates to ALLOW for ai_tutor_assistant without requiring manual logout!
      const afterRes = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-xyz",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });
      expect(afterRes.allowed).toBe(true);
      expect(afterRes.decision).toBe("ALLOW");
    });
  });

  // =========================================================================
  // 4. Navigation Registry & Entitlement Filtering
  // =========================================================================
  describe("4. Navigation Registry Entitlement Filtering", () => {
    it("omits navigation links when feature entitlement is false", () => {
      const entitlementsWithTutorDisabled: PlanEntitlementsMap = {
        core_drives_management: true,
        ai_tutor_assistant: false, // Tutor OFF
        mistake_to_mastery: false, // Mistakes OFF
        placement_memory_analytics: true,
      };

      const sections = getAuthorizedNavigation(
        "STUDENT",
        false,
        [Permissions.DASHBOARD_READ, Permissions.AI_STUDY_TUTOR_USE, Permissions.MISTAKE_BANK_MANAGE_OWN],
        "ACTIVE",
        false,
        entitlementsWithTutorDisabled
      );

      const allHrefs = sections.flatMap((s) => s.items).map((i) => i.href);
      expect(allHrefs).not.toContain("/dashboard/student/tutor");
      expect(allHrefs).not.toContain("/dashboard/student/mistakes");
    });

    it("includes navigation links when feature entitlement is true", () => {
      const entitlementsWithTutorEnabled: PlanEntitlementsMap = {
        core_drives_management: true,
        ai_tutor_assistant: true, // Tutor ON
        mistake_to_mastery: true, // Mistakes ON
        placement_memory_analytics: true,
      };

      const sections = getAuthorizedNavigation(
        "STUDENT",
        false,
        [Permissions.DASHBOARD_READ, Permissions.AI_STUDY_TUTOR_USE, Permissions.MISTAKE_BANK_MANAGE_OWN],
        "ACTIVE",
        false,
        entitlementsWithTutorEnabled
      );

      const allHrefs = sections.flatMap((s) => s.items).map((i) => i.href);
      expect(allHrefs).toContain("/dashboard/student/tutor");
      expect(allHrefs).toContain("/dashboard/student/mistakes");
    });

    it("filters out Department & Academic Structure from College nav when disabled", () => {
      const collegeEntitlementsDeptDisabled: PlanEntitlementsMap = {
        core_drives_management: true,
        department_hierarchy: false, // Academic structure OFF
      };

      const sections = getAuthorizedNavigation(
        "PLACEMENT_HEAD",
        false,
        [Permissions.DASHBOARD_READ, Permissions.DEPARTMENTS_MANAGE],
        "ACTIVE",
        false,
        collegeEntitlementsDeptDisabled
      );

      const allHrefs = sections.flatMap((s) => s.items).map((i) => i.href);
      expect(allHrefs).not.toContain("/dashboard/settings/academic");
    });
  });

  // =========================================================================
  // 5. Multi-College Tenant Isolation
  // =========================================================================
  describe("5. Multi-College Tenant Entitlement Isolation", () => {
    it("ensures College A cannot inherit College B's entitled modules", async () => {
      const mockAdmin = createMockAdmin();

      // College A: Starter (AI Tutor OFF)
      mockDatabase.college_subscriptions.push({
        id: "sub-col-a",
        tenant_id: "college-a",
        plan_id: "starter",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: {
          planId: "starter",
          planName: "Starter",
          entitlements: { ai_tutor_assistant: false },
          limits: { max_students: 500, max_staff: 5, max_drives: 5, max_storage_gb: 20, max_assessments: 10, ai_tokens_monthly: 0 },
        },
      });

      // College B: Enterprise (AI Tutor ON)
      mockDatabase.college_subscriptions.push({
        id: "sub-col-b",
        tenant_id: "college-b",
        plan_id: "enterprise",
        status: "ACTIVE",
        plan_version: 1,
        entitlements_snapshot: {
          planId: "enterprise",
          planName: "Enterprise",
          entitlements: { ai_tutor_assistant: true },
          limits: { max_students: 10000, max_staff: 100, max_drives: 100, max_storage_gb: 500, max_assessments: 500, ai_tokens_monthly: 1000000 },
        },
      });

      const resA = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-a",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });

      const resB = await SubscriptionAccessService.evaluateAccess({
        tenantId: "college-b",
        featureKey: "ai_tutor_assistant",
        admin: mockAdmin as any,
      });

      expect(resA.allowed).toBe(false);
      expect(resA.decision).toBe("DENY_ENTITLEMENT");
      expect(resB.allowed).toBe(true);
      expect(resB.decision).toBe("ALLOW");
    });
  });
});
