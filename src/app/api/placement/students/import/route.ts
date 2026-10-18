/**
 * Student CSV Import API Route
 * GET /api/placement/students/import — Download standard CSV template
 * POST /api/placement/students/import — Preview or commit bulk student records
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { StudentImportExportService } from "@/modules/students/services/student-import-export-service";

export async function GET() {
  try {
    await requireAuthContext(Permissions.STUDENTS_IMPORT);
    const template = StudentImportExportService.getCSVTemplate();

    return new Response(template, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="urplaced_student_import_template.csv"',
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.STUDENTS_IMPORT);
    const body = await request.json();

    const mode = body.mode || "preview"; // "preview" | "commit"
    const csvContent = body.csvContent;

    if (!csvContent || typeof csvContent !== "string") {
      return NextResponse.json({ error: "csvContent is required." }, { status: 400 });
    }

    if (mode === "preview") {
      const preview = await StudentImportExportService.validateAndPreview(ctx.tenantId, csvContent);
      return NextResponse.json(preview);
    } else if (mode === "commit") {
      const preview = await StudentImportExportService.validateAndPreview(ctx.tenantId, csvContent);

      if (preview.validRows.length === 0) {
        return NextResponse.json(
          { error: "No valid rows found to import.", errors: preview.errors },
          { status: 400 }
        );
      }

      const commitResult = await StudentImportExportService.commitImport(
        ctx.tenantId,
        preview.validRows
      );

      await AuditService.log({
        tenantId: ctx.tenantId,
        actorId: ctx.userId,
        action: "STUDENTS_BULK_IMPORTED",
        resourceType: "student_import",
        resourceId: `import_${Date.now()}`,
        afterState: {
          importedCount: commitResult.importedCount,
          totalRows: preview.totalRows,
        },
      });

      return NextResponse.json({
        success: true,
        importedCount: commitResult.importedCount,
        errors: commitResult.errors,
      });
    }

    return NextResponse.json({ error: "Invalid import mode. Use 'preview' or 'commit'." }, { status: 400 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
