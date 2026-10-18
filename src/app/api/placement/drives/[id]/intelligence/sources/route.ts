import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { SourceService } from "@/modules/recruitment-intelligence/services/source-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_SOURCES_READ);

    const sources = await SourceService.getSources(authContext.tenantId, {
      driveId,
    });

    return NextResponse.json(sources);
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
    const authContext = await requireAuthContext(Permissions.INTELLIGENCE_SOURCES_MANAGE);
    const body = await request.json();

    if (!body.title || !body.publisher || !body.companyId) {
      return NextResponse.json(
        { error: "Title, publisher, and company ID are required." },
        { status: 400 }
      );
    }

    const source = await SourceService.createSource({
      tenantId: authContext.tenantId,
      companyId: body.companyId,
      driveId,
      title: body.title,
      publisher: body.publisher,
      sourceType: body.sourceType || "MANUAL_ENTRY",
      canonicalUrl: body.canonicalUrl,
      documentRef: body.documentRef,
      publishedAt: body.publishedAt,
      effectiveAt: body.effectiveAt,
      accessClassification: body.accessClassification || "TENANT_CONFIDENTIAL",
      rawContent: body.rawContent,
      excerpt: body.excerpt,
      userId: authContext.userId,
    });

    return NextResponse.json(source, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
