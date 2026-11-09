/**
 * Personalized Learning Recommendations API
 * GET /api/student/learning-recommendations
 * Synthesizes cross-module student evidence into prioritized recommendations & learning roadmap
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { LearningRecommendationsService } from "@/modules/students/services/learning-recommendations-service";

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
    const targetRole = url.searchParams.get("role") || "Software Developer";

    const recommendationsData = await LearningRecommendationsService.getRecommendations(
      authContext.tenantId,
      student.id
    );

    const roadmapData = await LearningRecommendationsService.getLearningRoadmap(
      authContext.tenantId,
      student.id,
      targetRole
    );

    return NextResponse.json({
      success: true,
      data: {
        ...recommendationsData,
        roadmap: roadmapData,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load learning recommendations" },
      { status: 500 }
    );
  }
}
