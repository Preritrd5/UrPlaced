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
    const msg = error.message || "Failed to list moderation reports";
    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg.includes("FORBIDDEN") || msg.includes("FEATURE_NOT_IN_PLAN")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
