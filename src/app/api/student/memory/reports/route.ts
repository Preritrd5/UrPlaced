import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import {
  ReportModerationService,
  SubmitExperienceReportInput,
} from "@/modules/placement-memory/services/report-moderation-service";

export async function GET(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_READ, undefined, token);
    const searchParams = request.nextUrl.searchParams;

    const filter = {
      companyId: searchParams.get("companyId") || undefined,
      driveId: searchParams.get("driveId") || undefined,
    };

    const result = await ReportModerationService.getApprovedReports(
      authContext.tenantId,
      filter,
      false // false = student view, masks identity if anonymous
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ reports: result.reports });
  } catch (error: any) {
    if (error.message?.startsWith("UNAUTHORIZED")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const authContext = await requireAuthContext(Permissions.EXPERIENCE_REPORTS_SUBMIT, undefined, token);
    const body: SubmitExperienceReportInput = await request.json();

    // Resolve student record to ensure valid student foreign key
    const student = await StudentService.getByUserId(authContext.tenantId, authContext.userId);
    const studentId = student?.id || authContext.userId;

    const result = await ReportModerationService.submitReport(
      authContext.tenantId,
      studentId,
      body
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ report: result.report }, { status: 201 });
  } catch (error: any) {
    if (error.message?.startsWith("UNAUTHORIZED")) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.statusCode === 403) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
