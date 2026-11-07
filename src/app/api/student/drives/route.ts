/**
 * Student Drives Discovery API Route
 * GET /api/student/drives
 * 
 * Lists published and active recruitment opportunities belonging to the student's college.
 * Automatically computes personalized eligibility status and application state for each drive.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { EligibilityEngine } from "@/modules/eligibility/services/eligibility-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.COMPANIES_READ);

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.toLowerCase().trim();
    const filter = searchParams.get("filter") || "ALL"; // ALL, ELIGIBLE, APPLIED

    const supabase = createAdminClient();

    // 1. Fetch student roster record & personalization preferences
    const student = await StudentService.getByUserId(ctx.tenantId, ctx.userId);
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", ctx.userId)
      .maybeSingle();

    const targetRoles: string[] = Array.isArray(userProfile?.preferences?.targetRoles)
      ? userProfile.preferences.targetRoles
      : [];

    // 2. Fetch published drives for caller's college
    let query = supabase
      .from("recruitment_drives")
      .select(
        "*, company:companies(id, name, industry, website), criteria:drive_eligibility_criteria(*), applications:drive_applications(id, status, student_id)"
      )
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["PUBLISHED", "REGISTRATION_OPEN", "IN_PROGRESS", "COMPLETED"])
      .order("created_at", { ascending: false });

    const { data: drives, error } = await query;
    if (error) {
      throw new Error(`Failed to list student drives: ${error.message}`);
    }

    // 3. Process each drive with personalized student context
    const processedDrives = (drives || []).map((drive: any) => {
      const criteria = drive.criteria?.[0] || null;
      let eligibility = {
        isEligible: true,
        status: "ELIGIBLE",
        summary: "Open to all candidates",
      };

      if (student && criteria) {
        const evalResult = EligibilityEngine.evaluate(student, criteria);
        eligibility = {
          isEligible: evalResult.isEligible,
          status: evalResult.status,
          summary: evalResult.summary,
        };
      } else if (!student && criteria) {
        eligibility = {
          isEligible: false,
          status: "NEEDS_REVIEW",
          summary: "Student roster record required to verify eligibility.",
        };
      }

      // Check if student applied
      const studentApplication = student
        ? (drive.applications || []).find((a: any) => a.student_id === student.id)
        : null;

      const isDeadlinePassed = drive.registration_deadline
        ? new Date() > new Date(drive.registration_deadline)
        : false;

      const isRegistrationOpen =
        (drive.status === "PUBLISHED" || drive.status === "REGISTRATION_OPEN") && !isDeadlinePassed;

      return {
        id: drive.id,
        title: drive.title,
        roleTitle: drive.role_title,
        company: drive.company,
        recruitmentType: drive.recruitment_type,
        location: drive.location,
        compensationRange: drive.compensation_range,
        status: drive.status,
        registrationStart: drive.registration_start,
        registrationDeadline: drive.registration_deadline,
        isRegistrationOpen,
        isDeadlinePassed,
        hasApplied: Boolean(studentApplication),
        applicationStatus: studentApplication?.status || null,
        applicationId: studentApplication?.id || null,
        eligibility,
        isTargetRoleMatch:
          targetRoles.length > 0
            ? targetRoles.some((tr) => {
                const cleanTr = tr.toLowerCase();
                const role = (drive.role_title || "").toLowerCase();
                const title = (drive.title || "").toLowerCase();
                return role.includes(cleanTr) || cleanTr.includes(role) || title.includes(cleanTr);
              })
            : true,
        createdAt: drive.created_at,
      };
    });

    // 4. Apply client-requested filtering
    let filtered = processedDrives;

    if (search) {
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(search) ||
          d.roleTitle.toLowerCase().includes(search) ||
          (d.company?.name && d.company.name.toLowerCase().includes(search)) ||
          (d.company?.industry && d.company.industry.toLowerCase().includes(search))
      );
    }

    if (filter === "ELIGIBLE") {
      filtered = filtered.filter((d) => d.eligibility.isEligible);
    } else if (filter === "APPLIED") {
      filtered = filtered.filter((d) => d.hasApplied);
    } else if (filter === "TARGET_ROLES") {
      filtered = filtered.filter((d) => d.isTargetRoleMatch);
    }

    return NextResponse.json({
      drives: filtered,
      total: filtered.length,
      studentLinked: Boolean(student),
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
