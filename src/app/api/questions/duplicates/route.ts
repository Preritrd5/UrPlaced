import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_REVIEW);
    const supabase = await createServerSupabaseClient();

    const { data: candidates, error } = await supabase
      .from("question_duplicate_candidates")
      .select(`
        id,
        source_question_id,
        matched_question_id,
        similarity_score,
        detection_method,
        status,
        created_at,
        source_question:questions!question_duplicate_candidates_source_question_id_fkey(
          id,
          question_type,
          lifecycle_status,
          current_version:question_versions!fk_questions_current_version(prompt, difficulty)
        ),
        matched_question:questions!question_duplicate_candidates_matched_question_id_fkey(
          id,
          question_type,
          lifecycle_status,
          current_version:question_versions!fk_questions_current_version(prompt, difficulty)
        )
      `)
      .eq("tenant_id", authContext.tenantId)
      .order("similarity_score", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(candidates || []);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.QUESTIONS_REVIEW);
    const body = await request.json();

    if (!body.id || !body.status) {
      return NextResponse.json(
        { error: "id and status are required." },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("question_duplicate_candidates")
      .update({
        status: body.status,
        reviewed_by: authContext.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("tenant_id", authContext.tenantId)
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, status: body.status });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
