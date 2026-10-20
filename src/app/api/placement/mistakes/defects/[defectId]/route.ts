import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { ContentDefectService } from "@/modules/mistake-mastery/services/content-defect-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ defectId: string }> }
) {
  try {
    const { defectId } = await params;
    const authContext = await requireAuthContext(Permissions.QUESTION_DEFECTS_MANAGE);
    const body = await request.json();
    const { decision, resolutionNotes, invalidateStudentMistakes } = body;

    if (!decision || !resolutionNotes) {
      return NextResponse.json(
        { error: "decision and resolutionNotes are required." },
        { status: 400 }
      );
    }

    const res = await ContentDefectService.resolveDefect(
      authContext.tenantId,
      authContext.userId,
      {
        defectId,
        decision,
        resolutionNotes,
        invalidateStudentMistakes: !!invalidateStudentMistakes,
      }
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json(res);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
