import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AttemptLifecycleService } from "@/modules/assessments/services/attempt-lifecycle-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const supabase = await createClient();

    let studentId: string | null = null;
    const { data: student } = await supabase
      .from("students")
      .select("id, is_archived, academic_status")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", authContext.userId)
      .maybeSingle();

    if (student && !student.is_archived && student.academic_status === "ACTIVE") {
      studentId = student.id;
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    const result = await AttemptLifecycleService.submitAttempt(
      authContext.tenantId,
      studentId,
      id,
      body.submissionReason || "MANUAL",
      body.metadata || {}
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.attempt);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
