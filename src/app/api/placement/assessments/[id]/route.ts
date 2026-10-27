import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AssessmentService } from "@/modules/assessments/services/assessment-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_READ);
    const { id } = await params;

    const result = await AssessmentService.getAssessmentById(authContext.tenantId, id);

    if (!result.success || !result.assessment) {
      return NextResponse.json({ error: result.error || "Not found" }, { status: 404 });
    }

    return NextResponse.json(result.assessment);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_MANAGE);
    const { id } = await params;

    const result = await AssessmentService.deleteAssessment(authContext.tenantId, id);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Assessment deleted successfully." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
