import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";
import { EmailAdapter } from "@/modules/identity-access/services/email-adapter";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { EntitlementService } from "@/modules/platform-admin/services/entitlement-service";
import { Permissions } from "@/modules/identity-access/services/policy-engine";

describe("URPLACED SA-03: College Invitation-Based Onboarding & Lifecycle", () => {
  let mockTenants: any[] = [];
  let mockMemberships: any[] = [];
  let mockProfiles: any[] = [];
  let mockSubscriptions: any[] = [];
  let mockInvoices: any[] = [];
  let mockAuditLogs: any[] = [];

  // Mock Admin Client
  const mockAdminClient: any = {
    auth: {
      admin: {
        createUser: vi.fn(async (params: any) => {
          const id = `auth-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          return { data: { user: { id, email: params.email } }, error: null };
        }),
        updateUserById: vi.fn(async (id: string, params: any) => {
          return { data: { user: { id, ...params } }, error: null };
        }),
      },
    },
    from: vi.fn((tableName: string) => {
      if (tableName === "tenants") {
        return {
          select: vi.fn((fields?: string) => ({
            eq: vi.fn((col: string, val: any) => ({
              maybeSingle: vi.fn(async () => {
                const found = mockTenants.find((t) => t[col] === val);
                return { data: found || null, error: null };
              }),
              single: vi.fn(async () => {
                const found = mockTenants.find((t) => t[col] === val);
                return { data: found || null, error: found ? null : { message: "Not found" } };
              }),
            })),
            like: vi.fn((col: string, pattern: string) => ({
              limit: vi.fn(async (limit: number) => {
                const cleanPattern = pattern.replace(/%/g, "");
                const matched = mockTenants.filter(
                  (t) => t[col] && t[col].includes(cleanPattern)
                );
                return { data: matched.slice(0, limit), error: null };
              }),
            })),
            order: vi.fn(() => ({
              data: mockTenants,
              error: null,
            })),
          })),
          insert: vi.fn((record: any) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const newTenant = {
                  id: `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  ...record,
                };
                mockTenants.push(newTenant);
                return { data: newTenant, error: null };
              }),
            })),
          })),
          update: vi.fn((updates: any) => ({
            eq: vi.fn((col: string, val: any) => {
              const target = mockTenants.find((t) => t[col] === val);
              if (target) {
                Object.assign(target, updates);
                return { error: null, data: target };
              }
              return { error: { message: "Tenant not found" }, data: null };
            }),
          })),
        };
      }

      if (tableName === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: any) => ({
              maybeSingle: vi.fn(async () => {
                const found = mockProfiles.find((p) => p[col] === val);
                return { data: found || null, error: null };
              }),
            })),
          })),
          upsert: vi.fn(async (profile: any) => {
            const idx = mockProfiles.findIndex((p) => p.id === profile.id || p.email === profile.email);
            if (idx >= 0) {
              mockProfiles[idx] = { ...mockProfiles[idx], ...profile };
            } else {
              mockProfiles.push(profile);
            }
            return { error: null };
          }),
        };
      }

      if (tableName === "tenant_memberships") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: any) => {
              const matches = mockMemberships.filter((m) => m[col] === val);
              return {
                data: matches,
                error: null,
                maybeSingle: vi.fn(async () => ({ data: matches[0] || null, error: null })),
              };
            }),
          })),
          upsert: vi.fn(async (membership: any) => {
            const idx = mockMemberships.findIndex(
              (m) => m.user_id === membership.user_id && m.tenant_id === membership.tenant_id
            );
            if (idx >= 0) {
              mockMemberships[idx] = { ...mockMemberships[idx], ...membership };
            } else {
              mockMemberships.push(membership);
            }
            return { error: null };
          }),
        };
      }

      if (tableName === "college_subscriptions") {
        return {
          insert: vi.fn((sub: any) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const record = { id: `sub-${Date.now()}`, ...sub };
                mockSubscriptions.push(record);
                return { data: record, error: null };
              }),
            })),
          })),
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: any) => ({
              maybeSingle: vi.fn(async () => {
                const found = mockSubscriptions.find((s) => s[col] === val);
                return { data: found || null, error: null };
              }),
            })),
          })),
        };
      }

      if (tableName === "platform_invoices") {
        return {
          insert: vi.fn(async (inv: any) => {
            mockInvoices.push(inv);
            return { error: null };
          }),
        };
      }

      if (tableName === "notifications") {
        return {
          insert: vi.fn((notif: any) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const rec = { id: `notif-${Date.now()}`, ...notif };
                return { data: rec, error: null };
              }),
            })),
          })),
        };
      }

      if (tableName === "audit_logs") {
        return {
          insert: vi.fn(async (log: any) => {
            mockAuditLogs.push(log);
            return { error: null };
          }),
        };
      }

      return {
        select: vi.fn(() => ({ error: null, data: [] })),
        insert: vi.fn(() => ({ error: null })),
      };
    }),
  };

  beforeEach(() => {
    mockTenants = [];
    mockMemberships = [];
    mockProfiles = [];
    mockSubscriptions = [];
    mockInvoices = [];
    mockAuditLogs = [];
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. Super Admin College Registration & Cryptographic Invitation Generation
  // ==========================================================================
  describe("1. Super Admin College Registration Workflow", () => {
    it("registers college with INVITED onboarding status, pending subscription, and emails Placement Head", async () => {
      const emailSpy = vi.spyOn(EmailAdapter, "sendCollegePlacementHeadInvitation").mockResolvedValue({
        success: true,
        messageId: "mock-smtp-reg-1",
        deliveryMethod: "GMAIL_SMTP",
      });

      const result = await PlatformCollegeService.registerCollege({
        name: "Dayananda Sagar College of Engineering",
        slug: "dsce-bangalore",
        officialEmail: "placement.head@dsce.edu.in",
        contactName: "Dr. A. Sharma",
        contactPhone: "+91 98450 12345",
        initialPlanId: "growth",
        studentSeatLimit: 1500,
        adminId: "super-admin-01",
        admin: mockAdminClient,
      });

      expect(result.college).toBeDefined();
      expect(result.college.name).toBe("Dayananda Sagar College of Engineering");
      expect(result.college.slug).toBe("dsce-bangalore");
      expect(result.college.officialEmail).toBe("placement.head@dsce.edu.in");
      expect(result.college.contactName).toBe("Dr. A. Sharma");
      expect(result.college.onboardingStatus).toBe("INVITED");

      // Verify rawToken is high-entropy 64 hex chars (32 bytes)
      expect(result.onboardingToken).toBeDefined();
      expect(result.onboardingToken.length).toBe(64);

      // Verify token in database is hashed with timestamp prefix, NOT stored as raw plaintext
      const storedTenant = mockTenants.find((t) => t.slug === "dsce-bangalore");
      expect(storedTenant).toBeDefined();
      expect(storedTenant.onboarding_token).not.toBe(result.onboardingToken);
      expect(storedTenant.onboarding_token.startsWith("tok_")).toBe(true);

      const expectedHash = crypto.createHash("sha256").update(result.onboardingToken).digest("hex");
      expect(storedTenant.onboarding_token).toContain(expectedHash);

      // Verify subscription is PENDING_PAYMENT
      expect(mockSubscriptions.length).toBe(1);
      expect(mockSubscriptions[0].status).toBe("PENDING_PAYMENT");

      // Verify email dispatch attempt
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: "placement.head@dsce.edu.in",
          collegeName: "Dayananda Sagar College of Engineering",
          placementHeadName: "Dr. A. Sharma",
          inviteUrl: expect.stringContaining(result.onboardingToken),
        })
      );
    });

    it("rejects duplicate college slug with clear conflict error", async () => {
      mockTenants.push({
        id: "existing-tenant-1",
        slug: "rvce-bangalore",
        name: "RV College",
      });

      await expect(
        PlatformCollegeService.registerCollege({
          name: "RV College of Engineering",
          slug: "rvce-bangalore",
          officialEmail: "head@rvce.edu.in",
          contactName: "Placement Officer",
          initialPlanId: "growth",
          adminId: "admin-01",
          admin: mockAdminClient,
        })
      ).rejects.toThrow("already taken");
    });

    it("enforces One Person = One College rule during registration", async () => {
      // Simulate that this email already belongs to a user associated with another college
      mockProfiles.push({ id: "user-abc-123", email: "head@anothercollege.edu" });
      mockMemberships.push({ user_id: "user-abc-123", tenant_id: "other-tenant-999" });

      await expect(
        PlatformCollegeService.registerCollege({
          name: "New College",
          slug: "new-college",
          officialEmail: "head@anothercollege.edu",
          contactName: "Officer Name",
          initialPlanId: "growth",
          adminId: "admin-01",
          admin: mockAdminClient,
        })
      ).rejects.toThrow("One Person = One College");
    });
  });

  // ==========================================================================
  // 2. Cryptographic Invitation Token Verification
  // ==========================================================================
  describe("2. Invitation Token Verification & Invalidation", () => {
    it("successfully verifies valid invitation token and resolves prefilled metadata", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAtMs = Date.now() + 72 * 60 * 60 * 1000;

      mockTenants.push({
        id: "tenant-bms",
        name: "BMS College of Engineering",
        slug: "bms-college",
        official_email: "placement@bmsce.ac.in",
        contact_name: "Prof. K. Ramesh",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${expiresAtMs}_${tokenHash}`,
      });

      const verified = await PlatformCollegeService.verifyInvitationToken(rawToken, mockAdminClient);

      expect(verified.valid).toBe(true);
      expect(verified.collegeName).toBe("BMS College of Engineering");
      expect(verified.officialEmail).toBe("placement@bmsce.ac.in");
      expect(verified.contactName).toBe("Prof. K. Ramesh");
      expect(verified.tenantId).toBe("tenant-bms");
    });

    it("rejects missing, forged, or malformed invitation tokens", async () => {
      const emptyCheck = await PlatformCollegeService.verifyInvitationToken("", mockAdminClient);
      expect(emptyCheck.valid).toBe(false);
      expect(emptyCheck.error).toBe("INVITATION_NOT_FOUND");

      const forgedCheck = await PlatformCollegeService.verifyInvitationToken(
        "forged-token-that-does-not-exist-12345",
        mockAdminClient
      );
      expect(forgedCheck.valid).toBe(false);
      expect(forgedCheck.error).toBe("INVITATION_NOT_FOUND");
    });

    it("rejects expired invitation token (exceeded 72 hours)", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const pastExpiresAtMs = Date.now() - 10000; // 10 seconds ago

      mockTenants.push({
        id: "tenant-pes",
        name: "PES University",
        slug: "pes-university",
        official_email: "placements@pes.edu",
        contact_name: "Director Placements",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${pastExpiresAtMs}_${tokenHash}`,
      });

      const verified = await PlatformCollegeService.verifyInvitationToken(rawToken, mockAdminClient);

      expect(verified.valid).toBe(false);
      expect(verified.error).toBe("INVITATION_EXPIRED");
      expect(verified.message).toContain("expired");
    });

    it("rejects already consumed invitation token", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockTenants.push({
        id: "tenant-consumed",
        name: "Previously Onboarded College",
        slug: "consumed-college",
        official_email: "head@consumed.edu",
        contact_name: "Dr. Completed",
        status: "ACTIVE",
        onboarding_status: "COMPLETED",
        onboarding_token: `tok_${Date.now() + 100000}_${tokenHash}`,
      });

      const verified = await PlatformCollegeService.verifyInvitationToken(rawToken, mockAdminClient);

      expect(verified.valid).toBe(false);
      expect(verified.error).toBe("INVITATION_ALREADY_CONSUMED");
      expect(verified.message).toContain("already been used");
    });

    it("rejects revoked invitation token", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockTenants.push({
        id: "tenant-revoked",
        name: "Revoked College",
        slug: "revoked-college",
        official_email: "head@revoked.edu",
        contact_name: "Dr. Revoked",
        status: "ACTIVE",
        onboarding_status: "ACTION_REQUIRED",
        onboarding_token: `tok_${Date.now() + 100000}_${tokenHash}`,
      });

      const verified = await PlatformCollegeService.verifyInvitationToken(rawToken, mockAdminClient);

      expect(verified.valid).toBe(false);
      expect(verified.error).toBe("INVITATION_REVOKED");
      expect(verified.message).toContain("revoked");
    });

    it("rejects invitation for suspended college", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockTenants.push({
        id: "tenant-suspended",
        name: "Suspended College",
        slug: "suspended-college",
        official_email: "head@suspended.edu",
        contact_name: "Dr. Suspended",
        status: "SUSPENDED",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${Date.now() + 100000}_${tokenHash}`,
      });

      const verified = await PlatformCollegeService.verifyInvitationToken(rawToken, mockAdminClient);

      expect(verified.valid).toBe(false);
      expect(verified.error).toBe("COLLEGE_SUSPENDED");
    });
  });

  // ==========================================================================
  // 3. Placement Head Account Setup & Atomic Token Consumption
  // ==========================================================================
  describe("3. Account Setup & Invitation Consumption", () => {
    it("atomically provisions Auth user, profile, PLACEMENT_HEAD membership and consumes invitation", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAtMs = Date.now() + 72 * 60 * 60 * 1000;

      const tenantRecord: any = {
        id: "tenant-msrit",
        name: "MS Ramaiah Institute of Technology",
        slug: "msrit-bangalore",
        official_email: "placement.head@msrit.edu",
        contact_name: "Dr. Savitha K.",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${expiresAtMs}_${tokenHash}`,
        onboarding_completed_at: null,
      };
      mockTenants.push(tenantRecord);

      const result = await PlatformCollegeService.completeCollegeOnboarding({
        token: rawToken,
        password: "StrongSecurePassword123!",
        admin: mockAdminClient,
      });

      expect(result.success).toBe(true);
      expect(result.collegeName).toBe("MS Ramaiah Institute of Technology");
      expect(result.email).toBe("placement.head@msrit.edu");

      // Verify Auth User was created with PLACEMENT_HEAD role and bound tenant_id
      expect(mockAdminClient.auth.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "placement.head@msrit.edu",
          app_metadata: expect.objectContaining({
            role: "PLACEMENT_HEAD",
            account_category: "COLLEGE",
            tenant_id: "tenant-msrit",
          }),
        })
      );

      // Verify Profile was created
      const profile = mockProfiles.find((p) => p.email === "placement.head@msrit.edu");
      expect(profile).toBeDefined();
      expect(profile.full_name).toBe("Dr. Savitha K.");

      // Verify PLACEMENT_HEAD Membership was created
      const membership = mockMemberships.find(
        (m) => m.tenant_id === "tenant-msrit" && m.role === "PLACEMENT_HEAD"
      );
      expect(membership).toBeDefined();
      expect(membership.status).toBe("ACTIVE");

      // Verify invitation was consumed and token was wiped
      expect(tenantRecord.onboarding_status).toBe("COMPLETED");
      expect(tenantRecord.onboarding_completed_at).toBeDefined();
      expect(tenantRecord.onboarding_token).toBeNull();

      // Verify replay attack fails because token is wiped
      const replayVerification = await PlatformCollegeService.verifyInvitationToken(
        rawToken,
        mockAdminClient
      );
      expect(replayVerification.valid).toBe(false);
      expect(replayVerification.error).toBe("INVITATION_NOT_FOUND");
    });

    it("rejects setup when password is under 8 characters", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      mockTenants.push({
        id: "tenant-short-pw",
        name: "Test College",
        slug: "test-college",
        official_email: "head@test.edu",
        contact_name: "Dr. Test",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${Date.now() + 100000}_${tokenHash}`,
      });

      await expect(
        PlatformCollegeService.completeCollegeOnboarding({
          token: rawToken,
          password: "short",
          admin: mockAdminClient,
        })
      ).rejects.toThrow("Password must be at least 8 characters");
    });
  });

  // ==========================================================================
  // 4. Super Admin Invitation Resend & Revocation
  // ==========================================================================
  describe("4. Invitation Resend & Revocation Lifecycle", () => {
    it("resend generates new token, invalidates old token, and re-dispatches email", async () => {
      const oldRawToken = crypto.randomBytes(32).toString("hex");
      const oldHash = crypto.createHash("sha256").update(oldRawToken).digest("hex");

      const tenant = {
        id: "tenant-resend-test",
        name: "Reva University",
        slug: "reva-university",
        official_email: "placement@reva.edu.in",
        contact_name: "Dr. Ramesh",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${Date.now() + 100000}_${oldHash}`,
      };
      mockTenants.push(tenant);

      const emailSpy = vi.spyOn(EmailAdapter, "sendCollegePlacementHeadInvitation").mockResolvedValue({
        success: true,
        messageId: "mock-smtp-resend-1",
        deliveryMethod: "GMAIL_SMTP",
      });

      const resendResult = await PlatformCollegeService.resendInvitation({
        tenantId: "tenant-resend-test",
        adminId: "super-admin-01",
        admin: mockAdminClient,
      });

      expect(resendResult.success).toBe(true);

      // Verify tenant has a NEW token hash
      expect(tenant.onboarding_token).not.toContain(oldHash);

      // Verify the OLD token is now completely invalid
      const oldVerification = await PlatformCollegeService.verifyInvitationToken(
        oldRawToken,
        mockAdminClient
      );
      expect(oldVerification.valid).toBe(false);
      expect(oldVerification.error).toBe("INVITATION_NOT_FOUND");

      // Verify email was sent with new invite URL
      expect(emailSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toEmail: "placement@reva.edu.in",
          collegeName: "Reva University",
        })
      );
    });

    it("revocation sets onboarding_status to ACTION_REQUIRED and clears token", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      const tenant = {
        id: "tenant-revoke-test",
        name: "Revoke Target College",
        slug: "revoke-target",
        official_email: "revoke@target.edu",
        contact_name: "Dr. Target",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${Date.now() + 100000}_${tokenHash}`,
      };
      mockTenants.push(tenant);

      const revokeResult = await PlatformCollegeService.revokeInvitation({
        tenantId: "tenant-revoke-test",
        adminId: "super-admin-01",
        reason: "Suspected spoofing",
        admin: mockAdminClient,
      });

      expect(revokeResult.success).toBe(true);
      expect(tenant.onboarding_status).toBe("ACTION_REQUIRED");
      expect(tenant.onboarding_token).toBeNull();

      // Verify token verification fails
      const check = await PlatformCollegeService.verifyInvitationToken(rawToken, mockAdminClient);
      expect(check.valid).toBe(false);
    });
  });

  // ==========================================================================
  // 5. Email Provider Resilience & Honest Status Reporting
  // ==========================================================================
  describe("5. Email Adapter Provider Behavior", () => {
    it("reports honest UNCONFIGURED delivery status when email credentials are not set", async () => {
      vi.restoreAllMocks();

      const origVitest = process.env.VITEST;
      const origNodeEnv = process.env.NODE_ENV;
      const origGmailUser = process.env.GMAIL_USER;
      const origGmailPass = process.env.GMAIL_APP_PASSWORD;
      const origResendKey = process.env.RESEND_API_KEY;
      const origEmailApiKey = process.env.EMAIL_API_KEY;

      delete process.env.VITEST;
      (process.env as any).NODE_ENV = "production";
      delete process.env.GMAIL_USER;
      delete process.env.GMAIL_APP_PASSWORD;
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_API_KEY;

      try {
        const result = await EmailAdapter.sendCollegePlacementHeadInvitation({
          toEmail: "test@college.edu",
          collegeName: "Test College",
          placementHeadName: "Test Head",
          inviteUrl: "https://urplaced.com/auth/college/signup?token=abc",
        });

        expect(result.success).toBe(false);
        expect(result.deliveryMethod).toBe("UNCONFIGURED");
        expect(result.error).toMatch(/Gmail SMTP credentials|No outbound transactional email provider/);
      } finally {
        if (origVitest !== undefined) process.env.VITEST = origVitest;
        (process.env as any).NODE_ENV = origNodeEnv;
        if (origGmailUser !== undefined) process.env.GMAIL_USER = origGmailUser;
        if (origGmailPass !== undefined) process.env.GMAIL_APP_PASSWORD = origGmailPass;
        if (origResendKey !== undefined) process.env.RESEND_API_KEY = origResendKey;
        if (origEmailApiKey !== undefined) process.env.EMAIL_API_KEY = origEmailApiKey;
      }
    });
  });

  // ==========================================================================
  // 6. Concurrent Redemption & Replay Protection
  // ==========================================================================
  describe("6. Concurrent Redemption & Replay Attacks", () => {
    it("atomically handles first redemption and strictly rejects second concurrent redemption", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAtMs = Date.now() + 72 * 60 * 60 * 1000;

      const tenantRecord: any = {
        id: "tenant-race-condition",
        name: "Concurrent Test University",
        slug: "concurrent-test",
        official_email: "race@university.edu",
        contact_name: "Dr. Race",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${expiresAtMs}_${tokenHash}`,
        onboarding_completed_at: null,
      };
      mockTenants.push(tenantRecord);

      // First setup attempt succeeds
      const firstResult = await PlatformCollegeService.completeCollegeOnboarding({
        token: rawToken,
        password: "FirstPassword123!",
        admin: mockAdminClient,
      });

      expect(firstResult.success).toBe(true);
      expect(tenantRecord.onboarding_status).toBe("COMPLETED");
      expect(tenantRecord.onboarding_token).toBeNull();

      // Second setup attempt using the same token fails immediately
      await expect(
        PlatformCollegeService.completeCollegeOnboarding({
          token: rawToken,
          password: "SecondPassword456!",
          admin: mockAdminClient,
        })
      ).rejects.toThrow("Invalid or unrecognized invitation token");
    });
  });

  // ==========================================================================
  // 7. Partial Provisioning Failure Handling
  // ==========================================================================
  describe("7. Partial Provisioning Failure Handling", () => {
    it("fails cleanly without corrupting tenant state if user creation encounters an error", async () => {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAtMs = Date.now() + 72 * 60 * 60 * 1000;

      const tenantRecord: any = {
        id: "tenant-failing-setup",
        name: "Failing Setup College",
        slug: "failing-setup",
        official_email: "fail@setup.edu",
        contact_name: "Dr. Failure",
        status: "ACTIVE",
        onboarding_status: "INVITED",
        onboarding_token: `tok_${expiresAtMs}_${tokenHash}`,
        onboarding_completed_at: null,
      };
      mockTenants.push(tenantRecord);

      // Temporarily mock createUser to fail
      const origCreateUser = mockAdminClient.auth.admin.createUser;
      mockAdminClient.auth.admin.createUser = vi.fn(async () => ({
        data: null,
        error: { message: "Auth service unavailable" },
      }));

      try {
        await expect(
          PlatformCollegeService.completeCollegeOnboarding({
            token: rawToken,
            password: "ValidPassword123!",
            admin: mockAdminClient,
          })
        ).rejects.toThrow("Failed to create authentication user");

        // Tenant onboarding status remains INVITED, not COMPLETED
        expect(tenantRecord.onboarding_status).toBe("INVITED");
      } finally {
        mockAdminClient.auth.admin.createUser = origCreateUser;
      }
    });
  });

  // ==========================================================================
  // 8. Strict PENDING_PAYMENT Server-Side Entitlement Lockdown
  // ==========================================================================
  describe("8. Strict PENDING_PAYMENT Server-Side Entitlement Lockdown", () => {
    const lockedTenantId = "tenant-locked-unpaid";

    beforeEach(() => {
      mockSubscriptions.push({
        id: "sub-unpaid-1",
        tenant_id: lockedTenantId,
        plan_id: "growth",
        status: "PENDING_PAYMENT",
        renewal_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      });
    });

    it("blocks operational permissions (STUDENTS_READ, DRIVES_MANAGE) with FORBIDDEN: SUBSCRIPTION_PENDING_PAYMENT", async () => {
      await expect(
        EntitlementService.assertCollegeOperationalEntitlement(
          lockedTenantId,
          "PLACEMENT_HEAD",
          Permissions.STUDENTS_READ,
          mockAdminClient
        )
      ).rejects.toThrow("FORBIDDEN: SUBSCRIPTION_PENDING_PAYMENT");

      await expect(
        EntitlementService.assertCollegeOperationalEntitlement(
          lockedTenantId,
          "PLACEMENT_HEAD",
          Permissions.DRIVES_MANAGE,
          mockAdminClient
        )
      ).rejects.toThrow("FORBIDDEN: SUBSCRIPTION_PENDING_PAYMENT");
    });

    it("allows administrative exemptions (PROFILE_READ, BILLING_READ) even when PENDING_PAYMENT", async () => {
      // Profile and Billing permissions must NOT throw
      await expect(
        EntitlementService.assertCollegeOperationalEntitlement(
          lockedTenantId,
          "PLACEMENT_HEAD",
          "profile.read" as any,
          mockAdminClient
        )
      ).resolves.toBeUndefined();

      await expect(
        EntitlementService.assertCollegeOperationalEntitlement(
          lockedTenantId,
          "PLACEMENT_HEAD",
          "billing.read" as any,
          mockAdminClient
        )
      ).resolves.toBeUndefined();
    });

    it("allows all operational permissions once subscription status transitions to ACTIVE", async () => {
      const activeTenantId = "tenant-active-paid";
      mockSubscriptions.push({
        id: "sub-active-1",
        tenant_id: activeTenantId,
        plan_id: "growth",
        status: "ACTIVE",
        entitlements_snapshot: {
          plan_id: "growth",
          plan_version: 1,
          entitlements: {
            [Permissions.STUDENTS_READ]: true,
            [Permissions.DRIVES_MANAGE]: true,
            job_postings_drives: true,
            question_bank_assessments: true,
            placement_tracking_crm: true,
          },
          limits: {
            max_students: 2000,
            max_staff: 15,
          },
        },
        renewal_date: new Date(Date.now() + 30 * 86400000).toISOString(),
      });

      await expect(
        EntitlementService.assertCollegeOperationalEntitlement(
          activeTenantId,
          "PLACEMENT_HEAD",
          Permissions.STUDENTS_READ,
          mockAdminClient
        )
      ).resolves.toBeUndefined();

      await expect(
        EntitlementService.assertCollegeOperationalEntitlement(
          activeTenantId,
          "PLACEMENT_HEAD",
          Permissions.DRIVES_MANAGE,
          mockAdminClient
        )
      ).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // 9. Environment-Aware Invitation URL Resolution
  // ==========================================================================
  describe("9. Environment-Aware Invitation Base URL Resolution", () => {
    const origEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...origEnv };
    });

    it("resolves preview deployment URL when VERCEL_ENV is preview", () => {
      process.env.VERCEL_ENV = "preview";
      process.env.VERCEL_URL = "urplaced-preview-git-branch.vercel.app";

      expect(EmailAdapter.getAppOrigin()).toBe("https://urplaced-preview-git-branch.vercel.app");
    });

    it("resolves local development URL (localhost:3000) in local environment", () => {
      delete process.env.VERCEL_ENV;
      delete process.env.NEXT_PUBLIC_VERCEL_ENV;
      delete process.env.VERCEL;
      (process.env as any).NODE_ENV = "development";
      process.env.APP_BASE_URL = "http://localhost:3000";

      expect(EmailAdapter.getAppOrigin()).toBe("http://localhost:3000");
    });

    it("resolves production URL when in production environment", () => {
      delete process.env.VERCEL_ENV;
      delete process.env.APP_BASE_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;
      (process.env as any).NODE_ENV = "production";

      expect(EmailAdapter.getAppOrigin()).toBe("https://urplaced.vercel.app");
    });

    it("never trusts unvalidated client headers and always sanitizes trailing slashes", () => {
      process.env.APP_BASE_URL = "https://custom.campus.edu////";
      expect(EmailAdapter.getAppOrigin()).toBe("https://custom.campus.edu");
    });
  });
});
