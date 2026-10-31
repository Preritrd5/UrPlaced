/**
 * Single Student Drive Details API Route
 * GET /api/student/drives/[id]
 * 
 * Fetches published drive specifications, student-visible stages,
 * personalized eligibility breakdown, and current application progress.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";
import { createAdminClient } from "@/lib/supabase/admin";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const ctx = await requireAuthContext(Permissions.COMPANIES_READ);

    const supabase = createAdminClient();

    // 1. Fetch published drive with company and student-visible stages
    const { data: drive, error: driveErr } = await supabase
      .from("recruitment_drives")
      .select(
        "*, company:companies(*), academic_year:academic_years(*), criteria:drive_eligibility_criteria(*), stages:drive_stages(*)"
      )
      .eq("tenant_id", ctx.tenantId)
      .eq("id", id)
      .maybeSingle();

    if (driveErr || !drive) {
      return NextResponse.json({ error: "Recruitment drive not found." }, { status: 404 });
    }

    // Only allow students to access published drives
    if (
      drive.status !== "PUBLISHED" &&
      drive.status !== "REGISTRATION_OPEN" &&
      drive.status !== "IN_PROGRESS" &&
      drive.status !== "COMPLETED"
    ) {
      return NextResponse.json({ error: "Drive is not currently accessible to students." }, { status: 403 });
    }

    // 2. Fetch student roster record
    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);

    // 3. Evaluate eligibility
    const criteria = drive.criteria?.[0] || null;
    let eligibility = null;
    if (student && criteria) {
      eligibility = EligibilityEngine.evaluate(student, criteria);
    }

    // 4. Check for existing application and stage results
    let application = null;
    if (student) {
      const { data: appData } = await supabase
        .from("drive_applications")
        .select(
          "*, current_stage:drive_stages(name, stage_type, stage_order), results:candidate_stage_results(*, stage:drive_stages(name, is_student_visible))"
        )
        .eq("tenant_id", ctx.tenantId)
        .eq("drive_id", id)
        .eq("student_id", student.id)
        .maybeSingle();

      if (appData) {
        application = {
          ...appData,
          results: (appData.results || [])
            .filter((r: any) => r.stage?.is_student_visible !== false)
            .map((r: any) => ({
              ...r,
              internal_notes: undefined, // Never expose staff notes
            })),
        };
      }
    }

    // Filter stages to only student-visible rounds
    const visibleStages = (drive.stages || [])
      .filter((s: any) => s.is_student_visible)
      .sort((a: any, b: any) => a.stage_order - b.stage_order);

    const isDeadlinePassed = drive.registration_deadline
      ? new Date() > new Date(drive.registration_deadline)
      : false;

    const isRegistrationOpen =
      (drive.status === "PUBLISHED" || drive.status === "REGISTRATION_OPEN") && !isDeadlinePassed;

    return NextResponse.json({
      id: drive.id,
      title: drive.title,
      roleTitle: drive.role_title,
      company: drive.company,
      academicYear: drive.academic_year,
      recruitmentType: drive.recruitment_type,
      jobDescription: drive.job_description,
      location: drive.location,
      compensationRange: drive.compensation_range,
      status: drive.status,
      registrationStart: drive.registration_start,
      registrationDeadline: drive.registration_deadline,
      isRegistrationOpen,
      isDeadlinePassed,
      stages: visibleStages,
      eligibility,
      studentLinked: Boolean(student),
      application,
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
