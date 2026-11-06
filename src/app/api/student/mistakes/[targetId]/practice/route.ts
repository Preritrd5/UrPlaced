import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { PracticeRecommendationService } from "@/modules/mistake-mastery/services/practice-recommendation-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  try {
    const { targetId } = await params;
    const authContext = await requireAuthContext(Permissions.MISTAKE_BANK_MANAGE_OWN);
    const supabase = createAdminClient();

    // 1. Resolve student profile
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", authContext.userId)
      .maybeSingle();

    let studentId = student?.id;
    if (!studentId) {
      const { data: studentByEmail } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", authContext.tenantId)
        .eq("email", authContext.email)
        .maybeSingle();
      studentId = studentByEmail?.id;
    }

    if (!studentId) {
      return NextResponse.json({ error: "No student profile linked to this account." }, { status: 404 });
    }

    const limit = Number(request.nextUrl.searchParams.get("limit") || 3);

    const res = await PracticeRecommendationService.getRetestPracticeQuestions(
      authContext.tenantId,
      studentId,
      targetId,
      limit
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    // Sanitize recommendations for student practice: strip answer_key and explanation
    const sanitized = (res.recommendations || []).map((rec) => ({
      questionId: rec.question.id,
      versionId: rec.version.id,
      questionType: rec.question.question_type,
      prompt: rec.version.prompt,
      contentFormat: rec.version.content_format,
      difficulty: rec.version.difficulty,
      options:
        (rec.version.options as any)?.options ||
        (Array.isArray(rec.version.options) ? rec.version.options : []),
      matchReason: rec.matchReason,
      isNewQuestion: rec.isNewQuestion,
    }));

    return NextResponse.json({
      target: res.target,
      recommendations: sanitized,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
