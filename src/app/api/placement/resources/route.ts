import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { SkillMappingService } from "@/modules/recruitment-intelligence/services/skill-mapping-service";

export async function GET(request: NextRequest) {
  try {
    await requireAuthContext();
    const { searchParams } = new URL(request.url);
    const skillId = searchParams.get("skillId") || undefined;

    const resources = await SkillMappingService.getPracticeResources(skillId);
    return NextResponse.json(resources);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
