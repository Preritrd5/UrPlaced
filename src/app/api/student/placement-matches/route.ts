/**
 * Smart Placement Drive Matches API
 * GET /api/student/placement-matches
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { SmartDriveMatchingService } from "@/modules/students/services/smart-drive-matching-service";

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

    const { searchParams } = new URL(request.url);
    const filter = (searchParams.get("filter") || "ALL").toUpperCase() as
      | "ALL"
      | "ELIGIBLE"
      | "HIGH_MATCH";

    const matches = await SmartDriveMatchingService.getMatchesForStudent({
      tenantId: authContext.tenantId,
      studentId: student.id,
      filter,
    });

    return NextResponse.json({
      success: true,
      data: matches,
      count: matches.length,
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
    console.error("[Placement Matches API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load placement matches" },
      { status: 500 }
    );
  }
}
