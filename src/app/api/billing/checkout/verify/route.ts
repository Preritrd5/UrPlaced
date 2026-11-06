import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user and resolve tenant context
    const ctx = await requireAuthContext();

    // 2. Strict RBAC: Only PLACEMENT_HEAD or SUPER_ADMIN may verify institutional payments
    if (ctx.tenantRole !== "PLACEMENT_HEAD" && ctx.tenantRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only institutional placement administrators may verify payments." },
        { status: 403 }
      );
    }

    // 3. Parse checkout verification payload
    const body = await request.json().catch(() => ({}));
    const { orderId, paymentId, signature } = body;

    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        { error: "Order ID, Payment ID, and signature are required for payment verification." },
        { status: 400 }
      );
    }

    // 4. Delegate to single atomic reconciliation path
    const result = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature,
      source: "CHECKOUT_VERIFICATION",
      callerTenantId: ctx.isPlatformAdmin ? undefined : ctx.tenantId,
    });

    return NextResponse.json({
      success: true,
      duplicate: result.duplicate || false,
      message: result.message || "Payment verified successfully.",
      status: "ACTIVE",
      orderId: result.orderId,
      paymentId: result.paymentId,
    });
  } catch (error: any) {
    console.error("[Checkout Verify API Error]:", error);
    const msg = error.message || "Payment verification failed.";

    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (msg.includes("Cryptographic verification failed") || msg.includes("Invalid checkout signature")) {
      return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
    }
    if (msg.includes("Payment not captured") || msg.includes("mismatch")) {
      return NextResponse.json({ error: msg }, { status: 422 });
    }
    if (msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
