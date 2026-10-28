import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { QuestionDifficulty, QuestionType } from "@/types/database";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);
    const body = await request.json().catch(() => ({}));

    if (!body.currentQuestionId || !body.subject) {
      return NextResponse.json(
        { error: "currentQuestionId and subject are required." },
        { status: 400 }
      );
    }

    const swapRes = await QuestionSetService.swapPreviewItem(authContext.tenantId, {
      currentQuestionId: body.currentQuestionId,
      subject: body.subject,
      difficulty: body.difficulty as QuestionDifficulty,
      questionType: body.questionType as QuestionType,
      alreadySelectedIds: Array.isArray(body.alreadySelectedIds) ? body.alreadySelectedIds : [],
    });

    if (!swapRes.success) {
      return NextResponse.json({ error: swapRes.error }, { status: 400 });
    }

    return NextResponse.json(swapRes);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied. Requires Question Sets permission." }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
