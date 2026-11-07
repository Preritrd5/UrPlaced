import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { PlatformConfigService } from "@/modules/platform-admin/services/platform-config-service";
import { MaintenanceModeError, requireAuthContext } from "@/lib/auth/server-context";
import { middleware } from "@/middleware";

// Mock Supabase admin & server
const mockPlatformSettings: Record<string, any> = {
  maintenance_mode: {
    key: "maintenance_mode",
    value: {
      enabled: false,
      message: "UrPlaced is performing scheduled maintenance.",
      scheduledEnd: null,
    },
    category: "system",
    description: "Global maintenance mode switch",
    updated_by: "super-admin-uuid",
    updated_at: new Date().toISOString(),
  },
};

const mockSuperAdminUser = {
  id: "super-admin-uuid-1",
  email: "admin@urplaced.internal",
  app_metadata: {
    is_platform_admin: true,
    role: "SUPER_ADMIN",
    account_category: "SUPER_ADMIN",
    verified_by_server: true,
  },
  user_metadata: {
    full_name: "UrPlaced Super Admin",
  },
};

const mockPlacementHeadUser = {
  id: "placement-head-uuid-1",
  email: "head@cambridge.edu",
  app_metadata: {
    is_platform_admin: false,
    role: "PLACEMENT_HEAD",
    account_category: "INSTITUTION_STAFF",
    tenant_id: "tenant-cambridge-01",
    verified_by_server: true,
  },
  user_metadata: {
    full_name: "Prof. Charles",
  },
};

const mockStudentUser = {
  id: "student-uuid-1",
  email: "student@cambridge.edu",
  app_metadata: {
    is_platform_admin: false,
    role: "STUDENT",
    account_category: "STUDENT",
    tenant_id: "tenant-cambridge-01",
    verified_by_server: true,
  },
  user_metadata: {
    full_name: "Alice Student",
  },
};

const mockAdminClient = {
  from: vi.fn((table: string) => ({
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn(function (this: any, col: string, val: any) {
      this._filterCol = col;
      this._filterVal = val;
      return this;
    }),
    single: vi.fn(async function (this: any) {
      if (table === "platform_settings") {
        const item = mockPlatformSettings[this._filterVal];
        return { data: item || null, error: item ? null : new Error("Not found") };
      }
      return { data: null, error: null };
    }),
    maybeSingle: vi.fn(async function (this: any) {
      if (table === "platform_settings") {
        const item = mockPlatformSettings[this._filterVal];
        return { data: item || null, error: null };
      }
      return { data: null, error: null };
    }),
    update: vi.fn(function (this: any, updates: any) {
      this._updates = updates;
      return {
        eq: vi.fn((col: string, val: any) => ({
          select: vi.fn(() => ({
            single: vi.fn(async () => {
              if (table === "platform_settings") {
                if (!mockPlatformSettings[val]) {
                  mockPlatformSettings[val] = { key: val, category: "system" };
                }
                mockPlatformSettings[val] = {
                  ...mockPlatformSettings[val],
                  ...updates,
                  updated_at: new Date().toISOString(),
                };
                return { data: mockPlatformSettings[val], error: null };
              }
              return { data: null, error: null };
            }),
          })),
        })),
      };
    }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
  auth: {
    getUser: vi.fn(async (jwt?: string) => {
      if (jwt?.includes("super-admin")) {
        return { data: { user: mockSuperAdminUser }, error: null };
      }
      if (jwt?.includes("placement-head")) {
        return { data: { user: mockPlacementHeadUser }, error: null };
      }
      if (jwt?.includes("student")) {
        return { data: { user: mockStudentUser }, error: null };
      }
      return { data: { user: null }, error: new Error("Unauthorized") };
    }),
  },
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => mockAdminClient),
}));

let currentServerUser: any = mockPlacementHeadUser;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async (explicitToken?: string) => ({
    auth: {
      getUser: vi.fn(async (jwt?: string) => {
        const token = jwt || explicitToken;
        if (token?.includes("super-admin")) return { data: { user: mockSuperAdminUser }, error: null };
        if (token?.includes("placement-head")) return { data: { user: mockPlacementHeadUser }, error: null };
        if (token?.includes("student")) return { data: { user: mockStudentUser }, error: null };
        return { data: { user: currentServerUser }, error: currentServerUser ? null : { message: "No session" } };
      }),
    },
  })),
}));

