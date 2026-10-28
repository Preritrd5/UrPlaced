import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionSetService } from "@/modules/question-bank/services/question-set-service";
import { QuestionType, QuestionDifficulty } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTION_SETS_MANAGE);
    const { searchParams } = new URL(request.url);

    const bankId = searchParams.get("bankId") || undefined;
    const subject = searchParams.get("subject") || undefined;
    const topic = searchParams.get("topic") || undefined;
    const questionType = (searchParams.get("questionType") as QuestionType) || undefined;
    const difficulty = (searchParams.get("difficulty") as QuestionDifficulty) || undefined;
    const search = searchParams.get("search") || undefined;
    const excludeSetId = searchParams.get("excludeSetId") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const data = await QuestionSetService.getEligibleQuestionsForBulkAdd(
      authContext.tenantId,
      {
        bankId,
        subject,
        topic,
        questionType,
        difficulty,
        search,
        excludeSetId,
        limit,
        offset,
      }
    );

    return NextResponse.json(data);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied. Requires Question Sets permission." }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
