import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { PracticeCatalogueService } from "@/modules/assessments/services/practice-catalogue-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.PRACTICE_READ);
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") as any;
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

    const { responses, error } = await PracticeCatalogueService.listBehavioralResponses(
      authContext.tenantId,
      studentId,
      category
    );

    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json(responses);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

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

    if (!body.prompt || !body.response_text) {
      return NextResponse.json(
        { error: "Prompt and response text are required." },
        { status: 400 }
      );
    }

    const result = await PracticeCatalogueService.saveBehavioralResponse(
      authContext.tenantId,
      studentId,
      {
        prompt: body.prompt,
        category: body.category || "HR_INTERVIEW",
        response_text: body.response_text,
        self_reflection: body.self_reflection,
        key_learnings: body.key_learnings,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
