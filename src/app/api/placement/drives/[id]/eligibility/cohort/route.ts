/**
 * Placement Staff Cohort Eligibility Evaluation API
 * GET /api/placement/drives/[id]/eligibility/cohort
 * 
 * Computes deterministic eligibility across the college's entire student roster
 * for a specific recruitment drive.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: driveId } = await params;
    const ctx = await requireAuthContext(Permissions.ELIGIBILITY_EVALUATE);

    const supabase = createAdminClient();

    // 1. Fetch criteria
    const criteria = await EligibilityEngine.getByDriveId(ctx.tenantId, driveId);
    if (!criteria) {
      return NextResponse.json({
        totalStudents: 0,
        eligibleCount: 0,
        ineligibleCount: 0,
        reviewCount: 0,
        summary: "No eligibility criteria configured for this drive.",
      });
    }

    // 2. Fetch all active students in college with departments
    const { data: students, error: studErr } = await supabase
      .from("students")
      .select("*, department:departments(name, code)")
      .eq("tenant_id", ctx.tenantId)
      .eq("academic_status", "ACTIVE")
      .eq("is_archived", false);

    if (studErr) {
      throw new Error(`Failed to load student roster: ${studErr.message}`);
    }

    const roster = students || [];
    let eligibleCount = 0;
    let ineligibleCount = 0;
    let reviewCount = 0;

    const departmentMap: Record<string, { code: string; name: string; eligible: number; total: number }> = {};

    for (const student of roster) {
      const deptCode = student.department?.code || "OTHER";
      const deptName = student.department?.name || "General";

      if (!departmentMap[deptCode]) {
        departmentMap[deptCode] = { code: deptCode, name: deptName, eligible: 0, total: 0 };
      }
      departmentMap[deptCode].total++;

      const evalResult = EligibilityEngine.evaluate(student, criteria);
      if (evalResult.isEligible) {
        eligibleCount++;
        departmentMap[deptCode].eligible++;
      } else if (evalResult.status === "NEEDS_REVIEW") {
        reviewCount++;
      } else {
        ineligibleCount++;
      }
    }

    return NextResponse.json({
      driveId,
      totalStudents: roster.length,
      eligibleCount,
      ineligibleCount,
      reviewCount,
      departments: Object.values(departmentMap),
      criteriaSnapshot: {
        minCgpa: criteria.min_cgpa,
        maxActiveBacklogs: criteria.max_active_backlogs,
        allowedDepartments: criteria.allowed_departments,
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
