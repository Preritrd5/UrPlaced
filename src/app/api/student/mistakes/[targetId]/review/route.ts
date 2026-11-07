import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { PracticeRecommendationService } from "@/modules/mistake-mastery/services/practice-recommendation-service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ targetId: string }> }
) {
  try {
    const { targetId } = await params;
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const authContext = await requireAuthContext(Permissions.MISTAKE_BANK_MANAGE_OWN, undefined, token);
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
    const { action, reasonCategory, reflection, notes } = body;

    if (action === "EXPLANATION_VIEWED") {
      const res = await PracticeRecommendationService.markExplanationViewed(
        authContext.tenantId,
        studentId,
        targetId
      );
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ success: true, message: "Explanation viewed recorded." });
    }

    if (action === "REFLECTION_SAVED") {
      if (!reasonCategory || !reflection) {
        return NextResponse.json(
          { error: "Reason category and reflection text are required." },
          { status: 400 }
        );
      }
      const res = await PracticeRecommendationService.saveStudentReflection(
        authContext.tenantId,
        studentId,
        targetId,
        reasonCategory,
        reflection
      );
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ success: true, target: res.target });
    }

    if (action === "DISMISS") {
      const res = await PracticeRecommendationService.dismissTarget(
        authContext.tenantId,
        studentId,
        targetId,
        notes
      );
      if (!res.success) return NextResponse.json({ error: res.error }, { status: 400 });
      return NextResponse.json({ success: true, target: res.target });
    }

    return NextResponse.json({ error: "Unknown review action." }, { status: 400 });
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
