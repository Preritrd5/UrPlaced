import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { RequirementService } from "@/modules/recruitment-intelligence/services/requirement-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; reqId: string }> }
) {
  try {
    const { reqId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_REQUIREMENTS_VERIFY);
    const body = await request.json();

    if (body.action === "RESOLVE_CONFLICT") {
      const resolved = await RequirementService.resolveConflict(
        authContext.tenantId,
        reqId,
        body.resolution || "KEEP_THIS",
        body.newValue,
        authContext.userId
      );
      return NextResponse.json(resolved);
    }

    const verified = await RequirementService.verifyRequirement(
      authContext.tenantId,
      reqId,
      authContext.userId,
      body.status || "VERIFIED"
    );

    return NextResponse.json(verified);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
