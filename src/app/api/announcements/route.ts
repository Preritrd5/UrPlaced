/**
 * Announcements API Route
 * UrPlaced Enterprise Notification & Announcements
 * 
 * GET  /api/announcements — List sent announcements history for caller's college
 * POST /api/announcements — Compose and broadcast announcement to students
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { AuditService } from "@/modules/identity-access/services/audit-service";
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
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await NotificationService.listAnnouncements({
      collegeId: ctx.tenantId,
      limit: isNaN(limit) ? 20 : limit,
      offset: isNaN(offset) ? 0 : offset,
    });

    return NextResponse.json({
      success: true,
      announcements: result.announcements,
      total: result.total,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext(Permissions.ANNOUNCEMENTS_MANAGE);

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body provided." },
        { status: 400 }
      );
    }

    const {
      title,
      body: announcementBody,
      category = "GENERAL",
      audienceType,
      departmentId,
      departmentName,
      selectedStudentIds,
      actionUrl,
    } = body;

    const result = await NotificationService.sendAnnouncement({
      collegeId: ctx.tenantId,
      createdByUserId: ctx.userId,
      title,
      body: announcementBody,
      category,
      audienceType: audienceType as AnnouncementAudienceType,
      departmentId,
      departmentName,
      selectedStudentIds,
      actionUrl,
    });

    // Audit log
    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "ANNOUNCEMENT_BROADCAST",
      resourceType: "announcement",
      resourceId: result.announcement.id,
      afterState: {
        title: result.announcement.title,
        category: result.announcement.category,
        audienceType: result.announcement.audience_type,
        recipientCount: result.recipientCount,
      },
    }).catch(() => null);

    return NextResponse.json(
      {
        success: true,
        announcement: result.announcement,
        recipientCount: result.recipientCount,
      },
      { status: 201 }
    );
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
    console.error("[Announcements API Error]", error);
    return NextResponse.json(
      { error: error.message || "Failed to broadcast announcement." },
      { status: 500 }
    );
  }
}
