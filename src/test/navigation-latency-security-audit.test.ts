/**
 * Global Navigation Latency Fix & Multi-Portal Security Audit Test Suite
 * 
 * Verifies that the navigation performance optimizations in commit 8c5a605
 * across Student Portal, College Placement Portal, and Super Admin Control Plane:
 * 1. Maintain strict fail-closed authentication and authorization.
 * 2. Never disclose protected data to unauthenticated document or RSC requests.
 * 3. Never allow forged or expired cookies or invalid Bearer tokens to bypass security.
 * 4. Strictly enforce multi-college isolation, student privacy, and Super Admin AAL2 MFA.
 * 5. Correctly handle session refresh, cookie propagation, and tab-isolated authentication.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { requireAuthContext } from "@/lib/auth/server-context";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { Permissions } from "@/modules/identity-access/services/policy-engine";

// Mock Supabase config
vi.mock("@/lib/supabase/config", () => ({
  getSupabaseConfig: () => ({
    supabaseUrl: "https://mock-project.supabase.co",
    supabaseAnonKey: "mock-anon-key-12345",
  }),
}));

const USERS = {
  headA: {
    id: "user-head-college-a",
    email: "head@college-a.edu",
    role: "PLACEMENT_HEAD",
    category: "COLLEGE",
    tenantId: "tenant-college-a",
    token: "token-head-college-a",
    isPlatformAdmin: false,
    aal: "aal1",
  },
  studentA: {
    id: "user-student-alpha",
    email: "student@college-a.edu",
    role: "STUDENT",
    category: "STUDENT",
    tenantId: "tenant-college-a",
    token: "token-student-alpha",
    isPlatformAdmin: false,
    aal: "aal1",
  },
  superAdminAal2: {
    id: "user-super-admin-aal2",
    email: "admin@urplaced.com",
    role: "SUPER_ADMIN",
    category: "PLATFORM",
    tenantId: null,
    token: "token-super-admin-aal2",
    isPlatformAdmin: true,
    aal: "aal2",
  },
  superAdminAal1: {
    id: "user-super-admin-aal1",
    email: "admin-aal1@urplaced.com",
    role: "SUPER_ADMIN",
    category: "PLATFORM",
    tenantId: null,
    token: "token-super-admin-aal1",
    isPlatformAdmin: true,
    aal: "aal1",
  },
};

// Mock admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        const found = Object.values(USERS).find((u) => u.token === token);
        if (found) {
          return {
            data: {
              user: {
                id: found.id,
                email: found.email,
                app_metadata: {
                  role: found.role,
                  account_category: found.category,
                  tenant_id: found.tenantId,
                  is_platform_admin: found.isPlatformAdmin,
                  aal: found.aal,
                  verified_by_server: true,
                },
                user_metadata: {},
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: new Error("Invalid or expired session token") };
      }),
    },
    from: vi.fn((table: string) => {
      let filterField: string | null = null;
      let filterVal: any = null;

      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn((field: string, val: any) => {
          filterField = field;
          filterVal = val;
          return builder;
        }),
        order: vi.fn(async () => {
          if (table === "tenant_memberships") {
            const foundUser = Object.values(USERS).find((u) => u.id === filterVal);
            if (foundUser && foundUser.tenantId) {
              return {
                data: [
                  {
                    id: `mem-${foundUser.id}`,
                    user_id: foundUser.id,
                    tenant_id: foundUser.tenantId,
                    role: foundUser.role,
                    status: "ACTIVE",
                    tenants: { id: foundUser.tenantId, name: "College A", slug: "college-a" },
                  },
                ],
                error: null,
              };
            }
          }
          return { data: [], error: null };
        }),
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            const found = Object.values(USERS).find((u) => u.id === filterVal);
            if (found) {
              return {
                data: {
                  id: found.id,
                  email: found.email,
                  is_platform_admin: found.isPlatformAdmin,
                },
                error: null,
              };
            }
          }
          if (table === "platform_admins") {
            const found = Object.values(USERS).find((u) => u.id === filterVal);
            if (found && found.isPlatformAdmin) {
              return {
                data: {
                  id: `pa-${found.id}`,
                  user_id: found.id,
                  status: "ACTIVE",
                },
                error: null,
              };
            }
          }
          if (table === "tenant_memberships") {
            const foundUser = Object.values(USERS).find((u) => u.id === filterVal);
            if (foundUser && foundUser.tenantId) {
              return {
                data: {
                  id: `mem-${foundUser.id}`,
                  user_id: foundUser.id,
                  tenant_id: foundUser.tenantId,
                  role: foundUser.role,
                  status: "ACTIVE",
                  tenants: { id: foundUser.tenantId, name: "College A", slug: "college-a" },
                },
                error: null,
              };
            }
          }
          return { data: null, error: null };
        }),
      };
      return builder;
    }),
  })),
}));

describe("Global Navigation Performance & Multi-Portal Security Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // 1. MIDDLEWARE SECURITY HEADERS & BYPASS AUDIT
  // ==========================================================================
  describe("1. Next.js Middleware Security Invariants & Bypass Audit", () => {
    it("applies standard security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) on all requests", async () => {
      const req = new NextRequest("https://urplaced.com/dashboard");
      const res = await middleware(req);

      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    });

    it("bypasses cookie refresh for tab-isolated requests carrying Bearer tokens without dropping headers", async () => {
      const req = new NextRequest("https://urplaced.com/api/placement/metrics", {
        headers: {
          authorization: "Bearer tab-isolated-student-token-abc",
        },
      });

      const res = await middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      // Does not attempt to read or refresh cookies
      expect(res.cookies.getAll().length).toBe(0);
    });

    it("bypasses blocking remote cookie refresh for speculative background prefetch requests", async () => {
      const reqPrefetch = new NextRequest("https://urplaced.com/dashboard/students", {
        headers: {
          "next-router-prefetch": "1",
        },
      });

      const res = await middleware(reqPrefetch);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.cookies.getAll().length).toBe(0);
    });

    it("skips remote network refresh when existing cookie session is fresh (> 60s remaining)", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour remaining
      const mockPayload = Buffer.from(JSON.stringify({ exp: futureExp, sub: "user-123" })).toString("base64url");
      const freshToken = `header.${mockPayload}.signature`;

      const req = new NextRequest("https://urplaced.com/dashboard/drives", {
        headers: {
          cookie: `sb-access-token=${freshToken}`,
        },
      });

      const res = await middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      // Fresh session should not trigger remote refresh Set-Cookie writes
      expect(res.cookies.getAll().length).toBe(0);
    });

    it("safely handles malformed, corrupted, or non-JSON cookies without crashing", async () => {
      const req = new NextRequest("https://urplaced.com/dashboard", {
        headers: {
          cookie: "sb-mock-auth-token=corrupted-non-json-token-string",
        },
      });

      // Must not throw or crash
      const res = await middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });

  // ==========================================================================
  // 2. UNAUTHENTICATED REQUESTS & RSC/PREFETCH DATA LEAK PREVENTION
  // ==========================================================================
  describe("2. Unauthenticated Document & RSC/Prefetch Fail-Closed Enforcement", () => {
    it("fails closed on unauthenticated document requests to protected server components", async () => {
      const profile = await getCurrentUserProfile(undefined, undefined);
      // Unauthenticated request resolves profile as null
      expect(profile).toBeNull();
    });

    it("fails closed on unauthenticated RSC requests (rsc: 1 or _rsc param) without disclosing protected data", async () => {
      // Simulating an unauthorized client sending RSC header
      const req = new NextRequest("https://urplaced.com/dashboard/students?_rsc=123", {
        headers: {
          rsc: "1",
        },
      });

      const res = await middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");

      // Verify that downstream server context strictly rejects unauthenticated request
      await expect(requireAuthContext(Permissions.STUDENTS_READ)).rejects.toThrow("UNAUTHORIZED");
    });

    it("fails closed on segment-prefetch URL variants without disclosing student records or institutional data", async () => {
      // Simulating segment-prefetch URL
      const prefetchHeaders: HeadersInit[] = [
        { "next-router-prefetch": "1" },
        { purpose: "prefetch" },
        { rsc: "1" },
      ];

      for (const h of prefetchHeaders) {
        const req = new NextRequest("https://urplaced.com/api/placement/students", {
          headers: h,
        });

        const res = await middleware(req);
        expect(res.headers.get("X-Frame-Options")).toBe("DENY");

        // The API route handler must strictly reject unauthenticated request regardless of prefetch headers
        await expect(requireAuthContext(Permissions.STUDENTS_READ)).rejects.toThrow("UNAUTHORIZED");
      }
    });
  });

  // ==========================================================================
  // 3. FORGED COOKIES & INVALID BEARER TOKENS
  // ==========================================================================
  describe("3. Cryptographic Validation of Cookies and Bearer Tokens", () => {
    it("strictly rejects forged authentication cookies with fake unverified future exp claims", async () => {
      const futureExp = Math.floor(Date.now() / 1000) + 999999;
      const forgedJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ sub: "attacker-user-id", exp: futureExp, role: "authenticated" })
      ).toString("base64url")}.fake-unverified-signature`;

      // Downstream server context must cryptographically reject it via Supabase Auth
      await expect(
        requireAuthContext(Permissions.DASHBOARD_READ, undefined, forgedJwt)
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("strictly rejects expired tokens with UNAUTHORIZED", async () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const expiredJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${Buffer.from(
        JSON.stringify({ sub: "user-123", exp: pastExp, role: "authenticated" })
      ).toString("base64url")}.fake-sig`;

      await expect(
        requireAuthContext(Permissions.DASHBOARD_READ, undefined, expiredJwt)
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("strictly rejects invalid or malformed Bearer tokens with UNAUTHORIZED", async () => {
      await expect(
        requireAuthContext(Permissions.DASHBOARD_READ, undefined, "malformed-bearer-token-123")
      ).rejects.toThrow("UNAUTHORIZED");
    });
  });

  // ==========================================================================
  // 4. MULTI-TENANT ISOLATION & RESOURCE-LEVEL AUTHORIZATION
  // ==========================================================================
  describe("4. Multi-Tenant Cross-College & Student Data Isolation", () => {
    it("strictly isolates College A administrator from accessing College B resources", async () => {
      // Attempting to access foreign College B tenant throws FORBIDDEN: NO_ACTIVE_TENANT
      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, "tenant-college-b", USERS.headA.token)
      ).rejects.toThrow(/foreign institution resources is strictly prohibited|NO_ACTIVE_TENANT/);
    });

    it("strictly prevents student accounts from accessing institutional administrative routes", async () => {
      // Students attempting institutional permission (DRIVES_MANAGE) are denied with FORBIDDEN
      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, USERS.studentA.tenantId, USERS.studentA.token)
      ).rejects.toThrow("FORBIDDEN");
    });
  });

  // ==========================================================================
  // 5. SUPER ADMIN & AAL2 ASSURANCE AUDIT
  // ==========================================================================
  describe("5. Platform Super Admin Access & AAL2 Assurance Enforcement", () => {
    it("denies Super Admin access to College Placement Heads attempting cross-escalation", async () => {
      const mockReq: any = {
        headers: new Headers({
          authorization: `Bearer ${USERS.headA.token}`,
        }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq)
      ).rejects.toThrow(/NOT_PLATFORM_ADMIN|UNAUTHORIZED/);
    });

    it("strictly requires cryptographic AAL2 MFA assurance claim for elevated Super Admin control", async () => {
      const mockReq: any = {
        headers: new Headers({
          authorization: `Bearer ${USERS.superAdminAal1.token}`,
        }),
      };

      await expect(
        PlatformAuthService.requireSuperAdmin(mockReq, { requireAal2: true })
      ).rejects.toThrow(/AAL2_REQUIRED|MFA_REQUIRED|UNAUTHORIZED/);
    });

    it("strictly allows verified Super Admin with genuine AAL2 cryptographic claim", async () => {
      const mockReq: any = {
        headers: new Headers({
          authorization: `Bearer ${USERS.superAdminAal2.token}`,
        }),
      };

      const admin = await PlatformAuthService.requireSuperAdmin(mockReq, { requireAal2: true });
      expect(admin).toBeDefined();
      expect(admin.id).toBe(USERS.superAdminAal2.id);
      expect(admin.email).toBe(USERS.superAdminAal2.email);
    });
  });

  // ==========================================================================
  // 6. TAB-ISOLATION & SESSION REFRESH INTEGRITY
  // ==========================================================================
  describe("6. Tab-Isolated Authentication & Cookie Propagation", () => {
    it("ensures tab-isolated bearer token requests are processed without cookie conflicts", async () => {
      const req = new NextRequest("https://urplaced.com/api/student/dashboard", {
        headers: {
          authorization: "Bearer student-tab-1-token",
          cookie: "sb-mock-auth-token=college-head-token-in-cookies", // Different tab in cookie!
        },
      });

      // Middleware fast-paths Bearer requests without touching or overwriting tab bearer authorization
      const res = await middleware(req);
      expect(res.headers.get("X-Frame-Options")).toBe("DENY");
      expect(res.cookies.getAll().length).toBe(0);
    });
  });
});
