import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { SubscriptionLifecycleBillingService } from "@/modules/billing/services/subscription-lifecycle-billing-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the institutional Placement Head can request subscription cancellation." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const result = await SubscriptionLifecycleBillingService.requestCancellationPlacementHead({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      reason,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const msg = error.message || "Failed to submit cancellation request";
    const status = msg.includes("UNAUTHORIZED") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
