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
    if (err.message?.startsWith("UNAUTHORIZED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.startsWith("FORBIDDEN") || err?.statusCode === 403) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
