/**
 * Refund and Credit Note Service (SA-05 Workstream 02 & Hardened SA-08)
 * Full & Partial refunds, Q10 decoupled subscription actions, and strict simulated vs genuine payment isolation.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/payment/razorpay";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export type SubscriptionActionOnRefund = "KEEP_ACTIVE" | "CANCEL_IMMEDIATELY" | "CANCEL_AT_PERIOD_END";

export type PaymentClassification = "GENUINE" | "SIMULATED" | "OFFLINE" | "AMBIGUOUS";

export interface IssueRefundParams {
  invoiceId: string;
  amountInr?: number;
  reason: string;
  subscriptionAction: SubscriptionActionOnRefund;
  adminId: string;
  callerRole?: string; // Optional caller role enforcement ("SUPER_ADMIN")
  expectedTenantId?: string; // Tenant boundary isolation
  idempotencyKey?: string; // Idempotency protection key
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
  gateway?: string;
  isTestReversal?: boolean;
}

/**
 * Authoritative Server-Side Payment Classification:
 * Distinguishes genuine customer gateway payments from explicit simulated/test payments.
 * Ambiguous records fail closed to prevent accidental fallback.
 */
export function classifyPayment(invoice: any, tx?: any): PaymentClassification {
  if (!invoice) return "AMBIGUOUS";

  // 1. Explicit Simulated / Demo (trusted server-side persistence only)
  if (
    invoice.is_demo === true ||
    invoice.payment_method === "SIMULATED" ||
    invoice.payment_method === "TEST" ||
    invoice.payment_classification === "SIMULATED" ||
    invoice.notes?.includes("[SIMULATED_PAYMENT]") ||
    invoice.notes?.includes("PAYMENT_CLASSIFICATION:SIMULATED") ||
    tx?.gateway === "SIMULATED" ||
    tx?.gateway === "TEST" ||
    tx?.is_demo === true ||
    tx?.payment_classification === "SIMULATED"
  ) {
    return "SIMULATED";
  }

  // 2. Explicit Offline / Manual payments (bank transfer, check, offline)
  if (
    invoice.payment_method === "BANK_TRANSFER" ||
    invoice.payment_method === "OFFLINE" ||
    invoice.payment_method === "MANUAL"
  ) {
    return "OFFLINE";
  }

  // 3. Genuine Razorpay payment
  const paymentId =
    invoice.razorpay_payment_id ||
    (invoice.notes && invoice.notes.match(/pay_[A-Za-z0-9_]+/)?.[0]) ||
    tx?.payment_id;

  if (
    (invoice.payment_method === "RAZORPAY" || tx?.gateway === "RAZORPAY" || (paymentId && paymentId.startsWith("pay_"))) &&
    invoice.is_demo !== true &&
    invoice.payment_method !== "UNKNOWN"
  ) {
    // If paymentId explicitly carries test/mock prefixes assigned by test seeders:
    if (
      paymentId &&
      (paymentId.startsWith("pay_sim_") ||
        paymentId.startsWith("pay_mock_") ||
        paymentId.startsWith("pay_demo_") ||
        paymentId.startsWith("pay_test_"))
    ) {
      return "SIMULATED";
    }
    return "GENUINE";
  }

  return "AMBIGUOUS";
}

