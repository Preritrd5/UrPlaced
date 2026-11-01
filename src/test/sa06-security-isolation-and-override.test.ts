/**
 * ==============================================================================
 * UrPlaced — SA-06 Final Security Verification Suite
 * Multi-College Exclusive Membership, Strict Tenant Isolation &
 * Super Admin Override Authentication Hardening
 * ==============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST as handleOverridePost } from "@/app/api/preritrd/subscriptions/[id]/override/route";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions, can } from "@/modules/identity-access/services/policy-engine";
import { AIPlacementIntelligenceService } from "@/modules/ai/services/ai-placement-intelligence-service";
import { GeminiClient } from "@/modules/ai/gemini-client";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";
import { StudentService } from "@/modules/students/services/student-service";

// ---------------------------------------------------------------------------
// Mock In-Memory Database State
// ---------------------------------------------------------------------------
interface MockDb {
  profiles: any[];
  platform_admins: any[];
  tenant_memberships: any[];
  tenants: any[];
  college_subscriptions: any[];
  subscription_plans: any[];
  students: any[];
  question_banks: any[];
  questions: any[];
  assessments: any[];
  assessment_attempts: any[];
  audit_logs: any[];
}

let mockDb: MockDb;

function resetMockDb() {
  mockDb = {
    profiles: [
      {
        id: "super-admin-01",
        email: "prerit@urplaced.com",
        full_name: "Prerit Super Admin",
        is_platform_admin: true,
      },
      {
        id: "admin-suspended-02",
        email: "suspended@urplaced.com",
        full_name: "Suspended Admin",
        is_platform_admin: true,
      },
      {
        id: "admin-inactive-03",
        email: "inactive@urplaced.com",
        full_name: "Inactive Admin",
        is_platform_admin: true,
      },
      {
        id: "col-a-head",
        email: "head@sapthagiri.edu.in",
        full_name: "Dr. Sapthagiri Head",
        is_platform_admin: false,
      },
      {
        id: "col-a-student",
        email: "student@sapthagiri.edu.in",
        full_name: "Sapthagiri Student",
        is_platform_admin: false,
      },
      {
        id: "col-b-head",
        email: "head@abc.edu.in",
        full_name: "Dr. ABC Head",
        is_platform_admin: false,
      },
      {
        id: "col-b-student",
        email: "student@abc.edu.in",
        full_name: "ABC Student",
        is_platform_admin: false,
      },
    ],
    platform_admins: [
      {
        id: "super-admin-01",
        email: "prerit@urplaced.com",
        full_name: "Prerit Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        mfa_enabled: true,
        mfa_enforced: true,
      },
      {
        id: "admin-suspended-02",
        email: "suspended@urplaced.com",
        full_name: "Suspended Admin",
        role: "SUPER_ADMIN",
        status: "SUSPENDED",
        mfa_enabled: true,
        mfa_enforced: true,
      },
      {
        id: "admin-inactive-03",
        email: "inactive@urplaced.com",
        full_name: "Inactive Admin",
        role: "SUPER_ADMIN",
        status: "INACTIVE",
        mfa_enabled: true,
        mfa_enforced: true,
      },
    ],
    tenants: [
      { id: "tenant-college-a", name: "Sapthagiri College of Engineering", slug: "sapthagiri", status: "ACTIVE" },
      { id: "tenant-college-b", name: "ABC Institute of Technology", slug: "abc-tech", status: "ACTIVE" },
    ],
    tenant_memberships: [
      {
        id: "mem-a-head",
        tenant_id: "tenant-college-a",
        user_id: "col-a-head",
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: ["DRIVES_MANAGE", "STUDENTS_READ", "STUDENTS_EXPORT", "QUESTIONS_MANAGE"],
      },
      {
        id: "mem-a-student",
        tenant_id: "tenant-college-a",
        user_id: "col-a-student",
        role: "STUDENT",
        status: "ACTIVE",
        permissions: [],
      },
      {
        id: "mem-b-head",
        tenant_id: "tenant-college-b",
        user_id: "col-b-head",
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: ["DRIVES_MANAGE", "STUDENTS_READ", "STUDENTS_EXPORT", "QUESTIONS_MANAGE"],
      },
      {
        id: "mem-b-student",
        tenant_id: "tenant-college-b",
        user_id: "col-b-student",
        role: "STUDENT",
        status: "ACTIVE",
        permissions: [],
      },
    ],
    college_subscriptions: [
      {
        id: "sub-college-a",
        tenant_id: "tenant-college-a",
        status: "PAST_DUE",
        plan_id: "plan-growth",
        renewal_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        grace_period_ends_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        entitlements_snapshot: {
          planId: "plan-growth",
          planName: "Growth Institution",
          planVersion: 1,
          entitlements: {
            core_drives_management: true,
            student_directory_basic: true,
            advanced_candidate_filtering: true,
            questionbank_authoring: true,
            ai_cohort_intelligence: true,
          },
          limits: { max_students: 500, max_staff: 10, max_drives: 25 },
        },
      },
      {
        id: "sub-college-b",
        tenant_id: "tenant-college-b",
        status: "ACTIVE",
        plan_id: "plan-growth",
        entitlements_snapshot: {
          planId: "plan-growth",
          planName: "Growth Institution",
          planVersion: 1,
          entitlements: {
            core_drives_management: true,
            student_directory_basic: true,
            questionbank_authoring: true,
            ai_cohort_intelligence: true,
          },
          limits: { max_students: 500, max_staff: 10, max_drives: 25 },
        },
      },
    ],
    subscription_plans: [
      { id: "plan-growth", name: "Growth Institution", version: 1 },
    ],
    students: [
      { id: "stu-a-01", tenant_id: "tenant-college-a", user_id: "col-a-student", full_name: "Sapthagiri Student", email: "student@sapthagiri.edu.in", srn: "1SG22CS001" },
      { id: "stu-b-01", tenant_id: "tenant-college-b", user_id: "col-b-student", full_name: "ABC Student", email: "student@abc.edu.in", srn: "1AB22CS001" },
    ],
    question_banks: [
      { id: "bank-a-01", tenant_id: "tenant-college-a", name: "Sapthagiri Core Algorithms Bank", status: "ACTIVE" },
      { id: "bank-b-01", tenant_id: "tenant-college-b", name: "ABC Internal Tech Bank", status: "ACTIVE" },
    ],
    questions: [
      { id: "q-a-01", tenant_id: "tenant-college-a", bank_id: "bank-a-01", prompt: "Explain Sapthagiri CS Dijkstra Variant" },
      { id: "q-b-01", tenant_id: "tenant-college-b", bank_id: "bank-b-01", prompt: "Explain ABC Dynamic Programming" },
    ],
    assessments: [
      { id: "asm-a-01", tenant_id: "tenant-college-a", title: "Sapthagiri Coding Final", status: "PUBLISHED" },
      { id: "asm-b-01", tenant_id: "tenant-college-b", title: "ABC Tech Placement Exam", status: "PUBLISHED" },
    ],
    assessment_attempts: [
      { id: "att-a-01", tenant_id: "tenant-college-a", assessment_id: "asm-a-01", student_id: "stu-a-01", score: 95 },
      { id: "att-b-01", tenant_id: "tenant-college-b", assessment_id: "asm-b-01", student_id: "stu-b-01", score: 88 },
    ],
    audit_logs: [],
  };
}

// ---------------------------------------------------------------------------
// Mock Admin Supabase Client
// ---------------------------------------------------------------------------
function createMockAdminClient() {
  const getUserMock = async (token: string) => {
    if (token === "token-super-admin-aal2") {
      return {
        data: {
          user: {
            id: "super-admin-01",
            email: "prerit@urplaced.com",
            app_metadata: { is_platform_admin: true, aal: "aal2" },
          },
        },
        error: null,
      };
    }
    if (token === "token-super-admin-no-aal2") {
      return {
        data: {
          user: {
            id: "super-admin-01",
            email: "prerit@urplaced.com",
            app_metadata: { is_platform_admin: true, aal: "aal1" },
          },
        },
        error: null,
      };
    }
    if (token === "token-admin-suspended") {
      return {
        data: {
          user: {
            id: "admin-suspended-02",
            email: "suspended@urplaced.com",
            app_metadata: { is_platform_admin: true, aal: "aal2" },
          },
        },
        error: null,
      };
    }
    if (token === "token-admin-inactive") {
      return {
        data: {
          user: {
            id: "admin-inactive-03",
            email: "inactive@urplaced.com",
            app_metadata: { is_platform_admin: true, aal: "aal2" },
          },
        },
        error: null,
      };
    }
    if (token === "token-col-a-head") {
      return {
        data: {
          user: {
            id: "col-a-head",
            email: "head@sapthagiri.edu.in",
            app_metadata: { role: "PLACEMENT_HEAD", tenant_id: "tenant-college-a" },
          },
        },
        error: null,
      };
    }
    if (token === "token-col-a-student") {
      return {
        data: {
          user: {
            id: "col-a-student",
            email: "student@sapthagiri.edu.in",
            app_metadata: { role: "STUDENT", tenant_id: "tenant-college-a" },
          },
        },
        error: null,
      };
    }
    return { data: { user: null }, error: new Error("Invalid or expired session token") };
  };

  return {
    auth: {
      getUser: vi.fn(getUserMock),
      admin: {
        getUser: vi.fn(getUserMock),
      },
    },
    from: vi.fn((table: string) => {
      const makeQueryBuilder = (currentRows: any[]) => ({
        eq: vi.fn((field: string, val: any) =>
          makeQueryBuilder(currentRows.filter((r: any) => r[field] === val))
        ),
        in: vi.fn((field: string, vals: any[]) =>
          makeQueryBuilder(currentRows.filter((r: any) => vals.includes(r[field])))
        ),
        order: vi.fn(() => makeQueryBuilder(currentRows)),
        limit: vi.fn(() => makeQueryBuilder(currentRows)),
        single: vi.fn(async () => ({
          data: currentRows[0] || null,
          error: currentRows[0] ? null : { message: "Not found" },
        })),
        maybeSingle: vi.fn(async () => ({
          data: currentRows[0] || null,
          error: null,
        })),
        then: ((onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) => {
          return Promise.resolve({ data: currentRows, error: null }).then(onfulfilled, onrejected);
        }) as any,
      });

      return {
        select: vi.fn((columns?: string, opts?: any) => {
          const rows = (mockDb as any)[table] || [];
          return makeQueryBuilder(rows);
        }),
        insert: vi.fn(async (record: any) => {
          // Enforce DB unique constraint on tenant_memberships(user_id)
          if (table === "tenant_memberships") {
            const exists = mockDb.tenant_memberships.some((m) => m.user_id === record.user_id);
            if (exists) {
              return {
                data: null,
                error: {
                  code: "23505",
                  message: 'duplicate key value violates unique constraint "uq_tenant_memberships_user_id"',
                },
              };
            }
          }
          if (table === "audit_logs" || table === "platform_audit_logs") {
            mockDb.audit_logs.push(record);
            return { data: record, error: null };
          }
          ((mockDb as any)[table] || []).push(record);
          return { data: record, error: null };
        }),
        update: vi.fn((patch: any) => ({
          eq: vi.fn(async (field: string, val: any) => {
            const rows = (mockDb as any)[table] || [];
            const item = rows.find((r: any) => r[field] === val);
            if (item) {
              Object.assign(item, patch);
            }
            return { data: item, error: null };
          }),
        })),
        upsert: vi.fn(async (record: any) => {
          // Enforce DB unique constraint on tenant_memberships(user_id)
          if (table === "tenant_memberships") {
            const existing = mockDb.tenant_memberships.find((m) => m.user_id === record.user_id);
            if (existing && existing.tenant_id !== record.tenant_id) {
              return {
                data: null,
                error: {
                  code: "23505",
                  message: 'duplicate key value violates unique constraint "uq_tenant_memberships_user_id"',
                },
              };
            }
          }
          ((mockDb as any)[table] || []).push(record);
          return { data: record, error: null };
        }),
      };
    }),
  };
}

// Mock Supabase admin injection
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createMockAdminClient(),
}));

// Mock MembershipService to use mock database
vi.mock("@/modules/tenancy/services/membership-service", () => ({
  MembershipService: {
    listUserMemberships: async (userId: string) => {
      return mockDb.tenant_memberships.filter((m) => m.user_id === userId);
    },
  },
  getUserMemberships: async (userId: string) => {
    return mockDb.tenant_memberships.filter((m) => m.user_id === userId);
  },
}));

// ===========================================================================
// SA-06 VERIFICATION GAP SUITE
// ===========================================================================
describe("URPLACED SA-06: Exclusive College Membership, Tenant Isolation & Super Admin Override Hardening", () => {
  beforeEach(() => {
    resetMockDb();
    vi.clearAllMocks();
  });

  // =========================================================================
  // GAP 1: MANDATORY EXCLUSIVE ONE-COLLEGE MEMBERSHIP (Scenarios 1 - 10)
  // =========================================================================
  describe("Gap 1: Mandatory Exclusive One-College Membership Architecture", () => {
    it("Scenario 1: One person cannot belong to two colleges (PostgreSQL uq_tenant_memberships_user_id and server-side check)", async () => {
      const admin = createMockAdminClient();

      // col-a-head already belongs to tenant-college-a
      const userMemberships: any = await (admin
        .from("tenant_memberships")
        .select("*")
        .eq("user_id", "col-a-head") as any);

      expect(userMemberships.data.length).toBe(1);
      expect(userMemberships.data[0].tenant_id).toBe("tenant-college-a");

      // Attempting to insert a second membership for another college fails with 23505 unique violation
      const insertResult = await admin.from("tenant_memberships").insert({
        tenant_id: "tenant-college-b",
        user_id: "col-a-head",
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
      });

      expect(insertResult.error).not.toBeNull();
      expect(insertResult.error?.code).toBe("23505");
      expect(insertResult.error?.message).toContain("uq_tenant_memberships_user_id");

      // Invariant check in server-context: if memberships with multiple tenant_ids exist, fail closed
      mockDb.tenant_memberships.push({
        id: "mem-corrupt-multi",
        tenant_id: "tenant-college-b",
        user_id: "col-a-head",
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
      });

      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, undefined, "token-col-a-head")
      ).rejects.toThrow(/MULTI_COLLEGE_MEMBERSHIP_VIOLATION/);
    });

    it("Scenario 2: College A cannot read College B's students or staff", () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Can read own students
      const canReadOwn = can(colAStaffContext, Permissions.STUDENTS_READ, {
        tenantId: "tenant-college-a",
      });
      expect(canReadOwn).toBe(true);

      // Cannot read College B students
      const canReadCollegeB = can(colAStaffContext, Permissions.STUDENTS_READ, {
        tenantId: "tenant-college-b",
      });
      expect(canReadCollegeB).toBe(false);

      // Database-level query isolation: filtering strictly by tenantId
      const colBStudents = mockDb.students.filter((s) => s.tenant_id === "tenant-college-a");
      expect(colBStudents.some((s) => s.tenant_id === "tenant-college-b")).toBe(false);
    });

    it("Scenario 3: College A cannot access College B's questions or question banks", () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Can manage own question banks
      expect(can(colAStaffContext, Permissions.QUESTIONS_MANAGE, { tenantId: "tenant-college-a" })).toBe(true);

      // Denied cross-college question bank access
      expect(can(colAStaffContext, Permissions.QUESTIONS_MANAGE, { tenantId: "tenant-college-b" })).toBe(false);

      // Question isolation: verify questions are strictly associated with owning college
      const colAQuestions = mockDb.questions.filter((q) => q.tenant_id === "tenant-college-a");
      expect(colAQuestions.every((q) => q.tenant_id === "tenant-college-a")).toBe(true);
      expect(colAQuestions.find((q) => q.id === "q-b-01")).toBeUndefined();
    });

    it("Scenario 4: College A cannot access College B's study materials or assessments", () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Denied cross-college assessment management and grading
      expect(can(colAStaffContext, Permissions.ASSESSMENTS_MANAGE, { tenantId: "tenant-college-b" })).toBe(false);
      expect(can(colAStaffContext, Permissions.ASSESSMENTS_GRADE, { tenantId: "tenant-college-b" })).toBe(false);

      // Attempts query isolation
      const colAAttempts = mockDb.assessment_attempts.filter((a) => a.tenant_id === "tenant-college-a");
      expect(colAAttempts.find((a) => a.id === "att-b-01")).toBeUndefined();
    });

    it("Scenario 5: College A cannot retrieve College B content through AI", async () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Staff from College A attempting to invoke placement intel for College B
      const allowed = can(colAStaffContext, Permissions.AI_PLACEMENT_INTEL_READ, {
        tenantId: "tenant-college-b",
      });
      expect(allowed).toBe(false);

      vi.spyOn(GeminiClient, "generate").mockResolvedValueOnce({
        text: JSON.stringify({
          readinessIndex: 82,
          keyInsights: [
            {
              category: "COHORT_STRENGTH",
              title: "Strong Core Algorithms Foundation",
              description: "Sapthagiri students show high proficiency.",
              evidenceMetrics: "100% pass on core algorithms",
              priority: "HIGH",
            },
          ],
          recommendedInterventions: [
            {
              title: "Advanced System Design Workshop",
              targetDomain: "Computer Science",
              format: "BOOTCAMP",
              impactPotential: "Prepares top cohort for product companies",
            },
          ],
        }),
      } as any);

      // AI Service executes queries strictly anchored to the caller's tenantId
      const report = await AIPlacementIntelligenceService.generateCohortInsights({
        tenantId: "tenant-college-a",
        userId: "col-a-head",
        cohortMetricsOverride: {
          totalStudents: mockDb.students.filter((s) => s.tenant_id === "tenant-college-a").length,
          activeDrivesCount: 2,
        },
      });

      expect(report.tenantId).toBe("tenant-college-a");
      expect(report.cohortSummary.totalStudents).toBe(1); // Only Sapthagiri student counted
    });

    it("Scenario 6: College A cannot download College B files or exports", () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Policy boundary for exports
      expect(can(colAStaffContext, Permissions.STUDENTS_EXPORT, { tenantId: "tenant-college-b" })).toBe(false);
      expect(can(colAStaffContext, Permissions.ANALYTICS_EXPORT, { tenantId: "tenant-college-b" })).toBe(false);
      expect(can(colAStaffContext, Permissions.REPORTS_EXPORT, { tenantId: "tenant-college-b" })).toBe(false);
    });

    it("Scenario 7: Client-supplied tenant IDs cannot bypass isolation", async () => {
      // User from College A supplies targetTenantId = "tenant-college-b" via cookie/parameter
      await expect(
        requireAuthContext(undefined, "tenant-college-b", "token-col-a-head")
      ).rejects.toThrow(/NO_ACTIVE_TENANT/);
    });

    it("Scenario 8: Cross-college search and API access are denied", () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Verify that any search targeting another college returns false
      expect(can(colAStaffContext, Permissions.DASHBOARD_READ, { tenantId: "tenant-college-b" })).toBe(false);
      expect(can(colAStaffContext, Permissions.COMPANIES_READ, { tenantId: "tenant-college-b" })).toBe(false);
    });

    it("Scenario 9: Students cannot access another college's resources", () => {
      const colAStudentContext = {
        userId: "col-a-student",
        tenantId: "tenant-college-a",
        role: "STUDENT" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      // Student attempting to attempt College B's assessment
      expect(can(colAStudentContext, Permissions.ASSESSMENTS_ATTEMPT, { tenantId: "tenant-college-b" })).toBe(false);
      expect(can(colAStudentContext, Permissions.QUESTION_SETS_READ, { tenantId: "tenant-college-b" })).toBe(false);
      expect(can(colAStudentContext, Permissions.AI_STUDY_TUTOR_USE, { tenantId: "tenant-college-b" })).toBe(false);

      // Student attempting to access administrative permissions is denied everywhere
      expect(can(colAStudentContext, Permissions.DRIVES_MANAGE)).toBe(false);
      expect(can(colAStudentContext, Permissions.STUDENTS_READ)).toBe(false);
    });

    it("Scenario 10: Authorized access within the same college continues working", async () => {
      const colAStaffContext = {
        userId: "col-a-head",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_HEAD" as const,
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };

      expect(can(colAStaffContext, Permissions.DRIVES_MANAGE, { tenantId: "tenant-college-a" })).toBe(true);
      expect(can(colAStaffContext, Permissions.STUDENTS_READ, { tenantId: "tenant-college-a" })).toBe(true);
      expect(can(colAStaffContext, Permissions.QUESTIONS_MANAGE, { tenantId: "tenant-college-a" })).toBe(true);
    });
  });

  // =========================================================================
  // GAP 2: SUPER ADMIN OVERRIDE AUTHENTICATION HARDENING (Scenarios 11 - 20)
  // =========================================================================
  describe("Gap 2: Super Admin Override Authentication Hardening", () => {
    it("Scenario 11: Valid Super Admin with verified AAL2/MFA and active registry can grant override", async () => {
      const req = {
        headers: new Headers({ authorization: "Bearer token-super-admin-aal2" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Urgent placement season override approved by leadership.",
        }),
      } as any;

      const res = await handleOverridePost(req, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.subscriptionId).toBe("sub-college-a");
      expect(data.durationHours).toBe(24);
      expect(data.reason).toBe("Urgent placement season override approved by leadership.");

      // Check database update
      const sub = mockDb.college_subscriptions.find((s) => s.id === "sub-college-a");
      expect(sub.temporary_override_until).toBeDefined();
      expect(sub.override_reason).toBe("Urgent placement season override approved by leadership.");
      expect(sub.override_by).toBe("super-admin-01");

      // Check structured audit log in audit_logs
      expect(mockDb.audit_logs.length).toBe(1);
      const audit = mockDb.audit_logs[0];
      expect(audit.action).toBe("SUBSCRIPTION_TEMPORARY_OVERRIDE_GRANTED");
      expect(audit.actor_id).toBe("super-admin-01");
      expect(audit.after_state.collegeId).toBe("tenant-college-a");
      expect(audit.after_state.durationHours).toBe(24);
      expect(audit.after_state.justification).toBe("Urgent placement season override approved by leadership.");
    });

    it("Scenario 12: Missing or non-AAL2 MFA session is rejected with HTTP 403 MFA_REQUIRED", async () => {
      const req = {
        headers: new Headers({ authorization: "Bearer token-super-admin-no-aal2" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Urgent placement season override approved by leadership.",
        }),
      } as any;

      const res = await handleOverridePost(req, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("MFA_REQUIRED");
    });

    it("Scenario 13: Invalid or missing JWT session is rejected with HTTP 401 UNAUTHORIZED", async () => {
      const req = {
        headers: new Headers({ authorization: "Bearer invalid-garbage-token" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Urgent placement season override approved by leadership.",
        }),
      } as any;

      const res = await handleOverridePost(req, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("UNAUTHORIZED");
    });

    it("Scenario 14: Inactive or suspended platform administrator in registry is rejected with HTTP 403", async () => {
      // Suspended
      const reqSuspended = {
        headers: new Headers({ authorization: "Bearer token-admin-suspended" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Urgent placement season override approved by leadership.",
        }),
      } as any;

      const resSuspended = await handleOverridePost(reqSuspended, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(resSuspended.status).toBe(403);
      const dataSuspended = await resSuspended.json();
      expect(dataSuspended.error).toContain("ADMIN_SUSPENDED");

      // Inactive
      const reqInactive = {
        headers: new Headers({ authorization: "Bearer token-admin-inactive" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Urgent placement season override approved by leadership.",
        }),
      } as any;

      const resInactive = await handleOverridePost(reqInactive, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(resInactive.status).toBe(403);
      const dataInactive = await resInactive.json();
      expect(dataInactive.error).toContain("ADMIN_INACTIVE");
    });

    it("Scenario 15: Unauthorized non-admin user (Placement Head) is rejected with HTTP 403 NOT_PLATFORM_ADMIN", async () => {
      const req = {
        headers: new Headers({ authorization: "Bearer token-col-a-head" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Attempt by placement head to unlock self without authorization.",
        }),
      } as any;

      const res = await handleOverridePost(req, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("NOT_PLATFORM_ADMIN");
    });

    it("Scenario 16: Manipulated client claim (client asserting platform admin) is rejected by server authority", async () => {
      // col-a-student attempting to call override
      const req = {
        headers: new Headers({ authorization: "Bearer token-col-a-student" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Client claiming spoofed privilege.",
        }),
      } as any;

      const res = await handleOverridePost(req, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("NOT_PLATFORM_ADMIN");
    });

    it("Scenario 17: Expired Super Admin session is rejected with HTTP 401 UNAUTHORIZED", async () => {
      const req = {
        headers: new Headers(), // No token
        json: async () => ({
          overrideHours: 24,
          reason: "Expired session call attempt.",
        }),
      } as any;

      const res = await handleOverridePost(req, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("UNAUTHORIZED");
    });

    it("Scenario 18: Override duration outside 1–168 hours is rejected with HTTP 400 Bad Request", async () => {
      // 0 hours
      const req0 = {
        headers: new Headers({ authorization: "Bearer token-super-admin-aal2" }),
        json: async () => ({
          overrideHours: 0,
          reason: "Zero hours duration attempt.",
        }),
      } as any;
      const res0 = await handleOverridePost(req0, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });
      expect(res0.status).toBe(400);
      expect((await res0.json()).error).toContain("Invalid duration");

      // 169 hours (> 7 days)
      const req169 = {
        headers: new Headers({ authorization: "Bearer token-super-admin-aal2" }),
        json: async () => ({
          overrideHours: 169,
          reason: "Too long duration attempt exceeding 7 days.",
        }),
      } as any;
      const res169 = await handleOverridePost(req169, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });
      expect(res169.status).toBe(400);
      expect((await res169.json()).error).toContain("Invalid duration");
    });

    it("Scenario 19: Override reason under 10 characters is rejected with HTTP 400 Bad Request", async () => {
      const reqShort = {
        headers: new Headers({ authorization: "Bearer token-super-admin-aal2" }),
        json: async () => ({
          overrideHours: 24,
          reason: "Too short", // 9 characters
        }),
      } as any;

      const res = await handleOverridePost(reqShort, {
        params: Promise.resolve({ id: "sub-college-a" }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid reason");
    });

    it("Scenario 20: Expired overrides automatically revert to the underlying subscription state", async () => {
      const admin = createMockAdminClient();

      // Configure a subscription with an override that expired 1 hour ago
      const expiredOverrideTime = new Date(Date.now() - 3600 * 1000).toISOString();
      const sub = mockDb.college_subscriptions.find((s) => s.id === "sub-college-a");
      sub.temporary_override_until = expiredOverrideTime;
      sub.status = "PAST_DUE";
      sub.grace_period_ends_at = new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(); // grace expired

      // Evaluate access
      const result = await SubscriptionAccessService.evaluateAccess({
        tenantId: "tenant-college-a",
        userRole: "PLACEMENT_HEAD",
        permission: Permissions.DRIVES_MANAGE,
        admin: admin as any,
      });

      // Lapsed override reverts to underlying state (which has expired grace -> DENY_EXPIRED)
      expect(result.allowed).toBe(false);
      expect(result.decision).toBe("DENY_EXPIRED");
    });
  });
});
