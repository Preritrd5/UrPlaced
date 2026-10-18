import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { SourceIngestionService } from "@/modules/recruitment-intelligence/services/source-ingestion-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    await requireAuthContext(Permissions.INTELLIGENCE_SOURCES_MANAGE);
    const body = await request.json();

    if (!body.url) {
      return NextResponse.json({ error: "Source URL is required." }, { status: 400 });
    }

    const result = await SourceIngestionService.fetchRemoteSourceText(body.url);
    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
