import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const planId = searchParams.get("planId") || undefined;
    const search = searchParams.get("search") || undefined;

    const subscriptions = await PlatformSubscriptionService.listCollegeSubscriptions({
      status,
      planId,
      search,
    });

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load subscriptions";
    const status = msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN") || msg.includes("MFA_REQUIRED")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
