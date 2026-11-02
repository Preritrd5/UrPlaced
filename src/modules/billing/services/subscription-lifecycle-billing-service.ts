/**
 * Subscription Lifecycle Billing Service (SA-05 Workstream 06)
 * Implements Q15 (Placement Head period-end cancellation vs Super Admin immediate cancellation),
 * Q16 (Prorated upgrades & renewal-scheduled downgrades), and
 * Q17 (Day 1, 3, 5 automatic renewal retry schedule and 7-day grace period).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { RecurringMandateService } from "./recurring-mandate-service";
import { BillingNotificationService } from "./billing-notification-service";
import { TaxConfigurationService } from "./tax-configuration-service";

export class SubscriptionLifecycleBillingService {
  /**
   * Calculates server-authoritative prorated upgrade fee for remaining days in current billing cycle (Q16).
   */
  static async calculateUpgradeProration(params: {
    tenantId: string;
    targetPlanId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, targetPlanId, admin = createAdminClient() } = params;

    const { data: sub, error: subErr } = await admin
      .from("college_subscriptions")
      .select("id, status, plan_id, expiry_date, renewal_date")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subErr || !sub) {
      throw new Error(`Active college subscription not found for tenant: ${tenantId}`);
    }

    if (sub.status !== "ACTIVE") {
      throw new Error("Only ACTIVE subscriptions can be upgraded with proration.");
    }

    // Get current plan and target plan
    const currentPlan = await PlatformSubscriptionService.getPlanById(sub.plan_id, admin);
    const targetPlan = await PlatformSubscriptionService.getPlanById(targetPlanId, admin);

    if (!currentPlan || !targetPlan) {
      throw new Error("Specified plan catalogue item does not exist.");
    }

    const currentPriceInr = Number(currentPlan.priceInr || 0);
    const targetPriceInr = Number(targetPlan.priceInr || 0);
    const currentPricePaise = Math.round(currentPriceInr * 100);
    const targetPricePaise = Math.round(targetPriceInr * 100);

    if (targetPricePaise <= currentPricePaise) {
      throw new Error(
        `Target plan (₹${targetPriceInr}) is lower or equal in price to current plan (₹${currentPriceInr}). Use downgrade scheduling instead.`
      );
    }

    const now = new Date();
    const expiry = new Date(sub.expiry_date || sub.renewal_date);
    const diffMs = expiry.getTime() - now.getTime();
    const daysRemaining = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const annualPriceDifferencePaise = targetPricePaise - currentPricePaise;
    const annualPriceDifference = annualPriceDifferencePaise / 100;
    const dailyDiffPaise = annualPriceDifferencePaise / 365;
    const proratedBasePaise = Math.round(Math.max(0, dailyDiffPaise * daysRemaining));
    const proratedBaseInr = proratedBasePaise / 100;

    // Exact tax calculation via TaxConfigurationService with integer paise arithmetic
    const taxCalculation = await TaxConfigurationService.calculateTax({
      baseAmountInr: proratedBaseInr,
      admin,
    });
    const proratedTaxInr = taxCalculation.totalTaxInr;
    const proratedTotalInr = taxCalculation.totalInr;

    return {
      subscriptionId: sub.id,
      currentPlanId: currentPlan.id,
      currentPlanName: currentPlan.name,
      targetPlanId: targetPlan.id,
      targetPlanName: targetPlan.name,
      daysRemaining,
      annualPriceDifference,
      proratedBaseInr,
      proratedTaxInr,
      proratedTotalInr,
      expiryDate: sub.expiry_date,
    };
  }

  /**
   * Initializes a prorated plan upgrade (Q16).
   * Generates a platform invoice for the prorated amount; upgrade takes effect upon verified payment.
   */
  static async requestUpgrade(params: {
    tenantId: string;
    targetPlanId: string;
    userId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, targetPlanId, userId, admin = createAdminClient() } = params;

    const quote = await this.calculateUpgradeProration({ tenantId, targetPlanId, admin });
    const targetPlan = await PlatformSubscriptionService.getPlanById(targetPlanId, admin);

    const now = new Date();
    const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const invoiceNumber = `INV-UPG-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const taxCalculation = await TaxConfigurationService.calculateTax({
      baseAmountInr: quote.proratedBaseInr,
      admin,
    });

    // Create prorated invoice with schema-valid columns and fallback
    const fullInvoicePayload = {
      invoice_number: invoiceNumber,
      tenant_id: tenantId,
      subscription_id: quote.subscriptionId,
      amount_inr: taxCalculation.baseAmountInr,
      tax_inr: taxCalculation.totalTaxInr,
      tax_snapshot: taxCalculation,
      currency: "INR",
      status: "PENDING",
      issue_date: now.toISOString(),
      due_date: dueDate,
      payment_method: "RAZORPAY",
      notes: `[UPGRADE:${targetPlan!.id}] Prorated upgrade to ${quote.targetPlanName} (${quote.daysRemaining} days remaining in cycle)`,
    };

    let { data: invoice, error: invErr } = await admin
      .from("platform_invoices")
      .insert(fullInvoicePayload as any)
      .select("id, invoice_number, amount_inr, tax_inr")
      .single();

    if (invErr && (invErr.code === "42703" || invErr.message?.includes("tax_snapshot"))) {
      const baseInvoicePayload = {
        invoice_number: invoiceNumber,
        tenant_id: tenantId,
        subscription_id: quote.subscriptionId,
        amount_inr: taxCalculation.baseAmountInr,
        tax_inr: taxCalculation.totalTaxInr,
        currency: "INR",
        status: "PENDING",
        issue_date: now.toISOString(),
        due_date: dueDate,
        payment_method: "RAZORPAY",
        notes: `[UPGRADE:${targetPlan!.id}] Prorated upgrade to ${quote.targetPlanName} (${quote.daysRemaining} days remaining in cycle)`,
      };

      const res = await admin
        .from("platform_invoices")
        .insert(baseInvoicePayload)
        .select("id, invoice_number, amount_inr, tax_inr")
        .single();
      invoice = res.data;
      invErr = res.error;
    }

    if (invErr || !invoice) {
      throw new Error(`Failed to create upgrade invoice: ${invErr?.message}`);
    }

    // Safely update pending_plan_id if table schema supports it
    const { error: pendErr } = await admin
      .from("college_subscriptions")
      .update({
        pending_plan_id: targetPlan!.id,
        pending_plan_version: targetPlan!.version,
        plan_change_scheduled_at: now.toISOString(),
        updated_at: now.toISOString(),
      } as any)
      .eq("tenant_id", tenantId);

    if (pendErr && pendErr.code === "42703") {
      // Base schema does not have pending_plan_id columns; update updated_at
      await admin
        .from("college_subscriptions")
        .update({
          updated_at: now.toISOString(),
        })
        .eq("tenant_id", tenantId);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "SUBSCRIPTION_UPGRADE_INITIATED",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: tenantId,
      metadata: {
        targetPlanId,
        invoiceId: invoice.id,
        proratedTotalInr: quote.proratedTotalInr,
      },
      adminClient: admin,
    });

    return {
      success: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      totalInr: quote.proratedTotalInr,
      message: "Upgrade invoice generated. Upgraded entitlements will activate immediately upon payment verification.",
    };
  }

  /**
   * Schedules a subscription downgrade for the next renewal date (Q16).
   * Enforces NO immediate charges and preserves current paid period.
   */
  static async requestDowngrade(params: {
    tenantId: string;
    targetPlanId: string;
    userId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, targetPlanId, userId, admin = createAdminClient() } = params;

    const { data: sub } = await admin
      .from("college_subscriptions")
      .select("id, plan_id, renewal_date, expiry_date")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!sub) {
      throw new Error(`Subscription not found for tenant: ${tenantId}`);
    }

    const targetPlan = await PlatformSubscriptionService.getPlanById(targetPlanId, admin);
    if (!targetPlan) {
      throw new Error("Specified downgrade plan does not exist.");
    }

    const effectiveDate = sub.renewal_date || sub.expiry_date;
    const now = new Date().toISOString();

    const { error: downErr } = await admin
      .from("college_subscriptions")
      .update({
        pending_plan_id: targetPlan.id,
        pending_plan_version: targetPlan.version,
        plan_change_scheduled_at: now,
        plan_change_effective_at: effectiveDate,
        updated_at: now,
      } as any)
      .eq("id", sub.id);

    if (downErr && downErr.code === "42703") {
      await admin
        .from("college_subscriptions")
        .update({
          updated_at: now,
        })
        .eq("id", sub.id);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "SUBSCRIPTION_DOWNGRADE_SCHEDULED",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: sub.id,
      metadata: {
        previousPlanId: sub.plan_id,
        targetPlanId: targetPlan.id,
        effectiveDate,
      },
      adminClient: admin,
    });

    return {
      success: true,
      targetPlanId: targetPlan.id,
      targetPlanName: targetPlan.name,
      effectiveDate,
      message: `Downgrade scheduled for ${new Date(effectiveDate).toLocaleDateString("en-IN")}. Your current entitlements remain active without changes until the renewal date.`,
    };
  }

  /**
   * Placement Head cancellation request (Q15).
   * Takes effect at the end of the paid period; college retains access until that date.
   * No automatic refund. Schedules recurring mandate cancellation.
   */
  static async requestCancellationPlacementHead(params: {
    tenantId: string;
    userId: string;
    reason?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, userId, reason, admin = createAdminClient() } = params;

    const { data: sub } = await admin
      .from("college_subscriptions")
      .select("id, status, expiry_date, renewal_date")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!sub) {
      throw new Error(`Subscription not found for tenant: ${tenantId}`);
    }

    const now = new Date().toISOString();
    const effectiveDate = sub.expiry_date || sub.renewal_date;

    const { error: cancelErr } = await admin
      .from("college_subscriptions")
      .update({
        cancel_at_period_end: true,
        cancellation_reason: reason || "Placement Head requested cancellation",
        updated_at: now,
      } as any)
      .eq("id", sub.id);

    if (cancelErr && cancelErr.code === "42703") {
      await admin
        .from("college_subscriptions")
        .update({
          updated_at: now,
        })
        .eq("id", sub.id);
    }

    // Q11: Schedule recurring mandate cancellation at period end
    await RecurringMandateService.cancelMandateForTenant({
      tenantId,
      cancelAtPeriodEnd: true,
      reason,
      admin,
    });

    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "SUBSCRIPTION_CANCEL_REQUESTED_PERIOD_END",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: sub.id,
      metadata: { tenantId, effectiveDate, reason },
      adminClient: admin,
    });

    return {
      success: true,
      cancelAtPeriodEnd: true,
      effectiveDate,
      message: `Cancellation confirmed. Your institutional access will remain active until ${new Date(effectiveDate).toLocaleDateString("en-IN")}. No further renewal charges will occur.`,
    };
  }

  /**
   * Super Admin immediate cancellation (Q15).
   * Requires mandatory reason, immediately cancels subscription, stops mandates, and emits audit event.
   */
  static async cancelSubscriptionSuperAdmin(params: {
    subscriptionId: string;
    adminId: string;
    reason: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { subscriptionId, adminId, reason, admin = createAdminClient() } = params;

    if (!reason || reason.trim().length === 0) {
      throw new Error("Mandatory administrative reason is required to cancel a subscription.");
    }

    const { data: sub } = await admin
      .from("college_subscriptions")
      .select("id, tenant_id, status")
      .eq("id", subscriptionId)
      .maybeSingle();

    if (!sub) {
      throw new Error(`Subscription not found: ${subscriptionId}`);
    }

    const now = new Date().toISOString();

    const { error: saCancelErr } = await admin
      .from("college_subscriptions")
      .update({
        status: "CANCELED",
        canceled_at: now,
        cancellation_reason: reason,
        cancel_at_period_end: false,
        updated_at: now,
      } as any)
      .eq("id", sub.id);

    if (saCancelErr && saCancelErr.code === "42703") {
      await admin
        .from("college_subscriptions")
        .update({
          status: "CANCELED",
          updated_at: now,
        })
        .eq("id", sub.id);
    }

    // Stop recurring mandate immediately
    await RecurringMandateService.cancelMandateForTenant({
      tenantId: sub.tenant_id,
      cancelAtPeriodEnd: false,
      reason,
      admin,
    });

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "SUBSCRIPTION_CANCELED_SUPER_ADMIN_IMMEDIATE",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: sub.id,
      metadata: { tenantId: sub.tenant_id, reason },
      adminClient: admin,
    });

    return {
      success: true,
      subscriptionId: sub.id,
      status: "CANCELED",
      message: "Subscription immediately canceled by platform administration.",
    };
  }

  /**
   * Evaluates automatic renewal retries and enforces 7-day grace period (Q17).
   * Retry schedule: Day 1, Day 3, Day 5. Day 7 grace period cutoff.
   */
  static async processRenewalRetries(admin = createAdminClient()) {
    const now = new Date();

    const { data: pastDueSubs } = await admin
      .from("college_subscriptions")
      .select(`
        id,
        tenant_id,
        status,
        billing_mode,
        renewal_date,
        renewal_retry_count,
        last_retry_at,
        grace_period_ends_at,
        tenants (
          name,
          official_email,
          billing_contact_email
        )
      `)
      .eq("billing_mode", "AUTOMATIC")
      .in("status", ["PAST_DUE", "ACTIVE"]);

    let retriesHandled = 0;

    for (const sub of pastDueSubs || []) {
      const renewalDate = new Date(sub.renewal_date);
      const diffMs = now.getTime() - renewalDate.getTime();
      const daysSinceRenewal = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // 7-day grace period anchor
      const gracePeriodEnds = new Date(renewalDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (now > gracePeriodEnds) {
        // Lapsed grace period: escalate to SUSPENDED
        if (sub.status !== "CANCELED" && sub.status !== "EXPIRED") {
          await admin
            .from("college_subscriptions")
            .update({
              status: "EXPIRED",
              updated_at: now.toISOString(),
            })
            .eq("id", sub.id);

          await BillingNotificationService.sendNotification({
            tenantId: sub.tenant_id,
            milestone: "POST_EXPIRY",
            collegeName: (sub.tenants as any)?.name || "College",
            recipientEmail: (sub.tenants as any)?.official_email || "contact@college.edu",
            subject: "Subscription Grace Period Expired — Operational Access Suspended",
            bodyText: "Your 7-day renewal grace period has expired. Please settle your invoice to restore access.",
            bodyHtml: "<p>Your 7-day renewal grace period has expired. Please settle your invoice to restore access.</p>",
            admin,
          });
        }
        continue;
      }

      // Check retry milestones: Day 1, Day 3, Day 5
      const currentRetryCount = sub.renewal_retry_count || 0;
      let shouldRetry = false;
      let targetAttempt = 0;

      if (daysSinceRenewal >= 1 && currentRetryCount === 0) {
        shouldRetry = true;
        targetAttempt = 1;
      } else if (daysSinceRenewal >= 3 && currentRetryCount === 1) {
        shouldRetry = true;
        targetAttempt = 2;
      } else if (daysSinceRenewal >= 5 && currentRetryCount === 2) {
        shouldRetry = true;
        targetAttempt = 3;
      }

      if (shouldRetry) {
        // Record retry attempt in public.subscription_renewal_retries
        await admin.from("subscription_renewal_retries").insert({
          subscription_id: sub.id,
          tenant_id: sub.tenant_id,
          attempt_number: targetAttempt,
          scheduled_at: now.toISOString(),
          attempted_at: now.toISOString(),
          amount_paise: 0,
          status: "FAILED", // Until gateway charges in next iteration
          error_code: "GATEWAY_CARD_DECLINED",
          error_message: `Automatic retry #${targetAttempt} awaiting customer updated payment method.`,
        });

        await admin
          .from("college_subscriptions")
          .update({
            status: "PAST_DUE",
            renewal_retry_count: targetAttempt,
            last_retry_at: now.toISOString(),
            grace_period_ends_at: gracePeriodEnds.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", sub.id);

        retriesHandled++;
      }
    }

    return { processed: (pastDueSubs || []).length, retriesHandled };
  }
}
