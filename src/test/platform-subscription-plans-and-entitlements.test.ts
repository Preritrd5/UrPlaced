import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { EntitlementService } from "@/modules/platform-admin/services/entitlement-service";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import {
  CONTROLLED_FEATURE_CATALOGUE,
  CONTROLLED_LIMIT_KEYS,
  DetailedSubscriptionPlan,
} from "@/modules/platform-admin/types/subscription-plans";

describe("SA-04: Platform Subscription Plans, Entitlements & Versioning", () => {
  let mockDatabase: Record<string, any[]> = {};

  const createMockAdmin = () => ({
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, email: "superadmin@urplaced.com", app_metadata: { is_platform_admin: true } } },
          error: null,
        })),
      },
      getUser: vi.fn(async (token: string) => {
        if (token === "super-admin-token") {
          return {
            data: {
              user: {
                id: "admin-uuid",
                email: "admin@urplaced.com",
                app_metadata: { aal: "aal2", is_platform_admin: true },
              },
            },
            error: null,
          };
        }
        if (token === "student-token") {
          return {
            data: {
              user: {
                id: "student-uuid",
                email: "student@sapthagiri.edu.in",
                app_metadata: { role: "STUDENT" },
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: { message: "Invalid token" } };
      }),
    },
    from: vi.fn((table: string) => {
      if (!mockDatabase[table]) mockDatabase[table] = [];

      return {
        select: vi.fn((columns?: string, options?: any) => {
          let rows = [...(mockDatabase[table] || [])];

          // Populate mock relational joins
          if (table === "college_subscriptions") {
            rows = rows.map((r) => ({
              ...r,
              tenants: mockDatabase["tenants"]?.find((t) => t.id === r.tenant_id),
              subscription_plans: mockDatabase["subscription_plans"]?.find((p) => p.id === r.plan_id),
            }));
          }

          const queryBuilder: any = {
            eq: vi.fn((field: string, val: any) => {
              rows = rows.filter((r) => r[field] === val);
              return queryBuilder;
            }),
            in: vi.fn((field: string, vals: any[]) => {
              rows = rows.filter((r) => vals.includes(r[field]));
              return queryBuilder;
            }),
            is: vi.fn((field: string, val: any) => {
              rows = rows.filter((r) => (val === null ? r[field] === null || r[field] === undefined : r[field] === val));
              return queryBuilder;
            }),
            or: vi.fn((condition: string) => {
              const parts = condition.split(",");
              rows = rows.filter((r) => {
                return parts.some((p) => {
                  const match = p.match(/(\w+)\.eq\.(.+)/);
                  if (match) {
                    const [, field, val] = match;
                    return String(r[field]) === String(val);
                  }
                  return false;
                });
              });
              return queryBuilder;
            }),
            order: vi.fn(() => queryBuilder),
            range: vi.fn((from: number, to: number) => {
              rows = rows.slice(from, to + 1);
              return queryBuilder;
            }),
            single: vi.fn(async () => {
              if (rows.length === 0) return { data: null, error: { message: "Row not found" } };
              return { data: rows[0], error: null };
            }),
            maybeSingle: vi.fn(async () => {
              return { data: rows[0] || null, error: null };
            }),
            then: vi.fn((resolve: any) =>
              resolve({
                data: rows,
                count: rows.length,
                error: null,
              })
            ),
          };
          return queryBuilder;
        }),
        insert: vi.fn((record: any) => {
          const newRecord = {
            id: record.id || `mock-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            ...record,
          };
          mockDatabase[table].push(newRecord);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: newRecord, error: null })),
            })),
            then: vi.fn((resolve: any) => resolve({ data: newRecord, error: null })),
          };
        }),
        update: vi.fn((updates: any) => ({
          eq: vi.fn((field: string, val: any) => {
            const idx = mockDatabase[table].findIndex((r) => r[field] === val);
            if (idx >= 0) {
              mockDatabase[table][idx] = { ...mockDatabase[table][idx], ...updates };
              const updatedRow = {
                ...mockDatabase[table][idx],
                tenants: mockDatabase["tenants"]?.find((t) => t.id === mockDatabase[table][idx].tenant_id),
                subscription_plans: mockDatabase["subscription_plans"]?.find((p) => p.id === mockDatabase[table][idx].plan_id),
              };
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: updatedRow, error: null })),
                })),
                then: vi.fn((resolve: any) => resolve({ data: updatedRow, error: null })),
              };
            }
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: null, error: { message: "Not found" } })),
              })),
              then: vi.fn((resolve: any) => resolve({ data: null, error: { message: "Not found" } })),
            };
          }),
        })),
      };
    }),
  });

  beforeEach(() => {
    mockDatabase = {
      tenants: [
        {
          id: "tenant-sapthagiri",
          name: "Sapthagiri NPS University",
          slug: "sapthagiri",
          status: "ACTIVE",
          student_seat_limit: 1500,
          created_at: new Date().toISOString(),
        },
        {
          id: "tenant-pending-college",
          name: "Pending Tech Campus",
          slug: "pending-tech",
          status: "PENDING_PAYMENT",
          student_seat_limit: 500,
          created_at: new Date().toISOString(),
        },
      ],
      profiles: [
        { id: "admin-uuid", email: "admin@urplaced.com", full_name: "Super Admin", is_platform_admin: true },
        { id: "student-uuid", email: "student@sapthagiri.edu.in", full_name: "Student", is_platform_admin: false },
      ],
      platform_admins: [
        {
          id: "admin-uuid",
          email: "admin@urplaced.com",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          mfa_enabled: true,
          mfa_enforced: true,
        },
      ],
      subscription_plans: [
        {
          id: "plan-starter",
          name: "Starter Campus",
          slug: "starter-campus",
          description: "Essential placement drive management",
          display_order: 1,
          status: "PUBLISHED",
          price_inr: 49999,
          currency: "INR",
          billing_interval: "ANNUAL",
          billing_cycle: "ANNUAL",
          discount_percentage: 0,
          student_limit: 500,
          staff_limit: 5,
          storage_limit_gb: 20,
          limits: {
            max_students: 500,
            max_staff: 5,
            max_drives: 10,
            max_storage_gb: 20,
            max_assessments: 25,
            ai_tokens_monthly: 50000,
          },
          entitlements: {
            core_drives_management: true,
            student_roster_directory: true,
            company_management: true,
            standard_assessments: true,
            subject_question_banks: true,
            custom_question_sets: false,
            drivefit_evaluator: false,
            mistake_to_mastery: false,
            ai_question_generator: false,
            ai_tutor_assistant: false,
            ai_evaluation_pipeline: false,
            department_hierarchy: false,
            audit_data_export_hub: false,
            dedicated_sla_liaison: false,
          },
          version: 1,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "plan-growth",
          name: "Growth Institution",
          slug: "growth-institution",
          description: "Full intelligence and evaluation suite",
          display_order: 2,
          status: "PUBLISHED",
          price_inr: 149999,
          currency: "INR",
          billing_interval: "ANNUAL",
          billing_cycle: "ANNUAL",
          discount_percentage: 10,
          student_limit: 2500,
          staff_limit: 20,
          storage_limit_gb: 100,
          limits: {
            max_students: 2500,
            max_staff: 20,
            max_drives: 50,
            max_storage_gb: 100,
            max_assessments: 200,
            ai_tokens_monthly: 500000,
          },
          entitlements: {
            core_drives_management: true,
            student_roster_directory: true,
            company_management: true,
            standard_assessments: true,
            subject_question_banks: true,
            custom_question_sets: true,
            drivefit_evaluator: true,
            mistake_to_mastery: true,
            ai_question_generator: true,
            ai_tutor_assistant: true,
            ai_evaluation_pipeline: false,
            department_hierarchy: false,
            audit_data_export_hub: true,
            dedicated_sla_liaison: false,
          },
          version: 1,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "plan-draft-tier",
          name: "Draft Pilot Tier",
          slug: "draft-pilot",
          description: "Unpublished testing tier",
          display_order: 3,
          status: "DRAFT",
          price_inr: 19999,
          currency: "INR",
          billing_interval: "ANNUAL",
          billing_cycle: "ANNUAL",
          discount_percentage: 0,
          student_limit: 100,
          staff_limit: 2,
          storage_limit_gb: 5,
          limits: {
            max_students: 100,
            max_staff: 2,
            max_drives: 5,
            max_storage_gb: 5,
            max_assessments: 10,
            ai_tokens_monthly: 10000,
          },
          entitlements: {
            core_drives_management: true,
            student_roster_directory: true,
          },
          version: 1,
          is_active: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      college_subscriptions: [
        {
          id: "sub-sapthagiri",
          tenant_id: "tenant-sapthagiri",
          plan_id: "plan-growth",
          plan_version: 1,
          status: "ACTIVE",
          start_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          grace_period_days: 15,
          student_seat_limit: 2500,
          staff_seat_limit: 20,
          entitlements_snapshot: {
            planId: "plan-growth",
            planName: "Growth Institution",
            planVersion: 1,
            priceInr: 149999,
            billingCycle: "ANNUAL",
            limits: {
              max_students: 2500,
              max_staff: 20,
              max_drives: 50,
              max_storage_gb: 100,
              max_assessments: 200,
              ai_tokens_monthly: 500000,
            },
            entitlements: {
              core_drives_management: true,
              student_roster_directory: true,
              company_management: true,
              standard_assessments: true,
              subject_question_banks: true,
              custom_question_sets: true,
              drivefit_evaluator: true,
              mistake_to_mastery: true,
              ai_question_generator: true,
              ai_tutor_assistant: true,
              ai_evaluation_pipeline: false,
              department_hierarchy: false,
              audit_data_export_hub: true,
              dedicated_sla_liaison: false,
            },
            snapshotAt: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          id: "sub-pending",
          tenant_id: "tenant-pending-college",
          plan_id: "plan-starter",
          plan_version: 1,
          status: "PENDING_PAYMENT",
          start_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          grace_period_days: 15,
          student_seat_limit: 500,
          staff_seat_limit: 5,
          entitlements_snapshot: {
            planId: "plan-starter",
            planName: "Starter Campus",
            planVersion: 1,
            priceInr: 49999,
            billingCycle: "ANNUAL",
            limits: {
              max_students: 500,
              max_staff: 5,
              max_drives: 10,
              max_storage_gb: 20,
              max_assessments: 25,
              ai_tokens_monthly: 50000,
            },
            entitlements: {
              core_drives_management: true,
              student_roster_directory: true,
              company_management: true,
              standard_assessments: true,
            },
            snapshotAt: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      audit_logs: [],
    };
  });

  // -------------------------------------------------------------
  // 1. Controlled Catalogue Integrity
  // -------------------------------------------------------------
  describe("1. Controlled Catalogue Integrity", () => {
    it("exports exactly 16 controlled features across 5 architectural categories", () => {
      expect(CONTROLLED_FEATURE_CATALOGUE).toHaveLength(16);

      const core = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === "CORE_PLACEMENT");
      const assessment = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === "ASSESSMENT_TESTING");
      const analytics = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === "INTELLIGENCE_ANALYTICS");
      const ai = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === "AI_CAPABILITIES");
      const admin = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === "INSTITUTIONAL_ADMIN");

      expect(core).toHaveLength(3);
      expect(assessment).toHaveLength(3);
      expect(analytics).toHaveLength(4);
      expect(ai).toHaveLength(3);
      expect(admin).toHaveLength(3);

      const keys = CONTROLLED_FEATURE_CATALOGUE.map((f) => f.key);
      expect(keys).toContain("core_drives_management");
      expect(keys).toContain("student_roster_directory");
      expect(keys).toContain("company_management");
      expect(keys).toContain("standard_assessments");
      expect(keys).toContain("subject_question_banks");
      expect(keys).toContain("custom_question_sets");
      expect(keys).toContain("automated_eligibility_engine");
      expect(keys).toContain("placement_memory_analytics");
      expect(keys).toContain("drivefit_evaluator");
      expect(keys).toContain("mistake_to_mastery");
      expect(keys).toContain("ai_question_generator");
      expect(keys).toContain("ai_tutor_assistant");
      expect(keys).toContain("ai_evaluation_pipeline");
      expect(keys).toContain("department_hierarchy");
      expect(keys).toContain("audit_data_export_hub");
      expect(keys).toContain("dedicated_sla_liaison");
    });

    it("exports valid numerical limit keys", () => {
      expect(CONTROLLED_LIMIT_KEYS.length).toBeGreaterThanOrEqual(6);
      const limitKeys = CONTROLLED_LIMIT_KEYS.map((l) => l.key);
      expect(limitKeys).toContain("max_students");
      expect(limitKeys).toContain("max_staff");
      expect(limitKeys).toContain("max_drives");
      expect(limitKeys).toContain("max_storage_gb");
      expect(limitKeys).toContain("max_assessments");
      expect(limitKeys).toContain("ai_tokens_monthly");
    });
  });

  // -------------------------------------------------------------
  // 2. Plan Lifecycle Management & Validation
  // -------------------------------------------------------------
  describe("2. Plan Lifecycle Management & Validation", () => {
    it("creates a new subscription plan with validation and initial version 1", async () => {
      const mockAdmin = createMockAdmin();

      const created = await PlatformSubscriptionService.createPlan({
        name: "Enterprise Consortium",
        slug: "enterprise-consortium",
        description: "Multi-campus university network plan",
        displayOrder: 4,
        status: "PUBLISHED",
        priceInr: 399999,
        currency: "INR",
        billingInterval: "ANNUAL",
        discountPercentage: 15,
        limits: {
          max_students: 15000,
          max_staff: 100,
          max_drives: null, // Unlimited
          max_storage_gb: 500,
          max_assessments: null,
          ai_tokens_monthly: 2000000,
        },
        entitlements: {
          core_drives_management: true,
          ai_question_generator: true,
          dedicated_sla_liaison: true,
        },
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(created.id).toBe("enterprise-consortium");
      expect(created.name).toBe("Enterprise Consortium");
      expect(created.version).toBe(1);
      expect(created.status).toBe("PUBLISHED");
      expect(created.limits.max_students).toBe(15000);
      expect(created.limits.max_drives).toBeNull();
      expect(created.entitlements["dedicated_sla_liaison"]).toBe(true);

      // Verify audit log
      expect(mockDatabase["audit_logs"].length).toBe(1);
      expect(mockDatabase["audit_logs"][0].action).toBe("PLATFORM_PLAN_CREATE");
    });

    it("rejects plan creation with negative price", async () => {
      const mockAdmin = createMockAdmin();

      await expect(
        PlatformSubscriptionService.createPlan({
          name: "Invalid Plan",
          slug: "invalid-plan",
          priceInr: -500,
          adminId: "admin-uuid",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("Price cannot be negative");
    });

    it("rejects duplicate plan slug", async () => {
      const mockAdmin = createMockAdmin();

      await expect(
        PlatformSubscriptionService.createPlan({
          name: "Starter Duplicate",
          slug: "starter-campus", // already exists
          priceInr: 50000,
          adminId: "admin-uuid",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("already exists");
    });

    it("publishes a DRAFT plan making it PUBLISHED", async () => {
      const mockAdmin = createMockAdmin();

      const published = await PlatformSubscriptionService.publishPlan("plan-draft-tier", "admin-uuid", mockAdmin as any);

      expect(published.status).toBe("PUBLISHED");
      expect(published.isActive).toBe(true);

      const inDb = mockDatabase["subscription_plans"].find((p) => p.id === "plan-draft-tier");
      expect(inDb.status).toBe("PUBLISHED");
    });
  });

  // -------------------------------------------------------------
  // 3. Plan Versioning & Existing Subscription Safety
  // -------------------------------------------------------------
  describe("3. Plan Versioning & Existing Subscription Safety", () => {
    it("increments plan version when a PUBLISHED plan is updated, without modifying existing subscriber snapshot", async () => {
      const mockAdmin = createMockAdmin();

      // Sapthagiri is on plan-growth (v1)
      const initialSub = mockDatabase["college_subscriptions"].find((s) => s.tenant_id === "tenant-sapthagiri");
      expect(initialSub.plan_version).toBe(1);
      expect(initialSub.entitlements_snapshot.limits.max_students).toBe(2500);

      // Super Admin updates plan-growth: increases price & changes max_students to 5000
      const updatedPlan = await PlatformSubscriptionService.updatePlan({
        id: "plan-growth",
        priceInr: 179999,
        limits: {
          max_students: 5000,
        },
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      // Plan version must be bumped from 1 to 2
      expect(updatedPlan.version).toBe(2);
      expect(updatedPlan.priceInr).toBe(179999);
      expect(updatedPlan.limits.max_students).toBe(5000);

      // CRITICAL INVARIANT: Existing subscription's snapshot must remain frozen on v1 with 2500 students!
      const preservedSub = mockDatabase["college_subscriptions"].find((s) => s.tenant_id === "tenant-sapthagiri");
      expect(preservedSub.plan_version).toBe(1);
      expect(preservedSub.entitlements_snapshot.planVersion).toBe(1);
      expect(preservedSub.entitlements_snapshot.limits.max_students).toBe(2500);
      expect(preservedSub.entitlements_snapshot.priceInr).toBe(149999);
    });

    it("detects when a college subscription has an outdated plan version", async () => {
      const mockAdmin = createMockAdmin();

      // Bump plan-growth to version 2
      const planInDb = mockDatabase["subscription_plans"].find((p) => p.id === "plan-growth");
      planInDb.version = 2;

      // List college subscriptions
      const subscriptions = await PlatformSubscriptionService.listCollegeSubscriptions({
        admin: mockAdmin as any,
      });

      const sapthagiri = subscriptions.find((s) => s.tenantId === "tenant-sapthagiri");
      expect(sapthagiri).toBeDefined();
      expect(sapthagiri!.planVersion).toBe(1);
      expect(sapthagiri!.currentPlanVersion).toBe(2);
      expect(sapthagiri!.isPlanVersionOutdated).toBe(true);
    });

    it("explicitly synchronizes an outdated subscription to the latest plan version upon admin action", async () => {
      const mockAdmin = createMockAdmin();

      // Bump plan-growth in DB to version 2 with updated price
      const planInDb = mockDatabase["subscription_plans"].find((p) => p.id === "plan-growth");
      planInDb.version = 2;
      planInDb.price_inr = 189999;
      planInDb.limits.max_students = 6000;

      // Admin triggers explicit sync
      const result = await PlatformSubscriptionService.syncCollegeSubscriptionToLatestPlan({
        tenantId: "tenant-sapthagiri",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(result.subscription.planVersion).toBe(2);
      expect(result.subscription.isPlanVersionOutdated).toBe(false);
      expect(result.subscription.entitlementsSnapshot?.planVersion).toBe(2);
      expect(result.subscription.entitlementsSnapshot?.limits.max_students).toBe(6000);

      // Verify audit log for synchronization
      const syncLog = mockDatabase["audit_logs"].find(
        (l) => l.action === "COLLEGE_SUBSCRIPTION_PLAN_VERSION_SYNC"
      );
      expect(syncLog).toBeDefined();
    });

    it("proves that editing a published plan in the database never alters existing subscriber entitlements in resolveTenantEntitlements", async () => {
      const mockAdmin = createMockAdmin();

      // 1. Resolve initial entitlements for Sapthagiri (subscribed to plan-growth)
      const initialEntitlements = await EntitlementService.resolveTenantEntitlements(
        "tenant-sapthagiri",
        mockAdmin as any
      );
      expect(initialEntitlements).not.toBeNull();
      expect(initialEntitlements!.isSnapshotValid).toBe(true);
      expect(initialEntitlements!.limits.max_students).toBe(2500);
      expect(initialEntitlements!.features["drivefit_evaluator"]).toBe(true);

      // 2. An administrator mutates the underlying plan-growth in the catalog:
      // removing drivefit_evaluator and slashing max_students to 500
      const planInDb = mockDatabase["subscription_plans"].find((p) => p.id === "plan-growth");
      planInDb.entitlements["drivefit_evaluator"] = false;
      planInDb.limits.max_students = 500;
      planInDb.version = 2;

      // 3. Resolve tenant entitlements again:
      const postEditEntitlements = await EntitlementService.resolveTenantEntitlements(
        "tenant-sapthagiri",
        mockAdmin as any
      );

      // CRITICAL GUARANTEE: The existing subscriber's entitlements and limits are 100% IMMUTABLE!
      expect(postEditEntitlements).not.toBeNull();
      expect(postEditEntitlements!.isSnapshotValid).toBe(true);
      expect(postEditEntitlements!.limits.max_students).toBe(2500); // Preserved!
      expect(postEditEntitlements!.features["drivefit_evaluator"]).toBe(true); // Preserved!
    });

    it("rejects or explicitly flags subscriptions with missing or corrupted snapshots without unsafe fallback", async () => {
      const mockAdmin = createMockAdmin();

      // Add a legacy college subscription with NO snapshot
      mockDatabase["college_subscriptions"].push({
        id: "sub-legacy-no-snapshot",
        tenant_id: "tenant-legacy",
        plan_id: "plan-growth",
        status: "ACTIVE",
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        student_seat_limit: 1000,
        staff_seat_limit: 10,
        entitlements_snapshot: null, // MISSING SNAPSHOT!
      });

      const resolved = await EntitlementService.resolveTenantEntitlements(
        "tenant-legacy",
        mockAdmin as any
      );

      expect(resolved).not.toBeNull();
      expect(resolved!.isSnapshotValid).toBe(false);
      expect(resolved!.snapshotError).toBe("MISSING_OR_CORRUPT_SNAPSHOT");
      expect(Object.values(resolved!.features).every((v) => v === false)).toBe(true);
      expect(resolved!.limits.max_students).toBe(0);

      // Feature check must strictly reject access
      const access = await EntitlementService.checkFeatureAccess(
        "tenant-legacy",
        "core_drives_management",
        mockAdmin as any
      );
      expect(access.allowed).toBe(false);
      expect(access.reason).toContain("snapshot is missing or invalid");
    });
  });

  // -------------------------------------------------------------
  // 4. Archive Safety Guard (Active Subscribers Protection)
  // -------------------------------------------------------------
  describe("4. Archive Safety Guard", () => {
    it("strictly blocks archiving a plan if active or pending college subscriptions are bound to it", async () => {
      const mockAdmin = createMockAdmin();

      // plan-growth has active subscriber: tenant-sapthagiri
      await expect(
        PlatformSubscriptionService.archivePlan("plan-growth", "admin-uuid", mockAdmin as any)
      ).rejects.toThrow(/associated with 1 active or pending college subscription/);

      // plan-starter has pending subscriber: tenant-pending-college
      await expect(
        PlatformSubscriptionService.archivePlan("plan-starter", "admin-uuid", mockAdmin as any)
      ).rejects.toThrow(/associated with 1 active or pending college subscription/);
    });

    it("allows archiving a plan when 0 college subscriptions are bound to it", async () => {
      const mockAdmin = createMockAdmin();

      // plan-draft-tier has 0 subscribers
      const archived = await PlatformSubscriptionService.archivePlan("plan-draft-tier", "admin-uuid", mockAdmin as any);

      expect(archived.status).toBe("ARCHIVED");
      expect(archived.isActive).toBe(false);

      const inDb = mockDatabase["subscription_plans"].find((p) => p.id === "plan-draft-tier");
      expect(inDb.status).toBe("ARCHIVED");
    });
  });

  // -------------------------------------------------------------
  // 5. College Plan Change & Strict PENDING_PAYMENT Isolation
  // -------------------------------------------------------------
  describe("5. College Plan Change & Status Isolation", () => {
    it("rejects changing college plan to a DRAFT plan", async () => {
      const mockAdmin = createMockAdmin();

      await expect(
        PlatformSubscriptionService.changeCollegePlan({
          tenantId: "tenant-sapthagiri",
          newPlanId: "plan-draft-tier",
          adminId: "admin-uuid",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow(/Only PUBLISHED plans can be assigned/);
    });

    it("schedules plan changes for next renewal when applied to an ACTIVE subscription without immediateOverride", async () => {
      const mockAdmin = createMockAdmin();

      const result = await PlatformSubscriptionService.changeCollegePlan({
        tenantId: "tenant-sapthagiri",
        newPlanId: "plan-starter",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(result.type).toBe("SCHEDULED_PENDING_RENEWAL");
      expect(result.message).toContain("scheduled for next renewal");

      // Current active plan and snapshot remain UNCHANGED
      expect(result.subscription.planId).toBe("plan-growth");
      expect(result.subscription.planName).toBe("Growth Institution");
      expect(result.subscription.pendingPlanId).toBe("plan-starter");
      expect(result.subscription.pendingPlanName).toBe("Starter Campus");
      expect(result.subscription.planChangeScheduledAt).toBeDefined();
      expect(result.subscription.planChangeEffectiveAt).toBeDefined();

      // Check DB row
      const inDb = mockDatabase["college_subscriptions"].find((s) => s.tenant_id === "tenant-sapthagiri");
      expect(inDb.plan_id).toBe("plan-growth");
      expect(inDb.pending_plan_id).toBe("plan-starter");

      // Audit log
      const log = mockDatabase["audit_logs"].find((l) => l.action === "PLATFORM_COLLEGE_PLAN_CHANGE_SCHEDULED");
      expect(log).toBeDefined();
    });

    it("rejects emergency immediate plan change for ACTIVE subscription without valid overrideReason", async () => {
      const mockAdmin = createMockAdmin();

      await expect(
        PlatformSubscriptionService.changeCollegePlan({
          tenantId: "tenant-sapthagiri",
          newPlanId: "plan-starter",
          immediateOverride: true,
          overrideReason: "short", // less than 10 characters
          adminId: "admin-uuid",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("requires a valid overrideReason (minimum 10 characters)");
    });

    it("executes immediate plan override for ACTIVE subscription when authorized with valid overrideReason", async () => {
      const mockAdmin = createMockAdmin();

      const result = await PlatformSubscriptionService.changeCollegePlan({
        tenantId: "tenant-sapthagiri",
        newPlanId: "plan-starter",
        immediateOverride: true,
        overrideReason: "Contractual renegotiation approved by Dean of Placements",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(result.type).toBe("IMMEDIATE_OVERRIDE");
      expect(result.subscription.planId).toBe("plan-starter");
      expect(result.subscription.planName).toBe("Starter Campus");
      expect(result.subscription.status).toBe("ACTIVE");
      expect(result.subscription.entitlementsSnapshot?.planId).toBe("plan-starter");

      // Audit log
      const log = mockDatabase["audit_logs"].find(
        (l) => l.action === "PLATFORM_COLLEGE_PLAN_CHANGE_IMMEDIATE_OVERRIDE"
      );
      expect(log).toBeDefined();
      expect(log.after_state?.overrideReason || log.metadata?.overrideReason).toContain("Contractual renegotiation");
    });

    it("STRICT SECURITY INVARIANT: Changing plan for a college on PENDING_PAYMENT retains PENDING_PAYMENT status", async () => {
      const mockAdmin = createMockAdmin();

      // College tenant-pending-college is PENDING_PAYMENT
      const initial = mockDatabase["college_subscriptions"].find((s) => s.tenant_id === "tenant-pending-college");
      expect(initial.status).toBe("PENDING_PAYMENT");

      // Super Admin assigns plan-growth to this college
      const result = await PlatformSubscriptionService.changeCollegePlan({
        tenantId: "tenant-pending-college",
        newPlanId: "plan-growth",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      // The subscription tier was changed:
      expect(result.subscription.planId).toBe("plan-growth");
      expect(result.subscription.planName).toBe("Growth Institution");

      // BUT STATUS MUST STRICTLY REMAIN PENDING_PAYMENT! (NEVER auto-activate unpaid subscriptions!)
      expect(result.subscription.status).toBe("PENDING_PAYMENT");
      const inDb = mockDatabase["college_subscriptions"].find((s) => s.tenant_id === "tenant-pending-college");
      expect(inDb.status).toBe("PENDING_PAYMENT");
    });

    it("controlled snapshot backfill scans and backfills legacy subscriptions missing snapshots", async () => {
      const mockAdmin = createMockAdmin();

      // Add subscription with null snapshot
      mockDatabase["college_subscriptions"].push({
        id: "sub-legacy-unanchored",
        tenant_id: "tenant-legacy-unanchored",
        plan_id: "plan-starter",
        plan_version: 1,
        status: "ACTIVE",
        student_seat_limit: 500,
        staff_seat_limit: 5,
        entitlements_snapshot: null,
      });

      const result = await PlatformSubscriptionService.backfillMissingSnapshots(
        "admin-uuid",
        mockAdmin as any
      );

      expect(result.success).toBe(true);
      expect(result.backfilledCount).toBeGreaterThanOrEqual(1);

      // Verify that the row in DB now has valid snapshot
      const updated = mockDatabase["college_subscriptions"].find(
        (s) => s.id === "sub-legacy-unanchored"
      );
      expect(updated.entitlements_snapshot).toBeDefined();
      expect(updated.entitlements_snapshot.limits).toBeDefined();
      expect(updated.entitlements_snapshot.entitlements).toBeDefined();
    });
  });

  // -------------------------------------------------------------
  // 6. EntitlementService Enforcement & Quota Verification
  // -------------------------------------------------------------
  describe("6. EntitlementService Enforcement & Quota Verification", () => {
    it("blocks feature access if college subscription is in PENDING_PAYMENT status", async () => {
      const mockAdmin = createMockAdmin();

      const access = await EntitlementService.checkFeatureAccess(
        "tenant-pending-college",
        "core_drives_management",
        mockAdmin as any
      );

      // Strict enforcement: unpaid colleges get NO operational feature access!
      expect(access.allowed).toBe(false);
      expect(access.reason).toContain("PENDING_PAYMENT");
    });

    it("allows feature access if subscription is ACTIVE and feature is enabled in snapshot", async () => {
      const mockAdmin = createMockAdmin();

      const driveFitAccess = await EntitlementService.checkFeatureAccess(
        "tenant-sapthagiri",
        "drivefit_evaluator",
        mockAdmin as any
      );
      expect(driveFitAccess.allowed).toBe(true);

      const slaAccess = await EntitlementService.checkFeatureAccess(
        "tenant-sapthagiri",
        "dedicated_sla_liaison",
        mockAdmin as any
      );
      expect(slaAccess.allowed).toBe(false);
      expect(slaAccess.reason).toContain("not included");
    });

    it("verifies numerical usage limits against snapshot", async () => {
      const mockAdmin = createMockAdmin();

      // Sapthagiri snapshot has max_students = 2500
      const underQuota = await EntitlementService.checkUsageLimit(
        "tenant-sapthagiri",
        "max_students",
        2000,
        mockAdmin as any
      );
      expect(underQuota.allowed).toBe(true);
      expect(underQuota.remaining).toBe(500);

      const overQuota = await EntitlementService.checkUsageLimit(
        "tenant-sapthagiri",
        "max_students",
        2501,
        mockAdmin as any
      );
      expect(overQuota.allowed).toBe(false);
      expect(overQuota.remaining).toBe(0);
    });

    it("strictly verifies operational entitlement enforcement across the full status matrix", async () => {
      const mockAdmin = createMockAdmin();

      // ACTIVE -> passes
      await expect(
        EntitlementService.assertCollegeOperationalEntitlement("tenant-sapthagiri", "PLACEMENT_HEAD", "drives.manage", mockAdmin as any)
      ).resolves.not.toThrow();

      // PENDING_PAYMENT -> blocked
      await expect(
        EntitlementService.assertCollegeOperationalEntitlement("tenant-pending-college", "PLACEMENT_HEAD", "drives.manage", mockAdmin as any)
      ).rejects.toThrow(/PENDING_PAYMENT/);

      // EXPIRED -> blocked
      mockDatabase["college_subscriptions"].push({
        id: "sub-expired",
        tenant_id: "tenant-expired",
        plan_id: "plan-starter",
        status: "EXPIRED",
        student_seat_limit: 500,
        staff_seat_limit: 5,
        entitlements_snapshot: {
          planId: "plan-starter",
          planName: "Starter Campus",
          planVersion: 1,
          limits: {},
          entitlements: {},
          snapshotAt: new Date().toISOString(),
        },
      });
      await expect(
        EntitlementService.assertCollegeOperationalEntitlement("tenant-expired", "PLACEMENT_HEAD", "drives.manage", mockAdmin as any)
      ).rejects.toThrow(/EXPIRED/);

      // CANCELED -> blocked
      mockDatabase["college_subscriptions"].push({
        id: "sub-canceled",
        tenant_id: "tenant-canceled",
        plan_id: "plan-starter",
        status: "CANCELED",
        student_seat_limit: 500,
        staff_seat_limit: 5,
        entitlements_snapshot: {
          planId: "plan-starter",
          planName: "Starter Campus",
          planVersion: 1,
          limits: {},
          entitlements: {},
          snapshotAt: new Date().toISOString(),
        },
      });
      await expect(
        EntitlementService.assertCollegeOperationalEntitlement("tenant-canceled", "PLACEMENT_HEAD", "drives.manage", mockAdmin as any)
      ).rejects.toThrow(/CANCELED/);
    });
  });

  // -------------------------------------------------------------
  // 7. Super Admin Authorization & Privilege Guard
  // -------------------------------------------------------------
  describe("7. Super Admin Authorization & Privilege Guard", () => {
    it("rejects unauthorized access without valid Super Admin session (UNAUTHORIZED)", async () => {
      const mockReq = new NextRequest("http://localhost/api/preritrd/subscriptions/plans", {
        headers: { authorization: "Bearer invalid-token" },
      });

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: createMockAdmin() as any })
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("rejects student account attempting Super Admin subscription operations (FORBIDDEN: NOT_PLATFORM_ADMIN)", async () => {
      const mockReq = new NextRequest("http://localhost/api/preritrd/subscriptions/plans", {
        headers: { authorization: "Bearer student-token" },
      });

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: createMockAdmin() as any })
      ).rejects.toThrow("FORBIDDEN: NOT_PLATFORM_ADMIN");
    });
  });
});
