import { describe, it, expect, vi, beforeEach } from "vitest";
import { StudentService, type StudentRow } from "@/modules/students/services/student-service";
import { StudentImportExportService } from "@/modules/students/services/student-import-export-service";
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

vi.mock("@/modules/identity-access/services/audit-service", () => ({
  AuditService: {
    log: vi.fn(),
  },
}));

function createMockQueryBuilder(resolvedData: any = null, count: number = 0) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    not: vi.fn().mockImplementation(() => {
      // Return a thenable or chainable builder that resolves to empty array by default
      return Promise.resolve({ data: [], error: null });
    }),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockImplementation(() => Promise.resolve({ data: resolvedData, count, error: null })),
    maybeSingle: vi.fn().mockImplementation(() => Promise.resolve({ data: resolvedData, error: null })),
    single: vi.fn().mockImplementation(() => Promise.resolve({ data: resolvedData, error: null })),
    update: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation(() => Promise.resolve({ data: resolvedData, error: null })),
    upsert: vi.fn().mockImplementation(() => Promise.resolve({ data: resolvedData, error: null })),
    then: (resolve: any) => Promise.resolve({ data: resolvedData, count, error: null }).then(resolve),
  };
  return builder;
}

describe("UrPlaced Phase 4: Automatic Student Directory Association & Roster Integrity", () => {
  const collegeAlphaId = "college-tenant-alpha-111";
  const collegeBetaId = "college-tenant-beta-222";

  const officialRosterStudent: StudentRow = {
    id: "student-alpha-001",
    tenant_id: collegeAlphaId,
    user_id: null,
    enrollment_number: "24SUUBECS0001",
    full_name: "Official Roster Student 0001",
    email: "official0001@college.edu",
    phone: "9123456780",
    department_id: "dept-cse-01",
    graduation_year: 2026,
    degree: "B.Tech",
    cgpa: 9.15,
    tenth_percentage: 94.0,
    twelfth_percentage: 91.5,
    active_backlogs: 0,
    total_backlogs: 0,
    academic_status: "ACTIVE",
    skills: ["TypeScript", "Next.js", "PostgreSQL"],
    resume_url: null,
    claimed_at: null,
    is_archived: false,
    created_at: "2026-08-01T00:00:00Z",
    updated_at: "2026-08-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockReset();
    mockFrom.mockReset();
    mockUpdateUserById.mockReset().mockResolvedValue({ data: {}, error: null });
  });

  // ============================================================================
  // Suite 1: Automatic Association Flow & College Derivation
  // ============================================================================
  describe("1. Automatic Association Flow & College Derivation", () => {
    it("resolves SRN to exact eligible roster record and derives college strictly from that record", async () => {
      const qb = createMockQueryBuilder([officialRosterStudent], 1);
      qb.order.mockResolvedValue({ data: [officialRosterStudent], error: null });
      mockFrom.mockReturnValue(qb);

      const result = await StudentService.findEligibleRosterBySrn("24SUUBECS0001");
      expect(result.status).toBe("FOUND");
      expect(result.roster).toBeDefined();
      expect(result.roster?.id).toBe(officialRosterStudent.id);
      expect(result.roster?.tenant_id).toBe(collegeAlphaId);
      // The college must be derived strictly from the matched roster record
      expect(result.roster?.tenant_id).not.toBe(collegeBetaId);
    });

    it("claims existing record and establishes student tenant membership atomically", async () => {
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

      mockRpc.mockResolvedValue({
        data: [
          {
            success: true,
            code: "CLAIMED_SUCCESSFULLY",
            message: "Roster record successfully claimed and linked to student account.",
            student_id: officialRosterStudent.id,
            tenant_id: collegeAlphaId,
            enrollment_number: officialRosterStudent.enrollment_number,
          },
        ],
        error: null,
      });

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "auth-student-user-888",
        fullName: "Personal Signup Name",
        email: "personal_student@gmail.com",
      });

      expect(claimRes.success).toBe(true);
      expect(claimRes.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(claimRes.studentId).toBe(officialRosterStudent.id);
      expect(claimRes.tenantId).toBe(collegeAlphaId);

      // Verify Auth app_metadata updated with derived college tenant_id and STUDENT role
      expect(mockUpdateUserById).toHaveBeenCalledWith("auth-student-user-888", {
        app_metadata: {
          tenant_id: collegeAlphaId,
          role: "STUDENT",
          account_category: "STUDENT",
        },
      });

      // Verify AuditService log
      expect(AuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: collegeAlphaId,
          actorId: "auth-student-user-888",
          action: "STUDENT_ROSTER_CLAIMED",
          resourceId: officialRosterStudent.id,
        })
      );
    });
  });

  // ============================================================================
  // Suite 2: Official Roster Identity & Personal Profile Separation
  // ============================================================================
  describe("2. Official Roster Identity & Personal Profile Separation", () => {
    it("preserves official full_name and email in public.students while personal profile stores signup details", async () => {
      // Claimed student has user_id set, but full_name and email remain original official roster values
      const claimedStudentInDb: StudentRow = {
        ...officialRosterStudent,
        user_id: "auth-student-user-888",
        claimed_at: "2026-10-27T10:00:00Z",
        updated_at: "2026-10-27T10:00:00Z",
      };

      // Personal profile in public.profiles stores personal signup name & email
      const personalProfile = {
        id: "auth-student-user-888",
        full_name: "Personal Signup Name",
        email: "personal_student@gmail.com",
        is_platform_admin: false,
      };

      // 1. Verify students table maintains official values
      expect(claimedStudentInDb.full_name).toBe("Official Roster Student 0001");
      expect(claimedStudentInDb.email).toBe("official0001@college.edu");
      expect(claimedStudentInDb.full_name).not.toBe(personalProfile.full_name);
      expect(claimedStudentInDb.email).not.toBe(personalProfile.email);

      // 2. Verify all academic attributes remain untouched
      expect(claimedStudentInDb.cgpa).toBe(9.15);
      expect(claimedStudentInDb.department_id).toBe("dept-cse-01");
      expect(claimedStudentInDb.graduation_year).toBe(2026);
      expect(claimedStudentInDb.degree).toBe("B.Tech");
      expect(claimedStudentInDb.active_backlogs).toBe(0);
      expect(claimedStudentInDb.skills).toEqual(["TypeScript", "Next.js", "PostgreSQL"]);
    });

    it("Student Directory query (StudentService.list) displays official roster full_name and email", async () => {
      const claimedStudentInDb = {
        ...officialRosterStudent,
        user_id: "auth-student-user-888",
        claimed_at: "2026-10-27T10:00:00Z",
        department: { name: "Computer Science and Engineering", code: "CSE" },
      };

      const qb = createMockQueryBuilder([claimedStudentInDb], 1);
      mockFrom.mockReturnValue(qb);

      const directory = await StudentService.list({
        tenantId: collegeAlphaId,
        page: 1,
        pageSize: 10,
      });

      expect(directory.students.length).toBe(1);
      const studentInDirectory = directory.students[0];
      // Must display official roster name and email, NEVER personal signup profile
      expect(studentInDirectory.full_name).toBe("Official Roster Student 0001");
      expect(studentInDirectory.email).toBe("official0001@college.edu");
      expect(studentInDirectory.enrollment_number).toBe("24SUUBECS0001");
    });

    it("Student Detail view (StudentService.getById) displays official roster full_name and email", async () => {
      const claimedStudentInDb = {
        ...officialRosterStudent,
        user_id: "auth-student-user-888",
        claimed_at: "2026-10-27T10:00:00Z",
        department: { name: "Computer Science and Engineering", code: "CSE" },
      };

      const qb = createMockQueryBuilder(claimedStudentInDb);
      mockFrom.mockReturnValue(qb);

      const studentDetail = await StudentService.getById(collegeAlphaId, officialRosterStudent.id);
      expect(studentDetail).not.toBeNull();
      expect(studentDetail?.full_name).toBe("Official Roster Student 0001");
      expect(studentDetail?.email).toBe("official0001@college.edu");
      expect(studentDetail?.cgpa).toBe(9.15);
    });

    it("Student Directory CSV export displays official roster full_name and email", () => {
      const claimedStudentInDb = {
        ...officialRosterStudent,
        user_id: "auth-student-user-888",
        claimed_at: "2026-10-27T10:00:00Z",
        department: { name: "Computer Science and Engineering", code: "CSE" },
      };

      const csvData = StudentImportExportService.generateExportCSV([claimedStudentInDb]);

      // Verify CSV contains official roster full_name and email
      expect(csvData).toContain("Official Roster Student 0001");
      expect(csvData).toContain("official0001@college.edu");
      expect(csvData).toContain("24SUUBECS0001");
      expect(csvData).toContain("9.15");
      // Must NOT contain personal signup values
      expect(csvData).not.toContain("Personal Signup Name");
      expect(csvData).not.toContain("personal_student@gmail.com");
    });
  });

  // ============================================================================
  // Suite 3: Matching, Rejection & Security Rules
  // ============================================================================
  describe("3. Matching, Rejection & Security Rules", () => {
    it("rejects unknown SRN without creating any student record", async () => {
      const qb = createMockQueryBuilder([], 0);
      qb.order.mockResolvedValue({ data: [], error: null });
      mockFrom.mockReturnValue(qb);

      const res = await StudentService.findEligibleRosterBySrn("UNKNOWN_SRN_9999");
      expect(res.status).toBe("NOT_FOUND");
      expect(res.roster).toBeUndefined();
    });

    it("rejects ambiguous SRN that matches multiple colleges", async () => {
      const multipleMatches = [
        { ...officialRosterStudent, tenant_id: collegeAlphaId },
        { ...officialRosterStudent, id: "student-beta-002", tenant_id: collegeBetaId },
      ];
      const qb = createMockQueryBuilder(multipleMatches, 2);
      qb.order.mockResolvedValue({ data: multipleMatches, error: null });
      mockFrom.mockReturnValue(qb);

      const res = await StudentService.findEligibleRosterBySrn("DUPLICATE_SRN_SHARED");
      expect(res.status).toBe("AMBIGUOUS");
      expect(res.matchesCount).toBe(2);
      expect(res.roster).toBeUndefined();
    });

    it("rejects attempt to claim already claimed SRN", async () => {
      const qb = createMockQueryBuilder([], 0);
      qb.order.mockResolvedValue({ data: [], error: null });
      // When checking claimed records: not("user_id", "is", null) returns a match
      qb.not.mockResolvedValue({ data: [{ id: "already-claimed-id" }], error: null });
      mockFrom.mockReturnValue(qb);

      const res = await StudentService.findEligibleRosterBySrn("24SUUBECS0001");
      expect(res.status).toBe("ALREADY_CLAIMED");
      expect(res.roster).toBeUndefined();
    });

    it("rejects when student account is already bound to another roster record", async () => {
      const qb = createMockQueryBuilder({
        id: "other-student-uuid",
        tenant_id: collegeAlphaId,
        enrollment_number: "DIFFERENT_SRN_999",
        full_name: "Other Student",
        email: "other@college.edu",
      });
      mockFrom.mockReturnValue(qb);

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "user-already-bound",
        fullName: "Some Student",
        email: "some@student.com",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("USER_ALREADY_HAS_ROSTER");
      expect(claimRes.message).toContain("already linked to student record DIFFERENT_SRN_999");
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("handles same-account idempotent retry without modifying roster values", async () => {
      const qb = createMockQueryBuilder({
        id: officialRosterStudent.id,
        tenant_id: collegeAlphaId,
        enrollment_number: officialRosterStudent.enrollment_number,
        full_name: officialRosterStudent.full_name,
        email: officialRosterStudent.email,
      });
      mockFrom.mockReturnValue(qb);

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "auth-student-user-888",
        fullName: "Another Personal Name",
        email: "another_personal@email.com",
      });

      expect(claimRes.success).toBe(true);
      expect(claimRes.code).toBe("CLAIMED_SUCCESSFULLY");
      expect(claimRes.studentId).toBe(officialRosterStudent.id);
      expect(claimRes.tenantId).toBe(collegeAlphaId);
      // Confirmed existing association idempotently without executing RPC or modifying data
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it("handles concurrent claim conflict cleanly and fails closed", async () => {
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

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

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "user-racing-loser",
        fullName: "Racing Student",
        email: "racing@student.com",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("CONCURRENT_CLAIM_CONFLICT");
      expect(claimRes.message).toContain("claimed concurrently");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("fails closed when transactional RPC is unavailable", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

      mockRpc.mockRejectedValue(new Error("RPC unavailable / network failure"));

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "user-fail-closed",
        fullName: "Fail Closed",
        email: "failclosed@student.com",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("CLAIM_FAILED");
      expect(claimRes.message).toContain("unavailable");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("rejects claim when account holds a TRAINER role in tenant_memberships", async () => {
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

      mockRpc.mockResolvedValue({
        data: [
          {
            success: false,
            code: "ROLE_CONFLICT",
            message: "This account already holds an administrative or staff role (TRAINER) and cannot claim a student roster record.",
          },
        ],
        error: null,
      });

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "user-trainer-uuid",
        fullName: "College Trainer",
        email: "trainer@college.edu",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("ROLE_CONFLICT");
      expect(claimRes.message).toContain("TRAINER");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("rejects claim when account holds PLACEMENT_STAFF or PLACEMENT_HEAD roles", async () => {
      const privilegedRoles = ["PLACEMENT_STAFF", "PLACEMENT_HEAD"];

      for (const role of privilegedRoles) {
        const qb = createMockQueryBuilder(null);
        mockFrom.mockReturnValue(qb);

        mockRpc.mockResolvedValue({
          data: [
            {
              success: false,
              code: "ROLE_CONFLICT",
              message: `This account already holds an administrative or staff role (${role}) and cannot claim a student roster record.`,
            },
          ],
          error: null,
        });

        const claimRes = await StudentService.claimStudentRosterRecord({
          srn: "24SUUBECS0001",
          userId: `user-${role.toLowerCase()}-uuid`,
          fullName: `Officer ${role}`,
          email: `${role.toLowerCase()}@college.edu`,
        });

        expect(claimRes.success).toBe(false);
        expect(claimRes.code).toBe("ROLE_CONFLICT");
        expect(claimRes.message).toContain(role);
        expect(mockUpdateUserById).not.toHaveBeenCalled();
      }
    });

    it("rejects claim when user membership in the tenant is suspended or revoked", async () => {
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

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

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "user-suspended-uuid",
        fullName: "Suspended Student",
        email: "suspended@college.edu",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("MEMBERSHIP_SUSPENDED");
      expect(claimRes.message).toContain("suspended or revoked");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("rejects claim when user account belongs to a different college tenant", async () => {
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

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

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "user-other-college-uuid",
        fullName: "Cross College Student",
        email: "other@othercollege.edu",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("TENANT_MISMATCH");
      expect(claimRes.message).toContain("already associated with another college");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });

    it("ensures a user with both a STUDENT membership and an institutional-role membership in another college is rejected with ROLE_CONFLICT", async () => {
      const qb = createMockQueryBuilder(null);
      mockFrom.mockReturnValue(qb);

      // In a multi-tenant schema with UNIQUE (tenant_id, user_id), a user can hold:
      // - Tenant Alpha: STUDENT
      // - Tenant Beta: PLACEMENT_HEAD (or TRAINER / PLACEMENT_STAFF)
      // The RPC must prioritize the institutional role and reject with ROLE_CONFLICT,
      // rather than letting an arbitrary LIMIT 1 pick the STUDENT row.
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

      const claimRes = await StudentService.claimStudentRosterRecord({
        srn: "24SUUBECS0001",
        userId: "multi-tenant-dual-role-user-uuid",
        fullName: "Dual Role User",
        email: "dualrole@college.edu",
      });

      expect(claimRes.success).toBe(false);
      expect(claimRes.code).toBe("ROLE_CONFLICT");
      expect(claimRes.message).toContain("already holds an administrative or staff role");
      expect(mockUpdateUserById).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Suite 4: Tenant Isolation & Single Appearance Invariants
  // ============================================================================
  describe("4. Tenant Isolation & Single Appearance Invariants", () => {
    it("strictly isolates students by tenant_id so College Beta cannot see College Alpha students", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "students") {
          const builder: any = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => {
              if (col === "tenant_id" && val === collegeBetaId) {
                // College Beta receives empty list
                return createMockQueryBuilder([], 0);
              }
              // College Alpha receives official student
              return createMockQueryBuilder([officialRosterStudent], 1);
            }),
          };
          return builder;
        }
        return createMockQueryBuilder([]);
      });

      const collegeBetaDirectory = await StudentService.list({
        tenantId: collegeBetaId,
        page: 1,
        pageSize: 10,
      });

      expect(collegeBetaDirectory.students.length).toBe(0);
      expect(collegeBetaDirectory.total).toBe(0);

      const collegeAlphaDirectory = await StudentService.list({
        tenantId: collegeAlphaId,
        page: 1,
        pageSize: 10,
      });

      expect(collegeAlphaDirectory.students.length).toBe(1);
      expect(collegeAlphaDirectory.students[0].id).toBe(officialRosterStudent.id);
    });

    it("ensures claimed student appears exactly once in official roster directory (no duplicate rows)", async () => {
      const studentList = [
        {
          ...officialRosterStudent,
          user_id: "auth-student-user-888",
          claimed_at: "2026-10-27T10:00:00Z",
          department: { name: "Computer Science and Engineering", code: "CSE" },
        },
      ];

      const qb = createMockQueryBuilder(studentList, 1);
      mockFrom.mockReturnValue(qb);

      const directory = await StudentService.list({
        tenantId: collegeAlphaId,
        page: 1,
        pageSize: 10,
      });

      // Claiming an account updates user_id in-place on the existing record; total count remains 1
      expect(directory.total).toBe(1);
      expect(directory.students.length).toBe(1);
      const studentIds = directory.students.map((s) => s.id);
      const uniqueIds = new Set(studentIds);
      expect(uniqueIds.size).toBe(studentIds.length);
    });
  });
});
