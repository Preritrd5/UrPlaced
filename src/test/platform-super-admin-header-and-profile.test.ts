import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase Admin & Server Clients
const mockAdminUser = {
  id: "admin-super-uuid-1",
  email: "urplaced5@gmail.com",
  app_metadata: {
    role: "SUPER_ADMIN",
    aal: "aal2",
  },
  user_metadata: {
    full_name: "Platform Super Admin",
  },
};

const mockProfile = {
  id: "admin-super-uuid-1",
  email: "urplaced5@gmail.com",
  full_name: "Platform Super Admin",
  is_platform_admin: true,
  avatar_url: "admin-super-uuid-1/avatar.png",
  phone: "+91 99999 88888",
  location: "Bengaluru, India",
  bio: "Platform Super Admin managing multi-tenant SaaS infrastructure.",
  preferences: {
    theme: "light",
    landingPage: "/preritrd/dashboard",
  },
};

const mockAdminRecord = {
  id: "admin-super-uuid-1",
  email: "urplaced5@gmail.com",
  full_name: "Platform Super Admin",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  mfa_enabled: true,
  mfa_enforced: true,
  last_sign_in_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
};

const mockNotifications = [
  {
    id: "notif-1",
    recipient_user_id: "admin-super-uuid-1",
    college_id: null,
    source: "PLATFORM_EVENT",
    type: "SECURITY_EVENT",
    title: "MFA Verified (AAL2)",
    body: "Session elevated to cryptographic AAL2 assurance.",
    action_url: "/preritrd/profile#security",
    read_at: null,
    created_at: new Date().toISOString(),
  },
  {
    id: "notif-2",
    recipient_user_id: "admin-super-uuid-1",
    college_id: null,
    source: "PLATFORM_EVENT",
    type: "SERVICE_INCIDENT",
    title: "System Health Checks Normal",
    body: "All platform control plane nodes operating normally.",
    action_url: "/preritrd/system-health",
    read_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === "valid-admin-token") {
          return { data: { user: mockAdminUser }, error: null };
        }
        return { data: { user: null }, error: new Error("Invalid token") };
      }),
      admin: {
        updateUserById: vi.fn().mockResolvedValue({ data: { user: mockAdminUser }, error: null }),
        getUserById: vi.fn().mockResolvedValue({ data: { user: mockAdminUser }, error: null }),
      },
      signInWithPassword: vi.fn().mockResolvedValue({ data: { user: mockAdminUser }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockProfile, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "platform_admins") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: mockAdminRecord, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === "notifications") {
        const queryBuilder: any = {};
        queryBuilder.select = vi.fn((cols?: string, opts?: any) => {
          if (opts?.head) {
            return {
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              then: (resolve: any) => resolve({ count: 1, error: null }),
            };
          }
          return queryBuilder;
        });
        queryBuilder.eq = vi.fn().mockReturnThis();
        queryBuilder.is = vi.fn().mockReturnThis();
        queryBuilder.order = vi.fn().mockReturnThis();
        queryBuilder.range = vi.fn().mockResolvedValue({ data: mockNotifications, count: 2, error: null });
        queryBuilder.update = vi.fn().mockReturnValue(queryBuilder);
        queryBuilder.insert = vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ data: mockNotifications, error: null }),
        });
        queryBuilder.then = (resolve: any) => resolve({ data: [{ id: "notif-1" }], error: null });

        return queryBuilder;
      }
      if (table === "audit_logs") {
        return {
          select: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockResolvedValue({
            data: [
              {
                id: "audit-1",
                action: "SUPER_ADMIN_MFA_VERIFIED",
                actor_id: "admin-super-uuid-1",
                resource_type: "PLATFORM_AUTH",
                metadata: {},
                created_at: new Date().toISOString(),
              },
            ],
            count: 1,
            error: null,
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "platform_settings") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
    storage: {
      getBucket: vi.fn().mockResolvedValue({ data: { id: "avatars", public: false }, error: null }),
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "admin-super-uuid-1/avatar.png" }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({
          data: { signedUrl: "https://mock.supabase.co/storage/v1/object/sign/avatars/admin/avatar.png?token=sig" },
          error: null,
        }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: mockAdminUser }, error: null })),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({
          data: { totp: [{ id: "factor-totp-1", status: "verified" }] },
          error: null,
        }),
      },
    },
  }),
}));

import { PlatformNotificationService } from "@/modules/platform-admin/services/platform-notification-service";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { GET as getNotificationsHandler } from "@/app/api/preritrd/notifications/route";
import { PATCH as markNotificationReadHandler } from "@/app/api/preritrd/notifications/[id]/read/route";
import { POST as markAllNotificationsReadHandler } from "@/app/api/preritrd/notifications/read-all/route";
import { GET as getProfileHandler, PATCH as patchProfileHandler } from "@/app/api/preritrd/profile/route";
import { POST as changePasswordHandler } from "@/app/api/preritrd/profile/password/route";
import { DELETE as deleteAvatarHandler } from "@/app/api/preritrd/profile/avatar/route";

