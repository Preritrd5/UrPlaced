import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudentService, type StudentRow } from "@/modules/students/services/student-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";

// Mock Supabase Admin Client
const mockUpdateUserById = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
    auth: {
      admin: {
        updateUserById: mockUpdateUserById,
      },
    },
  }),
}));

// Mock AuditService
vi.mock("@/modules/identity-access/services/audit-service", () => ({
  AuditService: {
    log: vi.fn(),
  },
}));

describe("Student SRN Normalization, Lookup & Claiming (Phase 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockUpdateUserById.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  const mockRosterStudent: StudentRow = {
    id: "student-uuid-101",
    tenant_id: "college-tenant-alpha",
    user_id: null,
    enrollment_number: "00123",
    full_name: "Original Roster Name",
    email: "original_roster@college.edu",
    phone: "9876543210",
    department_id: "dept-cs-01",
    graduation_year: 2026,
    degree: "B.Tech",
    cgpa: 9.25,
    tenth_percentage: 95.0,
    twelfth_percentage: 92.5,
    active_backlogs: 0,
    total_backlogs: 0,
    academic_status: "ACTIVE",
    skills: ["TypeScript", "PostgreSQL", "React"],
    resume_url: null,
    claimed_at: null,
    is_archived: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  };

  // ============================================================================
  // 1. SRN Normalization
  // ============================================================================
  describe("1. SRN Normalization & Type Safety", () => {
    it("trims leading and trailing whitespace", () => {
      expect(StudentService.normalizeSrn("   1MS21CS001   ")).toBe("1MS21CS001");
      expect(StudentService.normalizeSrn("  SRN_999  ")).toBe("SRN_999");
    });

    it("strictly preserves leading zeros without numeric casting", () => {
      expect(StudentService.normalizeSrn("00123")).toBe("00123");
      expect(StudentService.normalizeSrn("  000456  ")).toBe("000456");
      expect(StudentService.normalizeSrn("0")).toBe("0");
    });

    it("handles empty or invalid inputs gracefully", () => {
      expect(StudentService.normalizeSrn("")).toBe("");
      expect(StudentService.normalizeSrn("   ")).toBe("");
      expect(StudentService.normalizeSrn(null as any)).toBe("");
      expect(StudentService.normalizeSrn(undefined as any)).toBe("");
    });
  });

  // ============================================================================
  // 2. Find Eligible Roster Record
  // ============================================================================
  describe("2. Find Eligible Roster Record (findEligibleRosterBySrn)", () => {
    it("returns INVALID_SRN when given an empty or whitespace SRN", async () => {
      const res = await StudentService.findEligibleRosterBySrn("   ");
      expect(res.status).toBe("INVALID_SRN");
      expect(res.matchesCount).toBe(0);
    });

    it("detects and flags an already-claimed SRN", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({
              data: [{ id: "stu-1", user_id: "user-already-linked", enrollment_number: "00123", tenant_id: "tenant-1" }],
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await StudentService.findEligibleRosterBySrn("00123");
      expect(res.status).toBe("ALREADY_CLAIMED");
      expect(res.matchesCount).toBe(1);
      expect(res.message).toContain("already been claimed");
    });

    it("returns NOT_FOUND when no unclaimed active record exists", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
            is: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string, val: any) => {
              if (col === "academic_status") {
                return Promise.resolve({ data: [], error: null });
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              };
            }),
          };
        }
        return {};
      });

      const res = await StudentService.findEligibleRosterBySrn("NON_EXISTENT_SRN");
      expect(res.status).toBe("NOT_FOUND");
      expect(res.matchesCount).toBe(0);
    });

    it("returns AMBIGUOUS when multiple colleges have an unclaimed record with the same SRN", async () => {
      const college1 = { ...mockRosterStudent, id: "stu-c1", tenant_id: "college-1" };
      const college2 = { ...mockRosterStudent, id: "stu-c2", tenant_id: "college-2" };

      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
            is: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string) => {
              if (col === "academic_status") {
                return Promise.resolve({ data: [college1, college2], error: null });
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [college1, college2], error: null }),
              };
            }),
          };
        }
        return {};
      });

      const res = await StudentService.findEligibleRosterBySrn("00123");
      expect(res.status).toBe("AMBIGUOUS");
      expect(res.matchesCount).toBe(2);
      expect(res.message).toContain("multiple institutional rosters");
    });

    it("returns FOUND when an exact, unambiguous, unclaimed active roster record matches", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
            is: vi.fn().mockReturnThis(),
            eq: vi.fn().mockImplementation((col: string) => {
              if (col === "academic_status") {
                return Promise.resolve({ data: [mockRosterStudent], error: null });
              }
              return {
                eq: vi.fn().mockResolvedValue({ data: [mockRosterStudent], error: null }),
              };
            }),
          };
        }
        return {};
      });

      const res = await StudentService.findEligibleRosterBySrn("  00123  ");
      expect(res.status).toBe("FOUND");
      expect(res.matchesCount).toBe(1);
      expect(res.roster?.id).toBe("student-uuid-101");
      expect(res.roster?.tenant_id).toBe("college-tenant-alpha");
    });
  });

  // ============================================================================
  // 3. Claim Student Roster Record
  // ============================================================================
  describe("3. Claim Student Roster Record (claimStudentRosterRecord)", () => {
    it("rejects when SRN is empty or whitespace", async () => {
      const res = await StudentService.claimStudentRosterRecord({
        srn: "   ",
        userId: "user-uuid-888",
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SRN");
    });

    it("rejects when userId is missing", async () => {
      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "",
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_USER");
    });

    it("enforces 1:1 binding: rejects if the authenticated user already claimed another roster record", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "prior-student-id", tenant_id: "college-1", enrollment_number: "OLD_SRN_001" },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-with-existing-student-record",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("USER_ALREADY_HAS_ROSTER");
      expect(res.message).toContain("already linked to student record OLD_SRN_001");
    });

    it("rejects when the SRN has already been claimed by another user", async () => {
      mockRpc.mockRejectedValue(new Error("RPC not found"));

      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          callIndex++;
          if (callIndex === 1) {
            // First call: check existing claim by user_id
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (callIndex === 2) {
            // Second call: check if SRN already claimed by any user
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({
                data: [{ id: "other-stu", enrollment_number: "00123", tenant_id: "college-1" }],
                error: null,
              }),
            };
          }
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "new-user-uuid",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ALREADY_CLAIMED");
    });

    it("rejects when SRN is not found or inactive", async () => {
      mockRpc.mockRejectedValue(new Error("RPC not found"));

      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          callIndex++;
          if (callIndex === 1) {
            // Check user claim
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (callIndex === 2) {
            // Check SRN claimed
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (callIndex === 3) {
            // Query unclaimed
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            };
          }
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "UNKNOWN_SRN",
        userId: "new-user-uuid",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("SRN_NOT_FOUND");
    });

    it("rejects ambiguous SRN when matching multiple college rosters", async () => {
      mockRpc.mockRejectedValue(new Error("RPC not found"));

      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          callIndex++;
          if (callIndex === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (callIndex === 2) {
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (callIndex === 3) {
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    { ...mockRosterStudent, id: "c1-student", tenant_id: "college-1" },
                    { ...mockRosterStudent, id: "c2-student", tenant_id: "college-2" },
                  ],
                  error: null,
                }),
              }),
            };
          }
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "new-user-uuid",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("AMBIGUOUS_SRN");
    });

    it("handles concurrent claim conflict gracefully", async () => {
      mockRpc.mockRejectedValue(new Error("RPC not found"));

      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          callIndex++;
          if (callIndex === 1) {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (callIndex === 2) {
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (callIndex === 3) {
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [mockRosterStudent],
                  error: null,
                }),
              }),
            };
          }
          if (callIndex === 4) {
            // Atomic update fails because another concurrent request already updated user_id
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-uuid-999",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CONCURRENT_CLAIM_CONFLICT");
    });

    it("successfully claims an eligible roster record, derives college tenant_id, updates membership & metadata, and preserves academic data", async () => {
      mockRpc.mockRejectedValue(new Error("RPC not found"));

      const claimingUserId = "user-claim-success-777";
      const updatedStudent: StudentRow = {
        ...mockRosterStudent,
        user_id: claimingUserId,
        claimed_at: "2026-10-27T10:00:00.000Z",
      };

      const mockUpsertMembership = vi.fn().mockResolvedValue({ error: null });

      let callIndex = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          callIndex++;
          if (callIndex === 1) {
            // Check user claim
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          if (callIndex === 2) {
            // Check SRN claimed
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              not: vi.fn().mockResolvedValue({ data: [], error: null }),
            };
          }
          if (callIndex === 3) {
            // Query unclaimed
            return {
              select: vi.fn().mockReturnThis(),
              ilike: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({
                  data: [mockRosterStudent],
                  error: null,
                }),
              }),
            };
          }
          if (callIndex === 4) {
            // Concurrency-safe atomic update
            return {
              update: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              is: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: updatedStudent,
                error: null,
              }),
            };
          }
        }
        if (table === "tenant_memberships") {
          return {
            upsert: mockUpsertMembership,
          };
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "  00123  ",
        userId: claimingUserId,
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(res.studentId).toBe("student-uuid-101");
      expect(res.tenantId).toBe("college-tenant-alpha");
      expect(res.enrollmentNumber).toBe("00123");

      // Verify academic data preservation: name and email were NOT modified
      expect(res.student?.full_name).toBe("Original Roster Name");
      expect(res.student?.email).toBe("original_roster@college.edu");
      expect(res.student?.cgpa).toBe(9.25);
      expect(res.student?.department_id).toBe("dept-cs-01");
      expect(res.student?.skills).toEqual(["TypeScript", "PostgreSQL", "React"]);

      // Verify tenant membership established
      expect(mockUpsertMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant_id: "college-tenant-alpha",
          user_id: claimingUserId,
          role: "STUDENT",
          status: "ACTIVE",
        }),
        { onConflict: "tenant_id,user_id" }
      );

      // Verify Auth app_metadata updated
      expect(mockUpdateUserById).toHaveBeenCalledWith(
        claimingUserId,
        expect.objectContaining({
          app_metadata: {
            tenant_id: "college-tenant-alpha",
            role: "STUDENT",
            account_category: "STUDENT",
          },
        })
      );

      // Verify AuditService log called
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "college-tenant-alpha",
          actorId: claimingUserId,
          action: "STUDENT_ROSTER_CLAIMED",
          resourceType: "student",
          resourceId: "student-uuid-101",
        })
      );
    });

    it("successfully delegates to PostgreSQL claim_student_roster RPC when available", async () => {
      // Mock existing claim check passing
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return {};
      });

      // Mock RPC success
      mockRpc.mockResolvedValue({
        data: [
          {
            success: true,
            code: "CLAIMED_SUCCESSFULLY",
            message: "Roster record successfully claimed and linked to student account.",
            student_id: "rpc-student-101",
            tenant_id: "rpc-college-tenant",
            enrollment_number: "00123",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "rpc-user-999",
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(res.studentId).toBe("rpc-student-101");
      expect(res.tenantId).toBe("rpc-college-tenant");
      expect(res.enrollmentNumber).toBe("00123");

      expect(mockUpdateUserById).toHaveBeenCalledWith("rpc-user-999", {
        app_metadata: {
          tenant_id: "rpc-college-tenant",
          role: "STUDENT",
          account_category: "STUDENT",
        },
      });

      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: "rpc-college-tenant",
          actorId: "rpc-user-999",
          action: "STUDENT_ROSTER_CLAIMED",
          resourceId: "rpc-student-101",
        })
      );
    });
  });
});
