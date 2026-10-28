import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { NextRequest } from "next/server";

// Mock Supabase Client for UI components
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
    },
  }),
}));

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock Supabase Admin Client
const mockCreateUser = vi.fn();
const mockDeleteUser = vi.fn();
const mockUpsertProfile = vi.fn();
const mockUpsertMembership = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockCreateUser,
        deleteUser: mockDeleteUser,
      },
    },
    from: vi.fn((table: string) => {
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
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: { id: "college-tenant-xyz" }, error: null }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { id: "college-tenant-xyz" }, error: null }),
            }),
          }),
        };
      }
      return {};
    }),
  }),
}));

// Mock StudentService
const mockFindEligibleRosterBySrn = vi.fn();
const mockClaimStudentRosterRecord = vi.fn();
const mockNormalizeSrn = vi.fn((srn: string) => (srn ? srn.trim() : ""));

vi.mock("@/modules/students/services/student-service", () => ({
  StudentService: {
    normalizeSrn: (srn: string) => mockNormalizeSrn(srn),
    findEligibleRosterBySrn: (srn: string, tenantId?: string) => mockFindEligibleRosterBySrn(srn, tenantId),
    claimStudentRosterRecord: (params: any) => mockClaimStudentRosterRecord(params),
  },
}));

import { POST as signUpHandler } from "@/app/api/auth/signup/route";
import StudentSignUpPage from "@/app/auth/signup/page";

