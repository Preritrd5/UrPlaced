import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext();
    const { searchParams } = new URL(request.url);

    const bankId = searchParams.get("bankId") || undefined;
    const questionType = (searchParams.get("questionType") as any) || undefined;
    const difficulty = (searchParams.get("difficulty") as any) || undefined;
    const lifecycleStatus = (searchParams.get("lifecycleStatus") as any) || undefined;
    const search = searchParams.get("search") || undefined;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;
    const offset = searchParams.get("offset") ? parseInt(searchParams.get("offset")!, 10) : 0;

    const result = await QuestionService.getQuestions(
      authContext.tenantId,
      authContext.tenantRole,
      {
        bankId,
        questionType,
        difficulty,
        lifecycleStatus,
        search,
        limit,
        offset,
      }
    );

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_CREATE);
    const body = await request.json();

    if (!body.bank_id || !body.question_type || !body.prompt || !body.answer_key) {
      return NextResponse.json(
        { error: "bank_id, question_type, prompt, and answer_key are required." },
        { status: 400 }
      );
    }

    const res = await QuestionService.createQuestion(
      authContext.tenantId,
      authContext.userId,
      {
        bank_id: body.bank_id,
        question_type: body.question_type,
        prompt: body.prompt,
        difficulty: body.difficulty,
        options: body.options,
        answer_key: body.answer_key,
        explanation: body.explanation,
        skill_id: body.skill_id,
        topic_tags: body.topic_tags,
        source_type: body.source_type,
        source_reference: body.source_reference,
        license_type: body.license_type,
      }
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json(res, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
