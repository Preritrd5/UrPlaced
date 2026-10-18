import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { SourceService } from "@/modules/recruitment-intelligence/services/source-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { sourceId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_REQUIREMENTS_VERIFY);
    const body = await request.json();

    if (!body.verificationStatus) {
      return NextResponse.json(
        { error: "Verification status is required." },
        { status: 400 }
      );
    }

    const updated = await SourceService.updateVerificationStatus(
      authContext.tenantId,
      sourceId,
      authContext.userId,
      body.verificationStatus,
      body.reviewNotes
    );

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
