import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { HistoricalRecruitmentService } from "@/modules/placement-memory/services/historical-recruitment-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_READ);
    const { id } = await params;

    const result = await HistoricalRecruitmentService.getRecordById(authContext.tenantId, id);

    if (!result.success || !result.record) {
      return NextResponse.json({ error: result.error || "Record not found" }, { status: 404 });
    }

    return NextResponse.json({ record: result.record });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.PLACEMENT_MEMORY_MANAGE);
    const { id } = await params;
    const body = await request.json();

    if (body.action === "LINK_QUESTION_SET" && body.questionSetId) {
      const result = await HistoricalRecruitmentService.linkQuestionSet(
        authContext.tenantId,
        id,
        body.questionSetId
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (body.action === "SUPERSEDE" && body.supersededById) {
      const result = await HistoricalRecruitmentService.supersedeRecord(
        authContext.tenantId,
        id,
        body.supersededById
      );
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid PATCH action or missing arguments" }, { status: 400 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
