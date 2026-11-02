import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { RecurringMandateService } from "@/modules/billing/services/recurring-mandate-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole === "STUDENT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const admin = createAdminClient();

    // 1. Query tenant-isolated transactions (with invoice fallback)
    let txList: any[] = [];
    const { data: transactions, error: txErr } = await admin
      .from("payment_transactions")
      .select(`
        id,
        payment_id,
        order_id,
        invoice_id,
        amount_paise,
        currency,
        status,
        method,
        gateway,
        created_at,
        platform_invoices (
          id,
          invoice_number,
          issue_date,
          due_date,
          status,
          refunded_amount_inr
        )
      `)
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false });

    if (!txErr && transactions) {
      txList = transactions.map((t: any) => ({
        id: t.id,
        paymentId: t.payment_id,
        orderId: t.order_id,
        invoiceId: t.invoice_id,
        invoiceNumber: t.platform_invoices?.invoice_number || "INV-RECORD",
        amountInr: Number((t.amount_paise / 100).toFixed(2)),
        currency: t.currency,
        status: t.status,
        method: t.method || "card",
        gateway: t.gateway,
        createdAt: t.created_at,
        invoiceStatus: t.platform_invoices?.status || "PAID",
        refundedAmountInr: Number(t.platform_invoices?.refunded_amount_inr || 0),
      }));
    } else {
      // Fallback: Query platform_invoices directly for this tenant
      const { data: invList } = await admin
        .from("platform_invoices")
        .select("id, invoice_number, amount_inr, tax_inr, currency, status, payment_method, created_at, paid_at")
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false });

      if (invList) {
        txList = invList.map((inv: any) => ({
          id: inv.id,
          paymentId: inv.payment_method ? `TX-${inv.invoice_number}` : "PENDING",
          orderId: `ORD-${inv.invoice_number}`,
          invoiceId: inv.id,
          invoiceNumber: inv.invoice_number,
          amountInr: Number((Number(inv.amount_inr) + Number(inv.tax_inr)).toFixed(2)),
          currency: inv.currency || "INR",
          status: inv.status === "PAID" ? "CAPTURED" : inv.status,
          method: inv.payment_method || "ONLINE",
          gateway: "RAZORPAY",
          createdAt: inv.paid_at || inv.created_at,
          invoiceStatus: inv.status,
          refundedAmountInr: 0,
        }));
      }
    }

    // 2. Query tenant-isolated refunds
    let refundList: any[] = [];
    try {
      const { data: refunds } = await admin
        .from("refunds")
        .select(`
          id,
          refund_id,
          payment_id,
          amount_inr,
          currency,
          status,
          reason,
          subscription_action,
          created_at
        `)
        .eq("tenant_id", ctx.tenantId)
        .order("created_at", { ascending: false });

      if (refunds) refundList = refunds;
    } catch {
      refundList = [];
    }

    // 3. Query active mandate
    let mandate: any = null;
    try {
      mandate = await RecurringMandateService.getTenantMandate(ctx.tenantId, admin);
    } catch {
      mandate = null;
    }

    return NextResponse.json({
      success: true,
      transactions: txList,
      refunds: refundList,
      mandate: mandate ? {
        status: mandate.status,
        billingInterval: mandate.billing_interval,
        cancelAtPeriodEnd: mandate.cancel_at_period_end,
        consentRecordedAt: mandate.consent_recorded_at,
      } : null,
    });
  } catch (error: any) {
    const msg = error.message || "Failed to load billing history";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("Access denied") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
