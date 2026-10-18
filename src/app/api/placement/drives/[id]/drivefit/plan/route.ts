import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { createClient } from "@/lib/supabase/server";
import { PreparationPlannerService } from "@/modules/recruitment-intelligence/services/preparation-planner-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: driveId } = await params;
    const authContext = await requireAuthContext();
    const { searchParams } = new URL(request.url);

    const supabase = await createClient();
    let targetStudentId = searchParams.get("studentId");

    // If student user, lookup their student record
    if (authContext.tenantRole === "STUDENT" || !targetStudentId) {
      const { data: student } = await supabase
        .from("students")
        .select("id")
        .eq("tenant_id", authContext.tenantId)
        .eq("user_id", authContext.userId)
        .maybeSingle();

      if (!student) {
        // Fallback: check if any student matches the user's email
        const { data: studentByEmail } = await supabase
          .from("students")
          .select("id")
          .eq("tenant_id", authContext.tenantId)
          .eq("email", authContext.email)
          .maybeSingle();

        if (studentByEmail) {
          targetStudentId = studentByEmail.id;
        } else {
          return NextResponse.json(
            { error: "Student profile not linked to this account." },
            { status: 404 }
          );
        }
      } else {
        targetStudentId = student.id;
      }
    }

    if (!targetStudentId) {
      return NextResponse.json(
        { error: "Student ID is required or not linked to current profile." },
        { status: 404 }
      );
    }

    const planSummary = await PreparationPlannerService.getOrCreatePlan(
      authContext.tenantId,
      targetStudentId,
      driveId
    );

    return NextResponse.json(planSummary);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const authContext = await requireAuthContext();
    const body = await request.json();

    if (!body.taskId || !body.status) {
      return NextResponse.json(
        { error: "Task ID and status are required." },
        { status: 400 }
      );
    }

    const updated = await PreparationPlannerService.updateTaskStatus(
      authContext.tenantId,
      body.taskId,
      body.status
    );

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
