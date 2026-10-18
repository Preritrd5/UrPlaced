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

    const supabase = await createServerSupabaseClient();
    const { data: question, error } = await supabase
      .from("questions")
      .select(`
        id,
        tenant_id,
        bank_id,
        question_type,
        current_version_id,
        lifecycle_status,
        created_at,
        updated_at,
        bank:question_banks(id, name, category, sharing_policy),
        versions:question_versions(
          id,
          version_number,
          prompt,
          content_format,
          options,
          answer_key,
          explanation,
          difficulty,
          skill_id,
          topic_tags,
          source_type,
          source_reference,
          license_type,
          review_status,
          review_notes,
          fingerprint,
          change_summary,
          published_at,
          created_by,
          created_at
        )
      `)
      .eq("tenant_id", authContext.tenantId)
      .eq("id", id)
      .single();

    if (error || !question) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    let versions = (question.versions || []) as any[];
    // Role-based sanitization for student
    if (authContext.tenantRole === "STUDENT") {
      if (question.lifecycle_status !== "PUBLISHED") {
        return NextResponse.json({ error: "Access denied." }, { status: 403 });
      }
      versions = versions.map((v: any) =>
        QuestionService.sanitizeForStudent(v, question.question_type)
      );
    }

    return NextResponse.json({ ...question, versions });
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
    const action = searchParams.get("action") === "WITHDRAW" ? "WITHDRAWN" : "ARCHIVED";

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
