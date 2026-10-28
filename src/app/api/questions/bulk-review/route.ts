import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { QuestionType, QuestionDifficulty } from "@/types/database";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_REVIEW);
    const { searchParams } = new URL(request.url);

    const bankId = searchParams.get("bankId") || undefined;
    const subject = searchParams.get("subject") || undefined;
    const topic = searchParams.get("topic") || undefined;
    const questionType = (searchParams.get("questionType") as QuestionType) || undefined;
    const difficulty = (searchParams.get("difficulty") as QuestionDifficulty) || undefined;
    const search = searchParams.get("search") || undefined;

    const counts = await QuestionService.getEligibleReviewCount(authContext.tenantId, {
      bankId,
      subject,
      topic,
      questionType,
      difficulty,
      search,
    });

    return NextResponse.json(counts);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied. Requires review permissions." }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_REVIEW);
    const body = await request.json().catch(() => ({}));

    const result = await QuestionService.bulkAcceptQuestions(authContext.tenantId, authContext.userId, {
      bankId: body.bankId || undefined,
      subject: body.subject || undefined,
      topic: body.topic || undefined,
      questionType: body.questionType || undefined,
      difficulty: body.difficulty || undefined,
      search: body.search || undefined,
      questionIds: Array.isArray(body.questionIds) ? body.questionIds : undefined,
      reviewNotes: body.reviewNotes || undefined,
      limit: typeof body.limit === "number" ? body.limit : undefined,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Access denied. Requires review permissions." }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
