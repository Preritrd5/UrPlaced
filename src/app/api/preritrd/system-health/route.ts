import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformHealthService } from "@/modules/platform-admin/services/platform-health-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const report = await PlatformHealthService.checkSystemHealth();

    return NextResponse.json({
      success: true,
      report,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to run system health diagnostics";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
