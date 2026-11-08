/**
 * Student Activity Contribution Heatmap API
 * GET /api/student/activity/heatmap
 * 
 * Returns personal trailing 365-day submission heatmap for the authenticated student.
 * Multi-tenant safe, resolves authoritative students.id from server auth context.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { StudentActivityHeatmapService } from "@/modules/students/services/student-activity-heatmap-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
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

    // Resolve student record authoritative identity
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

    // Client timezone header or query param
    const { searchParams } = new URL(request.url);
    const timezone =
      request.headers.get("x-timezone") ||
      searchParams.get("timezone") ||
      "Asia/Kolkata";

    const heatmap = await StudentActivityHeatmapService.getHeatmap(
      authContext.tenantId,
      student.id,
      { timezone }
    );

    return NextResponse.json(
      {
        success: true,
        data: heatmap,
      },
      {
        headers: {
          "Cache-Control": "private, no-cache, no-store, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Heatmap API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate activity heatmap" },
      { status: 500 }
    );
  }
}
