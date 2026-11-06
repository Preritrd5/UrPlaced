import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/payment/razorpay";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/billing/checkout/status
 * Queries and verifies real-time payment status for a Razorpay checkout order.
 * Essential for UPI QR Code flows where payment occurs on a secondary mobile device.
 * Reconciles captured payments atomically and idempotently.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only institutional placement administrators may query billing status." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get("invoiceId")?.trim();
    const orderId = searchParams.get("orderId")?.trim();

    if (!invoiceId && !orderId) {
      return NextResponse.json(
        { error: "Either invoiceId or orderId query parameter is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Resolve invoice
    let invoice: any = null;
    if (invoiceId) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);
      let invQuery = admin
        .from("platform_invoices")
        .select("id, invoice_number, tenant_id, subscription_id, status, amount_inr, tax_inr");

      if (isUuid) {
        invQuery = invQuery.eq("id", invoiceId);
      } else {
        invQuery = invQuery.eq("invoice_number", invoiceId);
      }

      const { data: invData } = await invQuery.maybeSingle();
      if (invData) invoice = invData;
    }

    if (!invoice && orderId) {
      // Find invoice via payment_orders or platform_invoices
      const { data: poData } = await admin
        .from("payment_orders")
        .select("invoice_id, tenant_id")
        .eq("order_id", orderId)
        .maybeSingle();

      if (poData?.invoice_id) {
        const { data: invData } = await admin
          .from("platform_invoices")
          .select("id, invoice_number, tenant_id, subscription_id, status, amount_inr, tax_inr")
          .eq("id", poData.invoice_id)
          .maybeSingle();
        if (invData) invoice = invData;
      }
    }

    if (!invoice) {
      return NextResponse.json(
        { error: `Invoice not found for specified parameters.` },
        { status: 404 }
      );
    }

    // Strict tenant isolation: verify caller belongs to invoice tenant
    if (!ctx.isPlatformAdmin && invoice.tenant_id !== ctx.tenantId) {
      return NextResponse.json(
        { error: "Forbidden: Access to another institution's invoice is strictly prohibited." },
        { status: 403 }
      );
    }

    // 2. If invoice is already marked PAID, return verified success immediately
    if (invoice.status === "PAID") {
      return NextResponse.json({
        success: true,
        paid: true,
        status: "PAID",
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
      });
    }

    // 3. If invoice is not yet marked PAID and we have an orderId, check Razorpay gateway
    if (orderId) {
      try {
        const razorpay = getRazorpayClient();
        const rzpPayments = await razorpay.orders.fetchPayments(orderId);
        const paymentsList = (rzpPayments as any)?.items || [];

        // Check if any payment for this order is captured
        const captured = paymentsList.find((p: any) => p.status === "captured");

        if (captured) {
          // Reconcile and activate subscription atomically
          await PaymentReconciliationService.reconcilePayment({
            orderId,
            paymentId: captured.id,
            source: "RECONCILIATION",
            admin,
          });

          return NextResponse.json({
            success: true,
            paid: true,
            status: "PAID",
            paymentId: captured.id,
            method: captured.method || "upi",
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            reconciled: true,
          });
        }
      } catch (rzpErr: any) {
        // If order fetch fails (e.g. mock test environment), log notice and continue with database status
        console.warn("[Checkout Status Polling Notice]: Razorpay gateway check:", rzpErr?.message || rzpErr);
      }
    }

    // Still pending
    return NextResponse.json({
      success: true,
      paid: false,
      status: invoice.status || "PENDING",
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
    });
  } catch (error: any) {
    const msg = error.message || "Failed to query checkout status";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
