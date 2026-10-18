import { NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { SkillMappingService } from "@/modules/recruitment-intelligence/services/skill-mapping-service";

export async function GET() {
  try {
    await requireAuthContext();
    const skills = await SkillMappingService.getCanonicalSkills();
    return NextResponse.json(skills);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
