import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ContentDefectService } from "@/modules/mistake-mastery/services/content-defect-service";
import { DefectReportStatus } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTION_DEFECTS_MANAGE);
    const status = request.nextUrl.searchParams.get("status") as DefectReportStatus | null;
    const questionId = request.nextUrl.searchParams.get("questionId") || undefined;

    const res = await ContentDefectService.listReports(authContext.tenantId, {
      status: status || undefined,
      questionId,
    });

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json(res.reports);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
