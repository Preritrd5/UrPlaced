import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import * as ServerContextModule from "@/lib/auth/server-context";
import { StudentService } from "@/modules/students/services/student-service";
import { StudentActivityHeatmapService } from "@/modules/students/services/student-activity-heatmap-service";
import { GET as getHeatmap } from "@/app/api/student/activity/heatmap/route";

describe("Student Activity Contribution Heatmap API Endpoint Tests", () => {
  const tenantId = "tenant-1111-2222";
  const userId = "user-3333-4444";
  const studentId = "student-5555-6666";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockStudentContext = () => ({
    userId,
    email: "student@college.edu",
    isPlatformAdmin: false,
    tenantId,
    tenantRole: "STUDENT" as const,
    tenantStatus: "ACTIVE",
    membershipStatus: "ACTIVE",
  });

  it("returns 401 when request is unauthorized", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
      new Error("UNAUTHORIZED")
    );

    const req = new NextRequest("http://localhost:3000/api/student/activity/heatmap");
    const res = await getHeatmap(req);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when user is not linked to an active student profile", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
      mockStudentContext() as any
    );
    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/student/activity/heatmap");
    const res = await getHeatmap(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("No active verified student profile");
  });

  it("returns 403 when linked student profile is archived", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
      mockStudentContext() as any
    );
    vi.spyOn(StudentService, "getByUserId").mockResolvedValue({
      id: studentId,
      is_archived: true,
      academic_status: "ACTIVE",
    } as any);

    const req = new NextRequest("http://localhost:3000/api/student/activity/heatmap");
    const res = await getHeatmap(req);
    expect(res.status).toBe(403);
  });

  it("returns 200 and heatmap data for authenticated active student", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue(
      mockStudentContext() as any
    );
    vi.spyOn(StudentService, "getByUserId").mockResolvedValue({
      id: studentId,
      is_archived: false,
      academic_status: "ACTIVE",
    } as any);

    const mockPayload: any = {
      studentId,
      totalSubmissions: 3,
      totalActiveDays: 1,
      maxStreak: 1,
      currentStreak: 0,
      startDate: "2025-11-09",
      endDate: "2026-11-08",
      days: {},
      months: [],
    };

    vi.spyOn(StudentActivityHeatmapService, "getHeatmap").mockResolvedValue(mockPayload);

    const req = new NextRequest("http://localhost:3000/api/student/activity/heatmap", {
      headers: {
        "x-timezone": "Asia/Kolkata",
      },
    });
    const res = await getHeatmap(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.totalSubmissions).toBe(3);
    expect(json.data.studentId).toBe(studentId);

    // Verify StudentActivityHeatmapService called with authoritative tenantId and studentId
    expect(StudentActivityHeatmapService.getHeatmap).toHaveBeenCalledWith(
      tenantId,
      studentId,
      { timezone: "Asia/Kolkata" }
    );
  });
});
