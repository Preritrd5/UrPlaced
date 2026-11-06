import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AssignmentService } from "@/modules/assessments/services/assignment-service";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT);
    const supabase = await createClient();

    // 1. Resolve student record (strictly via canonical user_id binding, no email fallback)
    let studentId: string | null = null;
    let { data: student } = await supabase
      .from("students")
      .select("id, is_archived, academic_status")
      .eq("tenant_id", authContext.tenantId)
      .eq("user_id", authContext.userId)
      .maybeSingle();

    if (!student) {
      const admin = createAdminClient();
      const { data: adminStudent } = await admin
        .from("students")
        .select("id, is_archived, academic_status")
        .eq("tenant_id", authContext.tenantId)
        .eq("user_id", authContext.userId)
        .maybeSingle();
      student = adminStudent;
    }

    if (student && !student.is_archived && student.academic_status === "ACTIVE") {
      studentId = student.id;
    }

    if (!studentId) {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    const result = await AssignmentService.listAssignmentsForStudent(
      authContext.tenantId,
      studentId
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.assignments);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
