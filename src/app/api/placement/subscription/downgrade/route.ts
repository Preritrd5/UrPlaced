import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { SubscriptionLifecycleBillingService } from "@/modules/billing/services/subscription-lifecycle-billing-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the institutional Placement Head can schedule plan downgrades." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { targetPlanId } = body;

    if (!targetPlanId) {
      return NextResponse.json({ error: "targetPlanId is required." }, { status: 400 });
    }

    const result = await SubscriptionLifecycleBillingService.requestDowngrade({
      tenantId: ctx.tenantId,
      targetPlanId,
      userId: ctx.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const msg = error.message || "Failed to schedule downgrade";
    const status = msg.includes("UNAUTHORIZED") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
