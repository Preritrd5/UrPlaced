import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ExperienceReportService } from "@/modules/recruitment-intelligence/services/experience-report-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_SOURCES_READ);

    const reports = await ExperienceReportService.getReports(authContext.tenantId, {
      driveId,
      approvedOnly: authContext.tenantRole === "STUDENT",
    });

    return NextResponse.json(reports);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext(Permissions.EXPERIENCE_REPORTS_SUBMIT);
    const body = await request.json();

    if (!body.companyId || !body.roleTitle || !body.recruitmentCycle) {
      return NextResponse.json(
        { error: "Company ID, Role Title, and Recruitment Cycle are required." },
        { status: 400 }
      );
    }

    const report = await ExperienceReportService.submitReport({
      tenantId: authContext.tenantId,
      companyId: body.companyId,
      driveId,
      academicYearId: body.academicYearId,
      roleTitle: body.roleTitle,
      recruitmentCycle: body.recruitmentCycle,
      reportOrigin: "CANDIDATE_REPORTED",
      roundsDescribed: body.roundsDescribed || [],
      keyTopics: body.keyTopics || [],
      isAnonymous: body.isAnonymous ?? true,
      notes: body.notes,
      userId: authContext.userId,
    });

    return NextResponse.json(report, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
