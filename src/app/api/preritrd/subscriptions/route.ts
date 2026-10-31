import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const planId = searchParams.get("planId") || undefined;

    const subscriptions = await PlatformSubscriptionService.listCollegeSubscriptions({
      status,
      planId,
    });

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load subscriptions";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const { tenantId, planId, status, studentSeatLimit, staffSeatLimit, renewalDate } = body;

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant ID is required." }, { status: 400 });
    }

    const result = await PlatformSubscriptionService.updateCollegeSubscription({
      tenantId,
      planId,
      status,
      studentSeatLimit,
      staffSeatLimit,
      renewalDate,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "College subscription updated successfully.",
      subscription: result.subscription,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update subscription";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
