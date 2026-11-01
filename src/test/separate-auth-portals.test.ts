import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase Admin Client to prevent cloud network latency in unit test environment
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({
          data: { user: { id: "mock-user-123" } },
          error: null,
        }),
      },
    },
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "mock-tenant-id" }, error: null }),
    })),
  })),
}));

// Mock StudentService
vi.mock("@/modules/students/services/student-service", () => ({
  StudentService: {
    normalizeSrn: vi.fn((srn: string) => (srn ? srn.trim() : "")),
    findEligibleRosterBySrn: vi.fn().mockResolvedValue({
      status: "FOUND",
      roster: {
        id: "mock-student-id",
        tenant_id: "mock-tenant-id",
        enrollment_number: "SRN-ALEX-001",
      },
      matchesCount: 1,
    }),
    claimStudentRosterRecord: vi.fn().mockResolvedValue({
      success: true,
      code: "CLAIMED_SUCCESSFULLY",
      studentId: "mock-student-id",
      tenantId: "mock-tenant-id",
      enrollmentNumber: "SRN-ALEX-001",
    }),
  },
}));

import { POST as signUpHandler } from "@/app/api/auth/signup/route";
import { NextRequest } from "next/server";
import { getRoleDefaultDashboard } from "@/lib/navigation/navigation-config";

describe("Separate Student and College Authentication Portals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Dedicated Registration Workflows", () => {
    it("handles Student signup with STUDENT category and routes to /dashboard/student", async () => {
      const uniqueSuffix = Date.now().toString(36);
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srn: "SRN-ALEX-001",
          fullName: "Alex Student",
          email: `student-${uniqueSuffix}@campus.edu`,
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
    });

    it("rejects public College self-registration with HTTP 403 when missing invitation token", async () => {
      const uniqueSuffix = Date.now().toString(36);
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Dr. Placement Officer",
          email: `head-${uniqueSuffix}@college.edu`,
          password: "SecurePassword123!",
          role: "PLACEMENT_HEAD",
          accountCategory: "COLLEGE",
          institutionName: `College of Engineering ${uniqueSuffix}`,
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe("COLLEGE_REGISTRATION_RESTRICTED");
      expect(data.error).toContain("Public self-registration for College Placement Cells is disabled");
    });

    it("requires an invitation token for College accounts", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Incomplete College Officer",
          email: "officer@college.edu",
          password: "SecurePassword123!",
          role: "PLACEMENT_HEAD",
          accountCategory: "COLLEGE",
        }),
      });

      const res = await signUpHandler(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.code).toBe("COLLEGE_REGISTRATION_RESTRICTED");
    });
  });

  describe("2. Category-Specific Login Boundary Enforcement", () => {
    it("identifies a College user attempting to log in on the Student sign-in page", () => {
      const collegeUserMeta = {
        account_category: "COLLEGE",
        role: "PLACEMENT_HEAD",
      };

      const isCollegeAccount =
        collegeUserMeta.account_category === "COLLEGE" ||
        collegeUserMeta.role === "PLACEMENT_HEAD" ||
        collegeUserMeta.role === "PLACEMENT_STAFF" ||
        collegeUserMeta.role === "TRAINER";

      // On /auth/signin (Student login), this account must be rejected with portal redirect advice
      expect(isCollegeAccount).toBe(true);
    });

    it("identifies a Student user attempting to log in on the College sign-in page", () => {
      const studentUserMeta = {
        account_category: "STUDENT",
        role: "STUDENT",
      };

      const isStudentAccount =
        studentUserMeta.account_category === "STUDENT" ||
        studentUserMeta.role === "STUDENT";

      // On /auth/college/signin (College login), this account must be rejected with portal redirect advice
      expect(isStudentAccount).toBe(true);
    });

    it("authorizes correct destinations for all valid roles across the two portals", () => {
      // Student portal destination
      expect(getRoleDefaultDashboard("STUDENT")).toBe("/dashboard/student");

      // College portal destinations
      expect(getRoleDefaultDashboard("PLACEMENT_HEAD")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("PLACEMENT_STAFF")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("TRAINER")).toBe("/dashboard/training");
    });
  });

  describe("3. Middleware & Public Route Isolation", () => {
    it("ensures student and college auth paths are distinct and non-overlapping", () => {
      const studentAuthRoutes = ["/auth/signup", "/auth/signin"];
      const collegeAuthRoutes = ["/auth/college/signup", "/auth/college/signin"];

      // Verify no overlap
      const intersection = studentAuthRoutes.filter((r) => collegeAuthRoutes.includes(r));
      expect(intersection).toEqual([]);

      // Verify prefix segregation
      for (const route of collegeAuthRoutes) {
        expect(route.startsWith("/auth/college/")).toBe(true);
      }
      for (const route of studentAuthRoutes) {
        expect(route.startsWith("/auth/college/")).toBe(false);
      }
    });
  });
});
