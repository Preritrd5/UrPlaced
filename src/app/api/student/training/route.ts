import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.TRAINING_SESSIONS_ATTEND);
    const supabase = await createServerSupabaseClient();

    // Fetch training sessions where student is enrolled
    const { data: attendanceList, error: attErr } = await supabase
      .from("training_attendance")
      .select(`
        session_id,
        enrollment_status,
        attendance_status,
        pre_score,
        post_score,
        training_sessions(
          id,
          title,
          description,
          topic,
          session_date,
          duration_minutes,
          status,
          baseline_assessment_id,
          follow_up_assessment_id,
          skills(name)
        )
      `)
      .eq("tenant_id", authContext.tenantId)
      .eq("student_id", authContext.userId);

    if (attErr) {
      return NextResponse.json({ error: attErr.message }, { status: 500 });
    }

    return NextResponse.json({ sessions: attendanceList || [] });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
