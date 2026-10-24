import { describe, it, expect, beforeEach, vi } from "vitest";

// In-memory mock database store for invitations and memberships
const mockInvitations: any[] = [];
const mockMemberships: any[] = [];
const mockUsers: any[] = [];
const mockProfiles: any[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn(async ({ email, password, user_metadata, app_metadata }) => {
          const user = {
            id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            email,
            user_metadata: user_metadata || {},
            app_metadata: app_metadata || {},
            created_at: new Date().toISOString(),
          };
          mockUsers.push(user);
          return { data: { user }, error: null };
        }),
        updateUserById: vi.fn(async (userId, updates) => {
          const user = mockUsers.find((u) => u.id === userId);
          if (user) {
            if (updates.app_metadata) Object.assign(user.app_metadata, updates.app_metadata);
            if (updates.user_metadata) Object.assign(user.user_metadata, updates.user_metadata);
          }
          return { data: { user }, error: null };
        }),
        listUsers: vi.fn(async () => {
          return { data: { users: [...mockUsers] }, error: null };
        }),
      },
    },
    from: vi.fn((table: string) => {
      let currentFilter: any = {};
      let selectedData: any = null;

      const builder: any = {
        insert: vi.fn((record: any) => {
          const items = Array.isArray(record) ? record : [record];
          const inserted: any[] = [];
          items.forEach((item) => {
            const row = { id: item.id || `row-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`, ...item, created_at: new Date().toISOString() };
            if (table === "invitations") mockInvitations.push(row);
            if (table === "tenant_memberships") mockMemberships.push(row);
            if (table === "profiles") mockProfiles.push(row);
            inserted.push(row);
          });
          selectedData = inserted[0];
          return builder;
        }),
        upsert: vi.fn((record: any) => {
          if (table === "tenant_memberships") {
            const idx = mockMemberships.findIndex(
              (m) => m.tenant_id === record.tenant_id && m.user_id === record.user_id
            );
            if (idx >= 0) {
              mockMemberships[idx] = { ...mockMemberships[idx], ...record };
            } else {
              mockMemberships.push({ id: `mem-${Date.now()}`, ...record });
            }
          }
          if (table === "profiles") {
            const idx = mockProfiles.findIndex((p) => p.id === record.id);
            if (idx >= 0) {
              mockProfiles[idx] = { ...mockProfiles[idx], ...record };
            } else {
              mockProfiles.push(record);
            }
          }
          selectedData = record;
          return builder;
        }),
        update: vi.fn((updates: any) => {
          const filters: Record<string, any> = {};
          const applyUpdates = () => {
            if (table === "invitations") {
              mockInvitations.forEach((inv) => {
                const match = Object.entries(filters).every(([k, v]) => inv[k] === v);
                if (match) {
                  Object.assign(inv, updates);
                  selectedData = { ...inv };
                }
              });
            }
          };

          const updateChain: any = {
            eq: vi.fn((col: string, val: any) => {
              filters[col] = val;
              applyUpdates();
              return updateChain;
            }),
            select: vi.fn(() => updateChain),
            single: vi.fn(async () => {
              applyUpdates();
              return { data: selectedData || null, error: selectedData ? null : { message: "Not found" } };
            }),
          };

          return updateChain;
        }),
        select: vi.fn(() => builder),
        eq: vi.fn((col: string, val: any) => {
          currentFilter[col] = val;
          return builder;
        }),
        order: vi.fn(() => builder),
        single: vi.fn(async () => {
          if (selectedData) {
            const res = selectedData;
            selectedData = null;
            return {
              data: { ...res, tenants: { name: "Sapthagiri NPS University", slug: "sapthagiri", status: "ACTIVE" } },
              error: null,
            };
          }
          let row = null;
          if (table === "invitations") {
            row = mockInvitations.find((inv) => {
              return Object.entries(currentFilter).every(([k, v]) => inv[k] === v);
            });
            if (row) {
              row = { ...row, tenants: { name: "Sapthagiri NPS University", slug: "sapthagiri", status: "ACTIVE" } };
            }
          }
          return { data: row || null, error: row ? null : { message: "Not found" } };
        }),
      };

      // Handle query resolution returning multiple rows
      builder.then = (resolve: any) => {
        let results = [];
        if (table === "invitations") {
          results = mockInvitations.filter((inv) => {
            return Object.entries(currentFilter).every(([k, v]) => inv[k] === v);
          });
        }
        resolve({ data: results, error: null });
      };

      return builder;
    }),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      signInWithPassword: vi.fn(async ({ email, password }) => {
        const user = mockUsers.find((u) => u.email?.toLowerCase() === email.toLowerCase());
        if (!user) {
          return { data: { user: null, session: null }, error: { message: "Invalid credentials" } };
        }
        return { data: { user, session: { access_token: "test-token" } }, error: null };
      }),
    },
  })),
}));

