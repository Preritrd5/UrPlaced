import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AttemptLifecycleService } from "@/modules/assessments/services/attempt-lifecycle-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT);
    const { id } = await params;
    const supabase = await createClient();

    let studentId: string | null = null;
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", authContext.userId)
      .maybeSingle();

    if (student) {
      studentId = student.id;
    } else {
      const { data: studentByEmail } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", authContext.tenantId)
        .eq("email", authContext.email)
        .maybeSingle();

      if (studentByEmail) {
        studentId = studentByEmail.id;
      }
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "No student profile linked to this account." },
        { status: 404 }
      );
    }

    const result = await AttemptLifecycleService.getAttemptState(
      authContext.tenantId,
      studentId,
      id
    );

    if (!result.success || !result.state) {
      return NextResponse.json({ error: result.error || "Not found" }, { status: 404 });
    }

    return NextResponse.json(result.state);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
