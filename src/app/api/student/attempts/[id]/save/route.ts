import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AutosaveService } from "@/modules/assessments/services/autosave-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT);
    const { id } = await params;
    const body = await request.json();
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

    if (!body.questionId || !body.versionId) {
      return NextResponse.json(
        { error: "questionId and versionId are required." },
        { status: 400 }
      );
    }

    const result = await AutosaveService.saveResponse(
      authContext.tenantId,
      studentId,
      {
        attemptId: id,
        questionId: body.questionId,
        versionId: body.versionId,
        responsePayload: body.responsePayload || {},
        saveSequence: Number(body.saveSequence || 1),
        isFlagged: body.isFlagged,
        isAnswered: body.isAnswered,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
