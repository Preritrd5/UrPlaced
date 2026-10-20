import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AssessmentService } from "@/modules/assessments/services/assessment-service";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_READ);
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get("purpose") as any;
    const status = searchParams.get("status") as any;
    const driveId = searchParams.get("driveId") || undefined;

    const result = await AssessmentService.listAssessments(authContext.tenantId, {
      purpose,
      status,
      driveId,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result.assessments);
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_CREATE);
    const body = await request.json();

    if (!body.title || !body.question_set_id) {
      return NextResponse.json(
        { error: "Assessment title and question set are required." },
        { status: 400 }
      );
    }

    const result = await AssessmentService.createAssessment(
      authContext.tenantId,
      authContext.userId,
      {
        title: body.title,
        description: body.description,
        purpose: body.purpose,
        question_set_id: body.question_set_id,
        drive_id: body.drive_id,
        time_limit_minutes: body.time_limit_minutes,
        allowed_attempts: body.allowed_attempts,
        review_policy: body.review_policy,
        release_policy: body.release_policy,
        shuffle_questions: body.shuffle_questions,
        pass_percentage: body.pass_percentage,
      }
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.assessment, { status: 201 });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message === "FORBIDDEN") {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
