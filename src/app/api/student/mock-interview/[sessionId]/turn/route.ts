/**
 * Mock Interview Turn Answer API
 * POST /api/student/mock-interview/[sessionId]/turn — Submits student answer, evaluates, advances
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { MockInterviewService } from "@/modules/students/services/mock-interview-service";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;

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

    // Rate limiting check
    const rateCheck = AIRateLimiter.checkLimit(authContext.userId, "STUDENT");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const body = await request.json();
    const { questionIndex, answerText } = body;

    if (!questionIndex || typeof questionIndex !== "number") {
      return NextResponse.json({ error: "questionIndex is required." }, { status: 400 });
    }

    if (!answerText || typeof answerText !== "string" || answerText.trim().length === 0) {
      return NextResponse.json({ error: "Answer text is required." }, { status: 400 });
    }

    if (answerText.length > 5000) {
      return NextResponse.json(
        { error: "Answer exceeds maximum permitted character length (5000)." },
        { status: 400 }
      );
    }

    const turnResult = await MockInterviewService.submitAnswer({
      tenantId: authContext.tenantId,
      studentId: student.id,
      sessionId,
      questionIndex,
      answerText: answerText.trim(),
      userId: authContext.userId,
    });

    return NextResponse.json({
      success: true,
      data: turnResult,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Mock Interview Turn API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process interview response." },
      { status: 500 }
    );
  }
}
