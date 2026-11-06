import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user and resolve tenant context
    const ctx = await requireAuthContext();

    // 2. Strict RBAC: Only PLACEMENT_HEAD or SUPER_ADMIN may initiate institutional payments
    if (ctx.tenantRole !== "PLACEMENT_HEAD" && ctx.tenantRole !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: Only institutional placement administrators may initiate subscription payments." },
        { status: 403 }
      );
    }

    if (!ctx.tenantId) {
      return NextResponse.json(
        { error: "Active college context is required to initiate billing checkout." },
        { status: 400 }
      );
    }

    // 3. Parse input: ONLY accept invoiceId and optional client idempotency key
    const body = await request.json().catch(() => ({}));
    const { invoiceId, idempotencyKey } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { error: "Invoice ID is required to create a payment order." },
        { status: 400 }
      );
    }

    // 4. Create verified payment order via server-authoritative service
    const order = await PaymentReconciliationService.createPaymentOrder({
      invoiceId,
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      idempotencyKey,
    });

    return NextResponse.json({
      success: true,
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      amountInr: order.amountInr,
      currency: order.currency,
      keyId: order.keyId,
      invoiceId: order.invoiceId,
      invoiceNumber: order.invoiceNumber,
    });
  } catch (error: any) {
    const msg = error.message || "Failed to initialize payment checkout.";

    if (msg.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }
    if (msg.includes("Forbidden") || msg.includes("another college")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    if (msg.includes("already been fully paid") || msg.includes("Cannot pay invoice") || msg.includes("not found")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (msg.includes("Authentication failed")) {
      console.warn("[Checkout Create Order Gateway Auth Notice]: Razorpay rejected credentials (401).");
      return NextResponse.json(
        {
          error:
            "Payment gateway authentication failed: The configured Razorpay Test API Key ID or Secret in .env is invalid or expired. Please update RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET with active credentials from the Razorpay Dashboard.",
        },
        { status: 502 }
      );
    }

    console.error("[Checkout Create Order API Error]:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
