import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { PracticeCatalogueService } from "@/modules/assessments/services/practice-catalogue-service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.PRACTICE_READ);
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

    const { error } = await PracticeCatalogueService.logPracticeSession(
      authContext.tenantId,
      studentId,
      {
        skill_id: body.skill_id,
        topic: body.topic,
        questions_practiced: Number(body.questions_practiced || 0),
        correct_count: Number(body.correct_count || 0),
        time_spent_seconds: Number(body.time_spent_seconds || 0),
      }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Practice session logged." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
