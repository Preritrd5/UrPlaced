import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { RequirementService } from "@/modules/recruitment-intelligence/services/requirement-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_PUBLISH);
    const body = await request.json();

    if (!Array.isArray(body.requirementIds) || body.requirementIds.length === 0) {
      return NextResponse.json(
        { error: "Requirement IDs array is required." },
        { status: 400 }
      );
    }

    const isPublished = body.isPublished ?? true;
    const result = await RequirementService.setPublicationStatus(
      authContext.tenantId,
      body.requirementIds,
      isPublished,
      authContext.userId
    );

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
