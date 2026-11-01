import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const { tenantId } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required." }, { status: 400 });
    }

    const result = await PlatformSubscriptionService.syncCollegeSubscriptionToLatestPlan({
      tenantId,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Subscription successfully synchronized with latest plan definition (v${result.subscription.planVersion}).`,
      subscription: result.subscription,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to sync subscription version";
    const status = msg.includes("not found")
      ? 404
      : msg.includes("already synchronized")
      ? 400
      : msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