export class RefundService {
  /**
   * Issues a full or partial refund for a captured invoice payment.
   * Enforces strict separation between genuine Razorpay gateway refunds
   * and administrative test reversals.
   */
  static async issueRefund(params: IssueRefundParams): Promise<RefundResult> {
    const {
      invoiceId,
      amountInr,
      reason,
      subscriptionAction,
      adminId,
      callerRole,
      expectedTenantId,
      idempotencyKey,
      admin = createAdminClient(),
    } = params;

    // 0. Authorization Gate
    if (callerRole && callerRole !== "SUPER_ADMIN") {
      throw new Error(
        `Unauthorized: Caller with role '${callerRole}' is not authorized to issue refunds. Platform Super Admin access required.`
      );
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error("Mandatory refund reason is required to issue a refund.");
    }

    // 1. Fetch invoice with resilient schema fallback (supports both UUID and invoice_number)
    let invoice: any = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(invoiceId);

    const baseSelect = `
      id,
      invoice_number,
      tenant_id,
      subscription_id,
      amount_inr,
      tax_inr,
      currency,
      status,
      notes,
      paid_at,
      payment_method,
      is_demo,
      refunded_amount_inr,
      razorpay_payment_id,
      razorpay_order_id,
      tenants (
        name,
        slug
      )
    `;

    const { data: invData, error: invErr } = isUuid
      ? await admin.from("platform_invoices").select(baseSelect).eq("id", invoiceId).maybeSingle()
      : await admin.from("platform_invoices").select(baseSelect).eq("invoice_number", invoiceId).maybeSingle();

    if (!invErr && invData) {
      invoice = invData;
    } else {
      const fallbackQuery = isUuid
        ? admin.from("platform_invoices").select(baseSelect).eq("invoice_number", invoiceId).maybeSingle()
        : admin.from("platform_invoices").select(baseSelect).eq("id", invoiceId).maybeSingle();
      const { data: fallbackInv } = await fallbackQuery;
      if (fallbackInv) {
        invoice = fallbackInv;
      }
    }

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // Tenant Isolation Gate
    if (expectedTenantId && invoice.tenant_id !== expectedTenantId) {
      throw new Error(
        `Forbidden: Cross-tenant refund rejected. Invoice belongs to tenant '${invoice.tenant_id}', but caller requested tenant '${expectedTenantId}'.`
      );
    }

    if (invoice && !invoice.tenants && invoice.tenant_id) {
      try {
        const { data: t } = await admin
          .from("tenants")
          .select("name, slug")
          .eq("id", invoice.tenant_id)
          .maybeSingle();
        if (t) invoice.tenants = t;
      } catch {
        // Tenants query optional
      }
    }

    // Idempotency Check: if idempotencyKey was already successfully processed
    if (idempotencyKey) {
      try {
        const { data: existingRefund } = await admin
          .from("refunds")
          .select("*")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();

        if (existingRefund && existingRefund.status === "SUCCESS") {
          return {
            success: true,
            refundId: existingRefund.refund_id,
            creditNoteId: existingRefund.credit_note_id || `cn_${existingRefund.id}`,
            creditNoteNumber: existingRefund.credit_note_number || `CN-REC-${existingRefund.refund_id}`,
            amountInr: Number(existingRefund.amount_inr),
            isFullRefund: existingRefund.is_full_refund || false,
            invoiceStatus: invoice.status,
            subscriptionAction,
            subscriptionStatus: "ACTIVE",
            gateway: existingRefund.gateway,
            isTestReversal: existingRefund.gateway === "SIMULATED",
          };
        }
      } catch {
        // Table or column optional
      }
    }

    if (invoice.status !== "PAID" && invoice.status !== "PARTIALLY_REFUNDED") {
      throw new Error(
        `Cannot issue refund for invoice with status '${invoice.status}'. Only PAID or PARTIALLY_REFUNDED invoices can be refunded.`
      );
    }

    let alreadyRefundedInr = Number(invoice.refunded_amount_inr || 0);
    if (invoice.notes) {
      const refundMatches = invoice.notes.matchAll(/Refund of ₹([\d.]+)/g);
      for (const m of refundMatches) {
        if (m[1]) alreadyRefundedInr += parseFloat(m[1]);
      }
    }

    const totalInvoicePaise = Math.round(Number(invoice.amount_inr) * 100) + Math.round(Number(invoice.tax_inr) * 100);
    const alreadyRefundedPaise = Math.round(alreadyRefundedInr * 100);
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

    // 2. Fetch associated captured payment transaction (or support administrative offline payments)
    let paymentId = invoice.razorpay_payment_id;
    let orderId = invoice.razorpay_order_id;
    let tx: any = null;

    if (!paymentId && invoice.notes) {
      const payMatch = invoice.notes.match(/Payment ID:\s*(pay_[A-Za-z0-9_]+)/i);
      if (payMatch && payMatch[1]) {
        paymentId = payMatch[1];
      }
      const ordMatch = invoice.notes.match(/Order ID:\s*(order_[A-Za-z0-9_]+)/i);
      if (ordMatch && ordMatch[1]) {
        orderId = ordMatch[1];
      }
    }

    try {
      const txQuery = paymentId
        ? admin.from("payment_transactions").select("*").eq("payment_id", paymentId).maybeSingle()
        : admin.from("payment_transactions").select("*").eq("invoice_id", invoice.id).eq("status", "CAPTURED").order("created_at", { ascending: false }).limit(1).maybeSingle();

      const { data: foundTx } = await txQuery;
      if (foundTx) {
        tx = foundTx;
        paymentId = paymentId || tx.payment_id;
        orderId = orderId || tx.order_id;
      }
    } catch {
      // Table may not exist in unmigrated environments
    }

    // 3. Classify Payment
    const classification = classifyPayment(invoice, tx);

    if (classification === "AMBIGUOUS") {
      await PlatformAuthService.logAuditEvent({
        actorId: adminId || "SYSTEM_AUDIT",
        action: "REFUND_REJECTED_AMBIGUOUS_PAYMENT",
        resourceType: "INVOICE",
        resourceId: invoice.id,
        metadata: {
          reason: "Ambiguous or untrusted payment classification; failing closed for safety.",
          invoiceNumber: invoice.invoice_number,
        },
        adminClient: admin,
      });
      throw new Error("Payment classification is ambiguous or untrusted. Administrative refund rejected for security.");
    }

    // 4. Initiate Gateway Refund or Administrative Reversal
    let rzpRefund: any;
    let gateway = "RAZORPAY";
    let isTestReversal = false;

    if (classification === "GENUINE") {
      gateway = "RAZORPAY";
      let razorpayClient: any = null;
      try {
        razorpayClient = getRazorpayClient();
      } catch (clientErr: any) {
        throw new Error(`Razorpay gateway configuration failure: ${clientErr?.message || "Missing API credentials"}`);
      }

      if (razorpayClient && typeof razorpayClient.payments?.fetch === "function") {
        try {
          const livePayment = await razorpayClient.payments.fetch(paymentId);
          if (livePayment) {
            const liveAmountRefunded = Number(livePayment.amount_refunded || 0);
            const liveTotalAmount = Number(livePayment.amount || 0);
            const liveRemaining = liveTotalAmount - liveAmountRefunded;

            if (liveRemaining <= 0) {
              throw new Error(
                `Gateway Reconciliation Notice: Payment ${paymentId} has already been fully refunded on Razorpay (₹${(liveAmountRefunded / 100).toFixed(2)} refunded). No duplicate refund can be issued.`
              );
            }

            if (refundAmountPaise > liveRemaining) {
              throw new Error(
                `Gateway Reconciliation Notice: Requested refund of ₹${(refundAmountPaise / 100).toFixed(2)} exceeds remaining gateway balance of ₹${(liveRemaining / 100).toFixed(2)} on payment ${paymentId}.`
              );
            }
          }
        } catch (reconErr: any) {
          if (reconErr?.message?.includes("Gateway Reconciliation Notice")) {
            throw reconErr;
          }
          const isNotFound = reconErr?.statusCode === 404 || reconErr?.error?.description?.includes("does not exist");
          if (isNotFound) {
            throw new Error(`Razorpay payment ${paymentId} not found on remote gateway. Gateway refund cannot be processed.`);
          }
          console.warn("[Refund Service] Gateway pre-refund reconciliation check notice:", reconErr?.message || reconErr);
        }
      }

      if (!razorpayClient || typeof razorpayClient.payments?.refund !== "function") {
        throw new Error("Razorpay client is not configured for refunds.");
      }

      try {
        rzpRefund = await razorpayClient.payments.refund(paymentId, {
          amount: refundAmountPaise,
          notes: {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            tenantId: invoice.tenant_id,
            reason,
            subscriptionAction,
          },
        });
      } catch (gatewayErr: any) {
        console.error("[Refund Service] Gateway refund call failed for genuine payment:", {
          paymentId,
          invoiceId: invoice.id,
          statusCode: gatewayErr?.statusCode || gatewayErr?.error?.statusCode,
          error: gatewayErr?.error?.description || gatewayErr?.message,
        });

        await PlatformAuthService.logAuditEvent({
          actorId: adminId || "SYSTEM_SUPER_ADMIN",
          action: "GENUINE_REFUND_GATEWAY_FAILED",
          resourceType: "INVOICE",
          resourceId: invoice.id,
          metadata: {
            paymentId,
            statusCode: gatewayErr?.statusCode || gatewayErr?.error?.statusCode,
            error: gatewayErr?.error?.description || gatewayErr?.message,
          },
          adminClient: admin,
        });

        const status = gatewayErr?.statusCode || gatewayErr?.error?.statusCode;
        const desc = gatewayErr?.error?.description || gatewayErr?.message || "Gateway rejection";

        if (status === 401 || status === 403) {
          throw new Error(`Razorpay gateway authentication failure (${status}): ${desc}`);
        } else if (status === 404 || desc.includes("The id provided does not exist") || desc.includes("not found")) {
          throw new Error(`Razorpay payment ${paymentId} not found on remote gateway: ${desc}`);
        } else if (status === 429) {
          throw new Error(`Razorpay rate limit exceeded (HTTP 429). Please retry shortly.`);
        } else if (status >= 500) {
          throw new Error(`Razorpay remote gateway internal error (HTTP ${status}). Reconciliation required.`);
        } else if (gatewayErr?.code === "ETIMEDOUT" || gatewayErr?.message?.includes("timeout")) {
          throw new Error(`Razorpay network timeout. Transaction state uncertain; reconciliation required before retrying.`);
        } else {
          throw new Error(`Razorpay refund failed: ${desc}`);
        }
      }
    } else if (classification === "SIMULATED") {
      gateway = "SIMULATED";
      isTestReversal = true;

      let razorpayClient: any = null;
      try {
        razorpayClient = getRazorpayClient();
      } catch {
        // Mock client not available
      }

      let simulatedSuccess = false;
      if (razorpayClient && typeof razorpayClient.payments?.refund === "function") {
        try {
          rzpRefund = await razorpayClient.payments.refund(paymentId, {
            amount: refundAmountPaise,
            notes: {
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoice_number,
              tenantId: invoice.tenant_id,
              reason,
              subscriptionAction,
            },
          });
          simulatedSuccess = true;
        } catch (simErr: any) {
          const desc = simErr?.error?.description || simErr?.message || "";
          const status = simErr?.statusCode || simErr?.error?.statusCode;
          const isExpectedTestNotFound =
            status === 400 ||
            status === 404 ||
            desc.includes("does not exist") ||
            desc.includes("not found");

          if (isExpectedTestNotFound) {
            // Structured informational log for expected simulated-payment fallback, never console.error
            console.info("[Refund Service] Expected simulated payment not found on remote gateway; recording authorized administrative test reversal.", {
              operation: "ADMINISTRATIVE_TEST_REVERSAL",
              paymentId,
              invoiceId: invoice.id,
              classification: "SIMULATED",
              reason,
            });
          } else {
            console.error("[Refund Service] Unexpected internal error during simulated payment refund:", simErr);
            throw new Error(`Simulated payment refund failed with unexpected internal gateway error: ${desc}`);
          }
        }
      }

      if (!simulatedSuccess) {
        rzpRefund = {
          id: `rfnd_sim_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`,
          amount: refundAmountPaise,
          currency: "INR",
          status: "processed",
          classification: "ADMINISTRATIVE_TEST_REVERSAL",
        };
      }
    } else {
      // OFFLINE
      gateway = "OFFLINE";
      paymentId = paymentId || `pay_manual_${invoice.invoice_number}`;
      orderId = orderId || `ord_manual_${invoice.invoice_number}`;
      rzpRefund = {
        id: `rfnd_manual_${Date.now()}`,
        amount: refundAmountPaise,
        currency: "INR",
        status: "processed",
      };
    }

    const now = new Date().toISOString();

    // 5. Record in public.refunds (if table exists)
    let refundRecordId = rzpRefund.id;
    try {
      const { data: refundRecord } = await admin
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
          gateway,
          classification: isTestReversal ? "ADMINISTRATIVE_TEST_REVERSAL" : "GATEWAY_CONFIRMED",
          idempotency_key: idempotencyKey || null,
          gateway_response: rzpRefund,
          created_by: adminId,
          created_at: now,
        })
        .select("id")
        .maybeSingle();

