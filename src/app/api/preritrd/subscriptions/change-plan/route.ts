import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const { tenantId, newPlanId, preserveCustomLimits, immediateOverride, overrideReason } = body;

    if (!tenantId || !newPlanId) {
      return NextResponse.json(
        { error: "Tenant ID and target Plan ID are required." },
        { status: 400 }
      );
    }

    const result = await PlatformSubscriptionService.changeCollegePlan({
      tenantId,
      newPlanId,
      preserveCustomLimits: Boolean(preserveCustomLimits),
      immediateOverride: Boolean(immediateOverride),
      overrideReason: overrideReason ? String(overrideReason) : undefined,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      type: result.type,
      message: result.message,
      subscription: result.subscription,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to change subscription plan";
    const status = msg.includes("not found")
      ? 404
      : msg.includes("Only PUBLISHED plans") || msg.includes("overrideReason")
      ? 400
      : msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
