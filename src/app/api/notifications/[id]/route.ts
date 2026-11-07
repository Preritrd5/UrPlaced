/**
 * Notification Item API Route
 * DELETE /api/notifications/[id]
 * 
 * Securely deletes a single notification belonging to the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { NotificationService } from "@/modules/notifications/services/notification-service";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Notification ID is required" }, { status: 400 });
    }

    const success = await NotificationService.deleteNotification({
      userId: ctx.userId,
      notificationId: id,
      collegeId: ctx.tenantId,
    });

    if (!success) {
      return NextResponse.json({ error: "Failed to delete notification" }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Notification deleted successfully" });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
