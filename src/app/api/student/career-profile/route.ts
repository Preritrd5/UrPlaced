/**
 * Student Career Profile API
 * GET /api/student/career-profile
 * PUT /api/student/career-profile
 * 
 * Manages career profile data & server-side completeness calculation.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { StudentCareerProfileService } from "@/modules/students/services/student-career-profile-service";

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

    const profile = await StudentCareerProfileService.getProfile(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({ success: true, data: profile });
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
    console.error("[CareerProfile API] GET Error:", error);
    return NextResponse.json(
      { error: "Failed to load career profile" },
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

    const body = await request.json();

    const updated = await StudentCareerProfileService.updateProfile(
      authContext.tenantId,
      student.id,
      body
    );

    return NextResponse.json({ success: true, data: updated });
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
    console.error("[CareerProfile API] PUT Error:", error);
    return NextResponse.json(
      { error: "Failed to update career profile" },
      { status: 500 }
    );
  }
}