describe("Platform Super Admin Header, Notifications & Profile Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Platform Control-Plane Notification Isolation (Strict Option A)", () => {
    it("retrieves notifications strictly isolated to college_id IS NULL", async () => {
      const result = await PlatformNotificationService.listNotifications("admin-super-uuid-1");
      expect(result.notifications).toBeDefined();
      expect(result.notifications.length).toBeGreaterThan(0);
      expect(result.unreadCount).toBeGreaterThanOrEqual(0);

      // Verify each notification has college_id === null
      result.notifications.forEach((n) => {
        expect((n as any).college_id).toBeUndefined(); // or null in DB
        expect(n.source).toBe("PLATFORM_EVENT");
      });
    });

    it("GET /api/preritrd/notifications returns 200 with platform alerts", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/notifications", {
        headers: { Authorization: "Bearer valid-admin-token" },
      });
      const res = await getNotificationsHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.notifications)).toBe(true);
      expect(typeof data.unreadCount).toBe("number");
    });

    it("PATCH /api/preritrd/notifications/[id]/read marks individual notification read", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/notifications/notif-1/read", {
        headers: { Authorization: "Bearer valid-admin-token" },
      });
      const res = await markNotificationReadHandler(req, {
        params: Promise.resolve({ id: "notif-1" }),
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("POST /api/preritrd/notifications/read-all marks all unread notifications read", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/notifications/read-all", {
        headers: { Authorization: "Bearer valid-admin-token" },
      });
      const res = await markAllNotificationsReadHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("PATCH /api/preritrd/notifications/preferences enforces non-suppressible security alerts", async () => {
      const { PATCH: updatePrefsHandler } = await import("@/app/api/preritrd/notifications/preferences/route");
      const req = new NextRequest("http://localhost:3000/api/preritrd/notifications/preferences", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-admin-token",
        },
        body: JSON.stringify({
          inApp: {
            SECURITY_LOGIN: false, // Attempt to suppress critical security alert
            SECURITY_MFA: false,
            COLLEGE_REGISTRATION: false,
          },
        }),
      });

      const res = await updatePrefsHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      // Non-suppressible security alerts must remain true
      expect(data.preferences.inApp.SECURITY_LOGIN).toBe(true);
      expect(data.preferences.inApp.SECURITY_MFA).toBe(true);
      // Non-security category allowed to be toggled off
      expect(data.preferences.inApp.COLLEGE_REGISTRATION).toBe(false);
    });
  });

  describe("2. Super Admin Profile API & Strict Option A Security", () => {
    it("GET /api/preritrd/profile returns complete admin identity, readiness & recent activity", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/profile", {
        headers: { Authorization: "Bearer valid-admin-token" },
      });
      const res = await getProfileHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.admin.id).toBe("admin-super-uuid-1");
      expect(data.admin.role).toBe("SUPER_ADMIN");
      expect(data.admin.email).toBe("urplaced5@gmail.com");
      expect(data.readiness).toBeDefined();
      expect(data.readiness.mfaEnrolled).toBe(true);
      expect(data.mfa.assuranceLevel).toBe("aal2");
      expect(Array.isArray(data.recentActivity)).toBe(true);
    });

    it("PATCH /api/preritrd/profile updates personal details (fullName, phone, bio)", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-admin-token",
        },
        body: JSON.stringify({
          fullName: "Platform Lead Admin",
          phone: "+91 91234 56789",
          location: "Bengaluru, Karnataka",
          bio: "Updated Super Admin biography.",
        }),
      });

      const res = await patchProfileHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.admin.fullName).toBe("Platform Lead Admin");
    });

    it("PATCH /api/preritrd/profile strictly rejects tampering with platform privileges or role", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-admin-token",
        },
        body: JSON.stringify({
          fullName: "Attacker",
          isPlatformAdmin: false,
          role: "STUDENT",
        }),
      });

      const res = await patchProfileHandler(req);
      expect(res.status).toBe(403);

      const data = await res.json();
      expect(data.error).toContain("FORBIDDEN");
    });
  });

  describe("3. Security Credentials & Avatar Operations", () => {
    it("POST /api/preritrd/profile/password validates and updates password through Supabase Auth", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/profile/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-admin-token",
        },
        body: JSON.stringify({
          currentPassword: "OldPassword123!",
          newPassword: "SuperSecureNewPassword2026#",
          confirmPassword: "SuperSecureNewPassword2026#",
        }),
      });

      const res = await changePasswordHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it("POST /api/preritrd/profile/password rejects mismatched confirmation password", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/profile/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer valid-admin-token",
        },
        body: JSON.stringify({
          currentPassword: "OldPassword123!",
          newPassword: "Password123!",
          confirmPassword: "DifferentPassword123!",
        }),
      });

      const res = await changePasswordHandler(req);
      expect(res.status).toBe(400);

      const data = await res.json();
      expect(data.error).toContain("do not match");
    });

    it("DELETE /api/preritrd/profile/avatar safely removes avatar and resets profile reference", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/profile/avatar", {
        method: "DELETE",
        headers: {
          Authorization: "Bearer valid-admin-token",
        },
      });

      const res = await deleteAvatarHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });
});
