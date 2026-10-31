import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformAnalyticsService } from "@/modules/platform-admin/services/platform-analytics-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const trends = await PlatformAnalyticsService.getAnalyticsTrends();

    return NextResponse.json({
      success: true,
      trends,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load analytics trends";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