vi.mock("@/modules/tenancy/services/membership-service", () => ({
  MembershipService: {
    listUserMemberships: vi.fn(async (userId: string) => {
      if (userId === mockPlacementHeadUser.id) {
        return [
          {
            id: "membership-head-1",
            tenant_id: "tenant-cambridge-01",
            user_id: userId,
            role: "PLACEMENT_HEAD",
            status: "ACTIVE",
            tenants: { id: "tenant-cambridge-01", name: "Cambridge Institute", status: "ACTIVE" },
          },
        ];
      }
      if (userId === mockStudentUser.id) {
        return [
          {
            id: "membership-student-1",
            tenant_id: "tenant-cambridge-01",
            user_id: userId,
            role: "STUDENT",
            status: "ACTIVE",
            tenants: { id: "tenant-cambridge-01", name: "Cambridge Institute", status: "ACTIVE" },
          },
        ];
      }
      return [];
    }),
  },
}));

vi.mock("@/modules/platform-admin/services/platform-auth-service", () => ({
  PlatformAuthService: {
    logAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
    requireSuperAdmin: vi.fn(async () => mockSuperAdminUser),
  },
}));

describe("GLOBAL MAINTENANCE MODE — Full-Screen Lockdown & Tenant Access Enforcement", () => {
  beforeEach(() => {
    PlatformConfigService.invalidateMaintenanceCache();
    mockPlatformSettings["maintenance_mode"] = {
      key: "maintenance_mode",
      value: {
        enabled: false,
        message: "UrPlaced is performing scheduled maintenance.",
        scheduledEnd: null,
      },
      category: "system",
      description: "Global maintenance mode switch",
      updated_by: "super-admin-uuid",
      updated_at: new Date().toISOString(),
    };
    currentServerUser = mockPlacementHeadUser;
  });

  afterEach(() => {
    PlatformConfigService.invalidateMaintenanceCache();
    vi.restoreAllMocks();
  });

  it("1. Verification: Maintenance OFF — Placement Head and Student have full normal access", async () => {
    const status = await PlatformConfigService.getMaintenanceStatus(mockAdminClient as any, true);
    expect(status.enabled).toBe(false);

    // Server context resolution completes successfully without throwing MaintenanceModeError
    currentServerUser = mockPlacementHeadUser;
    const ctx = await requireAuthContext(undefined, "tenant-cambridge-01", "token-placement-head");
    expect(ctx.userId).toBe(mockPlacementHeadUser.id);
    expect(ctx.tenantRole).toBe("PLACEMENT_HEAD");
  });

  it("2. Verification: Maintenance ON — Super Admin updates announcement and toggles mode", async () => {
    const customAnnouncement = "Scheduled Database Migration & Security Upgrades in progress.";
    const updated = await PlatformConfigService.updateSetting({
      key: "maintenance_mode",
      value: {
        enabled: true,
        message: customAnnouncement,
        scheduledEnd: "2026-11-08T00:00:00Z",
      },
      adminId: mockSuperAdminUser.id,
      admin: mockAdminClient as any,
    });

    expect(updated.value.enabled).toBe(true);
    expect(updated.value.message).toBe(customAnnouncement);

    // Verify cache immediately reflects the updated state without database latency
    const status = await PlatformConfigService.getMaintenanceStatus(mockAdminClient as any);
    expect(status.enabled).toBe(true);
    expect(status.message).toBe(customAnnouncement);
  });

  it("3. Verification: Maintenance ON — Placement Head is strictly locked out with MaintenanceModeError", async () => {
    mockPlatformSettings["maintenance_mode"].value = {
      enabled: true,
      message: "UrPlaced platform maintenance in progress.",
    };
    PlatformConfigService.invalidateMaintenanceCache();

    currentServerUser = mockPlacementHeadUser;
    await expect(
      requireAuthContext(undefined, "tenant-cambridge-01", "token-placement-head")
    ).rejects.toThrowError(MaintenanceModeError);

    try {
      await requireAuthContext(undefined, "tenant-cambridge-01", "token-placement-head");
    } catch (err: any) {
      expect(err).toBeInstanceOf(MaintenanceModeError);
      expect(err.status).toBe(503);
      expect(err.code).toBe("MAINTENANCE_ACTIVE");
      expect(err.announcement).toContain("UrPlaced platform maintenance");
    }
  });

  it("4. Verification: Maintenance ON — Student is strictly locked out with MaintenanceModeError", async () => {
    mockPlatformSettings["maintenance_mode"].value = {
      enabled: true,
      message: "Student portal undergoing scheduled updates.",
    };
    PlatformConfigService.invalidateMaintenanceCache();

    currentServerUser = mockStudentUser;
    await expect(
      requireAuthContext(undefined, "tenant-cambridge-01", "token-student")
    ).rejects.toThrowError(MaintenanceModeError);

    try {
      await requireAuthContext(undefined, "tenant-cambridge-01", "token-student");
    } catch (err: any) {
      expect(err).toBeInstanceOf(MaintenanceModeError);
      expect(err.status).toBe(503);
      expect(err.code).toBe("MAINTENANCE_ACTIVE");
    }
  });

  it("5. Verification: Maintenance ON — Super Admin retains unrestricted access through requireAuthContext", async () => {
    mockPlatformSettings["maintenance_mode"].value = {
      enabled: true,
      message: "Global maintenance active.",
    };
    PlatformConfigService.invalidateMaintenanceCache();

    currentServerUser = mockSuperAdminUser;
    // Super admin passes through without being blocked by maintenance
    const ctx = await requireAuthContext(undefined, undefined, "token-super-admin");
    expect(ctx.isPlatformAdmin).toBe(true);
    expect(ctx.userId).toBe(mockSuperAdminUser.id);
  });

  it("6. Verification: Maintenance ON — Middleware intercepts tenant API requests with HTTP 503", async () => {
    // Mock global fetch to return maintenance_mode = true for middleware edge check
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url: any) => {
      if (typeof url === "string" && url.includes("platform_settings?key=eq.maintenance_mode")) {
        return {
          ok: true,
          json: async () => [
            {
              value: {
                enabled: true,
                message: "Maintenance Mode is Active. All services paused.",
              },
            },
          ],
        } as any;
      }
      return originalFetch(url);
    });

    try {
      const tenantApiUrl = new URL("https://urplaced.internal/api/student/dashboard");
      const request = new NextRequest(tenantApiUrl, {
        headers: {
          authorization: "Bearer dummy-student-token",
        },
      });

      const res = await middleware(request);
      expect(res.status).toBe(503);
      expect(res.headers.get("X-Maintenance-Mode")).toBe("active");
      expect(res.headers.get("Retry-After")).toBe("300");

      const body = await res.json();
      expect(body.error).toBe("SERVICE_UNAVAILABLE");
      expect(body.maintenance).toBe(true);
      expect(body.announcement).toContain("Maintenance Mode is Active");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("7. Verification: Maintenance ON — Middleware rewrites /dashboard direct URL to /maintenance", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url: any) => {
      if (typeof url === "string" && url.includes("platform_settings?key=eq.maintenance_mode")) {
        return {
          ok: true,
          json: async () => [
            {
              value: {
                enabled: true,
                message: "Platform upgrade in progress.",
              },
            },
          ],
        } as any;
      }
      return originalFetch(url);
    });

    try {
      const dashboardUrl = new URL("https://urplaced.internal/dashboard/student");
      const request = new NextRequest(dashboardUrl, {
        headers: {
          authorization: "Bearer dummy-student-token",
        },
      });

      const res = await middleware(request);
      // Middleware rewrites to /maintenance and sets maintenance header
      expect(res.headers.get("X-Maintenance-Mode")).toBe("active");
      expect(res.headers.get("x-middleware-rewrite")).toContain("/maintenance");
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("8. Verification: Maintenance ON — Critical integrations remain exempt and accessible", async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (url: any) => {
      if (typeof url === "string" && url.includes("platform_settings?key=eq.maintenance_mode")) {
        return {
          ok: true,
          json: async () => [
            {
              value: {
                enabled: true,
                message: "Platform upgrade in progress.",
              },
            },
          ],
        } as any;
      }
      return originalFetch(url);
    });

    try {
      // 1. Razorpay webhook
      const webhookUrl = new URL("https://urplaced.internal/api/billing/webhook");
      const webhookReq = new NextRequest(webhookUrl, { method: "POST" });
      const webhookRes = await middleware(webhookReq);
      expect(webhookRes.status).not.toBe(503);

      // 2. Super Admin Control Plane API
      const superAdminApiUrl = new URL("https://urplaced.internal/api/preritrd/configuration");
      const superAdminReq = new NextRequest(superAdminApiUrl);
      const superAdminRes = await middleware(superAdminReq);
      expect(superAdminRes.status).not.toBe(503);

      // 3. Super Admin UI Control Plane
      const superAdminUiUrl = new URL("https://urplaced.internal/preritrd/configuration");
      const superAdminUiReq = new NextRequest(superAdminUiUrl);
      const superAdminUiRes = await middleware(superAdminUiReq);
      expect(superAdminUiRes.headers.get("x-middleware-rewrite")).toBeNull();

      // 4. Platform Maintenance Status Polling Endpoint
      const maintenanceStatusUrl = new URL("https://urplaced.internal/api/platform/maintenance");
      const maintenanceStatusReq = new NextRequest(maintenanceStatusUrl);
      const maintenanceStatusRes = await middleware(maintenanceStatusReq);
      expect(maintenanceStatusRes.status).not.toBe(503);

      // 5. Auth Signout
      const signoutUrl = new URL("https://urplaced.internal/api/auth/signout");
      const signoutReq = new NextRequest(signoutUrl, { method: "POST" });
      const signoutRes = await middleware(signoutReq);
      expect(signoutRes.status).not.toBe(503);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("9. Verification: Maintenance OFF — Disabling maintenance mode immediately restores normal platform operations", async () => {
    // 1. Super Admin toggles maintenance OFF
    await PlatformConfigService.updateSetting({
      key: "maintenance_mode",
      value: {
        enabled: false,
        message: "",
        scheduledEnd: null,
      },
      adminId: mockSuperAdminUser.id,
      admin: mockAdminClient as any,
    });

    const status = await PlatformConfigService.getMaintenanceStatus(mockAdminClient as any);
    expect(status.enabled).toBe(false);

    // 2. Placement Head server context resolution resumes immediately
    currentServerUser = mockPlacementHeadUser;
    const ctx = await requireAuthContext(undefined, "tenant-cambridge-01", "token-placement-head");
    expect(ctx.userId).toBe(mockPlacementHeadUser.id);
    expect(ctx.tenantRole).toBe("PLACEMENT_HEAD");
  });

  it("10. Verification: Super Admin can update the broadcast message dynamically while active", async () => {
    // Initial active message
    await PlatformConfigService.updateSetting({
      key: "maintenance_mode",
      value: {
        enabled: true,
        message: "Message Phase 1",
      },
      adminId: mockSuperAdminUser.id,
      admin: mockAdminClient as any,
    });
    expect((await PlatformConfigService.getMaintenanceStatus()).message).toBe("Message Phase 1");

    // Dynamic update without restarting or redeploying
    await PlatformConfigService.updateSetting({
      key: "maintenance_mode",
      value: {
        enabled: true,
        message: "Message Phase 2: Finishing database index rebuilds.",
      },
      adminId: mockSuperAdminUser.id,
      admin: mockAdminClient as any,
    });
    expect((await PlatformConfigService.getMaintenanceStatus()).message).toBe(
      "Message Phase 2: Finishing database index rebuilds."
    );
  });
});
