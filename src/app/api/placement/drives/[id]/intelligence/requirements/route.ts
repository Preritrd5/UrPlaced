import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { RequirementService } from "@/modules/recruitment-intelligence/services/requirement-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_SOURCES_READ);

    const requirements = await RequirementService.getRequirements(authContext.tenantId, {
      driveId,
    });

    return NextResponse.json(requirements);
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
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_REQUIREMENTS_MANAGE);
    const body = await request.json();

    // Check if batch insert or single
    if (Array.isArray(body.requirements)) {
      const results = [];
      for (const req of body.requirements) {
        const item = await RequirementService.createRequirement({
          tenantId: authContext.tenantId,
          companyId: body.companyId,
          driveId,
          sourceId: req.sourceId || body.sourceId,
          scopeLevel: req.scopeLevel || "DRIVE",
          category: req.category,
          title: req.title,
          description: req.description,
          structuredValue: req.structuredValue,
          sourceExcerpt: req.sourceExcerpt,
          evidenceLevel: req.evidenceLevel || "INFERRED",
          userId: authContext.userId,
        });
        results.push(item);
      }
      return NextResponse.json(results, { status: 201 });
    }

    if (!body.title || !body.category || !body.companyId) {
      return NextResponse.json(
        { error: "Title, category, and company ID are required." },
        { status: 400 }
      );
    }

    const requirement = await RequirementService.createRequirement({
      tenantId: authContext.tenantId,
      companyId: body.companyId,
      driveId,
      sourceId: body.sourceId,
      scopeLevel: body.scopeLevel || "DRIVE",
      category: body.category,
      title: body.title,
      description: body.description,
      structuredValue: body.structuredValue,
      sourceExcerpt: body.sourceExcerpt,
      evidenceLevel: body.evidenceLevel || "INFERRED",
      userId: authContext.userId,
    });

    return NextResponse.json(requirement, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
