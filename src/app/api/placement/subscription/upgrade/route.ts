import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { SubscriptionLifecycleBillingService } from "@/modules/billing/services/subscription-lifecycle-billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();
    const { searchParams } = new URL(request.url);
    const targetPlanId = searchParams.get("targetPlanId");

    if (!targetPlanId) {
      return NextResponse.json({ error: "targetPlanId query parameter is required." }, { status: 400 });
    }

    const targetTenantId = ctx.tenantId || (ctx.isPlatformAdmin ? searchParams.get("tenantId") : null);
    if (!targetTenantId) {
      return NextResponse.json({ error: "Active college context is required." }, { status: 400 });
    }

    const quote = await SubscriptionLifecycleBillingService.calculateUpgradeProration({
      tenantId: targetTenantId,
      targetPlanId,
    });

    return NextResponse.json({ success: true, quote });
  } catch (error: any) {
    const msg = error.message || "Failed to calculate upgrade quote";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("downgrade") ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the institutional Placement Head can initiate plan upgrades." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { targetPlanId, tenantId: bodyTenantId } = body;

    if (!targetPlanId) {
      return NextResponse.json({ error: "targetPlanId is required." }, { status: 400 });
    }

    const targetTenantId = ctx.tenantId || (ctx.isPlatformAdmin ? bodyTenantId : null);
    if (!targetTenantId) {
      return NextResponse.json({ error: "Active college context is required." }, { status: 400 });
    }

    const result = await SubscriptionLifecycleBillingService.requestUpgrade({
      tenantId: targetTenantId,
      targetPlanId,
      userId: ctx.userId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const msg = error.message || "Failed to initiate upgrade";
    const status = msg.includes("UNAUTHORIZED") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
