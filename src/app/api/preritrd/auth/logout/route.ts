import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    let adminUser = null;
    try {
      adminUser = await PlatformAuthService.requireSuperAdmin(request, { requireAal2: false });
    } catch {
      // ignore
    }

    if (adminUser) {
      await PlatformAuthService.logAuditEvent({
        actorId: adminUser.id,
        action: "PLATFORM_ADMIN_LOGOUT",
        resourceType: "PLATFORM_AUTH",
        resourceId: adminUser.id,
      });
    }

    const response = NextResponse.json({
      success: true,
      message: "Signed out of Platform Super Admin portal.",
    });

    response.cookies.delete("sb-access-token");

    // Also expire any Supabase chunked auth cookies
    try {
      const { getSupabaseConfig } = await import("@/lib/supabase/config");
      const { supabaseUrl } = getSupabaseConfig();
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const cookieBaseName = `sb-${projectRef}-auth-token`;
      response.cookies.delete(cookieBaseName);
      for (let i = 0; i < 5; i++) {
        response.cookies.delete(`${cookieBaseName}.${i}`);
      }
    } catch {
      // non-fatal
    }

    return response;
  } catch {
    return NextResponse.json({ success: true });
  }
}
