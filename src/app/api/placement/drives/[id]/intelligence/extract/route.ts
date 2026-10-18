import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AIExtractionService } from "@/modules/recruitment-intelligence/services/ai-extraction-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    await requireAuthContext(Permissions.INTELLIGENCE_REQUIREMENTS_MANAGE);
    const body = await request.json();

    if (!body.text || body.text.trim().length === 0) {
      return NextResponse.json(
        { error: "Source text content is required for extraction." },
        { status: 400 }
      );
    }

    const extraction = await AIExtractionService.extractFromSourceText(body.text, {
      companyName: body.companyName || "Target Company",
      roleTitle: body.roleTitle,
      driveTitle: body.driveTitle,
    });

    return NextResponse.json(extraction);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
