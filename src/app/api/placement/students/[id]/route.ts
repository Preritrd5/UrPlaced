/**
 * Single Student API Route
 * GET /api/placement/students/[id] — Retrieve student details
 * PATCH /api/placement/students/[id] — Update student details
 * DELETE /api/placement/students/[id] — Archive student
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
    const ctx = await requireAuthContext(Permissions.STUDENTS_ARCHIVE);

    const archived = await StudentService.archive(ctx.tenantId, id);

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "STUDENT_ARCHIVED",
      resourceType: "student",
      resourceId: id,
    });

    return NextResponse.json({ success: true, student: archived });
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
