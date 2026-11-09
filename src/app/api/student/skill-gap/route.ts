/**
 * Skill Gap Analyzer API
 * GET /api/student/skill-gap — Fetches latest analysis and progress summary
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { SkillGapAnalyzerService } from "@/modules/students/services/skill-gap-analyzer-service";

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

    const url = new URL(request.url);
    const targetRole = url.searchParams.get("role") || undefined;

    const analysis = await SkillGapAnalyzerService.getLatestAnalysis(
      authContext.tenantId,
      student.id,
      targetRole
    );

    const progress = await SkillGapAnalyzerService.getSkillProgress(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        progressSummary: progress.summary,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to load skill gap analysis." },
      { status: 500 }
    );
  }
}
