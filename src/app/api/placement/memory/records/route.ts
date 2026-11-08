import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import {
  HistoricalRecruitmentService,
  CreateHistoricalRecordInput,
} from "@/modules/placement-memory/services/historical-recruitment-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_READ);
    const searchParams = request.nextUrl.searchParams;

    const filter = {
      companyId: searchParams.get("companyId") || undefined,
      roleTitle: searchParams.get("roleTitle") || undefined,
      recruitmentYear: searchParams.get("recruitmentYear") || undefined,
      reliabilityLabel: (searchParams.get("reliabilityLabel") as any) || undefined,
      recordType: (searchParams.get("recordType") as any) || undefined,
    };

    const result = await HistoricalRecruitmentService.listRecords(authContext.tenantId, filter);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ records: result.records });
  } catch (error: any) {
    const msg = error.message || "Failed to list memory records";
    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg.includes("FORBIDDEN") || msg.includes("FEATURE_NOT_IN_PLAN")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_MANAGE);
    const body: CreateHistoricalRecordInput = await request.json();

    const result = await HistoricalRecruitmentService.createRecord(
      authContext.tenantId,
      authContext.userId,
      body
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ record: result.record }, { status: 201 });
  } catch (error: any) {
    const msg = error.message || "Failed to list memory records";
    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (msg.includes("FORBIDDEN") || msg.includes("FEATURE_NOT_IN_PLAN")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
