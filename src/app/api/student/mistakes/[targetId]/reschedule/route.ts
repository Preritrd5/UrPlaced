import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { RevisionSchedulerService } from "@/modules/mistake-mastery/services/revision-scheduler-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

    const body = await request.json();
    const { customDueDate, notes } = body;

    if (!customDueDate) {
      return NextResponse.json({ error: "customDueDate is required." }, { status: 400 });
    }

    const res = await RevisionSchedulerService.rescheduleTarget(
      authContext.tenantId,
      studentId,
      targetId,
      customDueDate,
      notes
    );

    if (!res.success) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, target: res.target });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
