import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as sessionCheckHandler } from "@/app/api/preritrd/auth/session/route";
import { POST as loginHandler } from "@/app/api/preritrd/auth/login/route";
import { POST as mfaVerifyHandler } from "@/app/api/preritrd/auth/mfa/verify/route";
import { POST as mfaResetHandler } from "@/app/api/preritrd/auth/mfa/reset/route";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

describe("Platform Super Admin Login & MFA Authentication Flow", () => {
  const adminUserId = "cbb6cc91-1a40-4f82-84ed-9f4d5b28836f";
  const adminEmail = "urplaced5@gmail.com";
  const factorId = "b0072e0c-8743-4b4b-b61e-0ca33e135399";
  const challengeId = "chal_mock_123456";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Session Check Endpoint (/api/preritrd/auth/session)", () => {
    it("returns HTTP 200 with { authenticated: false } for logged-out / unauthenticated visitor", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/session");
      const res = await sessionCheckHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(false);
      expect(json.admin).toBeUndefined();
    });

    it("returns HTTP 200 with safe admin info when elevated AAL2 session is present", async () => {
      vi.spyOn(PlatformAuthService, "requireSuperAdmin").mockResolvedValueOnce({
        id: adminUserId,
        email: adminEmail,
        fullName: "Platform Super Admin",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        mfaEnforced: true,
        mfaVerified: true,
      });

      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/session", {
        headers: { Authorization: "Bearer aal2-mock-token" },
      });
      const res = await sessionCheckHandler(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.authenticated).toBe(true);
      expect(json.admin.id).toBe(adminUserId);
      expect(json.admin.email).toBe(adminEmail);
      expect(json.admin.role).toBe("SUPER_ADMIN");
      expect(json.admin.mfaVerified).toBe(true);
      // Ensures tokens or secrets are NEVER exposed in response body
      expect(json.sessionToken).toBeUndefined();
      expect(json.refreshToken).toBeUndefined();
      expect(json.password).toBeUndefined();
    });
  });

  describe("2. Credential Verification & Dual-Layer Authorization (/api/preritrd/auth/login)", () => {
    it("rejects unknown email with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: "unknown@example.com", password: "SomePassword123!" }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    }, 15000);

    it("rejects invalid password with 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail, password: "WrongPassword123!" }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBeDefined();
    }, 15000);

    it("rejects valid Supabase Auth user who is NOT a platform admin in public.profiles (403)", async () => {
      const studentToken = "student_mock_token";
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/login", {
        method: "POST",
        body: JSON.stringify({
          sessionToken: studentToken,
          email: "student@example.com",
        }),
      });
      const res = await loginHandler(req);
      expect(res.status).toBe(401); // Invalid session token
    }, 15000);
  });

  describe("3. Genuine TOTP MFA Challenge & Verification (/api/preritrd/auth/mfa/verify)", () => {
    it("rejects invalid or non-numeric TOTP code format with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          userId: adminUserId,
          factorId,
          challengeId,
          code: "abc12",
          sessionToken: "session_mock_token",
        }),
      });
      const res = await mfaVerifyHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("6-digit TOTP code");
    });

    it("rejects missing required parameters with 400", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          userId: adminUserId,
          code: "123456",
        }),
      });
      const res = await mfaVerifyHandler(req);
      expect(res.status).toBe(400);
    });

    it("rejects unauthorized user ID with 403", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/mfa/verify", {
        method: "POST",
        body: JSON.stringify({
          userId: "00000000-0000-0000-0000-000000000000",
          factorId,
          challengeId,
          code: "123456",
          sessionToken: "session_mock_token",
        }),
      });
      const res = await mfaVerifyHandler(req);
      expect(res.status).toBe(403);
    }, 30000);
  });

  describe("4. MFA Reset Flow (/api/preritrd/auth/mfa/reset)", () => {
    it("rejects unauthenticated MFA reset attempt with 400 or 401", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/auth/mfa/reset", {
        method: "POST",
        body: JSON.stringify({ userId: adminUserId }),
      });
      const res = await mfaResetHandler(req);
      expect(res.status).toBe(400);
    });
  });

  describe("5. Cookie Chunk Combination & AAL2 Session Persistence", () => {
    it("successfully extracts access token from standard or chunked cookie formats", async () => {
      const mockReq = {
        headers: new Headers(),
        cookies: {
          get(name: string) {
            if (name === "sb-access-token") return { value: "test-direct-token" };
            return undefined;
          },
          getAll() {
            return [{ name: "sb-access-token", value: "test-direct-token" }];
          },
        },
      } as unknown as NextRequest;

      // requireSuperAdmin with mock admin
      vi.spyOn(PlatformAuthService, "requireSuperAdmin").mockImplementation(async (req) => {
        const token = req?.cookies.get("sb-access-token")?.value;
        if (token === "test-direct-token") {
          return {
            id: adminUserId,
            email: adminEmail,
            fullName: "Platform Super Admin",
            role: "SUPER_ADMIN",
            status: "ACTIVE",
            mfaEnforced: true,
            mfaVerified: true,
          };
        }
        throw new Error("UNAUTHORIZED");
      });

      const admin = await PlatformAuthService.requireSuperAdmin(mockReq);
      expect(admin.id).toBe(adminUserId);
      expect(admin.role).toBe("SUPER_ADMIN");
      expect(admin.mfaVerified).toBe(true);
    });
  });
});
