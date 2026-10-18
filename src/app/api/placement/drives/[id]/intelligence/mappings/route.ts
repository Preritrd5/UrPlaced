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

    const mappings = await SkillMappingService.getMappingsForDrive(
      authContext.tenantId,
      driveId
    );

    return NextResponse.json(mappings);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_MAPPINGS_MANAGE);
    const body = await request.json();

    if (!body.requirementId || !body.skillId || !body.mappingRationale) {
      return NextResponse.json(
        { error: "Requirement ID, Skill ID, and Mapping Rationale are required." },
        { status: 400 }
      );
    }

    const mapping = await SkillMappingService.createMapping({
      tenantId: authContext.tenantId,
      driveId,
      requirementId: body.requirementId,
      skillId: body.skillId,
      importance: body.importance || "RECOMMENDED",
      mappingRationale: body.mappingRationale,
      mappingOrigin: body.mappingOrigin || "HUMAN_AUTHORED",
      evidenceLevel: body.evidenceLevel || "INFERRED",
      userId: authContext.userId,
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_MAPPINGS_MANAGE);
    const { searchParams } = new URL(request.url);
    const mappingId = searchParams.get("mappingId");

    if (!mappingId) {
      return NextResponse.json({ error: "Mapping ID is required." }, { status: 400 });
    }

    await SkillMappingService.deleteMapping(authContext.tenantId, mappingId, authContext.userId);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
