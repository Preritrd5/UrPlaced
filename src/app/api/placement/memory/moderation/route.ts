import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ReportModerationService } from "@/modules/placement-memory/services/report-moderation-service";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.REPORTS_MODERATE);

    const result = await ReportModerationService.listPendingReports(authContext.tenantId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ reports: result.reports });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
