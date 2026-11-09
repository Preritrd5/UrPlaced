/**
 * Skill Gap Analyzer Run API
 * POST /api/student/skill-gap/analyze — Triggers personalized skill gap evaluation
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { SkillGapAnalyzerService } from "@/modules/students/services/skill-gap-analyzer-service";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";

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

    // AI rate limit check
    const rateCheck = AIRateLimiter.checkLimit(authContext.userId, "STUDENT");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
    }

    const body = await request.json();
    const { targetRole, targetDriveId, customJobDescription, forceRefresh } = body;

    if (!targetRole || typeof targetRole !== "string" || targetRole.trim().length === 0) {
      return NextResponse.json(
        { error: "Target job role is required for skill gap analysis." },
        { status: 400 }
      );
    }

    const result = await SkillGapAnalyzerService.analyze({
      tenantId: authContext.tenantId,
      studentId: student.id,
      targetRole: targetRole.trim(),
      targetDriveId: targetDriveId || null,
      customJobDescription: customJobDescription || null,
      forceRefresh: Boolean(forceRefresh),
      userId: authContext.userId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[SkillGap Analyze API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze skill gap." },
      { status: 500 }
    );
  }
}
