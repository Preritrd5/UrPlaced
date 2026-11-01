import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { PlatformBillingService } from "@/modules/platform-admin/services/platform-billing-service";
import { PlatformAnalyticsService } from "@/modules/platform-admin/services/platform-analytics-service";
import { PlatformConfigService } from "@/modules/platform-admin/services/platform-config-service";
import { PlatformAdminManagementService } from "@/modules/platform-admin/services/platform-admin-management-service";
import { PlatformAuditService } from "@/modules/platform-admin/services/platform-audit-service";
import { PlatformHealthService } from "@/modules/platform-admin/services/platform-health-service";
import { can, Permissions, RoleDefaultPermissions } from "@/modules/identity-access/services/policy-engine";
import { POST as verifyMfaPost } from "@/app/api/preritrd/auth/mfa/verify/route";

describe("UrPlaced Platform Super Admin Portal & Strict Option A Isolation", () => {
  let mockDatabase: Record<string, any[]> = {};

  const createMockAdminClient = () => ({
    auth: {
      admin: {
        getUserById: vi.fn(async (id: string) => ({
          data: { user: { id, email: "superadmin@urplaced.com", app_metadata: { is_platform_admin: true } } },
          error: null,
        })),
        listUsers: vi.fn(async () => ({
          data: { users: [{ id: "admin-1", email: "admin@urplaced.com" }] },
          error: null,
        })),
      },
      getUser: vi.fn(async (token: string) => {
        if (token === "super-admin-token" || token === "super-admin-aal2-token") {
          return { data: { user: { id: "admin-uuid", email: "admin@urplaced.com", app_metadata: { aal: "aal2", is_platform_admin: true } } }, error: null };
        }
        if (token === "super-admin-aal1-token") {
          return { data: { user: { id: "admin-uuid", email: "admin@urplaced.com", app_metadata: { aal: "aal1", is_platform_admin: true } } }, error: null };
        }
        if (token === "super-admin-forged-token") {
          return {
            data: {
              user: {
                id: "admin-uuid",
                email: "admin@urplaced.com",
                app_metadata: { aal: "aal1", is_platform_admin: true },
                user_metadata: { aal: "aal2", is_platform_admin: true }, // Forged client metadata!
              },
            },
            error: null,
          };
        }
        if (token === "student-token") {
          return { data: { user: { id: "student-uuid", email: "student@sapthagiri.edu.in", app_metadata: { role: "STUDENT" } } }, error: null };
        }
        if (token === "head-token") {
          return { data: { user: { id: "head-uuid", email: "head@sapthagiri.edu.in", app_metadata: { role: "PLACEMENT_HEAD" } } }, error: null };
        }
        return { data: { user: null }, error: { message: "Invalid token" } };
      }),
    },
    storage: {
      getBucket: vi.fn(async (name: string) => {
        if (name === "avatars") return { data: { id: "avatars", public: false }, error: null };
        return { data: null, error: { message: "Not found" } };
      }),
    },
    from: vi.fn((table: string) => {
      if (!mockDatabase[table]) mockDatabase[table] = [];

      return {
        select: vi.fn((columns?: string, options?: any) => {
          let rows = [...(mockDatabase[table] || [])];
          const queryBuilder: any = {
            eq: vi.fn((field: string, val: any) => {
              rows = rows.filter((r) => r[field] === val);
              return queryBuilder;
            }),
            is: vi.fn((field: string, val: any) => {
              rows = rows.filter((r) => (val === null ? r[field] === null || r[field] === undefined : r[field] === val));
              return queryBuilder;
            }),
            or: vi.fn((condition: string) => {
              return queryBuilder;
            }),
            order: vi.fn(() => queryBuilder),
            range: vi.fn((from: number, to: number) => {
              rows = rows.slice(from, to + 1);
              return queryBuilder;
            }),
            limit: vi.fn((n: number) => {
              rows = rows.slice(0, n);
              return queryBuilder;
            }),
            single: vi.fn(async () => {
              if (rows.length === 0) return { data: null, error: { message: "Row not found" } };
              return { data: rows[0], error: null };
            }),
            maybeSingle: vi.fn(async () => {
              return { data: rows[0] || null, error: null };
            }),
            then: vi.fn((resolve: any) => resolve({ data: rows, count: rows.length, error: null })),
          };
          return queryBuilder;
        }),
        insert: vi.fn((record: any) => {
          const newRecord = { id: record.id || `mock-${Date.now()}`, ...record };
          mockDatabase[table].push(newRecord);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: newRecord, error: null })),
            })),
            then: vi.fn((resolve: any) => resolve({ data: newRecord, error: null })),
          };
        }),
        upsert: vi.fn((record: any) => {
          const idx = mockDatabase[table].findIndex((r) => (record.id ? r.id === record.id : r.key === record.key));
          if (idx >= 0) {
            mockDatabase[table][idx] = { ...mockDatabase[table][idx], ...record };
          } else {
            mockDatabase[table].push(record);
          }
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: record, error: null })),
            })),
            then: vi.fn((resolve: any) => resolve({ data: record, error: null })),
          };
        }),
        update: vi.fn((updates: any) => ({
          eq: vi.fn((field: string, val: any) => {
            const idx = mockDatabase[table].findIndex((r) => r[field] === val);
            if (idx >= 0) {
              mockDatabase[table][idx] = { ...mockDatabase[table][idx], ...updates };
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: mockDatabase[table][idx], error: null })),
                })),
                then: vi.fn((resolve: any) => resolve({ data: mockDatabase[table][idx], error: null })),
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
        delete: vi.fn(() => ({
          eq: vi.fn((field: string, val: any) => {
            mockDatabase[table] = mockDatabase[table].filter((r) => r[field] !== val);
            return {
              then: vi.fn((resolve: any) => resolve({ data: null, error: null })),
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
          official_email: "placements@sapthagiri.edu.in",
          onboarding_status: "COMPLETED",
          created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
        },
        {
          id: "tenant-abc",
          name: "ABC Institute of Technology",
          slug: "abc-tech",
          status: "ACTIVE",
          student_seat_limit: 800,
          official_email: "placement@abctech.edu",
          onboarding_status: "COMPLETED",
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      profiles: [
        { id: "admin-uuid", email: "admin@urplaced.com", full_name: "Super Admin", is_platform_admin: true },
        { id: "student-uuid", email: "student@sapthagiri.edu.in", full_name: "Student Jane", is_platform_admin: false },
        { id: "head-uuid", email: "head@sapthagiri.edu.in", full_name: "Head Jack", is_platform_admin: false },
      ],
      platform_admins: [
        {
          id: "admin-uuid",
          email: "admin@urplaced.com",
          full_name: "Super Admin",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
          mfa_enabled: true,
          mfa_enforced: true,
        },
      ],
      subscription_plans: [
        {
          id: "starter",
          name: "Institutional Starter",
          slug: "starter",
          price_inr: 49999,
          billing_cycle: "ANNUAL",
          student_limit: 500,
          staff_limit: 5,
          storage_limit_gb: 20,
          features: ["Core Drives", "Standard Tests"],
          is_active: true,
        },
        {
          id: "growth",
          name: "Campus Growth",
          slug: "growth",
          price_inr: 129999,
          billing_cycle: "ANNUAL",
          student_limit: 2500,
          staff_limit: 25,
          storage_limit_gb: 100,
          features: ["DriveFit", "Mistake Bank"],
          is_active: true,
        },
      ],
      college_subscriptions: [
        {
          id: "sub-1",
          tenant_id: "tenant-sapthagiri",
          plan_id: "growth",
          status: "ACTIVE",
          student_seat_limit: 1500,
          staff_seat_limit: 25,
          renewal_date: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
      platform_invoices: [
        {
          id: "inv-1",
          invoice_number: "INV-2026-0001",
          tenant_id: "tenant-sapthagiri",
          amount_inr: 129999,
          tax_inr: 23399.82,
          currency: "INR",
          status: "PAID",
          issue_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          payment_method: "BANK_TRANSFER",
        },
      ],
      platform_settings: [
        {
          key: "maintenance_mode",
          value: { enabled: false, message: "" },
          category: "MAINTENANCE",
        },
      ],
      audit_logs: [
        {
          id: "log-1",
          tenant_id: null, // Platform-level event
          action: "PLATFORM_COLLEGE_REGISTER",
          actor_id: "admin-uuid",
          resource_type: "TENANT",
          created_at: new Date().toISOString(),
        },
      ],
    };
  });

  // ============================================================================
  // 1. AUTHENTICATION & ACCESS CONTROL TESTS
  // ============================================================================
  describe("1. Platform Super Admin Authentication & Privilege Boundaries", () => {
    it("denies access to an unauthenticated request without session", async () => {
      const mockReq: any = {
        headers: new Headers(),
      };
      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq)
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("denies access to a Student account attempting to access Super Admin", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "student-uuid", email: "student@sapthagiri.edu.in", is_platform_admin: false }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer student-token" }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any })
      ).rejects.toThrow("FORBIDDEN: NOT_PLATFORM_ADMIN");
    });

    it("denies access to a College Placement Head attempting to access Super Admin", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "head-uuid", email: "head@sapthagiri.edu.in", is_platform_admin: false }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer head-token" }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any })
      ).rejects.toThrow("FORBIDDEN: NOT_PLATFORM_ADMIN");
    });

    it("denies access to a suspended Super Admin account", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "admin-uuid", email: "admin@urplaced.com", is_platform_admin: true }, error: null };
              }
              if (table === "platform_admins") {
                return { data: { id: "admin-uuid", status: "SUSPENDED" }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer super-admin-token" }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any })
      ).rejects.toThrow("FORBIDDEN: ADMIN_SUSPENDED");
    });

    it("denies access when session assurance level is AAL1 (unverified MFA)", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "admin-uuid", email: "admin@urplaced.com", is_platform_admin: true }, error: null };
              }
              if (table === "platform_admins") {
                return { data: { id: "admin-uuid", status: "ACTIVE", mfa_enforced: true }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer super-admin-aal1-token" }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any })
      ).rejects.toThrow("MFA_REQUIRED: SESSION_NOT_AAL2");
    });

    it("strictly rejects forged AAL2 claims inside client-modifiable user_metadata", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "admin-uuid", email: "admin@urplaced.com", is_platform_admin: true }, error: null };
              }
              if (table === "platform_admins") {
                return { data: { id: "admin-uuid", status: "ACTIVE", mfa_enforced: true }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      // Attacker sends forged token containing user_metadata: { aal: "aal2" } while app_metadata is aal1
      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer super-admin-forged-token" }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any })
      ).rejects.toThrow("MFA_REQUIRED: SESSION_NOT_AAL2");
    });

    it("denies access if account has revoked or inactive status in platform_admins", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "admin-uuid", email: "admin@urplaced.com", is_platform_admin: true }, error: null };
              }
              if (table === "platform_admins") {
                return { data: { id: "admin-uuid", status: "REVOKED" }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer super-admin-aal2-token" }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any })
      ).rejects.toThrow("FORBIDDEN: ADMIN_INACTIVE");
    });

    it("grants elevated access only when user has genuine cryptographic AAL2 assurance claim", async () => {
      const mockAdmin = createMockAdminClient();
      mockAdmin.from = vi.fn((table: string) => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              if (table === "profiles") {
                return { data: { id: "admin-uuid", email: "admin@urplaced.com", is_platform_admin: true, full_name: "Super Admin" }, error: null };
              }
              if (table === "platform_admins") {
                return { data: { id: "admin-uuid", status: "ACTIVE", mfa_enforced: true }, error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      })) as any;

      const mockReq: any = {
        headers: new Headers({ authorization: "Bearer super-admin-aal2-token" }),
      };

      const result = await PlatformAuthService.requireSuperAdmin(mockReq, { adminClient: mockAdmin as any });
      expect(result).toBeDefined();
      expect(result.id).toBe("admin-uuid");
      expect(result.role).toBe("SUPER_ADMIN");
      expect(result.mfaVerified).toBe(true);
      expect(result.status).toBe("ACTIVE");
    });

    it("MFA verify route rejects static master bypass code SUPER-ADMIN-2026", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "admin-uuid",
          factorId: "factor-123",
          challengeId: "challenge-123",
          code: "SUPER-ADMIN-2026",
          sessionToken: "some-session-token",
        }),
      });

      const res = await verifyMfaPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid verification code format. Must be a 6-digit TOTP code.");
    });

    it("MFA verify route rejects non-numeric or malformed tokens", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: "admin-uuid",
          factorId: "factor-123",
          challengeId: "challenge-123",
          code: "ABC123",
          sessionToken: "some-session-token",
        }),
      });

      const res = await verifyMfaPost(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid verification code format. Must be a 6-digit TOTP code.");
    });
  });

  // ============================================================================
  // 2. STRICT OPTION A SECURITY ISOLATION TESTS
  // ============================================================================
  describe("2. Non-Negotiable Strict Option A Data Isolation", () => {
    it("enforces that Super Admin CANNOT access student personal records or profiles", () => {
      const ctx = {
        userId: "admin-uuid",
        isPlatformAdmin: true,
        role: "SUPER_ADMIN" as const,
      };

      // Attempting to evaluate access to students
      expect(can(ctx, Permissions.STUDENTS_READ)).toBe(false);
      expect(can(ctx, Permissions.STUDENTS_EDIT)).toBe(false);
      expect(can(ctx, Permissions.STUDENTS_DELETE)).toBe(false);
    });

    it("enforces that Super Admin CANNOT access college question banks or assessments", () => {
      const ctx = {
        userId: "admin-uuid",
        isPlatformAdmin: true,
        role: "SUPER_ADMIN" as const,
      };

      expect(can(ctx, Permissions.QUESTIONS_MANAGE)).toBe(false);
      expect(can(ctx, Permissions.ASSESSMENTS_MANAGE)).toBe(false);
      expect(can(ctx, Permissions.ASSESSMENTS_READ)).toBe(false);
      expect(can(ctx, Permissions.QUESTION_SETS_MANAGE)).toBe(false);
    });

    it("enforces that Super Admin CANNOT access student mistake bank records or defects", () => {
      const ctx = {
        userId: "admin-uuid",
        isPlatformAdmin: true,
        role: "SUPER_ADMIN" as const,
      };

      expect(can(ctx, Permissions.MISTAKE_BANK_MANAGE)).toBe(false);
      expect(can(ctx, Permissions.MISTAKE_BANK_MANAGE_OWN)).toBe(false);
      expect(can(ctx, Permissions.MISTAKE_BANK_READ_COHORT)).toBe(false);
    });

    it("enforces that Super Admin CANNOT access placement offers, stages, or drives", () => {
      const ctx = {
        userId: "admin-uuid",
        isPlatformAdmin: true,
        role: "SUPER_ADMIN" as const,
      };

      expect(can(ctx, Permissions.DRIVES_MANAGE)).toBe(false);
      expect(can(ctx, Permissions.STAGES_MANAGE)).toBe(false);
      expect(can(ctx, Permissions.OUTCOMES_MANAGE)).toBe(false);
      expect(can(ctx, Permissions.CANDIDATES_REGISTER)).toBe(false);
    });

    it("enforces that Super Admin ONLY possesses platform-level control plane permissions", () => {
      const perms = RoleDefaultPermissions.SUPER_ADMIN;
      expect(perms).toContain(Permissions.TENANT_CREATE);
      expect(perms).toContain(Permissions.TENANT_MANAGE);
      expect(perms).toContain(Permissions.TENANT_SUSPEND);
      expect(perms).toContain(Permissions.TENANT_REACTIVATE);
      expect(perms).toContain(Permissions.PLATFORM_HEALTH_READ);
      expect(perms).toContain(Permissions.AUDIT_LOG_READ);
      expect(perms).toContain(Permissions.PLATFORM_SUBSCRIPTIONS_MANAGE);
      expect(perms).toContain(Permissions.PLATFORM_BILLING_MANAGE);
      expect(perms).toContain(Permissions.PLATFORM_CONFIG_MANAGE);
      expect(perms).toContain(Permissions.PLATFORM_ADMINS_MANAGE);
      expect(perms).toContain(Permissions.PLATFORM_ANALYTICS_READ);

      // Verify ZERO college-level operational permissions are present
      expect(perms).not.toContain(Permissions.STUDENTS_READ);
      expect(perms).not.toContain(Permissions.COMPANIES_MANAGE);
      expect(perms).not.toContain(Permissions.DRIVES_MANAGE);
      expect(perms).not.toContain(Permissions.ASSESSMENTS_MANAGE);
    });
  });

  // ============================================================================
  // 3. POSITIVE PLATFORM OPERATIONS TESTS
  // ============================================================================
  describe("3. Positive Platform Control Plane Functions", () => {
    it("successfully lists registered college accounts", async () => {
      const mockAdmin = createMockAdminClient();
      const res = await PlatformCollegeService.listColleges({
        admin: mockAdmin as any,
      });

      expect(res.colleges.length).toBe(2);
      expect(res.colleges[0].name).toBe("Sapthagiri NPS University");
      expect(res.colleges[0].slug).toBe("sapthagiri");
    });

    it("successfully registers a new college account with onboarding token", async () => {
      const mockAdmin = createMockAdminClient();
      const res = await PlatformCollegeService.registerCollege({
        name: "XYZ Institute of Technology",
        slug: "xyz-institute",
        officialEmail: "admin@xyz.edu",
        contactName: "Dean Miller",
        initialPlanId: "growth",
        studentSeatLimit: 2000,
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(res.college.name).toBe("XYZ Institute of Technology");
      expect(res.college.slug).toBe("xyz-institute");
      expect(res.onboardingToken).toMatch(/^[a-f0-9]{64}$/);

      // Verify college added to mock database
      const added = mockDatabase["tenants"].find((t) => t.slug === "xyz-institute");
      expect(added).toBeDefined();
      expect(added.student_seat_limit).toBe(2000);
    }, 15000);

    it("suspends and reactivates a college account with audit logging", async () => {
      const mockAdmin = createMockAdminClient();

      // Suspend
      const suspendRes = await PlatformCollegeService.updateCollegeStatus({
        tenantId: "tenant-sapthagiri",
        status: "SUSPENDED",
        reason: "Terms of service review",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });
      expect(suspendRes.success).toBe(true);
      expect(suspendRes.status).toBe("SUSPENDED");

      // Verify tenant status updated
      expect(mockDatabase["tenants"][0].status).toBe("SUSPENDED");

      // Reactivate
      const activateRes = await PlatformCollegeService.updateCollegeStatus({
        tenantId: "tenant-sapthagiri",
        status: "ACTIVE",
        reason: "Review completed",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });
      expect(activateRes.success).toBe(true);
      expect(activateRes.status).toBe("ACTIVE");
      expect(mockDatabase["tenants"][0].status).toBe("ACTIVE");
    });

    it("lists and updates subscription plans", async () => {
      const mockAdmin = createMockAdminClient();
      const plans = await PlatformSubscriptionService.listPlans(mockAdmin as any);

      expect(plans.length).toBe(2);
      expect(plans[0].id).toBe("starter");
      expect(plans[0].priceInr).toBe(49999);

      // Upsert Enterprise plan
      const updated = await PlatformSubscriptionService.upsertPlan({
        id: "enterprise",
        name: "University Enterprise Tier",
        slug: "enterprise",
        priceInr: 299999,
        studentLimit: 15000,
        staffLimit: 100,
        storageLimitGb: 500,
        features: ["Dedicated SLA", "All Modules"],
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(updated.name).toBe("University Enterprise Tier");
      expect(updated.priceInr).toBe(299999);
      expect(updated.studentLimit).toBe(15000);
    });

    it("lists invoices and records verified payment", async () => {
      const mockAdmin = createMockAdminClient();
      const invoices = await PlatformBillingService.listInvoices({ admin: mockAdmin as any });

      expect(invoices.length).toBe(1);
      expect(invoices[0].invoiceNumber).toBe("INV-2026-0001");
      expect(invoices[0].status).toBe("PAID");

      // Create new invoice
      const newInv = await PlatformBillingService.createInvoice({
        tenantId: "tenant-abc",
        amountInr: 49999,
        notes: "Campus Starter Annual Subscription",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(newInv.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(newInv.status).toBe("PENDING");

      // Record payment
      const paidResult = await PlatformBillingService.recordPayment({
        invoiceId: newInv.id,
        paymentMethod: "DEMO_GATEWAY",
        isDemo: true,
        notes: "Verified in test suite",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(paidResult.success).toBe(true);
      expect(paidResult.invoice.status).toBe("PAID");
      expect(paidResult.invoice.isDemo).toBe(true);
    });

    it("computes privacy-safe overview metrics and adoption trends", async () => {
      const mockAdmin = createMockAdminClient();
      const overview = await PlatformAnalyticsService.getOverviewMetrics(mockAdmin as any);

      expect(overview.totalColleges).toBe(2);
      expect(overview.activeColleges).toBe(2);
      expect(overview.activeSubscriptions).toBe(1);
      expect(overview.totalRevenueInr).toBeGreaterThan(0);

      const trends = await PlatformAnalyticsService.getAnalyticsTrends(mockAdmin as any);
      expect(trends.collegeGrowth.length).toBe(6);
      expect(trends.planDistribution.length).toBeGreaterThan(0);
    });

    it("manages platform settings with audit logging", async () => {
      const mockAdmin = createMockAdminClient();
      const settings = await PlatformConfigService.getAllSettings(mockAdmin as any);

      expect(settings["maintenance_mode"]).toBeDefined();
      expect(settings["maintenance_mode"].value.enabled).toBe(false);

      const updated = await PlatformConfigService.updateSetting({
        key: "maintenance_mode",
        value: { enabled: true, message: "System maintenance until 03:00" },
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(updated.value.enabled).toBe(true);
      expect(updated.value.message).toBe("System maintenance until 03:00");
    });

    it("invites new administrator and prevents revoking the last active admin", async () => {
      const mockAdmin = createMockAdminClient();

      // Invite
      const inviteRes = await PlatformAdminManagementService.createInvitation({
        email: "alice-admin@urplaced.com",
        adminId: "admin-uuid",
        admin: mockAdmin as any,
      });

      expect(inviteRes.inviteLink).toContain("invitation=adm_inv_");

      // Attempt to suspend sole remaining active admin
      await expect(
        PlatformAdminManagementService.updateAdminStatus({
          targetAdminId: "admin-uuid",
          newStatus: "SUSPENDED",
          currentAdminId: "admin-uuid",
          admin: mockAdmin as any,
        })
      ).rejects.toThrow("Cannot suspend or revoke the platform's sole remaining active Super Admin");
    });

    it("strictly isolates platform audit logs to events where tenant_id IS NULL", async () => {
      const mockAdmin = createMockAdminClient();
      // Add a private college-owned audit log
      mockDatabase["audit_logs"].push({
        id: "college-log-1",
        tenant_id: "tenant-sapthagiri", // College private event!
        action: "STUDENT_ASSESSMENT_SUBMITTED",
        created_at: new Date().toISOString(),
      });

      const res = await PlatformAuditService.listPlatformAuditLogs({
        admin: mockAdmin as any,
      });

      // Must return ONLY the platform-level event
      expect(res.logs.every((l) => !l.metadata?.tenantId)).toBe(true);
      expect(res.logs.some((l) => l.action === "STUDENT_ASSESSMENT_SUBMITTED")).toBe(false);
    });

    it("executes genuine live system health diagnostic probes", async () => {
      const mockAdmin = createMockAdminClient();
      const report = await PlatformHealthService.checkSystemHealth(mockAdmin as any);

      expect(report.overallStatus).toBeDefined();
      expect(report.services.length).toBe(5);
      expect(report.services.some((s) => s.name.includes("PostgreSQL"))).toBe(true);
      expect(report.services.some((s) => s.name.includes("Storage"))).toBe(true);
      expect(report.services.some((s) => s.name.includes("Auth"))).toBe(true);
    });
  });
});
