import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AssignmentService } from "@/modules/assessments/services/assignment-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_READ);
    const { id } = await params;

    const result = await AssignmentService.listAssignmentsForAssessment(
      authContext.tenantId,
      id
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ASSIGN);
    const { id } = await params;
    const body = await request.json();

    const result = await AssignmentService.assignAssessment(
      authContext.tenantId,
      authContext.userId,
      {
        assessment_id: id,
        student_ids: body.student_ids,
        department_ids: body.department_ids,
        graduation_years: body.graduation_years,
        target_type: body.target_type,
        cohort_name: body.cohort_name,
        window_start: body.window_start,
        window_end: body.window_end,
        max_attempts_override: body.max_attempts_override,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      createdCount: result.createdCount,
      recipientCount: result.recipientCount ?? result.createdCount,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