import {
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  resendInvitation,
  revokeInvitation,
  listTenantInvitations,
  normalizeEmail,
  isValidEmail,
} from "@/modules/identity-access/services/invitation-service";
import { EmailAdapter } from "@/modules/identity-access/services/email-adapter";

describe("Staff & Members Secure Invitation & Onboarding Workflow", () => {
  const tenantId = "test-tenant-sapthagiri-123";
  const inviterId = "head-user-456";

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvitations.length = 0;
    mockMemberships.length = 0;
    mockUsers.length = 0;
    mockProfiles.length = 0;
  });

  describe("1. Email Validation & Normalization", () => {
    it("correctly identifies valid and invalid institutional email formats", () => {
      expect(isValidEmail("coordinator@campus.edu")).toBe(true);
      expect(isValidEmail("trainer.lead@university.ac.in")).toBe(true);
      expect(isValidEmail("plainaddress")).toBe(false);
      expect(isValidEmail("@missingusername.com")).toBe(false);
      expect(isValidEmail("missingdomain@")).toBe(false);
      expect(isValidEmail("spaces in@domain.com")).toBe(false);
    });

    it("normalizes mixed-case and whitespace-padded emails", () => {
      expect(normalizeEmail("  Faculty.Coordinator@CAMPUS.EDU  ")).toBe("faculty.coordinator@campus.edu");
    });
  });

  describe("2. Role Enforcement on Ordinary Staff Invitations", () => {
    it("permits PLACEMENT_STAFF and TRAINER roles", async () => {
      const staffInvite = await createInvitation({
        tenantId,
        email: "staff.officer@campus.edu",
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      expect(staffInvite.invitation.role).toBe("PLACEMENT_STAFF");
      expect(staffInvite.rawToken).toHaveLength(64);

      const trainerInvite = await createInvitation({
        tenantId,
        email: "trainer.specialist@campus.edu",
        role: "TRAINER",
        createdBy: inviterId,
      });

      expect(trainerInvite.invitation.role).toBe("TRAINER");
      expect(trainerInvite.rawToken).toHaveLength(64);
    });

    it("strictly rejects PLACEMENT_HEAD from ordinary staff invitation creation", async () => {
      await expect(
        createInvitation({
          tenantId,
          email: "impostor.head@campus.edu",
          role: "PLACEMENT_HEAD" as any,
          createdBy: inviterId,
        })
      ).rejects.toThrow(/Role PLACEMENT_HEAD is not permitted for staff invitations/);
    });

    it("strictly rejects SUPER_ADMIN from ordinary staff invitation creation", async () => {
      await expect(
        createInvitation({
          tenantId,
          email: "super.admin@campus.edu",
          role: "SUPER_ADMIN" as any,
          createdBy: inviterId,
        })
      ).rejects.toThrow(/Role SUPER_ADMIN is not permitted for staff invitations/);
    });
  });

  describe("3. Token Lifecycle, Resolution & Expiry", () => {
    it("resolves a pending invitation by valid raw token", async () => {
      const email = "resolvable.staff@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const resolved = await getInvitationByToken(created.rawToken);
      expect(resolved.isValid).toBe(true);
      expect(resolved.invitation?.email).toBe(email);
      expect(resolved.invitation?.role).toBe("PLACEMENT_STAFF");
      expect(resolved.invitation?.status).toBe("PENDING");
    });

    it("rejects invalid or tampered tokens", async () => {
      const bogusToken = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
      const resolved = await getInvitationByToken(bogusToken);
      expect(resolved.isValid).toBe(false);
      expect(resolved.error).toContain("Invalid invitation token");
    });

    it("rejects revoked invitations", async () => {
      const email = "to.revoke@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "TRAINER",
        createdBy: inviterId,
      });

      await revokeInvitation(created.invitation.id, tenantId);

      const resolved = await getInvitationByToken(created.rawToken);
      expect(resolved.isValid).toBe(false);
      expect(resolved.error).toContain("revoked");
    });
  });

  describe("4. Invitation Acceptance & Multi-Tenant Binding", () => {
    it("accepts invitation atomically and sets status to ACCEPTED", async () => {
      const email = "accept.newuser@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const acceptResult = await acceptInvitation({
        rawToken: created.rawToken,
        userId: "auth-user-new-001",
        userEmail: email,
        fullName: "Anand Verma",
      });

      expect(acceptResult.success).toBe(true);
      expect(acceptResult.tenantId).toBe(tenantId);
      expect(acceptResult.role).toBe("PLACEMENT_STAFF");

      // Verify token cannot be re-used (single-use invariant)
      const secondAttempt = await getInvitationByToken(created.rawToken);
      expect(secondAttempt.isValid).toBe(false);
      expect(secondAttempt.error).toContain("already been accepted");
    });

    it("rejects acceptance if user email does not match invitation bound email", async () => {
      const email = "target.recipient@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "TRAINER",
        createdBy: inviterId,
      });

      await expect(
        acceptInvitation({
          rawToken: created.rawToken,
          userId: "malicious-user-999",
          userEmail: "attacker@otherdomain.com",
        })
      ).rejects.toThrow(/Invitation was issued to/);
    });
  });

  describe("5. Idempotent Resending & Directory Listing", () => {
    it("invalidates older pending invitation when creating a new invitation for same email and tenant", async () => {
      const email = "duplicate.test@campus.edu";

      const first = await createInvitation({
        tenantId,
        email,
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const second = await createInvitation({
        tenantId,
        email,
        role: "TRAINER",
        createdBy: inviterId,
      });

      // First token should now be revoked
      const firstCheck = await getInvitationByToken(first.rawToken);
      expect(firstCheck.isValid).toBe(false);
      expect(firstCheck.error).toContain("revoked");

      // Second token should be valid
      const secondCheck = await getInvitationByToken(second.rawToken);
      expect(secondCheck.isValid).toBe(true);
      expect(secondCheck.invitation?.role).toBe("TRAINER");
    });

    it("resends an invitation with a fresh token and resets expiry", async () => {
      const email = "resend.test@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const resent = await resendInvitation({
        invitationId: created.invitation.id,
        tenantId,
        actorUserId: inviterId,
      });

      expect(resent.rawToken).not.toBe(created.rawToken);

      // Old token invalid
      const oldCheck = await getInvitationByToken(created.rawToken);
      expect(oldCheck.isValid).toBe(false);

      // New token valid
      const newCheck = await getInvitationByToken(resent.rawToken);
      expect(newCheck.isValid).toBe(true);
      expect(newCheck.invitation?.email).toBe(email);
    });

    it("lists all tenant invitations with accurate statuses", async () => {
      const email = "list.test@campus.edu";
      await createInvitation({
        tenantId,
        email,
        role: "TRAINER",
        createdBy: inviterId,
      });

      const list = await listTenantInvitations(tenantId);
      expect(list.length).toBeGreaterThan(0);
      expect(list.some((i) => i.email === email && i.role === "TRAINER")).toBe(true);
    });
  });

  describe("6. Email Adapter Resend Integration & Honest Delivery Reporting", () => {
    it("resolves APP_BASE_URL and trims trailing slashes", () => {
      process.env.APP_BASE_URL = "https://urplaced.campus.edu///";
      expect(EmailAdapter.getAppOrigin()).toBe("https://urplaced.campus.edu");
      delete process.env.APP_BASE_URL;

      expect(EmailAdapter.getAppOrigin()).toBe("http://localhost:3000");
    });

    it("resolves verified sender from RESEND_FROM_EMAIL", () => {
      process.env.RESEND_FROM_EMAIL = "Placement Office <placement@mycampus.edu>";
      expect(EmailAdapter.getSenderEmail()).toBe("Placement Office <placement@mycampus.edu>");
      delete process.env.RESEND_FROM_EMAIL;

      expect(EmailAdapter.getSenderEmail()).toBe("UrPlaced <onboarding@resend.dev>");
    });

    it("returns explicit unconfigured error when RESEND_API_KEY is missing outside test runner", async () => {
      const origVitest = process.env.VITEST;
      const origNodeEnv = process.env.NODE_ENV;
      delete process.env.VITEST;
      (process.env as any).NODE_ENV = "production";
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_API_KEY;

      const result = await EmailAdapter.sendInvitation({
        toEmail: "officer@campus.edu",
        tenantName: "Sapthagiri NPS University",
        role: "PLACEMENT_STAFF",
        inviteUrl: "http://localhost:3000/auth/college/invite/test-token",
      });

      expect(result.success).toBe(false);
      expect(result.deliveryMethod).toBe("UNCONFIGURED");
      expect(result.error).toContain("RESEND_API_KEY is not configured");

      process.env.VITEST = origVitest;
      (process.env as any).NODE_ENV = origNodeEnv;
    });

    it("reports LOCAL_DEV_SINK only when running in test runner without API key", async () => {
      delete process.env.RESEND_API_KEY;
      delete process.env.EMAIL_API_KEY;

      const result = await EmailAdapter.sendInvitation({
        toEmail: "local.sink@campus.edu",
        tenantName: "Sapthagiri NPS University",
        role: "PLACEMENT_STAFF",
        inviteUrl: "http://localhost:3000/auth/college/invite/sample-token",
      });

      expect(result.success).toBe(true);
      expect(result.deliveryMethod).toBe("LOCAL_DEV_SINK");
      expect(result.messageId).toContain("test-sink-");
    });
  });

  describe("7. API Route Endpoints & Account Activation Flow", () => {
    it("handles GET /api/auth/invite returning invitation metadata", async () => {
      const created = await createInvitation({
        tenantId,
        email: "api.metadata@campus.edu",
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const { GET: inviteGetHandler } = await import("@/app/api/auth/invite/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest(`http://localhost:3000/api/auth/invite?token=${created.rawToken}`);
      const res = await inviteGetHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.valid).toBe(true);
      expect(json.email).toBe("api.metadata@campus.edu");
      expect(json.role).toBe("PLACEMENT_STAFF");
      expect(json.tenantName).toBe("Sapthagiri NPS University");
    });

    it("handles POST /api/auth/invite for new user setting password and activating", async () => {
      const email = "new.staff.activation@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const { POST: invitePostHandler } = await import("@/app/api/auth/invite/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: created.rawToken,
          fullName: "Priya Sharma",
          password: "SecureStaffPassword123!",
        }),
      });

      const res = await invitePostHandler(req);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.role).toBe("PLACEMENT_STAFF");
      expect(json.tenantId).toBe(tenantId);

      // Verify the user was created in auth.users
      expect(mockUsers.some((u) => u.email === email)).toBe(true);

      // Verify token cannot be re-used
      const checkConsumed = await getInvitationByToken(created.rawToken);
      expect(checkConsumed.isValid).toBe(false);
    });

    it("rejects password less than 8 characters for new user activation", async () => {
      const email = "short.password@campus.edu";
      const created = await createInvitation({
        tenantId,
        email,
        role: "TRAINER",
        createdBy: inviterId,
      });

      const { POST: invitePostHandler } = await import("@/app/api/auth/invite/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: created.rawToken,
          fullName: "Short Pass",
          password: "short",
        }),
      });

      const res = await invitePostHandler(req);
      const json = await res.json();

      expect(res.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toContain("at least 8 characters");
    });

    it("strictly blocks a Student account from accepting a staff role", async () => {
      const studentEmail = "existing.student@campus.edu";
      mockUsers.push({
        id: "existing-student-uid",
        email: studentEmail,
        app_metadata: { account_category: "STUDENT", role: "STUDENT" },
        user_metadata: { account_category: "STUDENT", role: "STUDENT" },
      });

      const created = await createInvitation({
        tenantId,
        email: studentEmail,
        role: "PLACEMENT_STAFF",
        createdBy: inviterId,
      });

      const { POST: invitePostHandler } = await import("@/app/api/auth/invite/route");
      const { NextRequest } = await import("next/server");

      const req = new NextRequest("http://localhost:3000/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: created.rawToken,
          password: "AnyPassword123!",
        }),
      });

      const res = await invitePostHandler(req);
      const json = await res.json();

      expect(res.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toContain("Student account");
    });
  });

  describe("8. College Sign-In Route Destination Resolution", () => {
    it("routes PLACEMENT_STAFF and PLACEMENT_HEAD to /dashboard and TRAINER to /dashboard/training", () => {
      function resolveLandingRoute(role: string, next?: string): string {
        if (next && !next.startsWith("/dashboard/student")) {
          return next;
        }
        if (role === "TRAINER") {
          return "/dashboard/training";
        }
        return "/dashboard";
      }

      expect(resolveLandingRoute("PLACEMENT_STAFF")).toBe("/dashboard");
      expect(resolveLandingRoute("PLACEMENT_HEAD")).toBe("/dashboard");
      expect(resolveLandingRoute("TRAINER")).toBe("/dashboard/training");
      expect(resolveLandingRoute("TRAINER", "/dashboard/training/cohorts")).toBe("/dashboard/training/cohorts");
    });
  });
});
