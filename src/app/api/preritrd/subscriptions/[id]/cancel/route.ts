import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { SubscriptionLifecycleBillingService } from "@/modules/billing/services/subscription-lifecycle-billing-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json(
        { error: "Mandatory administrative cancellation reason is required." },
        { status: 400 }
      );
    }

    const result = await SubscriptionLifecycleBillingService.cancelSubscriptionSuperAdmin({
      subscriptionId: id,
      adminId: admin.id,
      reason,
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    const msg = error.message || "Failed to cancel subscription";
    const status = msg.includes("Super Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
