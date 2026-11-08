/**
 * AI Resume ATS Diagnostic Scan API
 * POST /api/student/resumes/[id]/analyze
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { ResumeScannerService } from "@/modules/students/services/resume-scanner-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: resumeId } = await params;
    let token: string | undefined;
    const authHeader = request?.headers?.get?.("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }

    const authContext = await requireAuthContext(
      Permissions.ASSESSMENTS_ATTEMPT,
      undefined,
      token
    );

    const student = await StudentService.getByUserId(
      authContext.tenantId,
      authContext.userId
    );

    if (!student || student.is_archived || student.academic_status !== "ACTIVE") {
      return NextResponse.json(
        { error: "No active verified student profile linked to this account." },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const scan = await ResumeScannerService.scanResume({
      tenantId: authContext.tenantId,
      studentId: student.id,
      resumeId,
      targetDriveId: body.targetDriveId,
      targetRole: body.targetRole,
      jobDescription: body.jobDescription,
    });

    return NextResponse.json({
      success: true,
      data: scan,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Resume Analyze API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to analyze resume" },
      { status: 500 }
    );
  }
}
