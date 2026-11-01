import { NextRequest, NextResponse } from "next/server";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 1. Read unparsed raw body string directly from incoming request stream
    const rawBody = await request.text();

    // 2. Extract signature and event identifier headers
    const signature = request.headers.get("x-razorpay-signature");
    const eventIdHeader = request.headers.get("x-razorpay-event-id");

    if (!signature) {
      console.warn("[Razorpay Webhook] Rejected: Missing x-razorpay-signature header.");
      return NextResponse.json(
        { error: "Missing x-razorpay-signature header." },
        { status: 400 }
      );
    }

    if (!rawBody) {
      return NextResponse.json(
        { error: "Empty request payload." },
        { status: 400 }
      );
    }

    // 3. Delegate to the shared reconciliation service
    const result = await PaymentReconciliationService.processWebhookEvent({
      rawBody,
      signature,
      eventIdHeader,
    });

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate || false,
      ignored: result.ignored || false,
    });
  } catch (error: any) {
    console.error("[Razorpay Webhook Error]:", error);
    const msg = error.message || "Webhook processing failed.";

    if (msg.includes("Invalid Razorpay webhook signature")) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
    }

    // Return 200 or 500 based on standard webhook reliability practices
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
