/**
 * Refund and Credit Note Service (SA-05 Workstream 02)
 * Full & Partial refunds, Q10 decoupled subscription actions, and Q11 mandate cancellations.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/payment/razorpay";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export type SubscriptionActionOnRefund = "KEEP_ACTIVE" | "CANCEL_IMMEDIATELY" | "CANCEL_AT_PERIOD_END";

export interface IssueRefundParams {
  invoiceId: string;
  amountInr?: number;
  reason: string;
  subscriptionAction: SubscriptionActionOnRefund;
  adminId: string;
  admin?: ReturnType<typeof createAdminClient>;
}

export interface RefundResult {
  success: boolean;
  refundId: string;
  creditNoteId: string;
  creditNoteNumber: string;
  amountInr: number;
  isFullRefund: boolean;
  invoiceStatus: string;
  subscriptionAction: SubscriptionActionOnRefund;
  subscriptionStatus: string;
}

export class RefundService {
  /**
   * Issues a full or partial refund for a captured invoice payment.
   * Decouples refund amount from subscription cancellation per Q10.
   */
  static async issueRefund(params: IssueRefundParams): Promise<RefundResult> {
    const {
      invoiceId,
      amountInr,
      reason,
      subscriptionAction,
      adminId,
      admin = createAdminClient(),
    } = params;

    if (!reason || reason.trim().length === 0) {
      throw new Error("Mandatory refund reason is required to issue a refund.");
    }

    // 1. Fetch invoice
    const { data: invoice, error: invErr } = await admin
      .from("platform_invoices")
      .select(`
        id,
        invoice_number,
        tenant_id,
        subscription_id,
        amount_inr,
        tax_inr,
        currency,
        status,
        refunded_amount_inr,
        razorpay_payment_id,
        razorpay_order_id,
        tenants (
          name,
          slug
        )
      `)
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    if (invoice.status !== "PAID") {
      throw new Error(`Cannot issue refund for invoice with status '${invoice.status}'. Only PAID invoices can be refunded.`);
    }

    const totalInvoicePaise = Math.round(Number(invoice.amount_inr) * 100) + Math.round(Number(invoice.tax_inr) * 100);
    const alreadyRefundedPaise = Math.round(Number(invoice.refunded_amount_inr || 0) * 100);
    const remainingRefundablePaise = totalInvoicePaise - alreadyRefundedPaise;

    if (remainingRefundablePaise <= 0) {
      throw new Error("This invoice has already been fully refunded.");
    }

    const refundAmountPaise = amountInr !== undefined ? Math.round(Number(amountInr) * 100) : remainingRefundablePaise;

    if (refundAmountPaise <= 0) {
      throw new Error("Refund amount must be greater than zero.");
    }

    if (refundAmountPaise > remainingRefundablePaise) {
      throw new Error(
        `Refund amount (₹${(refundAmountPaise / 100).toFixed(2)}) exceeds remaining refundable captured balance (₹${(remainingRefundablePaise / 100).toFixed(2)}).`
      );
    }

    const refundAmountInr = refundAmountPaise / 100;
    const isFullRefund = refundAmountPaise === remainingRefundablePaise;

    // 2. Fetch associated captured payment transaction
    let paymentId = invoice.razorpay_payment_id;
    let orderId = invoice.razorpay_order_id;

    if (!paymentId) {
      const { data: tx } = await admin
        .from("payment_transactions")
        .select("payment_id, order_id")
        .eq("invoice_id", invoiceId)
        .eq("status", "CAPTURED")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tx) {
        paymentId = tx.payment_id;
        orderId = tx.order_id;
      }
    }

    if (!paymentId || !orderId) {
      throw new Error("No verified gateway payment transaction found for this invoice to refund.");
    }

    // 3. Initiate Gateway Refund via Razorpay API
    const razorpay = getRazorpayClient();
    let rzpRefund: any;
    try {
      rzpRefund = await razorpay.payments.refund(paymentId, {
        amount: refundAmountPaise,
        notes: {
          invoiceId,
          invoiceNumber: invoice.invoice_number,
          tenantId: invoice.tenant_id,
          reason,
          subscriptionAction,
        },
      });
    } catch (gatewayErr: any) {
      console.error("[Refund Service] Gateway refund call failed:", gatewayErr);
      throw new Error(`Razorpay refund failed: ${gatewayErr.message || "Gateway rejection"}`);
    }

    const now = new Date().toISOString();

    // 4. Record in public.refunds
    const { data: refundRecord, error: refundInsertErr } = await admin
      .from("refunds")
      .insert({
        refund_id: rzpRefund.id,
        payment_id: paymentId,
        order_id: orderId,
        invoice_id: invoice.id,
        tenant_id: invoice.tenant_id,
        amount_paise: refundAmountPaise,
        amount_inr: refundAmountInr,
        currency: "INR",
        status: "SUCCESS",
        reason,
        subscription_action: subscriptionAction,
        gateway: "RAZORPAY",
        gateway_response: rzpRefund,
        created_by: adminId,
        created_at: now,
      })
      .select("id")
      .single();

    if (refundInsertErr || !refundRecord) {
      throw new Error(`Failed to record refund in database: ${refundInsertErr?.message}`);
    }

    // 5. Update invoice refunded amount and status
    const newRefundedTotal = Number(((alreadyRefundedPaise + refundAmountPaise) / 100).toFixed(2));
    const updatedInvoiceStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";

    await admin
      .from("platform_invoices")
      .update({
        refunded_amount_inr: newRefundedTotal,
        status: updatedInvoiceStatus,
        notes: `Refund of ₹${refundAmountInr.toFixed(2)} processed (Ref: ${rzpRefund.id})`,
        updated_at: now,
      })
      .eq("id", invoice.id);

    // 6. Generate Credit Note with exact integer paise reconciliation
    const creditNoteNumber = `CN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const basePortionPaise = Math.round((refundAmountPaise * 100) / 118);
    const taxPortionPaise = refundAmountPaise - basePortionPaise;
    const basePortion = basePortionPaise / 100;
    const taxPortion = taxPortionPaise / 100;

    const { data: creditNote, error: cnErr } = await admin
      .from("credit_notes")
      .insert({
        credit_note_number: creditNoteNumber,
        invoice_id: invoice.id,
        refund_id: refundRecord.id,
        tenant_id: invoice.tenant_id,
        amount_inr: basePortion,
        tax_inr: taxPortion,
        total_inr: refundAmountInr,
        currency: "INR",
        reason,
        issued_at: now,
        created_at: now,
      })
      .select("id")
      .single();

    if (cnErr || !creditNote) {
      console.warn("[Refund Service] Warning: Credit note record creation issue:", cnErr);
    }

    // 7. Q10 & Q11: Apply decoupled subscription action & mandate cancellation
    let currentSubscriptionStatus = "ACTIVE";
    if (invoice.subscription_id || invoice.tenant_id) {
      const { data: sub } = await admin
        .from("college_subscriptions")
        .select("id, status, expiry_date, cancel_at_period_end")
        .eq(invoice.subscription_id ? "id" : "tenant_id", invoice.subscription_id || invoice.tenant_id)
        .maybeSingle();

      if (sub) {
        currentSubscriptionStatus = sub.status;

        if (subscriptionAction === "CANCEL_IMMEDIATELY") {
          currentSubscriptionStatus = "CANCELED";
          await admin
            .from("college_subscriptions")
            .update({
              status: "CANCELED",
              canceled_at: now,
              cancellation_reason: `Super Admin refund with immediate cancellation: ${reason}`,
              cancel_at_period_end: false,
              updated_at: now,
            })
            .eq("id", sub.id);

          // Q11: Stop recurring mandate immediately
          await admin
            .from("recurring_mandates")
            .update({
              status: "CANCELLED",
              canceled_at: now,
              cancel_at_period_end: false,
              updated_at: now,
            })
            .eq("tenant_id", invoice.tenant_id)
            .eq("status", "ACTIVE");
        } else if (subscriptionAction === "CANCEL_AT_PERIOD_END") {
          await admin
            .from("college_subscriptions")
            .update({
              cancel_at_period_end: true,
              cancellation_reason: `Super Admin refund with period-end cancellation: ${reason}`,
              updated_at: now,
            })
            .eq("id", sub.id);

          // Q11: Schedule recurring mandate cancellation at period end
          await admin
            .from("recurring_mandates")
            .update({
              cancel_at_period_end: true,
              updated_at: now,
            })
            .eq("tenant_id", invoice.tenant_id)
            .eq("status", "ACTIVE");
        }
        // If KEEP_ACTIVE: do not modify subscription or mandate status!
      }
    }

    // 8. Platform Audit Log
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_INVOICE_REFUND_ISSUED",
      resourceType: "INVOICE",
      resourceId: invoice.id,
      metadata: {
        refundId: rzpRefund.id,
        amountInr: refundAmountInr,
        isFullRefund,
        subscriptionAction,
        reason,
      },
      adminClient: admin,
    });

    return {
      success: true,
      refundId: rzpRefund.id,
      creditNoteId: creditNote?.id || "cn_created",
      creditNoteNumber,
      amountInr: refundAmountInr,
      isFullRefund,
      invoiceStatus: updatedInvoiceStatus,
      subscriptionAction,
      subscriptionStatus: currentSubscriptionStatus,
    };
  }

  /**
   * Lists refund records, scoped by tenant for college users, or global for Super Admin.
   */
  static async listRefunds(params: {
    tenantId?: string;
    invoiceId?: string;
    status?: string;
    admin?: ReturnType<typeof createAdminClient>;
  } = {}) {
    const { tenantId, invoiceId, status, admin = createAdminClient() } = params;

    let query = admin
      .from("refunds")
      .select(`
        id,
        refund_id,
        payment_id,
        order_id,
        invoice_id,
        tenant_id,
        amount_inr,
        currency,
        status,
        reason,
        subscription_action,
        created_at,
        platform_invoices (
          invoice_number
        ),
        tenants (
          name,
          slug
        )
      `)
      .order("created_at", { ascending: false });

    if (tenantId && tenantId !== "ALL") {
      query = query.eq("tenant_id", tenantId);
    }
    if (invoiceId) {
      query = query.eq("invoice_id", invoiceId);
    }
    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to list refunds: ${error.message}`);
    }

    return (data || []).map((r: any) => ({
      id: r.id,
      refundId: r.refund_id,
      paymentId: r.payment_id,
      orderId: r.order_id,
      invoiceId: r.invoice_id,
      invoiceNumber: r.platform_invoices?.invoice_number || "INV-UNKNOWN",
      tenantId: r.tenant_id,
      collegeName: r.tenants?.name || "Unknown College",
      amountInr: Number(r.amount_inr),
      currency: r.currency,
      status: r.status,
      reason: r.reason,
      subscriptionAction: r.subscription_action,
      createdAt: r.created_at,
    }));
  }
}
