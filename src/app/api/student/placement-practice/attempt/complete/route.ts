/**
 * Placement Practice Complete Attempt API
 * POST /api/student/placement-practice/attempt/complete
 * Calculates authoritative score and generates review report server-side
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { PlacementPracticeService } from "@/modules/students/services/placement-practice-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const authContext = await requireAuthContext(Permissions.ASSESSMENTS_ATTEMPT, undefined, token);
    const student = await StudentService.getByUserId(authContext.tenantId, authContext.userId);

    if (!student || student.is_archived || student.academic_status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { attemptId, submissions, totalDurationSeconds } = body;

    if (!attemptId || !Array.isArray(submissions)) {
      return NextResponse.json(
        { error: "attemptId and submissions array are required." },
        { status: 400 }
      );
    }

    const evaluation = await PlacementPracticeService.completePracticeAttempt(
      authContext.tenantId,
      student.id,
      attemptId,
      submissions,
      totalDurationSeconds || 0
    );

    return NextResponse.json({
      success: true,
      data: evaluation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to evaluate practice attempt" },
      { status: 500 }
    );
  }
}
