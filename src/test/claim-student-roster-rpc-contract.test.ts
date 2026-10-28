import { describe, it, expect, beforeEach, vi } from "vitest";
import { StudentService } from "@/modules/students/services/student-service";
import fs from "fs";
import path from "path";

// Mock Supabase admin client
let capturedRpcCalls: Array<{ name: string; params: any }> = [];
let mockRpcReturn: { data: any; error: any } = { data: null, error: null };
let mockDeletedUsers: string[] = [];
let mockExistingClaim: any = null;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: vi.fn(async () => ({ error: null })),
        deleteUser: vi.fn(async (id: string) => {
          mockDeletedUsers.push(id);
          return { error: null };
        }),
      },
    },
    from: vi.fn((table: string) => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: mockExistingClaim, error: null })),
        })),
      })),
    })),
    rpc: vi.fn(async (name: string, params: any) => {
      capturedRpcCalls.push({ name, params });
      return mockRpcReturn;
    }),
  })),
}));

vi.mock("@/modules/identity-access/services/audit-service", () => ({
  AuditService: {
    log: vi.fn(async () => {}),
  },
}));

describe("UrPlaced — `claim_student_roster` RPC Contract & Error Safety Verification", () => {
  beforeEach(() => {
    capturedRpcCalls = [];
    mockDeletedUsers = [];
    mockExistingClaim = null;
    mockRpcReturn = {
      data: [
        {
          success: true,
          code: "CLAIMED_SUCCESSFULLY",
          message: "Roster record successfully claimed and linked to student account.",
          student_id: "student-uuid-101",
          tenant_id: "tenant-uuid-sapthagiri",
          enrollment_number: "SN20CS001",
        },
      ],
      error: null,
    };
  });

  describe("1. Canonical 5-Parameter RPC Signature & Exact Parameter Contract", () => {
    it("invokes `claim_student_roster` with the exact 5 named parameters expected by canonical migration", async () => {
      const result = await StudentService.claimStudentRosterRecord({
        srn: "SN20CS001",
        userId: "user-uuid-101",
        fullName: "Ananya Student",
        email: "student@snpsu.edu.in",
        tenantId: "tenant-uuid-sapthagiri",
      });

      expect(result.success).toBe(true);
      expect(capturedRpcCalls).toHaveLength(1);

      const rpcCall = capturedRpcCalls[0];
      expect(rpcCall.name).toBe("claim_student_roster");

      // Verify the EXACT 5 named parameter keys match canonical PostgreSQL function
      const paramKeys = Object.keys(rpcCall.params).sort();
      expect(paramKeys).toEqual(["p_email", "p_full_name", "p_srn", "p_tenant_id", "p_user_id"]);

      // Verify parameter values
      expect(rpcCall.params.p_srn).toBe("SN20CS001");
      expect(rpcCall.params.p_user_id).toBe("user-uuid-101");
      expect(rpcCall.params.p_full_name).toBe("Ananya Student");
      expect(rpcCall.params.p_email).toBe("student@snpsu.edu.in");
      expect(rpcCall.params.p_tenant_id).toBe("tenant-uuid-sapthagiri");
    });

    it("passes p_tenant_id as null when tenantId is omitted or undefined", async () => {
      await StudentService.claimStudentRosterRecord({
        srn: "SN20CS001",
        userId: "user-uuid-101",
        fullName: "Ananya Student",
        email: "student@snpsu.edu.in",
      });

      expect(capturedRpcCalls).toHaveLength(1);
      expect(capturedRpcCalls[0].params.p_tenant_id).toBeNull();
    });
  });

  describe("2. Safe Failure Handling & Internal Error Non-Leakage (PGRST202 Schema Mismatch)", () => {
    it("translates raw PGRST202 schema cache mismatch into a user-friendly error without leaking PostgreSQL internals", async () => {
      // Simulate production Vercel runtime error: PGRST202
      mockRpcReturn = {
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.claim_student_roster(p_email, p_full_name, p_srn, p_tenant_id, p_user_id) in the schema cache",
          details: null,
          hint: "Perhaps you meant to call the function public.claim_student_roster(p_email, p_full_name, p_srn, p_user_id)",
        },
      };

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await StudentService.claimStudentRosterRecord({
        srn: "R20CA122",
        userId: "user-uuid-reva",
        fullName: "Reva-Std",
        email: "revastd@gmail.com",
        tenantId: "tenant-uuid-reva",
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe("CLAIM_FAILED");

      // Verify that the user-facing message does NOT leak the raw PostgreSQL / PostgREST internal signature
      expect(result.message).not.toContain("Could not find the function public.claim_student_roster");
      expect(result.message).not.toContain("schema cache");
      expect(result.message).toContain("temporarily unavailable");

      // Verify that server-side diagnostics WERE logged with complete details for engineering analysis
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[StudentService.claimStudentRosterRecord] Database RPC execution error:",
        expect.objectContaining({
          code: "PGRST202",
          message: expect.stringContaining("schema cache"),
          hint: expect.stringContaining("public.claim_student_roster"),
        })
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("3. SQL Migration Lineage & Contract Consistency", () => {
    it("verifies canonical migration 20261028000002_multi_college_srn_claiming.sql defines the exact 5-parameter signature with PostgREST reload", () => {
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261028000002_multi_college_srn_claiming.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, "utf-8");

      // 1. Drops legacy 4-parameter overload to avoid signature collision
      expect(sql).toContain("DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID, TEXT, TEXT);");

      // 2. Defines the canonical 5-parameter signature
      expect(sql).toContain("CREATE OR REPLACE FUNCTION public.claim_student_roster(");
      expect(sql).toContain("p_srn TEXT");
      expect(sql).toContain("p_user_id UUID");
      expect(sql).toContain("p_full_name TEXT");
      expect(sql).toContain("p_email TEXT");
      expect(sql).toContain("p_tenant_id UUID DEFAULT NULL");

      // 3. Grants execute to service_role
      expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) TO service_role;");

      // 4. Reloads PostgREST schema cache
      expect(sql).toContain("NOTIFY pgrst, 'reload schema';");
    });
  });
});
