import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";

export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_MANAGE);
    const { searchParams } = new URL(request.url);

    const bankId = searchParams.get("bankId") || undefined;
    const subject = searchParams.get("subject") || undefined;

    const result = await QuestionService.bulkDeleteAllQuestions(
      authContext.tenantId,
      authContext.userId,
      { bankId, subject }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || result.message }, { status: 400 });
    }

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
    const authContext = await requireAuthContext(Permissions.QUESTIONS_MANAGE);
    const body = await request.json().catch(() => ({}));

    const bankId = body.bankId || undefined;
    const subject = body.subject || undefined;

    const result = await QuestionService.bulkDeleteAllQuestions(
      authContext.tenantId,
      authContext.userId,
      { bankId, subject }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error || result.message }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
