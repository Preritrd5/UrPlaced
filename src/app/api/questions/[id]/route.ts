import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { QuestionService } from "@/modules/question-bank/services/question-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext();

    const result = await QuestionService.getQuestionById(
      authContext.tenantId,
      authContext.tenantRole,
      id
    );

    if (result.error || !result.data) {
      return NextResponse.json({ error: result.error || "Question not found." }, { status: 404 });
    }

    return NextResponse.json(result.data);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext(Permissions.QUESTIONS_CREATE);
    const body = await request.json();

    const res = await QuestionService.updateQuestion(
      authContext.tenantId,
      authContext.userId,
      id,
      body
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authContext = await requireAuthContext(Permissions.QUESTIONS_MANAGE);
    const { searchParams } = new URL(request.url);
    const actionParam = searchParams.get("action");

    if (actionParam === "DELETE" || !actionParam) {
      const res = await QuestionService.deleteQuestion(
        authContext.tenantId,
        id
      );

      if (!res.success) {
        return NextResponse.json({ error: res.error }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        deleted: res.deleted ?? !res.archived,
        archived: res.archived ?? false,
        message: res.message || (res.archived ? "Question safely archived." : "Question permanently deleted."),
      });
    }

    const action = actionParam === "WITHDRAW" ? "WITHDRAWN" : "ARCHIVED";

    // Invariant: Non-destructive lifecycle archiving
    const res = await QuestionService.updateLifecycle(
      authContext.tenantId,
      id,
      action
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, status: action });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
