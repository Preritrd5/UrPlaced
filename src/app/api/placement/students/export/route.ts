/**
 * Student CSV Export API Route
 * GET /api/placement/students/export — Securely export student roster to CSV
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { StudentService } from "@/modules/students/services/student-service";
import { StudentImportExportService } from "@/modules/students/services/student-import-export-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.STUDENTS_EXPORT);

    const searchParams = request.nextUrl.searchParams;
    const departmentId = searchParams.get("departmentId") || undefined;
    const graduationYear = searchParams.get("graduationYear")
      ? parseInt(searchParams.get("graduationYear")!, 10)
      : undefined;

    // Fetch up to 1000 students for export
    const result = await StudentService.list({
      tenantId: ctx.tenantId,
      departmentId,
      graduationYear,
      pageSize: 1000,
    });

    const csvData = StudentImportExportService.generateExportCSV(result.students);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "STUDENTS_EXPORTED",
      resourceType: "student_export",
      resourceId: `export_${Date.now()}`,
      afterState: { exportedCount: result.students.length },
    });

    return new Response(csvData, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="students_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
