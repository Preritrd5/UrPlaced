import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { RefundService, SubscriptionActionOnRefund } from "@/modules/billing/services/refund-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || undefined;
    const status = searchParams.get("status") || undefined;

    const refunds = await RefundService.listRefunds({ tenantId, status });
    return NextResponse.json({ success: true, refunds });
  } catch (error: any) {
    const msg = error.message || "Failed to list refunds";
    const status = msg.includes("Super Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const body = await request.json().catch(() => ({}));
    const { invoiceId, amountInr, reason, subscriptionAction } = body;

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID is required to issue a refund." }, { status: 400 });
    }

    if (!reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "Mandatory refund reason is required." }, { status: 400 });
    }

    const validActions: SubscriptionActionOnRefund[] = ["KEEP_ACTIVE", "CANCEL_IMMEDIATELY", "CANCEL_AT_PERIOD_END"];
    if (!subscriptionAction || !validActions.includes(subscriptionAction)) {
      return NextResponse.json(
        { error: "Explicit subscriptionAction ('KEEP_ACTIVE', 'CANCEL_IMMEDIATELY', 'CANCEL_AT_PERIOD_END') is required." },
        { status: 400 }
      );
    }

    const result = await RefundService.issueRefund({
      invoiceId,
      amountInr: amountInr ? Number(amountInr) : undefined,
      reason,
      subscriptionAction,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "Refund processed successfully.",
      result,
    });
  } catch (error: any) {
    console.error("[Super Admin Refund API Error]:", error);
    const msg = error.message || "Failed to process refund";
    let status = 500;

    if (
      msg.includes("Super Admin") ||
      msg.includes("UNAUTHORIZED") ||
      msg.includes("Unauthorized") ||
      msg.includes("Forbidden")
    ) {
      status = 403;
    } else if (msg.includes("not found")) {
      status = 404;
    } else if (
      msg.includes("exceeds") ||
      msg.includes("already been fully refunded") ||
      msg.includes("Only PAID") ||
      msg.includes("greater than zero") ||
      msg.includes("Mandatory refund reason") ||
      msg.includes("Explicit subscriptionAction")
    ) {
      status = 422;
    } else if (msg.includes("Razorpay refund failed") || msg.includes("gateway")) {
      status = 502;
    } else {
      status = 400;
    }

    return NextResponse.json({ error: msg }, { status });
  }
}
