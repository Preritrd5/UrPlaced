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

    const preferences = await PlatformNotificationService.getPreferences(admin.id);

    return NextResponse.json({ success: true, preferences });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to retrieve notification preferences." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const preferences = await PlatformNotificationService.updatePreferences(admin.id, body);

    await PlatformAuthService.logAuditEvent({
      actorId: admin.id,
      action: "PLATFORM_UPDATE_NOTIFICATION_PREFERENCES",
      resourceType: "NOTIFICATION_PREFERENCES",
      metadata: { updatedBy: admin.email },
    });

    return NextResponse.json({ success: true, preferences });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to update notification preferences." },
      { status: 500 }
    );
  }
}
