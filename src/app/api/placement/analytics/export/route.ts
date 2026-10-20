import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ExportService } from "@/modules/analytics/services/export-service";
import { AnalyticsReportType } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ANALYTICS_EXPORT);
    const body = await request.json();

    const reportType = body.reportType as AnalyticsReportType;
    if (!reportType) {
      return NextResponse.json({ error: "Missing reportType parameter" }, { status: 400 });
    }

    const result = await ExportService.generateReportCsv(
      authContext.tenantId,
      authContext.userId,
      reportType,
      body.filterPayload || {}
    );

    if (!result.success || !result.csvContent) {
      return NextResponse.json({ error: result.error || "Export failed" }, { status: 500 });
    }

    // Return CSV file response
    return new NextResponse(result.csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
