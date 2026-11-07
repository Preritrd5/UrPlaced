/**
 * Announcement Item API Route
 * DELETE /api/announcements/[id]
 * 
 * Securely deletes an announcement for the authenticated college placement head.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";
import { NotificationService } from "@/modules/notifications/services/notification-service";
import { AuditService } from "@/modules/identity-access/services/audit-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext(Permissions.ANNOUNCEMENTS_MANAGE);
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Announcement ID is required" },
        { status: 400 }
      );
    }

    const success = await NotificationService.deleteAnnouncement({
      collegeId: ctx.tenantId,
      announcementId: id,
    });

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete announcement" },
        { status: 400 }
      );
    }

    // Audit log deletion
    await AuditService.log({
      tenantId: ctx.tenantId,
      actorId: ctx.userId,
      action: "ANNOUNCEMENT_DELETED",
      resourceType: "announcement",
      resourceId: id,
    }).catch(() => null);

    return NextResponse.json({
      success: true,
      message: "Announcement deleted successfully",
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
