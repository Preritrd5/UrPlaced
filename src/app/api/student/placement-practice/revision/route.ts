/**
 * Placement Practice Revision API
 * GET /api/student/placement-practice/revision
 * Retrieves questions answered incorrectly in previous attempts
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { PlacementPracticeService } from "@/modules/students/services/placement-practice-service";

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

    const revisionQuestions = await PlacementPracticeService.getRevisionQuestions(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({
      success: true,
      data: revisionQuestions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load revision questions" },
      { status: 500 }
    );
  }
}
