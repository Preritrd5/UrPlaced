/**
 * Placement Practice Start Attempt API
 * POST /api/student/placement-practice/attempt/start
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
    const { practiceMode, category, topic, difficulty, questionCount, timeLimitMinutes } = body;

    if (!practiceMode) {
      return NextResponse.json(
        { error: "practiceMode is required." },
        { status: 400 }
      );
    }

    const attemptSession = await PlacementPracticeService.startPracticeAttempt(
      authContext.tenantId,
      student.id,
      {
        practiceMode,
        category,
        topic,
        difficulty,
        questionCount: questionCount || 5,
        timeLimitMinutes,
      }
    );

    return NextResponse.json({
      success: true,
      data: attemptSession,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to start practice attempt" },
      { status: 500 }
    );
  }
}
