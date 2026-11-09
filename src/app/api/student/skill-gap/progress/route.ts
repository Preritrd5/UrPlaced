/**
 * Skill Progress Tracking API
 * GET /api/student/skill-gap/progress — Lists skill progress items and overall roadmap metrics
 * PUT /api/student/skill-gap/progress — Updates status or attaches evidence links
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

    const progress = await SkillGapAnalyzerService.getSkillProgress(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({
      success: true,
      data: progress,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to load skill progress." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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
    const { skillName, status, evidenceLink, notes } = body;

    if (!skillName || typeof skillName !== "string") {
      return NextResponse.json({ error: "Skill name is required." }, { status: 400 });
    }

    const updated = await SkillGapAnalyzerService.updateSkillProgress({
      tenantId: authContext.tenantId,
      studentId: student.id,
      skillName: skillName.trim(),
      status,
      evidenceLink,
      notes,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Skill Progress Update API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update skill progress." },
      { status: 500 }
    );
  }
}
