/**
 * Billing Notification Service (SA-05 Workstream 04 / Correction Pass 2)
 * Implements Q12 (renewal reminder schedule & automatic renewal notifications)
 * and Q13 (Placement Head + Billing Contact routing, Super Admin critical events).
 * Enforces dual-channel delivery (Email + In-App), milestone idempotency, and credential sanitization.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { EmailAdapter } from "@/modules/identity-access/services/email-adapter";
import { PlatformNotificationService } from "@/modules/platform-admin/services/platform-notification-service";
import { NotificationService } from "@/modules/notifications/services/notification-service";

export type BillingNotificationMilestone =
  | "MANUAL_7_DAY"
  | "MANUAL_3_DAY"
  | "MANUAL_1_DAY"
  | "DUE_DATE"
  | "POST_EXPIRY"
  | "PRE_COLLECTION"
  | "RENEWAL_SUCCESS"
  | "RENEWAL_FAILED"
  | "RETRY_WARNING"
  | "REFUND_ISSUED"
  | "PAYMENT_CONFIRMED";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BillingNotificationService {
  /**
   * Dispatches a billing notification to authorized recipients (Placement Head & Billing Contact).
   * Guarantees idempotency via billing_notifications_log uniqueness constraint.
   */
  static async sendNotification(params: {
    tenantId: string;
    milestone: BillingNotificationMilestone;
    collegeName: string;
    recipientEmail: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    metadata?: Record<string, any>;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ sent: boolean; duplicate?: boolean }> {
    const {
      tenantId,
      milestone,
      collegeName,
      recipientEmail,
      subject,
      bodyHtml,
      bodyText,
      metadata = {},
      admin = createAdminClient(),
    } = params;

    const dateKey = metadata.date || new Date().toISOString().split("T")[0];
    const idempotencyKey = `${tenantId}_${milestone}_${recipientEmail}_${dateKey}`;

    // 1. Idempotency Check in billing_notifications_log
    const { data: existingLog } = await admin
      .from("billing_notifications_log")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingLog && existingLog.status === "SENT") {
      return { sent: false, duplicate: true };
    }

    // 2. Dispatch Transactional Email via EmailAdapter (reusing verified Gmail SMTP)
    let emailSuccess = false;
    try {
      await EmailAdapter.dispatchTransactionalEmail({
        toEmail: recipientEmail,
        subject: `[UrPlaced Billing] ${subject}`,
        html: bodyHtml,
        text: bodyText,
      });
      emailSuccess = true;
    } catch (err: any) {
      console.warn(`[Billing Notification] Email delivery warning to ${recipientEmail}:`, err?.message);
    }

    // 3. Record in public.billing_notifications_log for EMAIL channel
    await admin
      .from("billing_notifications_log")
      .upsert(
        {
          tenant_id: tenantId,
          recipient_email: recipientEmail,
          notification_type: milestone,
          channel: "EMAIL",
          idempotency_key: idempotencyKey,
          sent_at: new Date().toISOString(),
          status: emailSuccess ? "SENT" : "FAILED",
          metadata,
        },
        { onConflict: "idempotency_key" }
      );

    // 4. Dispatch In-App Notification (Q13: Email AND In-App delivery)
    try {
      const { data: user } = await admin
        .from("users")
        .select("id")
        .eq("email", recipientEmail)
        .eq("college_id", tenantId)
        .maybeSingle();

      if (user?.id && UUID_REGEX.test(user.id)) {
        await NotificationService.createNotification({
          recipientUserId: user.id,
          collegeId: tenantId,
          type: "BILLING",
          title: subject,
          body: bodyText,
          actionUrl: "/dashboard/billing",
          deduplicationKey: `inapp_${idempotencyKey}`,
          metadata,
        });

        await admin.from("billing_notifications_log").upsert(
          {
            tenant_id: tenantId,
            recipient_email: recipientEmail,
            notification_type: milestone,
            channel: "IN_APP",
            idempotency_key: `inapp_${idempotencyKey}`,
            sent_at: new Date().toISOString(),
            status: "SENT",
            metadata,
          },
          { onConflict: "idempotency_key" }
        );
      }
    } catch (inAppErr: any) {
      console.warn(`[Billing Notification] In-app notification delivery notice:`, inAppErr?.message);
    }

    return { sent: emailSuccess, duplicate: false };
  }

  /**
   * Scans all subscriptions and triggers applicable renewal reminders for manual and automatic modes.
   * Called by scheduled cron jobs.
   */
  static async processRenewalReminders(admin = createAdminClient()) {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Configurable pre-collection notification window (Correction 6)
    const preCollectionDays = Number(process.env.BILLING_PRE_COLLECTION_NOTICE_DAYS || 2);

    // Query active subscriptions with renewal dates
    const { data: subs, error } = await admin
      .from("college_subscriptions")
      .select(`
        id,
        tenant_id,
        status,
        billing_mode,
        renewal_date,
        expiry_date,
        plan_id,
        tenants (
          name,
          official_email,
          contact_name
        )
      `)
      .in("status", ["ACTIVE", "PAST_DUE", "PENDING_PAYMENT"]);

    if (error || !subs) {
      console.error("[Billing Reminders] Failed to query subscriptions:", error);
      return { processed: 0, sent: 0, errors: [error?.message] };
    }

    let sentCount = 0;

    for (const sub of subs) {
      const targetDateStr = sub.renewal_date || sub.expiry_date;
      if (!targetDateStr) continue;

      const targetDate = new Date(targetDateStr);
      const diffMs = targetDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const tenant = sub.tenants as any;
      if (!tenant) continue;

      // Q13: Recipients are Placement Head and Designated Billing Contact only!
      const recipients = new Set<string>();
      if (tenant.official_email) recipients.add(tenant.official_email.trim());
      if (tenant.billing_contact_email) recipients.add(tenant.billing_contact_email.trim());

      let milestone: BillingNotificationMilestone | null = null;
      let subject = "";
      let noticeMessage = "";

      if (sub.billing_mode === "AUTOMATIC") {
        if (diffDays === preCollectionDays) {
          milestone = "PRE_COLLECTION";
          subject = `Upcoming Automatic Renewal in ${preCollectionDays} Days — ${tenant.name}`;
          noticeMessage = `Your UrPlaced institutional placement subscription is scheduled for automatic renewal on ${targetDate.toLocaleDateString()}.`;
        }
      } else {
        // Manual Renewal Reminders
        if (diffDays === 7) {
          milestone = "MANUAL_7_DAY";
          subject = `Subscription Renewal Reminder (7 Days Remaining) — ${tenant.name}`;
          noticeMessage = `Your UrPlaced institutional placement subscription will renew on ${targetDate.toLocaleDateString()}. Please complete your renewal payment.`;
        } else if (diffDays === 3) {
          milestone = "MANUAL_3_DAY";
          subject = `Urgent: Subscription Renewal in 3 Days — ${tenant.name}`;
          noticeMessage = `Your UrPlaced institutional subscription expires in 3 days. Ensure payment is completed to prevent placement cell interruption.`;
        } else if (diffDays === 1) {
          milestone = "MANUAL_1_DAY";
          subject = `Final Notice: Subscription Renews Tomorrow — ${tenant.name}`;
          noticeMessage = `Your UrPlaced institutional subscription renews tomorrow. Please settle the invoice now.`;
        } else if (diffDays === 0) {
          milestone = "DUE_DATE";
          subject = `Subscription Renewal Due Today — ${tenant.name}`;
          noticeMessage = `Your subscription renewal is due today. Settle your invoice via Razorpay to avoid operational lockdown.`;
        } else if (diffDays < 0 && diffDays >= -7) {
          milestone = "POST_EXPIRY";
          subject = `Subscription Expired (Grace Period Active) — ${tenant.name}`;
          noticeMessage = `Your subscription has expired. You are currently in a 7-day grace period. Settle your payment immediately to restore active status.`;
        }
      }

      if (milestone) {
        for (const recipient of recipients) {
          const res = await this.sendNotification({
            tenantId: sub.tenant_id,
            milestone,
            collegeName: tenant.name,
            recipientEmail: recipient,
            subject,
            bodyText: `${noticeMessage}\n\nVisit your billing dashboard at: https://urplaced.com/dashboard/billing`,
            bodyHtml: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #DDDCD5; border-radius: 8px;">
                <h2 style="color: #5052C9; margin-top: 0;">UrPlaced Institutional Billing</h2>
                <p>Hello Placement Team at <strong>${tenant.name}</strong>,</p>
                <p>${noticeMessage}</p>
                <div style="margin: 25px 0;">
                  <a href="https://urplaced.com/dashboard/billing" style="background-color: #5052C9; color: #FFFFFF; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Open Billing &amp; Settle Invoice
                  </a>
                </div>
                <p style="font-size: 12px; color: #747683;">This billing reminder was delivered strictly to the registered Placement Head and Designated Billing Contact.</p>
              </div>
            `,
            metadata: { diffDays, date: todayStr },
            admin,
          });

          if (res.sent) sentCount++;
        }
      }
    }

    return { processed: subs.length, sent: sentCount };
  }

  /**
   * Dispatches automatic renewal success notice upon verified recurring payment settlement (Q12).
   */
  static async sendRenewalSuccessNotification(params: {
    tenantId: string;
    invoiceNumber: string;
    amountInr: number;
    billingInterval: string;
    nextRenewalDate: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, invoiceNumber, amountInr, billingInterval, nextRenewalDate, admin = createAdminClient() } = params;

    const { data: tenant } = await admin
      .from("tenants")
      .select("name, official_email, billing_contact_email")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) return;

    const recipients = new Set<string>();
    if (tenant.official_email) recipients.add(tenant.official_email.trim());
    if (tenant.billing_contact_email) recipients.add(tenant.billing_contact_email.trim());

    const subject = `Subscription Renewal Confirmed — ${tenant.name}`;
    const nextFormatted = new Date(nextRenewalDate).toLocaleDateString("en-IN");
    const bodyText = `Your automatic renewal of ₹${amountInr.toLocaleString("en-IN")} for the ${billingInterval} billing cycle has been processed successfully (Invoice ${invoiceNumber}). Your next renewal date is ${nextFormatted}.`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #DDDCD5; border-radius: 8px;">
        <h2 style="color: #2E8F86; margin-top: 0;">Subscription Renewal Confirmed</h2>
        <p>Dear Placement Team at <strong>${tenant.name}</strong>,</p>
        <p>Your automatic subscription renewal payment has been successfully verified and settled.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr><td style="padding: 8px; color: #747683;">Invoice:</td><td style="padding: 8px; font-weight: bold;">${invoiceNumber}</td></tr>
          <tr><td style="padding: 8px; color: #747683;">Amount Paid:</td><td style="padding: 8px; font-weight: bold;">₹${amountInr.toLocaleString("en-IN")}</td></tr>
          <tr><td style="padding: 8px; color: #747683;">Billing Cycle:</td><td style="padding: 8px; font-weight: bold;">${billingInterval}</td></tr>
          <tr><td style="padding: 8px; color: #747683;">Next Renewal:</td><td style="padding: 8px; font-weight: bold;">${nextFormatted}</td></tr>
        </table>
        <div style="margin: 25px 0;">
          <a href="https://urplaced.com/dashboard/billing" style="background-color: #5052C9; color: #FFFFFF; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: inline-block;">
            Download Tax Invoice
          </a>
        </div>
      </div>
    `;

    for (const recipient of recipients) {
      await this.sendNotification({
        tenantId,
        milestone: "RENEWAL_SUCCESS",
        collegeName: tenant.name,
        recipientEmail: recipient,
        subject,
        bodyText,
        bodyHtml,
        metadata: { invoiceNumber, amountInr, date: new Date().toISOString().split("T")[0] },
        admin,
      });
    }

    // Alert Super Admin
    await this.notifySuperAdmin({
      action: "RENEWAL_PAYMENT_CONFIRMED",
      details: `Automatic renewal of ₹${amountInr} settled for ${tenant.name} (${invoiceNumber})`,
      metadata: { tenantId, invoiceNumber, amountInr },
      admin,
    });
  }

  /**
   * Dispatches automatic renewal failure notice and alerts administrators (Q12).
   */
  static async sendRenewalFailureNotification(params: {
    tenantId: string;
    subId: string;
    errorMessage: string;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { tenantId, subId, errorMessage, admin = createAdminClient() } = params;

    const { data: tenant } = await admin
      .from("tenants")
      .select("name, official_email, billing_contact_email")
      .eq("id", tenantId)
      .maybeSingle();

    if (!tenant) return;

    const recipients = new Set<string>();
    if (tenant.official_email) recipients.add(tenant.official_email.trim());
    if (tenant.billing_contact_email) recipients.add(tenant.billing_contact_email.trim());

    const subject = `Urgent: Automatic Renewal Payment Failed — ${tenant.name}`;
    const bodyText = `Your automatic subscription renewal attempt could not be completed (${errorMessage}). A 7-day grace period is in effect. Please update your payment method or pay manually to prevent service interruption.`;
    const bodyHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #DDDCD5; border-radius: 8px;">
        <h2 style="color: #D9534F; margin-top: 0;">Automatic Renewal Payment Failed</h2>
        <p>Dear Placement Team at <strong>${tenant.name}</strong>,</p>
        <p>We were unable to process your automatic renewal payment. Reason: <em>${errorMessage}</em></p>
        <p>Your subscription is currently protected by a <strong>7-day grace period</strong>. Please update your billing details immediately.</p>
        <div style="margin: 25px 0;">
          <a href="https://urplaced.com/dashboard/billing" style="background-color: #5052C9; color: #FFFFFF; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: inline-block;">
            Update Payment Method
          </a>
        </div>
      </div>
    `;

    for (const recipient of recipients) {
      await this.sendNotification({
        tenantId,
        milestone: "RENEWAL_FAILED",
        collegeName: tenant.name,
        recipientEmail: recipient,
        subject,
        bodyText,
        bodyHtml,
        metadata: { subId, date: new Date().toISOString().split("T")[0] },
        admin,
      });
    }

    // Alert Super Admin
    await this.notifySuperAdmin({
      action: "RENEWAL_PAYMENT_FAILED",
      details: `Automatic renewal charge failed for ${tenant.name}: ${errorMessage}`,
      metadata: { tenantId, subId, error: errorMessage },
      admin,
    });
  }

  /**
   * Notifies Super Admin of critical financial events via BOTH Email and In-App (Q13 / Correction 5).
   * Queries public.platform_admins for active administrators and sanitizes sensitive credentials.
   */
  static async notifySuperAdmin(params: {
    action: string;
    details: string;
    metadata?: Record<string, any>;
    admin?: ReturnType<typeof createAdminClient>;
  }) {
    const { action, details, metadata = {}, admin = createAdminClient() } = params;

    // 1. Resolve active Super Admins from public.platform_admins
    const { data: activeAdmins } = await admin
      .from("platform_admins")
      .select("id, email, full_name")
      .eq("status", "ACTIVE");

    const adminRecipients =
      activeAdmins && activeAdmins.length > 0
        ? activeAdmins
        : [
            {
              id: "platform-super-admin",
              email: process.env.SMTP_FROM_EMAIL || "superadmin@urplaced.com",
              full_name: "Super Admin",
            },
          ];

    // Sanitize credentials: strip secret keys and tokens from administrative notification bodies
    const sanitizedDetails = details
      .replace(/rzp_(?:live|test)_[a-zA-Z0-9]+/g, "[PROTECTED_KEY_ID]")
      .replace(/(?:secret|token|signature)[:=]\s*["']?[a-zA-Z0-9_\-]+["']?/gi, "[PROTECTED_SECRET]");

    const eventDate = new Date().toISOString().split("T")[0];

    for (const adminUser of adminRecipients) {
      const idempotencyKey = `admin_notif_${action}_${adminUser.id}_${eventDate}_${Math.floor(Date.now() / 60000)}`;

      // Channel 1: Platform In-App Notification (Q13)
      try {
        await PlatformNotificationService.createNotification(
          {
            recipientUserId: adminUser.id,
            type: "BILLING_INVOICE",
            title: `[UrPlaced Admin] ${action}`,
            body: sanitizedDetails,
            metadata: { ...metadata, action },
          },
          admin
        );
      } catch (err: any) {
        console.warn(`[Billing Notification] Super admin in-app notification error for ${adminUser.id}:`, err?.message);
      }

      // Channel 2: Transactional Email Notification (Q13)
      if (adminUser.email) {
        try {
          await EmailAdapter.dispatchTransactionalEmail({
            toEmail: adminUser.email,
            subject: `[UrPlaced Admin Notice] ${action}`,
            text: `${sanitizedDetails}\n\nTimestamp: ${new Date().toISOString()}\nPlatform Console: https://urplaced.com/preritrd/billing`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #DDDCD5; border-radius: 8px;">
                <h2 style="color: #5052C9; margin-top: 0;">UrPlaced Platform Administrative Notice</h2>
                <p><strong>Action:</strong> ${action}</p>
                <p>${sanitizedDetails}</p>
                <div style="margin: 25px 0;">
                  <a href="https://urplaced.com/preritrd/billing" style="background-color: #5052C9; color: #FFFFFF; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: bold; display: inline-block;">
                    Open Platform Billing Console
                  </a>
                </div>
                <p style="font-size: 12px; color: #747683;">This is a confidential administrative financial notice delivered strictly to verified Platform Super Admins.</p>
              </div>
            `,
          });
        } catch (emailErr: any) {
          console.warn(`[Billing Notification] Super admin email delivery error to ${adminUser.email}:`, emailErr?.message);
        }
      }
    }
  }
}
