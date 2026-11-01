/**
 * Reconciliation Engine (SA-05 Workstream 06)
 * Implements Q18 (Automated payment reconciliation) and Q21 (15-min pending check & daily sweep).
 * Detects missing webhooks, out-of-order events, amount mismatches, and flags discrepancies.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/payment/razorpay";
import { PaymentReconciliationService } from "./payment-reconciliation-service";
import { RecurringMandateService } from "./recurring-mandate-service";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export interface ReconciliationSummary {
  scannedOrders: number;
  reconciledCaptured: number;
  markedFailed: number;
  discrepanciesFound: number;
  errors: string[];
}

export class ReconciliationEngine {
  /**
   * 15-Minute Sweep: Checks pending/uncertain orders older than 15 minutes.
   * Resolves missing or delayed webhooks directly against the authoritative Razorpay API.
   */
  static async run15MinuteReconciliation(admin = createAdminClient()): Promise<ReconciliationSummary> {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Query pending orders created between 15 mins and 48 hours ago
    const { data: pendingOrders, error } = await admin
      .from("payment_orders")
      .select("id, order_id, tenant_id, invoice_id, amount_paise, currency, status, created_at")
      .in("status", ["CREATED", "ATTEMPTED"])
      .lte("created_at", fifteenMinutesAgo)
      .gte("created_at", twoDaysAgo)
      .limit(50);

    const summary: ReconciliationSummary = {
      scannedOrders: pendingOrders?.length || 0,
      reconciledCaptured: 0,
      markedFailed: 0,
      discrepanciesFound: 0,
      errors: [],
    };

    if (error || !pendingOrders) {
      summary.errors.push(error?.message || "Failed to query pending orders");
      return summary;
    }

    const razorpay = getRazorpayClient();

    for (const order of pendingOrders) {
      try {
        // Query payments associated with this order from Razorpay
        const rzpPayments = await razorpay.orders.fetchPayments(order.order_id);
        const paymentsList = (rzpPayments as any)?.items || [];

        // Check for any captured payment
        const capturedPayment = paymentsList.find((p: any) => p.status === "captured");

        if (capturedPayment) {
          // Reconcile and activate subscription! (Webhook was missing or delayed)
          await PaymentReconciliationService.reconcilePayment({
            orderId: order.order_id,
            paymentId: capturedPayment.id,
            source: "RECONCILIATION",
            admin,
          });

          summary.reconciledCaptured++;

          // Record discrepancy notice that webhook was missing/delayed
          await admin.from("payment_discrepancies").insert({
            tenant_id: order.tenant_id,
            order_id: order.order_id,
            payment_id: capturedPayment.id,
            invoice_id: order.invoice_id,
            discrepancy_type: "MISSING_WEBHOOK",
            gateway_status: "captured",
            local_status: order.status,
            suggested_action: "Payment automatically reconciled from 15-minute scheduled gateway check.",
            resolved: true,
            resolution_notes: "Auto-resolved by ReconciliationEngine",
            resolved_at: new Date().toISOString(),
          });
        } else {
          // Check if all payment attempts failed
          const allFailed = paymentsList.length > 0 && paymentsList.every((p: any) => p.status === "failed");
          if (allFailed) {
            await admin
              .from("payment_orders")
              .update({ status: "FAILED", updated_at: new Date().toISOString() })
              .eq("order_id", order.order_id);

            summary.markedFailed++;
          }
        }
      } catch (err: any) {
        summary.errors.push(`Order ${order.order_id} check error: ${err.message}`);
      }
    }

    return summary;
  }

  /**
   * Daily Full Sweep: Audits recent platform transactions against Razorpay ledger.
   * Flags unresolved discrepancies for Super Admin review without destroying verified local records.
   */
  static async runDailySweep(admin = createAdminClient()): Promise<ReconciliationSummary> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentTransactions, error } = await admin
      .from("payment_transactions")
      .select("id, payment_id, order_id, tenant_id, invoice_id, amount_paise, currency, status, created_at")
      .gte("created_at", thirtyDaysAgo)
      .limit(100);

    const summary: ReconciliationSummary = {
      scannedOrders: recentTransactions?.length || 0,
      reconciledCaptured: 0,
      markedFailed: 0,
      discrepanciesFound: 0,
      errors: [],
    };

    if (error || !recentTransactions) {
      summary.errors.push(error?.message || "Failed to query recent transactions");
      return summary;
    }

    const razorpay = getRazorpayClient();

    for (const tx of recentTransactions) {
      try {
        const gatewayPayment = await razorpay.payments.fetch(tx.payment_id);

        if (!gatewayPayment) {
          summary.discrepanciesFound++;
          await admin.from("payment_discrepancies").insert({
            tenant_id: tx.tenant_id,
            order_id: tx.order_id,
            payment_id: tx.payment_id,
            invoice_id: tx.invoice_id,
            discrepancy_type: "UNEXPECTED_GATEWAY_RECORD",
            gateway_status: "NOT_FOUND",
            local_status: tx.status,
            suggested_action: "Review gateway transaction ID existence with Razorpay support.",
            resolved: false,
          });
          continue;
        }

        // Amount Check
        if (Number(gatewayPayment.amount) !== Number(tx.amount_paise)) {
          summary.discrepanciesFound++;
          await admin.from("payment_discrepancies").insert({
            tenant_id: tx.tenant_id,
            order_id: tx.order_id,
            payment_id: tx.payment_id,
            invoice_id: tx.invoice_id,
            discrepancy_type: "AMOUNT_MISMATCH",
            gateway_status: `${gatewayPayment.amount} paise`,
            local_status: `${tx.amount_paise} paise`,
            suggested_action: "Investigate gateway vs invoice currency units.",
            resolved: false,
          });
        }

        // Status Check
        const expectedGatewayStatus = tx.status === "CAPTURED" ? "captured" : tx.status.toLowerCase();
        if (gatewayPayment.status !== expectedGatewayStatus) {
          summary.discrepanciesFound++;
          await admin.from("payment_discrepancies").insert({
            tenant_id: tx.tenant_id,
            order_id: tx.order_id,
            payment_id: tx.payment_id,
            invoice_id: tx.invoice_id,
            discrepancy_type: "STATUS_MISMATCH",
            gateway_status: gatewayPayment.status,
            local_status: tx.status,
            suggested_action: "Review transaction status update trail.",
            resolved: false,
          });
        }
      } catch (err: any) {
        summary.errors.push(`Transaction ${tx.payment_id} sweep error: ${err.message}`);
      }
    }

    // Execute scheduled billing mode transitions whose effective renewal date has arrived (Q8)
    try {
      await RecurringMandateService.executeScheduledModeChanges(admin);
    } catch (modeErr: any) {
      summary.errors.push(`Scheduled mode transition error: ${modeErr.message}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: "SYSTEM_RECONCILIATION_ENGINE",
      action: "DAILY_BILLING_SWEEP_COMPLETED",
      resourceType: "RECONCILIATION",
      resourceId: "DAILY_SWEEP",
      metadata: {
        scanned: summary.scannedOrders,
        discrepancies: summary.discrepanciesFound,
      },
      adminClient: admin,
    });

    return summary;
  }
}
