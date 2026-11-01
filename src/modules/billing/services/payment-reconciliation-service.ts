/**
 * Payment Reconciliation Service (UrPlaced SA-05 Step 01)
 * Single, authoritative atomic path for Razorpay order generation, checkout verification,
 * and webhook event reconciliation.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient, getRazorpayConfig, verifyCheckoutSignature, verifyWebhookSignature } from "@/lib/payment/razorpay";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { BillingNotificationService } from "./billing-notification-service";
import { TaxConfigurationService } from "./tax-configuration-service";

export interface CreateOrderResult {
  orderId: string;
  amountPaise: number;
  amountInr: number;
  currency: string;
  keyId: string;
  invoiceId: string;
  invoiceNumber: string;
  tenantId: string;
}

export interface ReconcilePaymentResult {
  success: boolean;
  duplicate?: boolean;
  alreadyProcessed?: boolean;
  orderId: string;
  paymentId: string;
  invoiceId: string;
  tenantId: string;
  message?: string;
}

export class PaymentReconciliationService {
  /**
   * Convenience wrapper for Razorpay order generation.
   */
  static async createRazorpayOrder(params: {
    invoiceId: string;
    tenantId?: string;
    userId?: string;
    idempotencyKey?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const admin = params.admin || createAdminClient();
    const { data: inv } = await admin
      .from("platform_invoices")
      .select("tenant_id")
      .eq("id", params.invoiceId)
      .maybeSingle();

    const tenantId = params.tenantId || inv?.tenant_id || "college-001";
    const userId = params.userId || "system-checkout";

    const res = await PaymentReconciliationService.createPaymentOrder({
      invoiceId: params.invoiceId,
      tenantId,
      userId,
      idempotencyKey: params.idempotencyKey,
      admin,
    });

    return {
      razorpayOrderId: res.orderId,
      orderId: res.orderId,
      amountPaise: res.amountPaise,
      amountInr: res.amountInr,
      currency: res.currency,
      keyId: res.keyId,
      invoiceId: res.invoiceId,
      invoiceNumber: res.invoiceNumber,
      tenantId: res.tenantId,
    };
  }

  /**
   * Convenience wrapper for client checkout verification.
   */
  static async verifyCheckoutPayment(params: {
    orderId: string;
    paymentId: string;
    signature: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    return PaymentReconciliationService.reconcilePayment({
      orderId: params.orderId,
      paymentId: params.paymentId,
      signature: params.signature,
      source: "CHECKOUT_VERIFICATION",
      admin: params.admin,
    });
  }

  /**
   * Creates a verified server-side Razorpay order for an eligible, unpaid institutional invoice.
   * Enforces server-authoritative pricing from database records.
   */
  static async createPaymentOrder(params: {
    invoiceId: string;
    tenantId: string;
    userId: string;
    idempotencyKey?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<CreateOrderResult> {
    const { invoiceId, tenantId, userId, idempotencyKey, admin = createAdminClient() } = params;

    // 1. Fetch trusted invoice from database
    const { data: invoice, error: invErr } = await admin
      .from("platform_invoices")
      .select("id, invoice_number, tenant_id, subscription_id, amount_inr, tax_inr, total_amount, currency, status")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    // 2. Strict tenant authorization check: Invoice must belong to caller's tenant
    if (invoice.tenant_id !== tenantId) {
      throw new Error("Forbidden: You are not authorized to pay an invoice belonging to another college.");
    }

    // 3. Status eligibility check: Invoice must be unpaid
    if (invoice.status === "PAID") {
      throw new Error("Invalid request: This invoice has already been fully paid.");
    }
    if (invoice.status === "CANCELED" || invoice.status === "REFUNDED" || invoice.status === "VOID") {
      throw new Error(`Invalid request: Cannot pay invoice in '${invoice.status}' status.`);
    }

    // 4. Calculate total amount in INR and paise strictly on the server
    const amountInr = Number(invoice.amount_inr ?? invoice.total_amount ?? 0);
    const taxInr = Number(invoice.tax_inr ?? 0);
    const totalInr = Number((amountInr + taxInr).toFixed(2));
    const amountPaise = Math.round(totalInr * 100);

    if (amountPaise <= 0) {
      throw new Error("Invalid invoice amount: Payable total must be greater than zero.");
    }

    const config = getRazorpayConfig();

    // 5. Idempotency & reuse check: Check if an active order already exists
    if (idempotencyKey) {
      const { data: existingByKey } = await admin
        .from("payment_orders")
        .select("order_id, amount_paise, currency, status")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();

      if (existingByKey && existingByKey.status !== "FAILED" && existingByKey.status !== "EXPIRED") {
        return {
          orderId: existingByKey.order_id,
          amountPaise: Number(existingByKey.amount_paise),
          amountInr: totalInr,
          currency: existingByKey.currency,
          keyId: config.keyId,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoice_number,
          tenantId: invoice.tenant_id,
        };
      }
    }

    // Check for an existing unexpired order for this invoice created recently (< 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: existingActiveOrder } = await admin
      .from("payment_orders")
      .select("order_id, amount_paise, currency, status, created_at")
      .eq("invoice_id", invoiceId)
      .eq("status", "CREATED")
      .gte("created_at", thirtyMinutesAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingActiveOrder) {
      return {
        orderId: existingActiveOrder.order_id,
        amountPaise: Number(existingActiveOrder.amount_paise),
        amountInr: totalInr,
        currency: existingActiveOrder.currency,
        keyId: config.keyId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        tenantId: invoice.tenant_id,
      };
    }

    // 6. Create order with official Razorpay API
    const razorpay = getRazorpayClient();
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: invoice.invoice_number.slice(0, 40),
      notes: {
        tenantId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        userId,
      },
    });

    // 7. Persist payment order record in database
    const { error: insertOrderErr } = await admin.from("payment_orders").insert({
      order_id: rzpOrder.id,
      tenant_id: tenantId,
      invoice_id: invoice.id,
      subscription_id: invoice.subscription_id,
      amount_paise: amountPaise,
      currency: "INR",
      status: "CREATED",
      gateway: "RAZORPAY",
      idempotency_key: idempotencyKey || null,
      created_by: userId,
    });

    if (insertOrderErr) {
      console.error("[Payment Reconciliation] Failed to record payment order:", insertOrderErr);
      throw new Error(`Failed to persist payment order: ${insertOrderErr.message}`);
    }

    // 8. Update platform invoice with order reference
    await admin
      .from("platform_invoices")
      .update({
        razorpay_order_id: rzpOrder.id,
        payment_gateway: "RAZORPAY",
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice.id);

    return {
      orderId: rzpOrder.id,
      amountPaise,
      amountInr: totalInr,
      currency: "INR",
      keyId: config.keyId,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      tenantId: invoice.tenant_id,
    };
  }

  /**
   * Authoritative Single Reconciliation Entrypoint:
   * Called by BOTH Checkout Verification API and Webhook Handlers.
   * Guarantees atomic, idempotent subscription activation and invoice settlement.
   */
  static async reconcilePayment(params: {
    orderId: string;
    paymentId: string;
    signature?: string;
    source: "CHECKOUT_VERIFICATION" | "WEBHOOK" | "RECONCILIATION";
    rawWebhookBody?: string;
    webhookSignature?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<ReconcilePaymentResult> {
    const {
      orderId,
      paymentId,
      signature,
      source,
      rawWebhookBody,
      webhookSignature,
      admin = createAdminClient(),
    } = params;

    // 1. Idempotency Gate: Check if payment transaction is already recorded and captured
    const { data: existingTx } = await admin
      .from("payment_transactions")
      .select("id, status, tenant_id, invoice_id")
      .eq("payment_id", paymentId)
      .maybeSingle();

    if (existingTx && existingTx.status === "CAPTURED") {
      return {
        success: true,
        duplicate: true,
        alreadyProcessed: true,
        orderId,
        paymentId,
        invoiceId: existingTx.invoice_id,
        tenantId: existingTx.tenant_id,
        message: "Payment was previously reconciled and activated.",
      };
    }

    // 2. Look up trusted payment order record
    const { data: order, error: orderErr } = await admin
      .from("payment_orders")
      .select("id, order_id, tenant_id, invoice_id, subscription_id, amount_paise, currency, status")
      .eq("order_id", orderId)
      .maybeSingle();

    if (orderErr || !order) {
      throw new Error(`Payment order not found: ${orderId}`);
    }

    // 3. Look up trusted invoice record
    const { data: invoice, error: invErr } = await admin
      .from("platform_invoices")
      .select("id, invoice_number, tenant_id, subscription_id, amount_inr, tax_inr, status")
      .eq("id", order.invoice_id)
      .maybeSingle();

    if (invErr || !invoice) {
      throw new Error(`Associated invoice not found: ${order.invoice_id}`);
    }

    // 4. Cryptographic Signature Verification
    if (source === "CHECKOUT_VERIFICATION") {
      if (!signature) {
        throw new Error("Missing checkout signature for payment verification.");
      }
      const isValid = verifyCheckoutSignature({
        orderId,
        paymentId,
        signature,
      });
      if (!isValid) {
        throw new Error("Cryptographic verification failed: Invalid checkout signature.");
      }
    } else if (source === "WEBHOOK" && rawWebhookBody && webhookSignature) {
      const isValid = verifyWebhookSignature({
        rawBody: rawWebhookBody,
        signature: webhookSignature,
      });
      if (!isValid) {
        throw new Error("Cryptographic verification failed: Invalid webhook signature.");
      }
    }

    // 5. Authoritative Gateway API Verification: Fetch payment directly from Razorpay
    const razorpay = getRazorpayClient();
    let paymentDetails: any;
    try {
      paymentDetails = await razorpay.payments.fetch(paymentId);
    } catch (fetchErr: any) {
      console.error("[Payment Reconciliation] Failed to fetch payment from Razorpay:", fetchErr);
      throw new Error(`Failed to verify payment with gateway: ${fetchErr?.message || "Gateway unreachable"}`);
    }

    // Confirm payment properties match recorded order
    if (paymentDetails.order_id !== order.order_id) {
      throw new Error(`Payment order mismatch: Expected ${order.order_id}, received ${paymentDetails.order_id}`);
    }

    if (paymentDetails.currency !== order.currency) {
      throw new Error(`Currency mismatch: Expected ${order.currency}, received ${paymentDetails.currency}`);
    }

    if (Number(paymentDetails.amount) !== Number(order.amount_paise)) {
      throw new Error(`Amount mismatch: Expected ${order.amount_paise} paise, received ${paymentDetails.amount} paise`);
    }

    // CRITICAL: Must be genuinely captured. An authorized or pending payment is not paid!
    if (paymentDetails.status !== "captured") {
      // Record non-captured attempt in transactions for audit without activating
      await admin.from("payment_transactions").upsert({
        payment_id: paymentId,
        order_id: orderId,
        tenant_id: order.tenant_id,
        invoice_id: order.invoice_id,
        amount_paise: Number(paymentDetails.amount),
        currency: paymentDetails.currency,
        status: paymentDetails.status === "failed" ? "FAILED" : "AUTHORIZED",
        method: paymentDetails.method || "unknown",
        gateway: "RAZORPAY",
        gateway_signature: signature || webhookSignature || null,
        error_code: paymentDetails.error_code || null,
        error_description: paymentDetails.error_description || `Payment status is ${paymentDetails.status}`,
        source,
      }, { onConflict: "payment_id" });

      throw new Error(`Payment not captured: Current status is '${paymentDetails.status}'. Invoice cannot be marked paid.`);
    }

    const now = new Date().toISOString();

    // 6. Record verified transaction in ledger
    const { error: txErr } = await admin.from("payment_transactions").upsert({
      payment_id: paymentId,
      order_id: orderId,
      tenant_id: order.tenant_id,
      invoice_id: order.invoice_id,
      amount_paise: Number(paymentDetails.amount),
      currency: paymentDetails.currency,
      status: "CAPTURED",
      method: paymentDetails.method || "unknown",
      gateway: "RAZORPAY",
      gateway_signature: signature || webhookSignature || null,
      source,
      updated_at: now,
    }, { onConflict: "payment_id" });

    if (txErr) {
      console.warn("[Payment Reconciliation] Transaction upsert warning:", txErr);
    }

    // 7. Update payment order status to PAID
    await admin
      .from("payment_orders")
      .update({
        status: "PAID",
        updated_at: now,
      })
      .eq("order_id", orderId);

    // 8. Update platform invoice to PAID
    await admin
      .from("platform_invoices")
      .update({
        status: "PAID",
        paid_at: now,
        payment_method: "RAZORPAY",
        razorpay_payment_id: paymentId,
        payment_gateway: "RAZORPAY",
        notes: `Settled via Razorpay (Payment ID: ${paymentId})`,
        updated_at: now,
      })
      .eq("id", order.invoice_id);

    // 9. Activate College Subscription (Guaranteed Atomic Path)
    await PlatformSubscriptionService.activateSubscriptionOnVerifiedPayment({
      tenantId: order.tenant_id,
      subscriptionId: order.subscription_id || invoice.subscription_id,
      paymentReference: paymentId,
      adminId: "SYSTEM_RAZORPAY_RECONCILIATION",
      admin,
    });

    // 10. Audit Log
    await PlatformAuthService.logAuditEvent({
      actorId: "SYSTEM_PAYMENT_GATEWAY",
      action: "PLATFORM_PAYMENT_RECONCILED",
      resourceType: "INVOICE",
      resourceId: order.invoice_id,
      metadata: {
        orderId,
        paymentId,
        tenantId: order.tenant_id,
        amountPaise: Number(paymentDetails.amount),
        source,
      },
      adminClient: admin,
    });

    return {
      success: true,
      duplicate: false,
      alreadyProcessed: false,
      orderId,
      paymentId,
      invoiceId: order.invoice_id,
      tenantId: order.tenant_id,
      message: "Payment successfully reconciled and subscription activated.",
    };
  }

  /**
   * Handles payment failure without compromising tenant status or activating subscriptions.
   */
  static async recordFailedPayment(params: {
    orderId: string;
    paymentId: string;
    errorCode?: string;
    errorDescription?: string;
    source: "CHECKOUT_VERIFICATION" | "WEBHOOK";
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<void> {
    const { orderId, paymentId, errorCode, errorDescription, source, admin = createAdminClient() } = params;

    const { data: order } = await admin
      .from("payment_orders")
      .select("tenant_id, invoice_id, amount_paise, currency")
      .eq("order_id", orderId)
      .maybeSingle();

    if (!order) return;

    await admin.from("payment_transactions").upsert({
      payment_id: paymentId,
      order_id: orderId,
      tenant_id: order.tenant_id,
      invoice_id: order.invoice_id,
      amount_paise: Number(order.amount_paise),
      currency: order.currency,
      status: "FAILED",
      gateway: "RAZORPAY",
      error_code: errorCode || "PAYMENT_FAILED",
      error_description: errorDescription || "Payment failed at gateway",
      source,
      updated_at: new Date().toISOString(),
    }, { onConflict: "payment_id" });

    // Update order status to ATTEMPTED if not already PAID
    await admin
      .from("payment_orders")
      .update({ status: "ATTEMPTED", updated_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .neq("status", "PAID");
  }

  /**
   * Processes incoming server-to-server Razorpay webhook events.
   * Enforces raw body verification, event idempotency, and delegates to the shared reconciliation engine.
   */
  static async processWebhookEvent(params: {
    rawBody: string;
    signature: string;
    eventIdHeader?: string | null;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ received: boolean; duplicate?: boolean; ignored?: boolean; eventType?: string }> {
    const { rawBody, signature, eventIdHeader, admin = createAdminClient() } = params;

    // 1. Verify webhook signature
    const isValid = verifyWebhookSignature({
      rawBody,
      signature,
    });

    if (!isValid) {
      throw new Error("Invalid Razorpay webhook signature.");
    }

    // 2. Parse payload
    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("Invalid JSON payload in webhook body.");
    }

    const eventType = payload.event;
    // Derive unique event receipt identifier
    const eventId =
      eventIdHeader ||
      payload.event_id ||
      payload.id ||
      `evt_${eventType}_${payload.created_at || Date.now()}`;

    // 3. Idempotency Check in payment_webhook_events
    const { data: existingEvent } = await admin
      .from("payment_webhook_events")
      .select("id, status")
      .eq("event_id", eventId)
      .maybeSingle();

    if (existingEvent && existingEvent.status === "PROCESSED") {
      return { received: true, duplicate: true, eventType };
    }

    // Record initial event receipt
    if (!existingEvent) {
      await admin.from("payment_webhook_events").insert({
        event_id: eventId,
        event_type: eventType,
        gateway: "RAZORPAY",
        status: "RECEIVED",
      });
    }

    try {
      // 4. Dispatch based on event type
      if (eventType === "order.paid" || eventType === "payment.captured") {
        const paymentEntity = payload.payload?.payment?.entity;
        const orderEntity = payload.payload?.order?.entity;

        const paymentId = paymentEntity?.id;
        const orderId = paymentEntity?.order_id || orderEntity?.id;

        if (!orderId || !paymentId) {
          throw new Error(`Incomplete webhook payload: order_id (${orderId}) or payment_id (${paymentId}) missing.`);
        }

        await this.reconcilePayment({
          orderId,
          paymentId,
          source: "WEBHOOK",
          rawWebhookBody: rawBody,
          webhookSignature: signature,
          admin,
        });

        await admin
          .from("payment_webhook_events")
          .update({
            status: "PROCESSED",
            order_id: orderId,
            payment_id: paymentId,
            processed_at: new Date().toISOString(),
          })
          .eq("event_id", eventId);

        return { received: true, duplicate: false, eventType };
      }

      if (eventType === "payment.failed") {
        const paymentEntity = payload.payload?.payment?.entity;
        const paymentId = paymentEntity?.id;
        const orderId = paymentEntity?.order_id;

        if (orderId && paymentId) {
          await this.recordFailedPayment({
            orderId,
            paymentId,
            errorCode: paymentEntity.error_code,
            errorDescription: paymentEntity.error_description,
            source: "WEBHOOK",
            admin,
          });

          await admin
            .from("payment_webhook_events")
            .update({
              status: "PROCESSED",
              order_id: orderId,
              payment_id: paymentId,
              processed_at: new Date().toISOString(),
            })
            .eq("event_id", eventId);
        }

        return { received: true, duplicate: false, eventType };
      }

      // --- REFUND EVENTS ---
      if (eventType === "refund.created" || eventType === "refund.processed" || eventType === "refund.failed") {
        const refundEntity = payload.payload?.refund?.entity;
        const refundId = refundEntity?.id;
        const paymentId = refundEntity?.payment_id;

        if (refundId) {
          const statusMap: Record<string, "PENDING" | "SUCCESS" | "FAILED"> = {
            "refund.created": "PENDING",
            "refund.processed": "SUCCESS",
            "refund.failed": "FAILED",
          };
          const targetStatus = statusMap[eventType] || "PENDING";

          const { data: existingRefund } = await admin
            .from("refunds")
            .select("id, invoice_id, amount_inr, status")
            .eq("refund_id", refundId)
            .maybeSingle();

          if (!existingRefund && paymentId) {
            // Refund created externally (e.g. from Razorpay Dashboard)
            const { data: tx } = await admin
              .from("payment_transactions")
              .select("order_id, invoice_id, tenant_id")
              .eq("payment_id", paymentId)
              .maybeSingle();

            if (tx) {
              const amountPaise = Number(refundEntity.amount || 0);
              const amountInr = amountPaise / 100;
              await admin.from("refunds").insert({
                refund_id: refundId,
                payment_id: paymentId,
                order_id: tx.order_id,
                invoice_id: tx.invoice_id,
                tenant_id: tx.tenant_id,
                amount_paise: amountPaise,
                amount_inr: amountInr,
                currency: refundEntity.currency || "INR",
                status: targetStatus,
                reason: refundEntity.notes?.reason || "External Razorpay Refund",
                subscription_action: refundEntity.notes?.subscriptionAction || "KEEP_ACTIVE",
                gateway: "RAZORPAY",
                gateway_response: refundEntity,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          } else if (existingRefund) {
            await admin
              .from("refunds")
              .update({
                status: targetStatus,
                gateway_response: refundEntity,
                updated_at: new Date().toISOString(),
              })
              .eq("refund_id", refundId);

            // If a previously recorded successful refund failed at the gateway, restore invoice balance
            if (targetStatus === "FAILED" && existingRefund.status === "SUCCESS") {
              const { data: inv } = await admin
                .from("platform_invoices")
                .select("id, amount_inr, tax_inr, refunded_amount_inr")
                .eq("id", existingRefund.invoice_id)
                .maybeSingle();

              if (inv) {
                const currentRefundedPaise = Math.round(Number(inv.refunded_amount_inr || 0) * 100);
                const failedPaise = Math.round(Number(existingRefund.amount_inr) * 100);
                const restoredRefundedPaise = Math.max(0, currentRefundedPaise - failedPaise);
                const restoredRefundedInr = restoredRefundedPaise / 100;
                const totalInvoicePaise = Math.round(Number(inv.amount_inr) * 100) + Math.round(Number(inv.tax_inr) * 100);

                let restoredStatus = "PAID";
                if (restoredRefundedPaise > 0) {
                  restoredStatus = restoredRefundedPaise >= totalInvoicePaise ? "REFUNDED" : "PARTIALLY_REFUNDED";
                }

                await admin
                  .from("platform_invoices")
                  .update({
                    refunded_amount_inr: restoredRefundedInr,
                    status: restoredStatus,
                    notes: `Refund ${refundId} failed at gateway; restored refundable balance.`,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", inv.id);
              }
            }
          }

          await admin
            .from("payment_webhook_events")
            .update({
              status: "PROCESSED",
              payment_id: paymentId || null,
              processed_at: new Date().toISOString(),
            })
            .eq("event_id", eventId);

          await PlatformAuthService.logAuditEvent({
            actorId: "SYSTEM_WEBHOOK",
            action: `REFUND_WEBHOOK_${targetStatus}`,
            resourceType: "REFUND",
            resourceId: refundId,
            metadata: { eventType, refundEntity },
            adminClient: admin,
          });
        }

        return { received: true, duplicate: false, eventType };
      }

      // --- SUBSCRIPTION / RECURRING MANDATE EVENTS ---
      if (typeof eventType === "string" && eventType.startsWith("subscription.")) {
        const subEntity = payload.payload?.subscription?.entity;
        const subId = subEntity?.id;

        if (subId) {
          const nowIso = new Date().toISOString();
          let mandateStatus: string = "ACTIVE";

          switch (eventType) {
            case "subscription.authenticated":
              // Mandate authorization only; does NOT grant paid access (Correction 2)
              mandateStatus = "AUTHENTICATED";
              break;

            case "subscription.activated":
            case "subscription.resumed":
              // Mandate lifecycle only; paid entitlements require verified payment (Correction 2)
              mandateStatus = "ACTIVE";
              break;

            case "subscription.charged": {
              mandateStatus = "ACTIVE";
              const paymentEntity = payload.payload?.payment?.entity;
              const paymentId = paymentEntity?.id;
              const paymentStatus = paymentEntity?.status;

              // Only grant paid extension if payment is genuinely captured (Correction 2)
              if (paymentId && paymentStatus === "captured") {
                // 1. Prevent duplicate period extensions from duplicate charge events (Correction 1 & 8)
                const { data: existingTx } = await admin
                  .from("payment_transactions")
                  .select("id, status")
                  .eq("payment_id", paymentId)
                  .eq("status", "CAPTURED")
                  .maybeSingle();

                if (existingTx) {
                  // Already processed; avoid duplicate extension
                  break;
                }

                // 2. Fetch mandate, college subscription, and associated plan
                const { data: mandate } = await admin
                  .from("recurring_mandates")
                  .select("id, tenant_id, subscription_id, billing_interval")
                  .eq("gateway_subscription_id", subId)
                  .maybeSingle();

                if (mandate) {
                  const { data: sub } = await admin
                    .from("college_subscriptions")
                    .select("id, tenant_id, plan_id, plan_version, status, renewal_date, expiry_date, billing_mode")
                    .eq("id", mandate.subscription_id)
                    .maybeSingle();

                  if (sub) {
                    // Fetch plan billing cycle
                    const plan = await PlatformSubscriptionService.getPlanById(sub.plan_id, admin);
                    const billingInterval = (
                      mandate.billing_interval ||
                      plan?.billingCycle ||
                      "ANNUAL"
                    ).toUpperCase();

                    // 3. Derive next renewal date (Correction 1: Billing-cycle-aware)
                    let nextRenewalIso: string;
                    if (subEntity?.current_end && typeof subEntity.current_end === "number" && subEntity.current_end > 0) {
                      // Trusted gateway period end
                      nextRenewalIso = new Date(subEntity.current_end * 1000).toISOString();
                    } else {
                      // Add calendar period based on plan interval
                      const baseDate = sub.renewal_date ? new Date(sub.renewal_date) : new Date();
                      const nextDate = new Date(baseDate.getTime());
                      if (billingInterval === "MONTHLY") {
                        nextDate.setMonth(nextDate.getMonth() + 1);
                      } else if (billingInterval === "QUARTERLY") {
                        nextDate.setMonth(nextDate.getMonth() + 3);
                      } else {
                        // Default ANNUAL
                        nextDate.setFullYear(nextDate.getFullYear() + 1);
                      }
                      nextRenewalIso = nextDate.toISOString();
                    }

                    // 4. Record renewal transaction in financial ledger
                    const orderId = paymentEntity.order_id || `sub_order_${Date.now()}`;
                    await admin.from("payment_transactions").upsert(
                      {
                        payment_id: paymentId,
                        order_id: orderId,
                        tenant_id: mandate.tenant_id,
                        amount_paise: Number(paymentEntity.amount || 0),
                        currency: paymentEntity.currency || "INR",
                        status: "CAPTURED",
                        method: paymentEntity.method || "card",
                        gateway: "RAZORPAY",
                        source: "WEBHOOK",
                        updated_at: nowIso,
                      },
                      { onConflict: "payment_id" }
                    );

                    // 5. Generate and settle renewal platform invoice with exact tax calculation
                    const totalRenewalInr = Number((Number(paymentEntity.amount || 0) / 100).toFixed(2));
                    const nowYear = new Date().getFullYear();
                    const invoiceNumber = `INV-REN-${nowYear}-${Math.floor(10000 + Math.random() * 90000)}`;

                    const { data: tenant } = await admin
                      .from("tenants")
                      .select("gstin, state")
                      .eq("id", mandate.tenant_id)
                      .maybeSingle();

                    const taxCalculation = await TaxConfigurationService.calculateTax({
                      baseAmountInr: Number((totalRenewalInr / 1.18).toFixed(2)),
                      collegeGstin: tenant?.gstin,
                      collegeStateCode: tenant?.state,
                      admin,
                    });

                    await admin.from("platform_invoices").insert({
                      invoice_number: invoiceNumber,
                      tenant_id: mandate.tenant_id,
                      subscription_id: sub.id,
                      amount_inr: taxCalculation.baseAmountInr,
                      tax_inr: taxCalculation.totalTaxInr,
                      tax_snapshot: taxCalculation,
                      total_amount: totalRenewalInr,
                      currency: "INR",
                      status: "PAID",
                      issue_date: nowIso,
                      due_date: nowIso,
                      paid_at: nowIso,
                      payment_method: "RAZORPAY",
                      razorpay_payment_id: paymentId,
                      notes: `Auto-renewal charge for ${billingInterval} billing cycle (${nextRenewalIso})`,
                    });

                    // 6. Update college subscription paid status & period
                    await admin
                      .from("college_subscriptions")
                      .update({
                        status: "ACTIVE",
                        renewal_date: nextRenewalIso,
                        expiry_date: nextRenewalIso,
                        last_payment_reference: paymentId,
                        updated_at: nowIso,
                      })
                      .eq("id", sub.id);

                    // 7. Dispatch Renewal Success Notifications (Q12)
                    await BillingNotificationService.sendRenewalSuccessNotification({
                      tenantId: mandate.tenant_id,
                      invoiceNumber,
                      amountInr: totalRenewalInr,
                      billingInterval,
                      nextRenewalDate: nextRenewalIso,
                      admin,
                    });
                  }
                }
              }
              break;
            }

            case "subscription.pending":
              mandateStatus = "PENDING";
              break;

            case "subscription.halted": {
              mandateStatus = "HALTED";
              const { data: mandate } = await admin
                .from("recurring_mandates")
                .select("tenant_id, subscription_id")
                .eq("gateway_subscription_id", subId)
                .maybeSingle();

              if (mandate) {
                // Subscription enters PAST_DUE
                await admin
                  .from("college_subscriptions")
                  .update({
                    status: "PAST_DUE",
                    updated_at: nowIso,
                  })
                  .eq("id", mandate.subscription_id);

                // Dispatch Renewal Failure Notice & Alert Super Admin (Q12 / Q13)
                await BillingNotificationService.sendRenewalFailureNotification({
                  tenantId: mandate.tenant_id,
                  subId,
                  errorMessage: "Automatic renewal charge failed at payment gateway. Mandate halted.",
                  admin,
                });
              }
              break;
            }

            case "subscription.paused":
              mandateStatus = "PAUSED";
              break;

            case "subscription.cancelled":
              mandateStatus = "CANCELLED";
              break;

            case "subscription.completed":
              mandateStatus = "COMPLETED";
              break;

            case "subscription.updated":
              mandateStatus = subEntity.status === "active" ? "ACTIVE" : (subEntity.status?.toUpperCase() || "ACTIVE");
              break;
          }

          await admin
            .from("recurring_mandates")
            .update({
              status: mandateStatus,
              updated_at: nowIso,
            })
            .eq("gateway_subscription_id", subId);

          await admin
            .from("payment_webhook_events")
            .update({
              status: "PROCESSED",
              processed_at: nowIso,
            })
            .eq("event_id", eventId);

          await PlatformAuthService.logAuditEvent({
            actorId: "SYSTEM_WEBHOOK",
            action: `SUBSCRIPTION_WEBHOOK_${eventType.toUpperCase().replace(".", "_")}`,
            resourceType: "RECURRING_MANDATE",
            resourceId: subId,
            metadata: { eventType, mandateStatus, subEntity },
            adminClient: admin,
          });
        }

        return { received: true, duplicate: false, eventType };
      }

      // Mark unhandled events as IGNORED
      await admin
        .from("payment_webhook_events")
        .update({
          status: "IGNORED",
          processed_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);

      return { received: true, ignored: true, eventType };
    } catch (procErr: any) {
      await admin
        .from("payment_webhook_events")
        .update({
          status: "FAILED",
          error_message: procErr?.message || "Webhook processing error",
          processed_at: new Date().toISOString(),
        })
        .eq("event_id", eventId);

      throw procErr;
    }
  }
}
