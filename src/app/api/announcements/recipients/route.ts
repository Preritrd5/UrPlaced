/**
 * Announcement Recipients Preview API Route
 * UrPlaced Enterprise Notification & Announcements
 * 
 * GET /api/announcements/recipients
 * Query params: audienceType, departmentId, search
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import {
  NotificationService,
  NotificationValidationError,
} from "@/modules/notifications/services/notification-service";
import type { AnnouncementAudienceType } from "@/modules/notifications/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.ANNOUNCEMENTS_READ);

    const searchParams = request.nextUrl.searchParams;
    const audienceType = (searchParams.get("audienceType") || "ALL_STUDENTS") as AnnouncementAudienceType;
    const departmentId = searchParams.get("departmentId") || undefined;
    const search = searchParams.get("search") || undefined;

    const result = await NotificationService.getEligibleStudents({
      collegeId: ctx.tenantId,
      audienceType,
      departmentId,
      search,
    });

    return NextResponse.json({
      success: true,
      eligibleCount: result.eligibleCount,
      students: result.students,
    });
  } catch (error: any) {
    if (error instanceof NotificationValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("[Announcement Recipients API Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve announcement recipients." },
      { status: 500 }
    );
  }
}
