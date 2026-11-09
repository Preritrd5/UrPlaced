/**
 * Placement Practice API
 * GET /api/student/placement-practice
 * Retrieves Practice Centre summary, categories, and recent activity
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { PlacementPracticeService, PRACTICE_CATEGORIES } from "@/modules/students/services/placement-practice-service";

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

    const summary = await PlacementPracticeService.getPracticeDashboardSummary(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({
      success: true,
      data: {
        summary,
        categories: PRACTICE_CATEGORIES,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load placement practice center" },
      { status: 500 }
    );
  }
}
