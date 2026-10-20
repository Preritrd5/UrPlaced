import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  try {
    const { targetId } = await params;
    const authContext = await requireAuthContext(Permissions.MISTAKE_BANK_MANAGE_OWN);
    const supabase = await createClient();

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

    // 2. Fetch the review target with question version and skill details
    const { data: target, error: targetErr } = await supabase
      .from("mistake_review_targets")
      .select(`
        *,
        questions!inner(
          id,
          question_type
        ),
        question_versions!inner(
          id,
          version_number,
          prompt,
          content_format,
          difficulty,
          options,
          answer_key,
          explanation,
          test_cases,
          topic_tags
        ),
        canonical_skills(
          id,
          name,
          category
        )
      `)
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", studentId)
      .eq("id", targetId)
      .single();

    if (targetErr || !target) {
      return NextResponse.json({ error: "Mistake target not found." }, { status: 404 });
    }

    // 3. Fetch occurrences for this target
    const { data: occurrences } = await supabase
      .from("mistake_occurrences")
      .select(`
        id,
        attempt_id,
        capture_reason,
        submitted_payload,
        points_awarded,
        occurred_at,
        assessment_attempts(
          id,
          assessment_id,
          started_at,
          submitted_at,
          assessments(
            title
          )
        )
      `)
      .eq("tenant_id", authContext.tenantId)
      .eq("target_id", targetId)
      .order("occurred_at", { ascending: false });

    // 4. Fetch review sessions activity history
    const { data: reviewSessions } = await supabase
      .from("review_sessions")
      .select("*")
      .eq("tenant_id", authContext.tenantId)
      .eq("target_id", targetId)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      target,
      occurrences: occurrences || [],
      reviewSessions: reviewSessions || [],
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
