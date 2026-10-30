/**
 * Single Student API Route
 * GET /api/placement/students/[id] — Retrieve student details
 * PATCH /api/placement/students/[id] — Update student details
 * DELETE /api/placement/students/[id] — Permanently delete student (requires SRN confirmation)
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { StudentService } from "@/modules/students/services/student-service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.STUDENTS_READ);

    const student = await StudentService.getById(ctx.tenantId, id);
    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json(student);
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

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.STUDENTS_EDIT);
    const body = await request.json();

    const existing = await StudentService.getById(ctx.tenantId, id);
    if (!existing) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const updated = await StudentService.update(ctx.tenantId, id, body);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "STUDENT_UPDATED",
      resourceType: "student",
      resourceId: id,
      beforeState: { cgpa: existing.cgpa, academicStatus: existing.academic_status },
      afterState: { cgpa: updated.cgpa, academicStatus: updated.academic_status },
    });

    return NextResponse.json(updated);
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

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.STUDENTS_DELETE);

    // Only Placement Heads are authorized to perform permanent deletions
    if (ctx.tenantRole !== "PLACEMENT_HEAD") {
      return NextResponse.json(
        { error: "Permanent deletion of student records is strictly restricted to Placement Heads." },
        { status: 403 }
      );
    }

    let confirmedSrn = "";
    try {
      const body = await request.json();
      confirmedSrn = body?.confirmedSrn || "";
    } catch {
      const url = new URL(request.url);
      confirmedSrn = url.searchParams.get("confirmedSrn") || "";
    }

    if (!confirmedSrn || !confirmedSrn.trim()) {
      return NextResponse.json(
        { error: "Confirmation enrollment number (SRN) is required to permanently delete a student." },
        { status: 400 }
      );
    }

    const result = await StudentService.deletePermanently(
      ctx.tenantId,
      id,
      confirmedSrn,
      ctx.userId
    );

    return NextResponse.json({ success: true, student: result.deletedStudent });
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
