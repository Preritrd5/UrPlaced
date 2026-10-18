import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext(Permissions.QUESTIONS_REVIEW);
    const body = await request.json();

    if (!body.versionId || !body.reviewStatus) {
      return NextResponse.json(
        { error: "versionId and reviewStatus are required." },
        { status: 400 }
      );
    }

    const res = await QuestionService.verifyAnswerKey(
      authContext.tenantId,
      authContext.userId,
      id,
      body.versionId,
      body.reviewStatus,
      body.reviewNotes
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, reviewStatus: body.reviewStatus });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
