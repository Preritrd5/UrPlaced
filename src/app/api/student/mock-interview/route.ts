/**
 * Mock Interview Studio API
 * GET /api/student/mock-interview — Lists student's past interview sessions
 * POST /api/student/mock-interview — Initializes a new session and generates question 1
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { MockInterviewService, InterviewType, InterviewDifficulty } from "@/modules/students/services/mock-interview-service";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
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

    const sessions = await MockInterviewService.listSessions(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("UNAUTHORIZED") || msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      msg.startsWith("FORBIDDEN") ||
      msg.includes("NO_ACTIVE_TENANT") ||
      msg === "FORBIDDEN" ||
      msg.includes("MEMBERSHIP_") ||
      msg.includes("SUBSCRIPTION_")
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to load mock interview history." },
      { status: 500 }
    );
  }
}

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

    // Rate limiting check
    const rateCheck = AIRateLimiter.checkLimit(authContext.userId, "STUDENT");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const body = await request.json();
    const { interviewType, targetRole, difficulty, totalQuestions, targetDriveId } = body;

    const validTypes: InterviewType[] = ["TECHNICAL", "HR", "BEHAVIOURAL", "PROJECT_BASED", "COMPANY_SPECIFIC"];
    if (!interviewType || !validTypes.includes(interviewType)) {
      return NextResponse.json(
        { error: `Invalid interview type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    if (!targetRole || typeof targetRole !== "string" || targetRole.trim().length === 0) {
      return NextResponse.json({ error: "Target job role is required." }, { status: 400 });
    }

    const session = await MockInterviewService.createSession({
      tenantId: authContext.tenantId,
      studentId: student.id,
      interviewType,
      targetRole: targetRole.trim(),
      difficulty: ["BEGINNER", "INTERMEDIATE", "ADVANCED"].includes(difficulty) ? difficulty : "INTERMEDIATE",
      totalQuestions: totalQuestions ? Number(totalQuestions) : 4,
      targetDriveId: targetDriveId || null,
      userId: authContext.userId,
    });

    return NextResponse.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    const msg = String(error?.message || "");
    if (msg.startsWith("UNAUTHORIZED") || msg === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      msg.startsWith("FORBIDDEN") ||
      msg.includes("NO_ACTIVE_TENANT") ||
      msg === "FORBIDDEN" ||
      msg.includes("MEMBERSHIP_") ||
      msg.includes("SUBSCRIPTION_")
    ) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Mock Interview Create API] Error:", error);
    return NextResponse.json(
      { error: "Failed to initialize mock interview." },
      { status: 500 }
    );
  }
}
