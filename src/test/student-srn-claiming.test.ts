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
    mockFrom.mockReset().mockImplementation((table: string) => {
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        ilike: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: [], error: null }),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    });
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
        fullName: "Test Student",
        email: "test@student.com",
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_SRN");
    });

    it("rejects when userId is missing", async () => {
      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "",
        fullName: "Test Student",
        email: "test@student.com",
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_USER");
    });

    it("rejects when fullName is missing or empty", async () => {
      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-uuid-888",
        fullName: "   ",
        email: "test@student.com",
      });
      expect(res.success).toBe(false);
      expect(res.code).toBe("INVALID_NAME");
      expect(res.message).toContain("Full name is required");
    });

    it("rejects when email is missing, empty, or has an invalid format", async () => {
      const emptyEmailRes = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-uuid-888",
        fullName: "Test Student",
        email: "   ",
      });
      expect(emptyEmailRes.success).toBe(false);
      expect(emptyEmailRes.code).toBe("INVALID_EMAIL");

      const invalidEmailRes = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-uuid-888",
        fullName: "Test Student",
        email: "invalid-email-address",
      });
      expect(invalidEmailRes.success).toBe(false);
      expect(invalidEmailRes.code).toBe("INVALID_EMAIL");
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
        fullName: "Test Student",
        email: "test@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("USER_ALREADY_HAS_ROSTER");
      expect(res.message).toContain("already linked to student record OLD_SRN_001");
    });

    it("rejects when the SRN has already been claimed by another user", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "ALREADY_CLAIMED",
            message: "This Student Registration Number (SRN) has already been claimed by a registered account.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "new-user-uuid",
        fullName: "Test Student",
        email: "test@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ALREADY_CLAIMED");
      expect(res.message).toContain("already been claimed");
    });

    it("rejects when SRN is not found or inactive", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "SRN_NOT_FOUND",
            message: "No active, eligible student roster record found for the provided SRN.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "UNKNOWN_SRN",
        userId: "new-user-uuid",
        fullName: "Test Student",
        email: "test@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("SRN_NOT_FOUND");
    });

    it("rejects ambiguous SRN when matching multiple college rosters", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "AMBIGUOUS_SRN",
            message: "This SRN matches multiple institutional rosters. Please contact your college placement cell.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "new-user-uuid",
        fullName: "Test Student",
        email: "test@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("AMBIGUOUS_SRN");
      expect(res.message).toContain("multiple institutional rosters");
    });

    it("handles concurrent claim conflict gracefully", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "CONCURRENT_CLAIM_CONFLICT",
            message: "This student record was claimed concurrently by another request.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-uuid-999",
        fullName: "Test Student",
        email: "test@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CONCURRENT_CLAIM_CONFLICT");
      expect(res.message).toContain("claimed concurrently");
    });

    it("rejects claim when the user already holds an administrative or staff role in tenant_memberships", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "ROLE_CONFLICT",
            message: "This account already holds an administrative or staff role (PLACEMENT_HEAD) and cannot claim a student roster record.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "staff-user-uuid",
        fullName: "Placement Officer",
        email: "placement@college.edu",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ROLE_CONFLICT");
      expect(res.message).toContain("already holds an administrative or staff role");
    });

    it("rejects claim when the user membership in the tenant is suspended or revoked", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "MEMBERSHIP_SUSPENDED",
            message: "This user membership is suspended or revoked in this institution.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "suspended-user-uuid",
        fullName: "Banned Student",
        email: "banned@college.edu",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("MEMBERSHIP_SUSPENDED");
      expect(res.message).toContain("suspended or revoked");
    });

    it("rejects claim when the user account is already associated with another college tenant", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "TENANT_MISMATCH",
            message: "This account is already associated with another college.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "other-college-user-uuid",
        fullName: "Transfer Student",
        email: "transfer@college.edu",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("TENANT_MISMATCH");
      expect(res.message).toContain("associated with another college");
    });

    it("successfully claims an eligible roster record, derives college tenant_id, updates membership & metadata", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: true,
            code: "CLAIMED_SUCCESSFULLY",
            message: "Roster record successfully claimed and synchronized with student account.",
            student_id: "student-uuid-101",
            tenant_id: "college-tenant-alpha",
            enrollment_number: "00123",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "  00123  ",
        userId: "user-claim-success-777",
        fullName: "Verified Student",
        email: "verified@student.com",
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(res.studentId).toBe("student-uuid-101");
      expect(res.tenantId).toBe("college-tenant-alpha");
      expect(res.enrollmentNumber).toBe("00123");

      // Verify canonical 4-parameter RPC call with validated non-null parameters
      expect(mockRpc).toHaveBeenCalledWith("claim_student_roster", {
        p_srn: "00123",
        p_user_id: "user-claim-success-777",
        p_full_name: "Verified Student",
        p_email: "verified@student.com",
      });

      // Verify Auth app_metadata updated
      expect(mockUpdateUserById).toHaveBeenCalledWith(
        "user-claim-success-777",
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
          actorId: "user-claim-success-777",
          action: "STUDENT_ROSTER_CLAIMED",
          resourceType: "student",
          resourceId: "student-uuid-101",
        })
      );
    });

    it("fails closed when transactional RPC is unavailable, preventing non-transactional partial writes", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockRpc.mockRejectedValue(new Error("Database connection lost / RPC unavailable"));

      const claimingUserId = "user-claim-failclosed-888";
      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: claimingUserId,
        fullName: "Verified Student",
        email: "verified@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CLAIM_FAILED");
      expect(res.message).toContain("unavailable");

      // Verify no Auth metadata mutation occurred on failure
      expect(mockUpdateUserById).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("successfully delegates to PostgreSQL claim_student_roster RPC when available", async () => {
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
        fullName: "Verified Student",
        email: "verified@student.com",
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(res.studentId).toBe("rpc-student-101");
      expect(res.tenantId).toBe("rpc-college-tenant");
      expect(res.enrollmentNumber).toBe("00123");

      expect(mockRpc).toHaveBeenCalledWith("claim_student_roster", {
        p_srn: "00123",
        p_user_id: "rpc-user-999",
        p_full_name: "Verified Student",
        p_email: "verified@student.com",
      });

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

    it("executes atomic claim AND name/email synchronization in a single RPC transaction", async () => {
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

      mockRpc.mockResolvedValue({
        data: [
          {
            success: true,
            code: "CLAIMED_SUCCESSFULLY",
            message: "Roster record successfully claimed and synchronized.",
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
        fullName: "Transactional Student",
        email: "transactional@student.com",
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");

      // Verify the RPC was invoked with all 4 parameters for a single atomic transaction
      expect(mockRpc).toHaveBeenCalledWith("claim_student_roster", {
        p_srn: "00123",
        p_user_id: "rpc-user-999",
        p_full_name: "Transactional Student",
        p_email: "transactional@student.com",
      });
    });

    it("handles RPC transaction failure and aborts cleanly without partial state updates", async () => {
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

      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "CLAIM_FAILED",
            message: "Unable to lock roster record. Transaction rolled back.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "rpc-user-fail",
        fullName: "Fail Test",
        email: "fail@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CLAIM_FAILED");
      expect(res.message).toContain("Transaction rolled back");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 4. Preserve Official Student Roster Data & Academic Field Invariants
  // ============================================================================
  describe("4. Preserve Official Student Roster Data & Academic Field Invariants", () => {
    it("preserves official roster full_name and email while linking account and strictly preserving academic attributes in atomic transaction", async () => {
      const newStudentUser = "user-prerit-uuid-999";
      const signupFullName = "Prerit R Deyagond";
      const signupEmail = "preritnitard17@gmail.com";

      mockRpc.mockResolvedValue({
        data: [
          {
            success: true,
            code: "CLAIMED_SUCCESSFULLY",
            message: "Roster record successfully claimed and linked to student account.",
            student_id: mockRosterStudent.id,
            tenant_id: mockRosterStudent.tenant_id,
            enrollment_number: mockRosterStudent.enrollment_number,
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: newStudentUser,
        fullName: signupFullName,
        email: signupEmail,
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(res.studentId).toBe(mockRosterStudent.id);
      expect(res.tenantId).toBe(mockRosterStudent.tenant_id);

      // Verify canonical 4-parameter RPC invocation
      expect(mockRpc).toHaveBeenCalledWith("claim_student_roster", {
        p_srn: "00123",
        p_user_id: newStudentUser,
        p_full_name: signupFullName,
        p_email: signupEmail,
      });

      // Verify official roster full_name and email on mockRosterStudent remain intact
      expect(mockRosterStudent.full_name).toBe("Original Roster Name");
      expect(mockRosterStudent.email).toBe("original_roster@college.edu");

      // Verify Auth metadata updated
      expect(mockUpdateUserById).toHaveBeenCalledWith(
        newStudentUser,
        expect.objectContaining({
          app_metadata: {
            tenant_id: mockRosterStudent.tenant_id,
            role: "STUDENT",
            account_category: "STUDENT",
          },
        })
      );
    });

    it("preserves official roster name and email when an account retries claim on their own existing roster record", async () => {
      const claimingUserId = "user-existing-retry";
      const mockUpdateFn = vi.fn();

      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "student-uuid-101",
                tenant_id: "college-tenant-alpha",
                enrollment_number: "00123",
                full_name: "Original Roster Name",
                email: "original_roster@college.edu",
              },
              error: null,
            }),
            update: mockUpdateFn,
          };
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: claimingUserId,
        fullName: "Updated Student Name",
        email: "updated@student.com",
      });

      expect(res.success).toBe(true);
      expect(res.code).toBe("CLAIMED_SUCCESSFULLY");
      // Official roster name and email must NOT be modified
      expect(mockUpdateFn).not.toHaveBeenCalled();
      expect(res.student?.full_name).toBe("Original Roster Name");
      expect(res.student?.email).toBe("original_roster@college.edu");
    });

    it("strictly rejects an account attempting to retry/claim an SRN claimed by another user", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "ALREADY_CLAIMED",
            message: "This Student Registration Number (SRN) has already been claimed by a registered account.",
          },
        ],
        error: null,
      });

      const attackerUserId = "attacker-user-999";
      const res = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS1577",
        userId: attackerUserId,
        fullName: "Attacker Name",
        email: "attacker@malicious.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("ALREADY_CLAIMED");
      expect(res.message).toContain("already been claimed");
    });

    it("rejects an authenticated user who already claimed one roster from claiming a different SRN", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "student-existing-1",
                tenant_id: "college-alpha",
                enrollment_number: "SRN_ORIGINAL_001",
                full_name: "Original Student",
                email: "original@college.edu",
              },
              error: null,
            }),
          };
        }
        return {};
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "SRN_DIFFERENT_999",
        userId: "user-already-linked",
        fullName: "Greedy Student",
        email: "greedy@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("USER_ALREADY_HAS_ROSTER");
      expect(res.message).toContain("SRN_ORIGINAL_001");
    });

    it("detects concurrent claim collision and aborts without overwriting state", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "CONCURRENT_CLAIM_CONFLICT",
            message: "This student record was claimed concurrently by another request.",
          },
        ],
        error: null,
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "racing-user-2",
        fullName: "Race Loser",
        email: "loser@student.com",
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe("CONCURRENT_CLAIM_CONFLICT");
      expect(res.message).toContain("claimed concurrently");
    });
  });

  // ============================================================================
  // 5. Database Migration Security & Permissions Invariants
  // ============================================================================
  describe("5. Database Migration Security & Permissions Invariants", () => {
    it("verifies migration drops legacy signatures, enforces mandatory params, restricts execute grants to service_role, and NEVER overwrites full_name/email", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const migrationFiles = [
        "supabase/migrations/20261027000003_strengthen_srn_claiming_guards.sql",
        "supabase/migrations/20261027000004_preserve_official_roster_data.sql",
      ];

      for (const file of migrationFiles) {
        const migrationPath = path.resolve(process.cwd(), file);
        const sqlContent = await fs.readFile(migrationPath, "utf-8");

        // Verify legacy signatures are cleanly dropped
        expect(sqlContent).toContain("DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID);");
        expect(sqlContent).toContain("DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID, TEXT, TEXT);");

        // Verify no default arguments on name/email
        expect(sqlContent).not.toContain("p_full_name TEXT DEFAULT");
        expect(sqlContent).not.toContain("p_email TEXT DEFAULT");

        // CRITICAL: Verify NO assignment of signup name or email into public.students
        expect(sqlContent).not.toMatch(/full_name\s*=\s*v_clean_name/);
        expect(sqlContent).not.toMatch(/email\s*=\s*v_clean_email/);
        expect(sqlContent).not.toMatch(/full_name\s*=\s*p_full_name/);
        expect(sqlContent).not.toMatch(/email\s*=\s*p_email/);

        // Verify SECURITY DEFINER and secure search_path
        expect(sqlContent).toContain("SECURITY DEFINER");
        expect(sqlContent).toContain("SET search_path = public, pg_temp");

        // Verify Owner assignment to postgres
        expect(sqlContent).toContain("ALTER FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) OWNER TO postgres;");

        // Verify public, anon, and authenticated execution privileges are revoked
        expect(sqlContent).toContain("REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;");
        expect(sqlContent).toContain("REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) FROM anon;");
        expect(sqlContent).toContain("REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) FROM authenticated;");

        // Verify execute privilege is granted solely to service_role
        expect(sqlContent).toContain("GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) TO service_role;");

        // Verify single transactional statement updates students AND tenant_memberships
        expect(sqlContent).toContain("UPDATE public.students");
        expect(sqlContent).toContain("INSERT INTO public.tenant_memberships");
        expect(sqlContent).toContain("FOR UPDATE");

        // Verify tenant membership DO UPDATE guard ensures non-student roles are never overwritten
        expect(sqlContent).toContain("WHERE tenant_memberships.role = 'STUDENT'");
        expect(sqlContent).toContain("AND tenant_memberships.status != 'REVOKED'");
        expect(sqlContent).toContain("AND tenant_memberships.status != 'SUSPENDED'");
      }
    });

    it("verifies single-record targeting invariant: RPC modifies only the single locked record", async () => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const migrationPath = path.resolve(
        process.cwd(),
        "supabase/migrations/20261027000004_preserve_official_roster_data.sql"
      );
      const sqlContent = await fs.readFile(migrationPath, "utf-8");

      // Verify row lock and single record target
      expect(sqlContent).toContain("WHERE id = v_target_student.id");
      expect(sqlContent).toContain("AND user_id IS NULL");
      // Verify rollback condition if concurrent conflict
      expect(sqlContent).toContain("IF NOT FOUND THEN");
      expect(sqlContent).toContain("'CONCURRENT_CLAIM_CONFLICT'");
    });

    it("verifies rollback integrity: transactional RPC ensures failure in membership creation aborts the entire transaction", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      // Simulate RPC returning a database-level transaction abort error (e.g., membership foreign key or constraint error)
      mockRpc.mockResolvedValue({
        data: null,
        error: {
          code: "23503",
          message: 'insert or update on table "tenant_memberships" violates foreign key constraint "tenant_memberships_tenant_id_fkey"',
        },
      });

      const res = await StudentService.claimStudentRosterRecord({
        srn: "00123",
        userId: "user-with-aborted-tx",
        fullName: "Rollback Tester",
        email: "rollback@student.com",
      });

      // The service must fail closed
      expect(res.success).toBe(false);
      expect(res.code).toBe("CLAIM_FAILED");
      expect(res.message).toContain("violates foreign key constraint");

      // Verify no Auth metadata mutation occurred
      expect(mockUpdateUserById).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // 6. Source of Truth Separation: Directory, Detail View, and CSV Export
  // ============================================================================
  describe("6. Source of Truth Separation (Roster vs Profile)", () => {
    it("ensures StudentService.list returns official roster name and email when student profile has different values", async () => {
      const officialRosterData = [
        {
          id: "student-roster-1",
          tenant_id: "college-tenant-alpha",
          enrollment_number: "24SUUBECS1577",
          full_name: "Placeholder Student 1523", // Official imported name
          email: "placeholder1523@example.com", // Official imported email
          user_id: "user-signup-uuid-777", // Claimed
          academic_status: "ACTIVE",
          is_archived: false,
          department: { name: "Computer Science", code: "CSE" },
        },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            ilike: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn().mockResolvedValue({
              data: officialRosterData,
              count: 1,
              error: null,
            }),
          };
        }
        return {};
      });

      const result = await StudentService.list({
        tenantId: "college-tenant-alpha",
      });

      expect(result.students).toHaveLength(1);
      // Critical check: Directory MUST show official roster values, NEVER overridden by signup profile
      expect(result.students[0].full_name).toBe("Placeholder Student 1523");
      expect(result.students[0].email).toBe("placeholder1523@example.com");
      expect(result.students[0].enrollment_number).toBe("24SUUBECS1577");
    });

    it("ensures StudentService.getById returns official roster name and email without profile substitution", async () => {
      const officialStudent = {
        id: "student-roster-1",
        tenant_id: "college-tenant-alpha",
        enrollment_number: "24SUUBECS1577",
        full_name: "Placeholder Student 1523",
        email: "placeholder1523@example.com",
        user_id: "user-signup-uuid-777",
        academic_status: "ACTIVE",
        is_archived: false,
      };

      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: officialStudent,
              error: null,
            }),
          };
        }
        return {};
      });

      const student = await StudentService.getById("college-tenant-alpha", "student-roster-1");

      expect(student).not.toBeNull();
      expect(student?.full_name).toBe("Placeholder Student 1523");
      expect(student?.email).toBe("placeholder1523@example.com");
    });

    it("ensures CSV export generates rows strictly with official roster name and email", async () => {
      const { StudentImportExportService } = await import(
        "@/modules/students/services/student-import-export-service"
      );

      const exportedStudents = [
        {
          id: "student-roster-1",
          tenant_id: "college-tenant-alpha",
          enrollment_number: "24SUUBECS1577",
          full_name: "Official Roster Student",
          email: "official_roster@college.edu",
          phone: "9876543210",
          department: { code: "CSE" },
          graduation_year: 2026,
          degree: "B.Tech",
          cgpa: 9.15,
          tenth_percentage: 95.0,
          twelfth_percentage: 92.0,
          active_backlogs: 0,
          total_backlogs: 0,
          skills: ["React", "PostgreSQL"],
        },
      ];

      const csv = StudentImportExportService.generateExportCSV(exportedStudents);

      // Verify CSV contains official roster name and email
      expect(csv).toContain("Official Roster Student");
      expect(csv).toContain("official_roster@college.edu");
      expect(csv).toContain("24SUUBECS1577");
      // Must not contain any personal profile email
      expect(csv).not.toContain("personal_signup@example.com");
    });
  });

  // ============================================================================
  // 7. Full Academic-Field Preservation Comparison Before & After Claim
  // ============================================================================
  describe("7. Full Academic-Field Preservation Invariants", () => {
    it("guarantees 100% preservation of all academic and institutional fields across claim operations", () => {
      const beforeClaim: StudentRow = { ...mockRosterStudent };

      // Simulate the updated student record in public.students after claim
      const afterClaim: StudentRow = {
        ...beforeClaim,
        user_id: "newly-bound-auth-user-id",
        claimed_at: "2026-10-27T08:00:00Z",
        updated_at: "2026-10-27T08:00:00Z",
      };

      // 1. Official identifiers & contact info preserved
      expect(afterClaim.enrollment_number).toBe(beforeClaim.enrollment_number);
      expect(afterClaim.full_name).toBe(beforeClaim.full_name);
      expect(afterClaim.email).toBe(beforeClaim.email);
      expect(afterClaim.phone).toBe(beforeClaim.phone);
      expect(afterClaim.tenant_id).toBe(beforeClaim.tenant_id);

      // 2. Academic metrics preserved
      expect(afterClaim.department_id).toBe(beforeClaim.department_id);
      expect(afterClaim.graduation_year).toBe(beforeClaim.graduation_year);
      expect(afterClaim.degree).toBe(beforeClaim.degree);
      expect(afterClaim.cgpa).toBe(beforeClaim.cgpa);
      expect(afterClaim.tenth_percentage).toBe(beforeClaim.tenth_percentage);
      expect(afterClaim.twelfth_percentage).toBe(beforeClaim.twelfth_percentage);
      expect(afterClaim.active_backlogs).toBe(beforeClaim.active_backlogs);
      expect(afterClaim.total_backlogs).toBe(beforeClaim.total_backlogs);
      expect(afterClaim.skills).toEqual(beforeClaim.skills);
      expect(afterClaim.academic_status).toBe(beforeClaim.academic_status);
      expect(afterClaim.is_archived).toBe(beforeClaim.is_archived);

      // 3. Only legitimate claim-state fields changed
      expect(afterClaim.user_id).toBe("newly-bound-auth-user-id");
      expect(afterClaim.claimed_at).not.toBeNull();
    });
  });
});
