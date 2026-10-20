import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ReportModerationService } from "@/modules/placement-memory/services/report-moderation-service";
import { ModerationStatus } from "@/types/database";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.REPORTS_MODERATE);
    const { reportId } = await params;
    const body = await request.json();

    const decision = body.decision as ModerationStatus;
    if (!decision || (decision !== "APPROVED" && decision !== "REJECTED")) {
      return NextResponse.json({ error: "Invalid moderation decision. Must be APPROVED or REJECTED." }, { status: 400 });
    }

    const result = await ReportModerationService.moderateReport(
      authContext.tenantId,
      authContext.userId,
      reportId,
      decision,
      body.notes,
      body.promoteToMemory ?? true
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ report: result.report, auditLog: result.auditLog });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
