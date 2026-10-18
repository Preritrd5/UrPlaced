/**
 * Academic Years API Route
 * GET /api/placement/academic-years — List academic years for tenant
 * POST /api/placement/academic-years — Create new academic year
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { AcademicYearService } from "@/modules/academic/services/academic-year-service";

export async function GET() {
  try {
    const ctx = await requireAuthContext(Permissions.DASHBOARD_READ);
    const years = await AcademicYearService.listByTenant(ctx.tenantId);
    return NextResponse.json(years);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.ACADEMIC_YEARS_MANAGE);
    const body = await request.json();

    if (!body.name || !body.startDate || !body.endDate) {
      return NextResponse.json(
        { error: "Missing required fields: name, startDate, endDate" },
        { status: 400 }
      );
    }

    const academicYear = await AcademicYearService.create({
      tenantId: ctx.tenantId,
      name: body.name,
      startDate: body.startDate,
      endDate: body.endDate,
      status: body.status || "PLANNED",
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "ACADEMIC_YEAR_CREATED",
      resourceType: "academic_year",
      resourceId: academicYear.id,
      afterState: { name: academicYear.name, status: academicYear.status },
    });

    return NextResponse.json(academicYear, { status: 201 });
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
