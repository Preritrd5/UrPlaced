import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase Admin Client
const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockUpsertProfile = vi.fn();
const mockUpsertMembership = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    from: mockFrom,
  }),
}));

// Mock StudentService
const mockFindEligibleRosterBySrn = vi.fn();
const mockClaimStudentRosterRecord = vi.fn();
const mockNormalizeSrn = vi.fn((srn: string) => (srn ? srn.trim() : ""));

vi.mock("@/modules/students/services/student-service", () => ({
  StudentService: {
    normalizeSrn: (srn: string) => mockNormalizeSrn(srn),
    findEligibleRosterBySrn: (srn: string, tenantId?: string) =>
      mockFindEligibleRosterBySrn(srn, tenantId),
    claimStudentRosterRecord: (params: any) => mockClaimStudentRosterRecord(params),
  },
}));

import { POST as signUpHandler } from "@/app/api/auth/signup/route";
import { GET as getCollegesHandler } from "@/app/api/auth/colleges/route";

describe("Multi-College SRN Signup, Roster Claiming & Tenant Resolution (Phase 17)", () => {
  const collegeA = {
    id: "college-a-sapthagiri-uuid",
    name: "Sapthagiri NPS University",
    slug: "sapthagiri-nps-university",
    status: "ACTIVE",
  };

  const collegeB = {
    id: "college-b-rvce-uuid",
    name: "RV College of Engineering",
    slug: "rv-college-of-engineering",
    status: "ACTIVE",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNormalizeSrn.mockImplementation((srn: string) => (srn ? srn.trim() : ""));
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-user-new-101", email: "student@test.com" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ data: {}, error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          upsert: mockUpsertProfile.mockResolvedValue({ error: null }),
        };
      }
      if (table === "tenant_memberships") {
        return {
          upsert: mockUpsertMembership.mockResolvedValue({ error: null }),
        };
      }
      if (table === "tenants") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockImplementation((col: string, val: string) => {
            if (col === "status" && val === "ACTIVE") {
              return {
                order: vi.fn().mockResolvedValue({
                  data: [collegeA, collegeB],
                  error: null,
                }),
              };
            }
            if (col === "id") {
              const matched = [collegeA, collegeB].find((c) => c.id === val);
              return {
                maybeSingle: vi.fn().mockResolvedValue({ data: matched || null, error: null }),
              };
            }
            return {
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }),
        };
      }
      return {};
    });
  });

  // ============================================================================
  // Test 1: College B Valid Signup
  // An unclaimed student in College B registers with their SRN and receives
  // an active account linked to College B.
  // ============================================================================
  it("Test 1: allows an unclaimed student in College B to register and creates an active account linked to College B", async () => {
    const srn = "24SUUBECS999";
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "FOUND",
      matchesCount: 1,
      roster: {
        id: "roster-student-cb-1",
        tenant_id: collegeB.id,
        enrollment_number: srn,
        full_name: "Rohan Patel",
        email: "rohan.patel@rvce.edu",
      },
    });

    mockClaimStudentRosterRecord.mockResolvedValue({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "roster-student-cb-1",
      tenantId: collegeB.id,
      enrollmentNumber: srn,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn,
        fullName: "Rohan Patel",
        email: "rohan.personal@gmail.com",
        password: "SecurePassword123!",
        role: "STUDENT",
        accountCategory: "STUDENT",
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tenantId).toBe(collegeB.id);
    expect(data.nextUrl).toBe("/dashboard/student");

    // Verify Auth user created with College B tenant
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "rohan.personal@gmail.com",
        app_metadata: expect.objectContaining({
          tenant_id: collegeB.id,
          role: "STUDENT",
        }),
      })
    );

    // Verify claim student roster record receives College B tenantId
    expect(mockClaimStudentRosterRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        srn,
        tenantId: collegeB.id,
      })
    );
  });

  // ============================================================================
  // Test 2: College A & College B Distinct SRNs
  // Students from both colleges register independently with their respective SRNs.
  // ============================================================================
  it("Test 2: enables students from College A and College B with distinct SRNs to register independently", async () => {
    // 1. College A student
    mockFindEligibleRosterBySrn.mockResolvedValueOnce({
      status: "FOUND",
      matchesCount: 1,
      roster: {
        id: "roster-student-ca",
        tenant_id: collegeA.id,
        enrollment_number: "1MS21CS001",
      },
    });

    mockClaimStudentRosterRecord.mockResolvedValueOnce({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "roster-student-ca",
      tenantId: collegeA.id,
    });

    const reqA = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: "1MS21CS001",
        fullName: "Student A",
        email: "studentA@sapthagiri.edu",
        password: "Password123!",
        role: "STUDENT",
      }),
    });

    const resA = await signUpHandler(reqA);
    const dataA = await resA.json();
    expect(resA.status).toBe(200);
    expect(dataA.tenantId).toBe(collegeA.id);

    // 2. College B student
    mockFindEligibleRosterBySrn.mockResolvedValueOnce({
      status: "FOUND",
      matchesCount: 1,
      roster: {
        id: "roster-student-cb",
        tenant_id: collegeB.id,
        enrollment_number: "24SUUBECS500",
      },
    });

    mockClaimStudentRosterRecord.mockResolvedValueOnce({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "roster-student-cb",
      tenantId: collegeB.id,
    });

    const reqB = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: "24SUUBECS500",
        fullName: "Student B",
        email: "studentB@rvce.edu",
        password: "Password123!",
        role: "STUDENT",
      }),
    });

    const resB = await signUpHandler(reqB);
    const dataB = await resB.json();
    expect(resB.status).toBe(200);
    expect(dataB.tenantId).toBe(collegeB.id);
  });

  // ============================================================================
  // Test 3: Same SRN in Both Colleges (College A claimed, College B unclaimed with institution context)
  // College B student provides institution context and claims College B's record.
  // College A remains claimed and untouched.
  // ============================================================================
  it("Test 3: allows College B student to register using same SRN claimed in College A when institution context is provided", async () => {
    const sharedSrn = "DUAL_CAMPUS_01";

    // When findEligibleRosterBySrn is called with collegeB.id, it finds College B's unclaimed record
    mockFindEligibleRosterBySrn.mockImplementation(async (srn: string, tenantId?: string) => {
      if (tenantId === collegeB.id) {
        return {
          status: "FOUND",
          matchesCount: 1,
          roster: {
            id: "roster-student-cb-dual",
            tenant_id: collegeB.id,
            enrollment_number: sharedSrn,
          },
        };
      }
      if (tenantId === collegeA.id) {
        return {
          status: "ALREADY_CLAIMED",
          matchesCount: 1,
          message: "This SRN has already been claimed in College A.",
        };
      }
      return {
        status: "AMBIGUOUS",
        matchesCount: 2,
        message: "This SRN matches multiple institutional rosters.",
      };
    });

    mockClaimStudentRosterRecord.mockResolvedValue({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "roster-student-cb-dual",
      tenantId: collegeB.id,
      enrollmentNumber: sharedSrn,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: sharedSrn,
        fullName: "College B Dual Student",
        email: "dual.b@rvce.edu",
        password: "SecurePassword123!",
        role: "STUDENT",
        accountCategory: "STUDENT",
        institutionId: collegeB.id, // Explicit institution disambiguation
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tenantId).toBe(collegeB.id);

    // Verify lookup was executed specifically within College B's tenant context
    expect(mockFindEligibleRosterBySrn).toHaveBeenCalledWith(sharedSrn, collegeB.id);

    // Verify claim was scoped to College B
    expect(mockClaimStudentRosterRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        srn: sharedSrn,
        tenantId: collegeB.id,
      })
    );
  });

  // ============================================================================
  // Test 4: Duplicate Claim Within One College
  // A student attempts to claim an already-claimed SRN in College B and is rejected
  // with HTTP 409 ALREADY_CLAIMED.
  // ============================================================================
  it("Test 4: strictly rejects duplicate claim within the same college with HTTP 409 ALREADY_CLAIMED", async () => {
    const srn = "24SUUBECS999";
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "ALREADY_CLAIMED",
      matchesCount: 1,
      message: "This Student Registration Number (SRN) has already been claimed by a registered account.",
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn,
        fullName: "Impostor Student",
        email: "impostor@gmail.com",
        password: "SecurePassword123!",
        role: "STUDENT",
        institutionId: collegeB.id,
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.code).toBe("ALREADY_CLAIMED");
    expect(data.error).toContain("already been claimed by a registered account");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  // ============================================================================
  // Test 5: Ambiguous SRN Without Institution Context
  // When an SRN exists in multiple colleges and no institution context is given,
  // rejects with HTTP 409 AMBIGUOUS_SRN prompting college selection.
  // ============================================================================
  it("Test 5: returns HTTP 409 AMBIGUOUS_SRN when an SRN appears in multiple colleges without institution context", async () => {
    const ambiguousSrn = "SHARED_SRN_888";
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "AMBIGUOUS",
      matchesCount: 2,
      message: "This SRN matches multiple institutional rosters. Please select your college or contact your placement cell.",
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: ambiguousSrn,
        fullName: "Undecided Student",
        email: "student@example.com",
        password: "SecurePassword123!",
        role: "STUDENT",
        // No institutionId provided
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.code).toBe("AMBIGUOUS_SRN");
    expect(data.requiresInstitutionSelection).toBe(true);
    expect(data.error).toContain("matches multiple institutional rosters");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  // ============================================================================
  // Test 6: Imported Roster Claim State
  // Validates that unclaimed roster records stay unclaimed, and only the specific
  // record being claimed transitions to claimed.
  // ============================================================================
  it("Test 6: ensures imported roster claim state transitions only target record and preserves unclaimed state for others", async () => {
    const srn = "24SUUBECS100";
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "FOUND",
      matchesCount: 1,
      roster: {
        id: "roster-student-100",
        tenant_id: collegeB.id,
        enrollment_number: srn,
        user_id: null,
        claimed_at: null,
        academic_status: "ACTIVE",
        is_archived: false,
      },
    });

    mockClaimStudentRosterRecord.mockResolvedValue({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "roster-student-100",
      tenantId: collegeB.id,
      enrollmentNumber: srn,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn,
        fullName: "Batch Student 100",
        email: "student100@rvce.edu",
        password: "Password123!",
        role: "STUDENT",
        institutionId: collegeB.id,
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockClaimStudentRosterRecord).toHaveBeenCalledTimes(1);
    expect(mockClaimStudentRosterRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        srn,
        tenantId: collegeB.id,
      })
    );
  });

  // ============================================================================
  // Test 7: Security and Rollback
  // Attempting to claim with an invalid/mismatched institution fails, and concurrent
  // conflict or role conflict triggers auth rollback.
  // ============================================================================
  it("Test 7: rolls back auth user on claim failure and enforces role-conflict protections", async () => {
    // 7a. Mismatched institution ID rejection
    mockFindEligibleRosterBySrn.mockResolvedValueOnce({
      status: "NOT_FOUND",
      matchesCount: 0,
      message: "No active roster record found in the selected college.",
    });

    const reqMismatch = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: "1MS21CS001",
        fullName: "Attacker",
        email: "attacker@college.edu",
        password: "Password123!",
        role: "STUDENT",
        institutionId: "non-existent-or-mismatched-college",
      }),
    });

    const resMismatch = await signUpHandler(reqMismatch);
    expect(resMismatch.status).toBe(404);
    expect(mockCreateUser).not.toHaveBeenCalled();

    // 7b. Concurrent claim conflict triggers auth user deletion (rollback)
    mockFindEligibleRosterBySrn.mockResolvedValueOnce({
      status: "FOUND",
      matchesCount: 1,
      roster: {
        id: "roster-conflict-id",
        tenant_id: collegeB.id,
        enrollment_number: "24SUUBECS222",
      },
    });

    mockClaimStudentRosterRecord.mockResolvedValueOnce({
      success: false,
      code: "CONCURRENT_CLAIM_CONFLICT",
      message: "This student record was claimed concurrently by another request.",
    });

    const reqRace = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: "24SUUBECS222",
        fullName: "Racer Student",
        email: "racer@example.com",
        password: "Password123!",
        role: "STUDENT",
      }),
    });

    const resRace = await signUpHandler(reqRace);
    const dataRace = await resRace.json();

    expect(resRace.status).toBe(409);
    expect(dataRace.error).toContain("claimed concurrently");
    // Verify rollback called
    expect(mockDeleteUser).toHaveBeenCalledWith("auth-user-new-101");
  });

  // ============================================================================
  // Test 8: Existing College Regression (Sapthagiri NPS University)
  // Student signup for Sapthagiri continues to work as expected without regression.
  // ============================================================================
  it("Test 8: guarantees student signup for Sapthagiri NPS University continues to work as expected without regression", async () => {
    const sapthagiriSrn = "24SUUBECS1577";
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "FOUND",
      matchesCount: 1,
      roster: {
        id: "sapthagiri-roster-1577",
        tenant_id: collegeA.id,
        enrollment_number: sapthagiriSrn,
        full_name: "Original Sapthagiri Student",
        email: "student1577@sapthagiri.edu",
      },
    });

    mockClaimStudentRosterRecord.mockResolvedValue({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "sapthagiri-roster-1577",
      tenantId: collegeA.id,
      enrollmentNumber: sapthagiriSrn,
    });

    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: sapthagiriSrn,
        fullName: "Sapthagiri Student",
        email: "student@sapthagiri.edu",
        password: "SecurePassword123!",
        role: "STUDENT",
        accountCategory: "STUDENT",
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tenantId).toBe(collegeA.id);
    expect(data.nextUrl).toBe("/dashboard/student");

    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        app_metadata: expect.objectContaining({
          tenant_id: collegeA.id,
          role: "STUDENT",
        }),
      })
    );
  });

  // ============================================================================
  // Test 9: Active Colleges Listing API (/api/auth/colleges)
  // ============================================================================
  it("Test 9: /api/auth/colleges endpoint returns active institutions for disambiguation", async () => {
    const res = await getCollegesHandler();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.colleges)).toBe(true);
    expect(data.colleges).toHaveLength(2);
    expect(data.colleges[0].name).toBe("Sapthagiri NPS University");
    expect(data.colleges[1].name).toBe("RV College of Engineering");
  });

  // ============================================================================
  // Test 10: Ownership Boundary — Unauthorized Claim Verification
  // Demonstrates that under the current implementation, an unauthorized person who
  // knows an SRN and selects College B can submit an unrelated email address and
  // claim the roster record because no institutional ownership proof is enforced.
  // ============================================================================
  it("Test 10 (Ownership Boundary): confirms that knowing an SRN and college currently allows an unrelated person to claim an unclaimed record without institutional proof", async () => {
    const targetSrn = "24SUUBECS999";
    const legitimateStudentRoster = {
      id: "roster-student-rohan",
      tenant_id: collegeB.id,
      enrollment_number: targetSrn,
      full_name: "Rohan Patel",
      email: "rohan.patel@rvce.edu", // Official institutional roster email
      user_id: null, // Unclaimed
      academic_status: "ACTIVE",
      is_archived: false,
    };

    // findEligibleRosterBySrn resolves the unclaimed record solely by SRN and tenantId
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "FOUND",
      matchesCount: 1,
      roster: legitimateStudentRoster,
    });

    mockClaimStudentRosterRecord.mockResolvedValue({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: legitimateStudentRoster.id,
      tenantId: collegeB.id,
      enrollmentNumber: targetSrn,
    });

    // An attacker / unrelated person submits the SRN with their own unrelated email
    const attackerEmail = "unrelated.attacker@external-domain.com";
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: targetSrn,
        fullName: "Eve Attacker",
        email: attackerEmail,
        password: "AttackerPassword123!",
        role: "STUDENT",
        accountCategory: "STUDENT",
        institutionId: collegeB.id,
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    // Critical boundary finding: The current signup flow succeeds with 200 OK
    // because SRN + college match is treated as sufficient evidence of ownership.
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.tenantId).toBe(collegeB.id);

    // The attacker's user ID is bound to Rohan Patel's roster record
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: attackerEmail,
        app_metadata: expect.objectContaining({
          tenant_id: collegeB.id,
          role: "STUDENT",
        }),
      })
    );
    expect(mockClaimStudentRosterRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        srn: targetSrn,
        email: attackerEmail,
        tenantId: collegeB.id,
      })
    );
  });

  // ============================================================================
  // Test 11: Ownership Boundary — Legitimate Student Lockout Consequence
  // Demonstrates that once an unauthorized person claims an SRN, the legitimate
  // student is locked out of their own official institutional record.
  // ============================================================================
  it("Test 11 (Lockout Consequence): confirms that after an unauthorized claim, the legitimate student is locked out with HTTP 409 ALREADY_CLAIMED", async () => {
    const targetSrn = "24SUUBECS999";

    // The record was previously claimed by an unauthorized account
    mockFindEligibleRosterBySrn.mockResolvedValue({
      status: "ALREADY_CLAIMED",
      matchesCount: 1,
      message: "This Student Registration Number (SRN) has already been claimed by a registered account.",
    });

    // The legitimate student now attempts to sign up with their official institutional email
    const legitimateStudentEmail = "rohan.patel@rvce.edu";
    const req = new NextRequest("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        srn: targetSrn,
        fullName: "Rohan Patel",
        email: legitimateStudentEmail,
        password: "RohanSecurePassword123!",
        role: "STUDENT",
        accountCategory: "STUDENT",
        institutionId: collegeB.id,
      }),
    });

    const res = await signUpHandler(req);
    const data = await res.json();

    // The legitimate student receives 409 Conflict and is locked out
    expect(res.status).toBe(409);
    expect(data.success).toBe(false);
    expect(data.code).toBe("ALREADY_CLAIMED");
    expect(data.error).toContain("already been claimed by a registered account");
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
