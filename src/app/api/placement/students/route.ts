/**
 * Students API Route
 * GET /api/placement/students — List students with filter, search, pagination
 * POST /api/placement/students — Create a student record
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { StudentService } from "@/modules/students/services/student-service";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.STUDENTS_READ);

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || undefined;
    const departmentId = searchParams.get("departmentId") || undefined;
    const graduationYear = searchParams.get("graduationYear")
      ? parseInt(searchParams.get("graduationYear")!, 10)
      : undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
    const pageSize = searchParams.get("pageSize") ? parseInt(searchParams.get("pageSize")!, 10) : 10;
    const academicStatus = (searchParams.get("academicStatus") as any) || undefined;

    const result = await StudentService.list({
      tenantId: ctx.tenantId,
      search,
      departmentId,
      graduationYear,
      academicStatus,
      page,
      pageSize,
    });

    return NextResponse.json(result);
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

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.STUDENTS_EDIT);
    const body = await request.json();

    if (!body.enrollmentNumber || !body.fullName || !body.email || !body.departmentId || body.cgpa === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: enrollmentNumber, fullName, email, departmentId, cgpa" },
        { status: 400 }
      );
    }

    const student = await StudentService.create({
      tenant_id: ctx.tenantId,
      enrollment_number: body.enrollmentNumber,
      full_name: body.fullName,
      email: body.email,
      phone: body.phone || null,
      department_id: body.departmentId,
      graduation_year: body.graduationYear || new Date().getFullYear(),
      degree: body.degree || "B.Tech",
      cgpa: parseFloat(body.cgpa),
      tenth_percentage: body.tenthPercentage ? parseFloat(body.tenthPercentage) : null,
      twelfth_percentage: body.twelfthPercentage ? parseFloat(body.twelfthPercentage) : null,
      active_backlogs: body.activeBacklogs ? parseInt(body.activeBacklogs, 10) : 0,
      total_backlogs: body.totalBacklogs ? parseInt(body.totalBacklogs, 10) : 0,
      skills: Array.isArray(body.skills) ? body.skills : [],
      academic_status: body.academicStatus || "ACTIVE",
      is_archived: false,
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "STUDENT_CREATED",
      resourceType: "student",
      resourceId: student.id,
      afterState: { enrollmentNumber: student.enrollment_number, email: student.email },
    });

    return NextResponse.json(student, { status: 201 });
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
