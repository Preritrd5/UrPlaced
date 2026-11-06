import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { MasteryEvaluationService } from "@/modules/mistake-mastery/services/mastery-evaluation-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: NextRequest) {
  try {
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

    const res = await MasteryEvaluationService.getStudentMasteryOverview(
      authContext.tenantId,
      studentId
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json(res);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