      if (refundRecord) {
        refundRecordId = refundRecord.id;
      }
    } catch {
      console.warn("[Refund Service] Note: public.refunds table insert skipped or unavailable.");
    }

    // 6. Update invoice refunded amount and status
    const newRefundedTotal = Number(((alreadyRefundedPaise + refundAmountPaise) / 100).toFixed(2));
    const updatedInvoiceStatus = isFullRefund ? "REFUNDED" : "PARTIALLY_REFUNDED";
    const updatedNotes = invoice.notes
      ? `${invoice.notes} | Refund of ₹${refundAmountInr.toFixed(2)} processed (Ref: ${rzpRefund.id}) [${reason}]`
      : `Refund of ₹${refundAmountInr.toFixed(2)} processed (Ref: ${rzpRefund.id}) [${reason}]`;

    const { error: invUpdateErr } = await admin
      .from("platform_invoices")
      .update({
        refunded_amount_inr: newRefundedTotal,
        status: updatedInvoiceStatus,
        notes: updatedNotes,
        updated_at: now,
      })
      .eq("id", invoice.id);

    if (invUpdateErr) {
      await admin
        .from("platform_invoices")
        .update({
          status: updatedInvoiceStatus,
          notes: updatedNotes,
          updated_at: now,
        })
        .eq("id", invoice.id);
    }

    // 7. Generate Credit Note with exact integer paise reconciliation
    const creditNoteNumber = `CN-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const basePortionPaise = Math.round((refundAmountPaise * 100) / 118);
    const taxPortionPaise = refundAmountPaise - basePortionPaise;
    const basePortion = basePortionPaise / 100;
    const taxPortion = taxPortionPaise / 100;

    let creditNoteId = "cn_" + Date.now();
    try {
      const { data: creditNote } = await admin
        .from("credit_notes")
        .insert({
          credit_note_number: creditNoteNumber,
          invoice_id: invoice.id,
          refund_id: refundRecordId,
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
        .maybeSingle();

      if (creditNote) {
        creditNoteId = creditNote.id;
      }
    } catch {
      console.warn("[Refund Service] Warning: Credit note record creation issue.");
    }

    // 8. Q10 & Q11: Apply decoupled subscription action & mandate cancellation
    let currentSubscriptionStatus = "ACTIVE";
    if (invoice.subscription_id || invoice.tenant_id) {
      const subQuery = invoice.subscription_id
        ? admin.from("college_subscriptions").select("*").eq("id", invoice.subscription_id).maybeSingle()
        : admin.from("college_subscriptions").select("*").eq("tenant_id", invoice.tenant_id).maybeSingle();

      const { data: sub } = await subQuery;

      if (sub) {
        currentSubscriptionStatus = sub.status;

        if (subscriptionAction === "CANCEL_IMMEDIATELY") {
          currentSubscriptionStatus = "CANCELED";
          const { error: subErr } = await admin
            .from("college_subscriptions")
            .update({
              status: "CANCELED",
              canceled_at: now,
              cancellation_reason: `Super Admin refund with immediate cancellation: ${reason}`,
              cancel_at_period_end: false,
              updated_at: now,
            })
            .eq("id", sub.id);

          if (subErr) {
            await admin
              .from("college_subscriptions")
              .update({
                status: "CANCELED",
                updated_at: now,
              })
              .eq("id", sub.id);
          }

          // Q11: Stop recurring mandate immediately if table exists
          try {
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
          } catch {
            // Table optional
          }
        } else if (subscriptionAction === "CANCEL_AT_PERIOD_END") {
          const { error: subErr } = await admin
            .from("college_subscriptions")
            .update({
              cancel_at_period_end: true,
              cancellation_reason: `Super Admin refund with period-end cancellation: ${reason}`,
              updated_at: now,
            })
            .eq("id", sub.id);

          if (subErr) {
            await admin
              .from("college_subscriptions")
              .update({
                updated_at: now,
              })
              .eq("id", sub.id);
          }

          try {
            await admin
              .from("recurring_mandates")
              .update({
                cancel_at_period_end: true,
                updated_at: now,
              })
              .eq("tenant_id", invoice.tenant_id)
              .eq("status", "ACTIVE");
          } catch {
            // Table optional
          }
        }
      }
    }

    // 9. Platform Audit Log
    try {
      await PlatformAuthService.logAuditEvent({
        actorId: adminId || "SYSTEM_SUPER_ADMIN",
        action: isTestReversal ? "ADMINISTRATIVE_TEST_REVERSAL" : "PLATFORM_INVOICE_REFUND_ISSUED",
        resourceType: "INVOICE",
        resourceId: invoice.id,
        metadata: {
          refundId: rzpRefund.id,
          amountInr: refundAmountInr,
          isFullRefund,
          subscriptionAction,
          reason,
          gateway,
          classification: isTestReversal ? "ADMINISTRATIVE_TEST_REVERSAL" : "GATEWAY_CONFIRMED",
        },
        adminClient: admin,
      });
    } catch {
      // Audit log optional
    }

    return {
      success: true,
      refundId: rzpRefund.id,
      creditNoteId,
      creditNoteNumber,
      amountInr: refundAmountInr,
      isFullRefund,
      invoiceStatus: updatedInvoiceStatus,
      subscriptionAction,
      subscriptionStatus: currentSubscriptionStatus,
      gateway,
      isTestReversal,
    };
  }

  /**
   * Lists historical refunds with tenant boundary isolation.
   */
  static async listRefunds(params: {
    tenantId?: string;
    invoiceId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    admin?: ReturnType<typeof createAdminClient>;
  } = {}) {
    const admin = params.admin || createAdminClient();
    const limit = params.limit || 50;
    const offset = params.offset || 0;

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
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.tenantId && params.tenantId !== "ALL") {
      query = query.eq("tenant_id", params.tenantId);
    }
    if (params.invoiceId) {
      query = query.eq("invoice_id", params.invoiceId);
    }
    if (params.status && params.status !== "ALL") {
      query = query.eq("status", params.status);
    }

    const { data, error } = await query;
    if (error) {
      console.warn("[Refund Service] listRefunds error:", error.message);
      return [];
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
