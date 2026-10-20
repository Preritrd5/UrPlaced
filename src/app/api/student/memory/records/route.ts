import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { HistoricalRecruitmentService } from "@/modules/placement-memory/services/historical-recruitment-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_READ);
    const searchParams = request.nextUrl.searchParams;

    const filter = {
      companyId: searchParams.get("companyId") || undefined,
      roleTitle: searchParams.get("roleTitle") || undefined,
      recruitmentYear: searchParams.get("recruitmentYear") || undefined,
    };

    const result = await HistoricalRecruitmentService.listRecords(authContext.tenantId, filter);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ records: result.records });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
