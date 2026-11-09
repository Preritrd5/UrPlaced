/**
 * Recommendation Status Lifecycle API
 * POST /api/student/learning-recommendations/[id]/status
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { LearningRecommendationsService, RecommendationStatus } from "@/modules/students/services/learning-recommendations-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const { status, dismissalReason } = body;

    const validStatuses: RecommendationStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED", "DISMISSED"];
    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
        { status: 400 }
      );
    }

    const success = await LearningRecommendationsService.updateStatus(
      authContext.tenantId,
      student.id,
      id,
      status,
      dismissalReason
    );

    return NextResponse.json({
      success,
      data: { id, status },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to update recommendation status" },
      { status: 500 }
    );
  }
}
