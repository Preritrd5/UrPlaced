/**
 * Drive Eligibility Criteria API Route
 * GET /api/placement/drives/[id]/criteria — Retrieve drive criteria
 * POST /api/placement/drives/[id]/criteria — Upsert drive criteria
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE);

    const criteria = await EligibilityEngine.getByDriveId(ctx.tenantId, id);
    return NextResponse.json(criteria || null);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.ELIGIBILITY_RULES_MANAGE);
    const body = await request.json();

    const minCgpa = parseFloat(body.minCgpa ?? 0);
    if (isNaN(minCgpa) || minCgpa < 0 || minCgpa > 10) {
      return NextResponse.json({ error: "Minimum CGPA must be between 0.00 and 10.00." }, { status: 400 });
    }

    const criteria = await EligibilityEngine.upsertCriteria({
      tenant_id: ctx.tenantId,
      drive_id: id,
      min_cgpa: minCgpa,
      min_tenth_percentage: body.minTenthPercentage ? parseFloat(body.minTenthPercentage) : null,
      min_twelfth_percentage: body.minTwelfthPercentage ? parseFloat(body.minTwelfthPercentage) : null,
      max_active_backlogs: body.maxActiveBacklogs ? parseInt(body.maxActiveBacklogs, 10) : 0,
      max_total_backlogs: body.maxTotalBacklogs !== undefined && body.maxTotalBacklogs !== null ? parseInt(body.maxTotalBacklogs, 10) : null,
      allowed_departments: Array.isArray(body.allowedDepartments) ? body.allowedDepartments : [],
      allowed_graduation_years: Array.isArray(body.allowedGraduationYears) ? body.allowedGraduationYears : [],
      allowed_degrees: Array.isArray(body.allowedDegrees) ? body.allowedDegrees : [],
      allowed_academic_statuses: Array.isArray(body.allowedAcademicStatuses) ? body.allowedAcademicStatuses : ["ACTIVE"],
    });

    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "DRIVE_CRITERIA_CONFIGURED",
      resourceType: "drive_criteria",
      resourceId: criteria.id,
      afterState: { minCgpa: criteria.min_cgpa, allowedDepts: criteria.allowed_departments },
    });

    return NextResponse.json(criteria);
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
