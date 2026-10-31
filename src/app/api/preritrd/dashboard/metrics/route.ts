import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformAnalyticsService } from "@/modules/platform-admin/services/platform-analytics-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const metrics = await PlatformAnalyticsService.getOverviewMetrics();

    return NextResponse.json({
      success: true,
      metrics,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load dashboard metrics";
    const status = msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : msg.includes("MFA_REQUIRED")
      ? 403
      : 500;

    return NextResponse.json({ error: msg }, { status });
  }
}
