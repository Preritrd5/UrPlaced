import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { SkillMappingService } from "@/modules/recruitment-intelligence/services/skill-mapping-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_SOURCES_READ);

    const coverage = await SkillMappingService.calculateDriveRequirementCoverage(
      authContext.tenantId,
      driveId
    );

    return NextResponse.json(coverage);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
