import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformNotificationService } from "@/modules/platform-admin/services/platform-notification-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "30", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const unreadOnly = searchParams.get("unreadOnly") === "true";
    const category = searchParams.get("category") || undefined;

    const result = await PlatformNotificationService.listNotifications(admin.id, {
      limit,
      offset,
      unreadOnly,
      category,
    });

    return NextResponse.json({
      success: true,
      notifications: result.notifications,
      unreadCount: result.unreadCount,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN") || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to retrieve platform notifications." },
      { status: 500 }
    );
  }
}
