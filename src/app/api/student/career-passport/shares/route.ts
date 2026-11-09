/**
 * Career Passport Share Links API
 * GET /api/student/career-passport/shares — Lists active share links
 * POST /api/student/career-passport/shares — Generates a new cryptographically secure revocable link
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { StudentService } from "@/modules/students/services/student-service";
import { CareerPassportService } from "@/modules/students/services/career-passport-service";

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

    const links = await CareerPassportService.listShareLinks(
      authContext.tenantId,
      student.id
    );

    return NextResponse.json({
      success: true,
      data: links,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to load share links." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}));
    const { label, expiresInDays } = body;

    const share = await CareerPassportService.createShareLink({
      tenantId: authContext.tenantId,
      studentId: student.id,
      label,
      expiresInDays: expiresInDays ? Number(expiresInDays) : null,
    });

    return NextResponse.json({
      success: true,
      data: share,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json(
      { error: error.message || "Failed to create share link." },
      { status: 500 }
    );
  }
}
