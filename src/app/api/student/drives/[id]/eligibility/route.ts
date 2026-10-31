/**
 * Student Drive Eligibility Check API Route
 * GET /api/student/drives/[id]/eligibility
 * 
 * Evaluates whether the currently authenticated student is eligible for the specified recruitment drive.
 * Returns a deterministic, explainable breakdown of met, unmet, and missing criteria.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";
import { DriveService } from "@/modules/recruitment-drives/services/drive-service";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: driveId } = await params;
    const ctx = await requireAuthContext(Permissions.ELIGIBILITY_READ_OWN);

    // 1. Fetch student roster record for the authenticated user
    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    if (!student) {
      return NextResponse.json(
        {
          error: "No verified student academic roster record found for your account in this college.",
          isEligible: false,
          status: "INELIGIBLE",
        },
        { status: 404 }
      );
    }

    // 2. Fetch recruitment drive
    const drive = await DriveService.getById(ctx.tenantId, driveId);
    if (!drive) {
      return NextResponse.json({ error: "Recruitment drive not found." }, { status: 404 });
    }

    // Students may only evaluate published/active drives
    if (drive.status !== "PUBLISHED" && drive.status !== "REGISTRATION_OPEN" && drive.status !== "IN_PROGRESS" && drive.status !== "COMPLETED") {
      return NextResponse.json({ error: "Drive is not active or published." }, { status: 403 });
    }

    // 3. Fetch criteria and evaluate
    const criteria = await EligibilityEngine.getByDriveId(ctx.tenantId, driveId);
    let evaluation;
    if (!criteria) {
      evaluation = {
        status: "ELIGIBLE" as const,
        isEligible: true,
        passedCriteria: [],
        failedCriteria: [],
        missingData: [],
        summary: "No eligibility restrictions have been placed on this recruitment drive.",
        evaluatedAt: new Date().toISOString(),
      };
    } else {
      evaluation = EligibilityEngine.evaluate(student, criteria);
    }

    // 4. Check if student has already registered/applied
    const supabase = createAdminClient();
    const { data: existingApp } = await supabase
      .from("drive_applications")
      .select("id, status, current_stage_id, registration_date")
      .eq("tenant_id", ctx.tenantId)
      .eq("drive_id", driveId)
      .eq("student_id", student.id)
      .maybeSingle();

    return NextResponse.json({
      driveId,
      studentId: student.id,
      ...evaluation,
      hasApplied: Boolean(existingApp),
      application: existingApp || null,
      isRegistrationOpen:
        (drive.status === "PUBLISHED" || drive.status === "REGISTRATION_OPEN") &&
        (!drive.registration_deadline || new Date() <= new Date(drive.registration_deadline)),
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