describe("Phase 3: Student Signup SRN Integration & Security Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNormalizeSrn.mockImplementation((srn: string) => (srn ? srn.trim() : ""));
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-user-999", email: "student@personal.com" } },
      error: null,
    });
    mockDeleteUser.mockResolvedValue({ data: {}, error: null });
    mockUpsertProfile.mockResolvedValue({ error: null });
  });

  // ============================================================================
  // 1. UI Safety & Invariant Tests
  // ============================================================================
  describe("1. Student Signup UI Form & Invariants", () => {
    it("renders the Student Registration Number (SRN) required field with accessible label and helper text", () => {
      render(<StudentSignUpPage />);

      const srnLabel = screen.getByText("Student Registration Number (SRN)");
      expect(srnLabel).toBeInTheDocument();

      const srnInput = screen.getByPlaceholderText(/e\.g\. 1MS21CS001 or 00123/i);
      expect(srnInput).toBeInTheDocument();
      expect(srnInput).toHaveAttribute("required");
      expect(srnInput).toHaveAttribute("id", "srn");

      expect(
        screen.getByText(/Enter your official roll number or registration ID from your campus placement roster/i)
      ).toBeInTheDocument();
    });

    it("strictly verifies there is NO College Name input or college dropdown on the Student Signup page", () => {
      render(<StudentSignUpPage />);

      // Must NOT contain college selection
      expect(screen.queryByLabelText(/college name/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/institution name/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/select college/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/enter your college/i)).not.toBeInTheDocument();
    });

    it("renders required user fields: Full Name, Email, Password, and Submit CTA", () => {
      render(<StudentSignUpPage />);

      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Create Login Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Retype Login Password/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Create Student Account/i })).toBeInTheDocument();
    });

    it("strictly verifies Department / Stream and Graduation Batch have been removed from the Student Signup form", () => {
      render(<StudentSignUpPage />);

      // Department / Stream must NOT be present
      expect(screen.queryByLabelText(/department/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/stream/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/select stream/i)).not.toBeInTheDocument();

      // Graduation Batch must NOT be present
      expect(screen.queryByLabelText(/graduation batch/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/batch/i)).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/select batch/i)).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // 2. Backend SRN Validation & Error Handling
  // ============================================================================
  describe("2. Backend API SRN Pre-Validation & Roster Association", () => {
    it("rejects student signup when SRN is missing or whitespace only", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Rahul Student",
          email: "rahul@example.com",
          password: "SecurePassword123!",
          role: "STUDENT",
          accountCategory: "STUDENT",
          srn: "   ",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Student Registration Number (SRN) is required");
      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("rejects when SRN is not found in any active college roster", async () => {
      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "NOT_FOUND",
        matchesCount: 0,
        message: "No active, eligible student roster record found.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "UNKNOWN_SRN_999",
          fullName: "Rahul Student",
          email: "rahul@example.com",
          password: "SecurePassword123!",
          role: "STUDENT",
          accountCategory: "STUDENT",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("could not be matched to an active college roster record");
      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("rejects when SRN has already been claimed by a registered account", async () => {
      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "ALREADY_CLAIMED",
        matchesCount: 1,
        message: "This SRN has already been claimed.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "00123",
          fullName: "Another Student",
          email: "another@example.com",
          password: "SecurePassword123!",
          role: "STUDENT",
          accountCategory: "STUDENT",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("already been claimed by a registered account");
      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("rejects ambiguous SRNs that match across multiple institutions", async () => {
      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "AMBIGUOUS",
        matchesCount: 2,
        message: "This SRN matches multiple institutional rosters.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "DUPLICATE_SRN_777",
          fullName: "Ambiguous Student",
          email: "student@example.com",
          password: "SecurePassword123!",
          role: "STUDENT",
          accountCategory: "STUDENT",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("matches multiple institutional rosters");
      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // 3. Successful Claim & College Derivation Lifecycle
  // ============================================================================
  describe("3. Successful Account Creation & College Derivation", () => {
    it("successfully creates student account, derives college strictly from roster, and claims record", async () => {
      const authoritativeCollegeTenantId = "authoritative-college-uuid-456";

      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "FOUND",
        matchesCount: 1,
        roster: {
          id: "student-roster-101",
          tenant_id: authoritativeCollegeTenantId,
          enrollment_number: "00123",
          full_name: "Original Roster Name",
          email: "original_roster@college.edu",
        },
      });

      mockClaimStudentRosterRecord.mockResolvedValue({
        success: true,
        code: "CLAIMED_SUCCESSFULLY",
        studentId: "student-roster-101",
        tenantId: authoritativeCollegeTenantId,
        enrollmentNumber: "00123",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "  00123  ",
          fullName: "Rahul Signup Name",
          email: "personal_rahul@gmail.com", // Different from roster email
          password: "SecurePassword123!",
          role: "STUDENT",
          accountCategory: "STUDENT",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.nextUrl).toBe("/dashboard/student");
      expect(data.tenantId).toBe(authoritativeCollegeTenantId);

      // Verify Auth account created with derived tenant_id and STUDENT role
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "personal_rahul@gmail.com",
          app_metadata: expect.objectContaining({
            account_category: "STUDENT",
            role: "STUDENT",
            tenant_id: authoritativeCollegeTenantId,
          }),
        })
      );

      // Verify claimStudentRosterRecord invoked with clean SRN, created user ID, signup name/email, and derived tenantId
      expect(mockClaimStudentRosterRecord).toHaveBeenCalledWith({
        srn: "00123",
        userId: "auth-user-999",
        fullName: "Rahul Signup Name",
        email: "personal_rahul@gmail.com",
        tenantId: authoritativeCollegeTenantId,
      });

      // Verify profile upserted
      expect(mockUpsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "auth-user-999",
          email: "personal_rahul@gmail.com",
          full_name: "Rahul Signup Name",
        })
      );
    });

    it("ignores forged client-supplied tenant_id / collegeId and uses authoritative roster tenant_id", async () => {
      const realCollegeTenantId = "real-college-tenant-001";
      const attackerFakeTenantId = "hacker-forged-college-999";

      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "FOUND",
        matchesCount: 1,
        roster: {
          id: "student-roster-101",
          tenant_id: realCollegeTenantId,
          enrollment_number: "00123",
        },
      });

      mockClaimStudentRosterRecord.mockResolvedValue({
        success: true,
        code: "CLAIMED_SUCCESSFULLY",
        studentId: "student-roster-101",
        tenantId: realCollegeTenantId,
        enrollmentNumber: "00123",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "00123",
          fullName: "Attacker User",
          email: "attacker@example.com",
          password: "SecurePassword123!",
          role: "STUDENT",
          tenant_id: attackerFakeTenantId,
          collegeId: attackerFakeTenantId,
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.tenantId).toBe(realCollegeTenantId);
      expect(data.tenantId).not.toBe(attackerFakeTenantId);

      // Verify createUser received the REAL roster tenant
      expect(mockCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          app_metadata: expect.objectContaining({
            tenant_id: realCollegeTenantId,
          }),
        })
      );
    });

    it("rolls back created Auth user if roster claim fails concurrently", async () => {
      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "FOUND",
        matchesCount: 1,
        roster: {
          id: "student-roster-101",
          tenant_id: "college-tenant-1",
          enrollment_number: "00123",
        },
      });

      // Simulate split-second race condition failure during claim
      mockClaimStudentRosterRecord.mockResolvedValue({
        success: false,
        code: "CONCURRENT_CLAIM_CONFLICT",
        message: "This student record was claimed concurrently by another request.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "00123",
          fullName: "Racer Student",
          email: "racer@example.com",
          password: "SecurePassword123!",
          role: "STUDENT",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("claimed concurrently");

      // Verify rollback: created auth user is deleted to avoid orphan account
      expect(mockDeleteUser).toHaveBeenCalledWith("auth-user-999");
    });

    it("rejects signup with 409 Conflict when user account holds a conflicting role (TRAINER) and rolls back auth user", async () => {
      mockFindEligibleRosterBySrn.mockResolvedValue({
        status: "FOUND",
        matchesCount: 1,
        roster: {
          id: "student-roster-101",
          tenant_id: "college-xyz",
          enrollment_number: "00123",
        },
      });

      mockClaimStudentRosterRecord.mockResolvedValue({
        success: false,
        code: "ROLE_CONFLICT",
        message: "This account already holds an administrative or staff role (TRAINER) and cannot claim a student roster record.",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "00123",
          fullName: "Faculty Trainer",
          email: "trainer@college.edu",
          password: "SecurePassword123!",
          role: "STUDENT",
          accountCategory: "STUDENT",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error).toContain("TRAINER");

      // Verify rollback: created auth user is deleted to avoid orphan account
      expect(mockDeleteUser).toHaveBeenCalledWith("auth-user-999");
    });
  });

  // ============================================================================
  // 4. College Registration Workflow Preservation
  // ============================================================================
  describe("4. Preservation of College Placement Cell Workflow", () => {
    it("preserves College registration workflow with institutionName and PLACEMENT_HEAD role", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Dr. Placement Head",
          email: "head@engineeringcollege.edu",
          password: "SecurePassword123!",
          role: "PLACEMENT_HEAD",
          accountCategory: "COLLEGE",
          institutionName: "Apex Institute of Technology",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.nextUrl).toBe("/dashboard");

      // SRN methods must NOT be called for college accounts
      expect(mockFindEligibleRosterBySrn).not.toHaveBeenCalled();
      expect(mockClaimStudentRosterRecord).not.toHaveBeenCalled();
    });
  });
});
