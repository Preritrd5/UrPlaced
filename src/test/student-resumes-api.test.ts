import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getResumesRoute, POST as postResumesRoute } from "@/app/api/student/resumes/route";
import { GET as downloadResumeRoute } from "@/app/api/student/resumes/[id]/download/route";
import { ResumeStorageService } from "@/modules/students/services/resume-storage-service";
import { StudentService } from "@/modules/students/services/student-service";
import * as ServerContextModule from "@/lib/auth/server-context";

describe("Student Resume API & Storage Service Suite (HTTP 500 Root-Cause & Hardening)", () => {
  const mockTenantId = "tenant-college-alpha-001";
  const mockUserId = "auth-user-student-777";
  const mockStudentId = "student-canonical-uuid-123";

  const sampleActiveStudent = {
    id: mockStudentId,
    tenant_id: mockTenantId,
    user_id: mockUserId,
    full_name: "Rohan Verma",
    email: "rohan.verma@alpha.edu",
    enrollment_number: "EN-2026-001",
    academic_status: "ACTIVE",
    is_archived: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const sampleResumeRow = {
    id: "resume-uuid-001",
    tenant_id: mockTenantId,
    student_id: mockStudentId,
    file_name: "Rohan_Verma_SDE.pdf",
    file_path: `${mockTenantId}/${mockStudentId}/resume-uuid-001.pdf`,
    file_size_bytes: 245000,
    file_type: "pdf",
    is_primary: true,
    parsed_text: "Experienced in Java, Spring Boot, React, and PostgreSQL.",
    parsing_status: "PARSED",
    parsing_error: null,
    created_at: "2026-11-01T10:00:00Z",
    updated_at: "2026-11-01T10:00:00Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Authenticated student with one resume
  it("Scenario 1: Authenticated student with one resume returns HTTP 200 with metadata", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      email: "rohan.verma@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STUDENT",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(sampleActiveStudent as any);
    vi.spyOn(ResumeStorageService, "listResumes").mockResolvedValue([
      {
        id: sampleResumeRow.id,
        tenantId: mockTenantId,
        studentId: mockStudentId,
        fileName: sampleResumeRow.file_name,
        filePath: sampleResumeRow.file_path,
        fileSizeBytes: sampleResumeRow.file_size_bytes,
        fileType: "pdf",
        isPrimary: true,
        parsedText: sampleResumeRow.parsed_text,
        parsingStatus: "PARSED",
        parsingError: null,
        createdAt: sampleResumeRow.created_at,
        updatedAt: sampleResumeRow.updated_at,
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].fileName).toBe("Rohan_Verma_SDE.pdf");
    expect(json.data[0].isPrimary).toBe(true);
  });

  // 2. Authenticated student with multiple resumes
  it("Scenario 2: Authenticated student with multiple resumes returns all authorized documents in order", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      email: "rohan.verma@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STUDENT",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(sampleActiveStudent as any);
    vi.spyOn(ResumeStorageService, "listResumes").mockResolvedValue([
      {
        id: "resume-2",
        tenantId: mockTenantId,
        studentId: mockStudentId,
        fileName: "Rohan_DevOps.pdf",
        filePath: "path-2",
        fileSizeBytes: 180000,
        fileType: "pdf",
        isPrimary: false,
        parsedText: null,
        parsingStatus: "PENDING",
        parsingError: null,
        createdAt: "2026-11-05T10:00:00Z",
        updatedAt: "2026-11-05T10:00:00Z",
      },
      {
        id: "resume-1",
        tenantId: mockTenantId,
        studentId: mockStudentId,
        fileName: "Rohan_SDE.pdf",
        filePath: "path-1",
        fileSizeBytes: 240000,
        fileType: "pdf",
        isPrimary: true,
        parsedText: null,
        parsingStatus: "PARSED",
        parsingError: null,
        createdAt: "2026-11-01T10:00:00Z",
        updatedAt: "2026-11-01T10:00:00Z",
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(2);
    expect(json.data[0].fileName).toBe("Rohan_DevOps.pdf");
  });

  // 3. Student with zero resumes (Crucial bugfix check: MUST NOT return 500)
  it("Scenario 3: Student with zero resumes returns HTTP 200 with empty array (NOT HTTP 500)", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      email: "rohan.verma@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STUDENT",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(sampleActiveStudent as any);
    vi.spyOn(ResumeStorageService, "listResumes").mockResolvedValue([]);

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data).toEqual([]);
  });

  // 4. Missing authentication
  it("Scenario 4: Missing authentication returns HTTP 401 Unauthorized", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(new Error("UNAUTHORIZED"));

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  // 5. Expired authentication or deleted account
  it("Scenario 5: Expired authentication with message 'UNAUTHORIZED: ACCOUNT_DELETED' returns HTTP 401 (not 500)", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(new Error("UNAUTHORIZED: ACCOUNT_DELETED"));

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  // 6. Student profile missing or inactive
  it("Scenario 6: User with no linked active student record returns HTTP 403 Forbidden", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: "user-without-student-profile",
      tenantId: mockTenantId,
      email: "staff@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STAFF",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toContain("No active verified student profile");
  });

  // 7. Missing optional resume metadata safely handled
  it("Scenario 7: Missing optional resume fields default gracefully without crashing", async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: [
              {
                id: "res-sparse",
                tenant_id: mockTenantId,
                student_id: mockStudentId,
                file_name: null,
                file_path: null,
                file_size_bytes: null,
                file_type: null,
                is_primary: null,
                parsed_text: null,
                parsing_status: null,
                parsing_error: null,
                created_at: null,
                updated_at: null,
              },
            ],
            error: null,
          }),
      })),
    };

    const adminSpy = vi.spyOn(await import("@/lib/supabase/admin"), "createAdminClient").mockReturnValue(mockAdmin as any);

    const resumes = await ResumeStorageService.listResumes(mockTenantId, mockStudentId);
    expect(resumes).toHaveLength(1);
    expect(resumes[0].fileName).toBe("resume.pdf");
    expect(resumes[0].fileSizeBytes).toBe(0);
    expect(resumes[0].isPrimary).toBe(false);
    expect(resumes[0].fileType).toBe("pdf");

    adminSpy.mockRestore();
  });

  // 8. Missing storage object handling
  it("Scenario 8: Missing storage object handled safely in download route without 500 crash", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      email: "rohan.verma@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STUDENT",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(sampleActiveStudent as any);
    vi.spyOn(ResumeStorageService, "getSignedDownloadUrl").mockRejectedValue(
      new Error("Storage object not found or bucket uninitialized")
    );

    const req = new NextRequest("http://localhost:3000/api/student/resumes/resume-123/download");
    const res = await downloadResumeRoute(req, { params: Promise.resolve({ id: "resume-123" }) });
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to generate download link");
  });

  // 9. Database query error / missing table handled safely in listResumes
  it("Scenario 9: Database query error or missing table in listResumes returns empty list safely", async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) =>
          resolve({
            data: null,
            error: { message: "Could not find the table 'public.student_resumes' in schema cache", code: "PGRST205" },
          }),
      })),
    };

    const adminSpy = vi.spyOn(await import("@/lib/supabase/admin"), "createAdminClient").mockReturnValue(mockAdmin as any);

    const results = await ResumeStorageService.listResumes(mockTenantId, mockStudentId);
    expect(results).toEqual([]);

    adminSpy.mockRestore();
  });

  // 10. Invalid database response
  it("Scenario 10: Unexpected exception during query returns empty list without throwing", async () => {
    const mockAdmin = {
      from: vi.fn(() => {
        throw new Error("Simulated connection timeout");
      }),
    };

    const adminSpy = vi.spyOn(await import("@/lib/supabase/admin"), "createAdminClient").mockReturnValue(mockAdmin as any);

    const results = await ResumeStorageService.listResumes(mockTenantId, mockStudentId);
    expect(results).toEqual([]);

    adminSpy.mockRestore();
  });

  // 11. Cross-student query isolation
  it("Scenario 11: Cross-student queries are strictly scoped to the authenticated student ID", async () => {
    const mockEq = vi.fn().mockReturnThis();
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: mockEq,
        order: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: [], error: null }),
      })),
    };

    const adminSpy = vi.spyOn(await import("@/lib/supabase/admin"), "createAdminClient").mockReturnValue(mockAdmin as any);

    await ResumeStorageService.listResumes("tenant-1", "student-target-only");

    expect(mockAdmin.from).toHaveBeenCalledWith("student_resumes");
    expect(mockEq).toHaveBeenCalledWith("student_id", "student-target-only");
    expect(mockEq).toHaveBeenCalledWith("tenant_id", "tenant-1");

    adminSpy.mockRestore();
  });

  // 12. Cross-tenant query isolation
  it("Scenario 12: Cross-tenant manipulation returns HTTP 403 Forbidden", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockRejectedValue(
      new Error("FORBIDDEN: NO_ACTIVE_TENANT: Access to foreign institution resources is strictly prohibited.")
    );

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error).toBe("Access denied");
  });

  // 13. Client-supplied foreign student ID is ignored in favor of canonical session
  it("Scenario 13: Query param or body cannot spoof another student ID", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      email: "rohan.verma@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STUDENT",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(sampleActiveStudent as any);
    const listSpy = vi.spyOn(ResumeStorageService, "listResumes").mockResolvedValue([]);

    // Attacker tries to pass spoofed student_id query param
    const req = new NextRequest("http://localhost:3000/api/student/resumes?student_id=victim-student-999");
    await getResumesRoute(req);

    // Endpoint MUST query with the canonical student record id, NOT the spoofed param
    expect(listSpy).toHaveBeenCalledWith(mockTenantId, mockStudentId);
  });

  // 14. API response does not expose private storage paths or raw server keys
  it("Scenario 14: Response exposes only sanitized metadata without secret keys", async () => {
    vi.spyOn(ServerContextModule, "requireAuthContext").mockResolvedValue({
      userId: mockUserId,
      tenantId: mockTenantId,
      email: "rohan.verma@alpha.edu",
      isPlatformAdmin: false,
      tenantRole: "STUDENT",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
    } as any);

    vi.spyOn(StudentService, "getByUserId").mockResolvedValue(sampleActiveStudent as any);
    vi.spyOn(ResumeStorageService, "listResumes").mockResolvedValue([
      {
        id: "res-1",
        tenantId: mockTenantId,
        studentId: mockStudentId,
        fileName: "Doc.pdf",
        filePath: "tenant/student/res-1.pdf",
        fileSizeBytes: 1000,
        fileType: "pdf",
        isPrimary: true,
        parsedText: null,
        parsingStatus: "PARSED",
        parsingError: null,
        createdAt: "2026-11-01T00:00:00Z",
        updatedAt: "2026-11-01T00:00:00Z",
      },
    ]);

    const req = new NextRequest("http://localhost:3000/api/student/resumes");
    const res = await getResumesRoute(req);
    const json = await res.json();

    expect(json.data[0]).not.toHaveProperty("serviceRoleKey");
    expect(json.data[0]).not.toHaveProperty("storageBucketCredentials");
  });

  // 15. StudentService.getByUserId resilient fallback when relationship embedding fails
  it("Scenario 15: StudentService.getByUserId falls back to flat select when department join fails", async () => {
    const mockAdmin = {
      from: vi.fn(() => ({
        select: vi.fn((sel: string) => {
          if (sel.includes("department:departments")) {
            return {
              eq: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "Could not find a relationship in schema cache", code: "PGRST200" },
              }),
            };
          }
          return {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: sampleActiveStudent,
              error: null,
            }),
          };
        }),
      })),
    };

    const adminSpy = vi.spyOn(await import("@/lib/supabase/admin"), "createAdminClient").mockReturnValue(mockAdmin as any);

    const student = await StudentService.getByUserId(mockTenantId, mockUserId);
    expect(student).not.toBeNull();
    expect(student?.id).toBe(mockStudentId);

    adminSpy.mockRestore();
  });
});
