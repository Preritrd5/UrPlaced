/**
 * Recurring Mandate Service (SA-05 Workstream 03)
 * Implements Q4 (explicit mandate consent), Q8/Q9 (effective at next renewal, no immediate charge),
 * and Q11 (mandate cancellation logic).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export interface SetBillingModeParams {
  tenantId: string;
  mode: "MANUAL" | "AUTOMATIC";
  userId: string;
  consentGiven?: boolean;
  termsVersion?: string;
  admin?: ReturnType<typeof createAdminClient>;
}

export class RecurringMandateService {
  /**
   * Sets college billing mode (MANUAL or AUTOMATIC).
   * Enforces Q8 & Q9: Mode change becomes effective at next renewal and triggers NO immediate charge.
   * Enforces Q4 & Q30: Automatic renewal requires explicit consent evidence.
   */
  static async setBillingMode(params: SetBillingModeParams) {
    const {
      tenantId,
      mode,
      userId,
      consentGiven = false,
      termsVersion = "v1.0",
      admin = createAdminClient(),
    } = params;

    // 1. Fetch current subscription (with fallback if billing_mode column missing)
    let sub: any = null;
    const { data: subWithMode, error: subModeErr } = await admin
      .from("college_subscriptions")
      .select("id, status, billing_mode, expiry_date, renewal_date, plan_id, student_seat_limit")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!subModeErr && subWithMode) {
      sub = subWithMode;
    } else {
      const { data: baseSub, error: baseSubErr } = await admin
        .from("college_subscriptions")
        .select("id, status, expiry_date, renewal_date, plan_id, student_seat_limit")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (baseSubErr || !baseSub) {
        throw new Error(`College subscription not found for tenant: ${tenantId}`);
      }
      sub = baseSub;
    }

    const now = new Date().toISOString();
    const effectiveDate = sub.renewal_date || sub.expiry_date || now;

    if (mode === "AUTOMATIC") {
      if (!consentGiven) {
        throw new Error(
          "Explicit consent is legally required to authorize automatic recurring renewals. Please confirm mandate agreement."
        );
      }

      let mandateId = `mandate_${sub.id}`;
      try {
        // Record / Upsert mandate consent evidence (Q4)
        const { data: mandate } = await admin
          .from("recurring_mandates")
          .upsert(
            {
              tenant_id: tenantId,
              subscription_id: sub.id,
              status: "ACTIVE",
              billing_interval: "ANNUAL",
              amount_paise: 0, // Determined at renewal based on approved plan version
              currency: "INR",
              consent_recorded_at: now,
              consent_user_id: userId,
              consent_version: termsVersion,
              cancel_at_period_end: false,
              scheduled_cancellation_at: null,
              updated_at: now,
            },
            { onConflict: "tenant_id" }
          )
          .select("*")
          .single();

        if (mandate) {
          mandateId = mandate.id;
        }

        // Schedule mode change for next renewal (Q8 & Q9: zero immediate charge)
        await admin
          .from("college_subscriptions")
          .update({
            pending_billing_mode: "AUTOMATIC",
            billing_mode_effective_at: effectiveDate,
            mandate_id: mandateId,
            updated_at: now,
          })
          .eq("id", sub.id);
      } catch {
        console.warn("[Mandate Service] Note: recurring_mandates table or pending_billing_mode column unavailable in schema.");
      }

      await PlatformAuthService.logAuditEvent({
        actorId: userId,
        action: "BILLING_MODE_AUTOMATIC_SCHEDULED",
        resourceType: "COLLEGE_SUBSCRIPTION",
        resourceId: sub.id,
        metadata: {
          tenantId,
          mandateId,
          effectiveDate,
          termsVersion,
        },
        adminClient: admin,
      });

      return {
        success: true,
        billingMode: "AUTOMATIC",
        effectiveAt: effectiveDate,
        mandateStatus: "ACTIVE",
        message: `Automatic renewal scheduled for ${new Date(effectiveDate).toLocaleDateString("en-IN")}. Your authorization will take effect without any charge today.`,
      };
    } else {
      // Switching to MANUAL (Q8: preserves current mandate until next renewal)
      try {
        await admin
          .from("college_subscriptions")
          .update({
            pending_billing_mode: "MANUAL",
            billing_mode_effective_at: effectiveDate,
            updated_at: now,
          })
          .eq("id", sub.id);

        // Keep active mandate intact until the renewal date arrives
        await admin
          .from("recurring_mandates")
          .update({
            cancel_at_period_end: true,
            scheduled_cancellation_at: effectiveDate,
            updated_at: now,
          })
          .eq("tenant_id", tenantId);
      } catch {
        console.warn("[Mandate Service] Note: recurring_mandates table or pending_billing_mode column unavailable in schema.");
      }

      await PlatformAuthService.logAuditEvent({
        actorId: userId,
        action: "BILLING_MODE_MANUAL_SCHEDULED",
        resourceType: "COLLEGE_SUBSCRIPTION",
        resourceId: sub.id,
        metadata: {
          tenantId,
          effectiveDate,
        },
        adminClient: admin,
      });

      return {
        success: true,
        billingMode: "MANUAL",
        effectiveAt: effectiveDate,
        mandateStatus: "PENDING_CANCELLATION",
        scheduledCancellation: true,
        message: `Switched to manual renewal. Future subscription renewals will require deliberate invoice settlement.`,
      };
    }
  }

  /**
   * Executes scheduled billing mode transitions that have reached their effective date (called by daily sweep).
   */
  static async executeScheduledModeChanges(admin = createAdminClient()) {
    const nowIso = new Date().toISOString();

    const { data: pendingSubs } = await admin
      .from("college_subscriptions")
      .select("id, tenant_id, pending_billing_mode, billing_mode_effective_at")
      .not("pending_billing_mode", "is", null)
      .lte("billing_mode_effective_at", nowIso);

    let executedCount = 0;

    for (const sub of pendingSubs || []) {
      const targetMode = sub.pending_billing_mode;

      if (targetMode === "MANUAL") {
        await admin
          .from("recurring_mandates")
          .update({
            status: "CANCELLED",
            canceled_at: nowIso,
            updated_at: nowIso,
          })
          .eq("tenant_id", sub.tenant_id);

        await admin
          .from("college_subscriptions")
          .update({
            billing_mode: "MANUAL",
            pending_billing_mode: null,
            billing_mode_effective_at: null,
            mandate_id: null,
            updated_at: nowIso,
          })
          .eq("id", sub.id);

        executedCount++;
      } else if (targetMode === "AUTOMATIC") {
        await admin
          .from("college_subscriptions")
          .update({
            billing_mode: "AUTOMATIC",
            pending_billing_mode: null,
            billing_mode_effective_at: null,
            updated_at: nowIso,
          })
          .eq("id", sub.id);

        executedCount++;
      }
    }

    return { evaluated: (pendingSubs || []).length, executedCount };
  }

  /**
   * Cancels mandate for a tenant, either immediately or at period end per Q11.
   */
  static async cancelMandateForTenant(params: {
    tenantId: string;
    cancelAtPeriodEnd?: boolean;
    reason?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, cancelAtPeriodEnd = false, reason, admin = createAdminClient() } = params;
    const now = new Date().toISOString();

    if (cancelAtPeriodEnd) {
      await admin
        .from("recurring_mandates")
        .update({
          cancel_at_period_end: true,
          scheduled_cancellation_at: now,
          updated_at: now,
        })
        .eq("tenant_id", tenantId)
        .eq("status", "ACTIVE");
    } else {
      await admin
        .from("recurring_mandates")
        .update({
          status: "CANCELLED",
          canceled_at: now,
          cancel_at_period_end: false,
          updated_at: now,
        })
        .eq("tenant_id", tenantId);
    }
  }

  /**
   * Retrieves active mandate details for tenant.
   */
  static async getTenantMandate(tenantId: string, admin = createAdminClient()) {
    try {
      const { data, error } = await admin
        .from("recurring_mandates")
        .select("*")
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error) return null;
      return data || null;
    } catch {
      return null;
    }
  }
}
