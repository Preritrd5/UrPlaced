import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as ServerContextModule from "@/lib/auth/server-context";
import { StudentService } from "@/modules/students/services/student-service";
import { GET as getEligibility } from "@/app/api/placement/students/[id]/eligibility/route";
import { POST as postDeactivate } from "@/app/api/placement/students/[id]/deactivate/route";
import { POST as postReactivate } from "@/app/api/placement/students/[id]/reactivate/route";
import { DELETE as deleteStudent } from "@/app/api/placement/students/[id]/route";
import { GET as getBulkPreview } from "@/app/api/placement/students/bulk-delete/preview/route";
import { POST as postBulkDelete } from "@/app/api/placement/students/bulk-delete/route";

describe("Student Directory Management API Endpoints Suite", () => {
  const tenantId = "357c432f-c54f-40f5-b634-9f92704f46fd";
  const userId = "468bea84-d12e-49c8-8c85-94a2973950b1";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockPlacementHeadContext = () => ({
    userId,
    email: "admin@snpsu.edu.in",
    isPlatformAdmin: false,
    tenantId,
    tenantRole: "PLACEMENT_HEAD" as const,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  const mockPlacementStaffContext = () => ({
    userId: "staff-1",
    email: "staff@snpsu.edu.in",
    isPlatformAdmin: false,
    tenantId,
    tenantRole: "PLACEMENT_STAFF" as const,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  describe("1. Eligibility Endpoint: GET /api/placement/students/[id]/eligibility", () => {
    it("returns eligibility check results for student", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );
      vi.spyOn(StudentService, "checkStudentDeletionEligibility").mockResolvedValue({
        eligible: true,
        student: { id: "stud-1", enrollment_number: "2024CS001" } as any,
        blockingReasons: [],
        dependencies: {
          hasUserAccount: false,
          applicationsCount: 0,
          offersCount: 0,
          assessmentAttemptsCount: 0,
          mistakeBankCount: 0,
          trainingCount: 0,
        },
      });

      const req = new NextRequest("http://localhost:3000/api/placement/students/stud-1/eligibility");
      const res = await getEligibility(req, { params: Promise.resolve({ id: "stud-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.eligible).toBe(true);
      expect(json.dependencies.hasUserAccount).toBe(false);
    });
  });

  describe("2. Deactivate Endpoint: POST /api/placement/students/[id]/deactivate", () => {
    it("calls StudentService.deactivate and returns 200", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );
      vi.spyOn(StudentService, "deactivate").mockResolvedValue({
        id: "stud-1",
        is_archived: true,
        academic_status: "WITHDRAWN",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/placement/students/stud-1/deactivate", {
        method: "POST",
      });
      const res = await postDeactivate(req, { params: Promise.resolve({ id: "stud-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.student.is_archived).toBe(true);
    });
  });

  describe("3. Reactivate Endpoint: POST /api/placement/students/[id]/reactivate", () => {
    it("calls StudentService.reactivate and returns 200", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );
      vi.spyOn(StudentService, "reactivate").mockResolvedValue({
        id: "stud-1",
        is_archived: false,
        academic_status: "ACTIVE",
      } as any);

      const req = new NextRequest("http://localhost:3000/api/placement/students/stud-1/reactivate", {
        method: "POST",
      });
      const res = await postReactivate(req, { params: Promise.resolve({ id: "stud-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.student.academic_status).toBe("ACTIVE");
    });
  });

  describe("4. Permanent Delete Endpoint: DELETE /api/placement/students/[id]", () => {
    it("strictly blocks non-Placement Heads (e.g. PLACEMENT_STAFF) with 403 Forbidden", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementStaffContext()
      );

      const req = new NextRequest("http://localhost:3000/api/placement/students/stud-1", {
        method: "DELETE",
        body: JSON.stringify({ confirmedSrn: "2024CS001" }),
      });
      const res = await deleteStudent(req, { params: Promise.resolve({ id: "stud-1" }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/restricted to Placement Heads/i);
    });

    it("rejects request with 400 if confirmedSrn is missing", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );

      const req = new NextRequest("http://localhost:3000/api/placement/students/stud-1", {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      const res = await deleteStudent(req, { params: Promise.resolve({ id: "stud-1" }) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Confirmation enrollment number \(SRN\) is required/i);
    });

    it("executes permanent deletion and returns 200 when authorized with matching SRN", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );
      vi.spyOn(StudentService, "deletePermanently").mockResolvedValue({
        success: true,
        deletedStudent: { id: "stud-1", enrollment_number: "2024CS001" } as any,
      });

      const req = new NextRequest("http://localhost:3000/api/placement/students/stud-1", {
        method: "DELETE",
        body: JSON.stringify({ confirmedSrn: "2024CS001" }),
      });
      const res = await deleteStudent(req, { params: Promise.resolve({ id: "stud-1" }) });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.student.enrollment_number).toBe("2024CS001");
    });
  });

  describe("5. Bulk Delete Preview Endpoint: GET /api/placement/students/bulk-delete/preview", () => {
    it("returns 403 Forbidden for non-Placement Heads", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementStaffContext()
      );

      const req = new NextRequest("http://localhost:3000/api/placement/students/bulk-delete/preview");
      const res = await getBulkPreview(req);

      expect(res.status).toBe(403);
    });

    it("returns impact preview metrics for authenticated Placement Head", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );
      vi.spyOn(StudentService, "getBulkDeletePreview").mockResolvedValue({
        totalStudents: 100,
        eligibleCount: 30,
        protectedCount: 70,
        breakdown: {
          withUserAccounts: 50,
          withApplicationsOrOffers: 15,
          withAssessmentsOrTraining: 5,
        },
        sampleEligibleSrns: ["2024CS001"],
      });

      const req = new NextRequest("http://localhost:3000/api/placement/students/bulk-delete/preview");
      const res = await getBulkPreview(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.totalStudents).toBe(100);
      expect(json.eligibleCount).toBe(30);
      expect(json.protectedCount).toBe(70);
      expect(json.breakdown.withUserAccounts).toBe(50);
    });
  });

  describe("6. Bulk Delete Execution Endpoint: POST /api/placement/students/bulk-delete", () => {
    it("returns 403 Forbidden for non-Placement Heads", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementStaffContext()
      );

      const req = new NextRequest("http://localhost:3000/api/placement/students/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ confirmationPhrase: "DELETE ALL STUDENTS" }),
      });
      const res = await postBulkDelete(req);

      expect(res.status).toBe(403);
    });

    it("returns 400 Bad Request if confirmation phrase is missing or incorrect", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );

      const req = new NextRequest("http://localhost:3000/api/placement/students/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ confirmationPhrase: "DELETE" }),
      });
      const res = await postBulkDelete(req);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Please enter 'DELETE ALL STUDENTS' exactly/i);
    });

    it("executes bulk deletion when phrase matches and user is Placement Head", async () => {
      vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
        mockPlacementHeadContext()
      );
      vi.spyOn(StudentService, "executeBulkDelete").mockResolvedValue({
        success: true,
        deletedCount: 25,
        protectedCount: 75,
        totalBefore: 100,
      });

      const req = new NextRequest("http://localhost:3000/api/placement/students/bulk-delete", {
        method: "POST",
        body: JSON.stringify({ confirmationPhrase: "DELETE ALL STUDENTS" }),
      });
      const res = await postBulkDelete(req);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.deletedCount).toBe(25);
      expect(json.protectedCount).toBe(75);
    });
  });
});
