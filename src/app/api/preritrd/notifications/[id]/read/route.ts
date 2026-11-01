import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformNotificationService } from "@/modules/platform-admin/services/platform-notification-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing notification ID" }, { status: 400 });
    }

    const success = await PlatformNotificationService.markAsRead(id, admin.id);

    return NextResponse.json({ success });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to mark notification as read." },
      { status: 500 }
    );
  }
}
