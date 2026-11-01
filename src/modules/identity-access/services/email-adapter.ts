/**
 * Email Delivery Adapter
 * Provides server-side transactional email abstractions for invitations,
 * password resets, and verification notices using Gmail SMTP (via Nodemailer)
 * with backward-compatible Resend transactional fallback.
 */

import https from "https";
import nodemailer from "nodemailer";

export interface SendInvitationEmailParams {
  toEmail: string;
  tenantName: string;
  role: string;
  inviteUrl: string;
  inviterName?: string;
  expiresInHours?: number;
}

export interface SendCollegeInvitationParams {
  toEmail: string;
  collegeName: string;
  placementHeadName: string;
  inviteUrl: string;
  expiresInHours?: number;
}

export interface SendPasswordResetParams {
  toEmail: string;
  resetUrl: string;
}

export interface SendVerificationEmailParams {
  toEmail: string;
  verifyUrl: string;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveryMethod: "GMAIL_SMTP" | "LIVE_PROVIDER" | "LOCAL_DEV_SINK" | "UNCONFIGURED";
}

/**
 * Escapes dynamic strings for safe embedding into HTML email templates.
 */
function escapeHtml(text: string): string {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export class EmailAdapter {
  /**
   * Resolves the canonical, trusted application base URL for generating recipient-accessible links.
   * Environment awareness:
   * - Preview deployments: Automatically resolves from VERCEL_URL when VERCEL_ENV === "preview"
   * - Production / Custom domains: Resolves from validated APP_BASE_URL > NEXT_PUBLIC_APP_URL > VERCEL_PROJECT_PRODUCTION_URL
   * - Local development: Resolves from APP_BASE_URL > NEXT_PUBLIC_APP_URL > http://localhost:${PORT || 3000}
   * 
   * SECURITY: Strictly validates scheme (http/https), trims trailing slashes, and NEVER trusts
   * unvalidated client/browser headers (Host / X-Forwarded-Host).
   */
  public static getAppOrigin(): string {
    // 1. Preview Deployments (e.g. Vercel Branch / PR Previews)
    const vercelEnv = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
    if (vercelEnv === "preview" && process.env.VERCEL_URL) {
      const previewCandidate = `https://${process.env.VERCEL_URL.trim().replace(/\/+$/, "")}`;
      try {
        const parsed = new URL(previewCandidate);
        return `${parsed.protocol}//${parsed.host}`;
      } catch {
        // Fallback to standard resolution if malformed
      }
    }

    // 2. Explicit environment base URL overrides
    const explicitCandidate =
      process.env.APP_BASE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL;

    let candidate = "";

    if (explicitCandidate && explicitCandidate.trim().length > 0) {
      candidate = explicitCandidate.trim();
    } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
      candidate = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.trim()}`;
    } else if (process.env.NODE_ENV === "production" || vercelEnv === "production") {
      candidate = "https://urplaced.vercel.app";
    } else {
      const port = process.env.PORT || "3000";
      candidate = `http://localhost:${port}`;
    }

    const trimmed = candidate.replace(/\/+$/, "");

    // Validate URL structure and scheme
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return "http://localhost:3000";
      }
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return "http://localhost:3000";
    }
  }

  /**
   * Safely resolves and sanitizes Gmail SMTP credentials from process.env.
   * Strips any unintentional leading equals signs, quotes, or internal whitespace.
   * NEVER prints or logs secret credentials.
   */
  public static getGmailConfig(): { user: string; pass: string; isConfigured: boolean } {
    const rawUser = process.env.GMAIL_USER || "";
    const rawPass = process.env.GMAIL_APP_PASSWORD || "";

    const user = rawUser.replace(/^=+/, "").replace(/['"]/g, "").trim();
    const pass = rawPass.replace(/^=+/, "").replace(/['"]/g, "").replace(/\s+/g, "").trim();

    return {
      user,
      pass,
      isConfigured: user.length > 0 && pass.length > 0,
    };
  }

  /**
   * Creates a Nodemailer transporter configured for Google's official SMTP:
   * Host: smtp.gmail.com, Port: 465, Secure TLS: true.
   */
  public static createGmailTransporter(user: string, pass: string) {
    return nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // TLS on port 465
      auth: {
        user,
        pass,
      },
    });
  }

  /**
   * Sends transactional email using Gmail SMTP via Nodemailer.
   */
  private static async sendViaGmailSmtp(payload: {
    user: string;
    pass: string;
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const transporter = this.createGmailTransporter(payload.user, payload.pass);
      const info = await transporter.sendMail({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: unknown) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        error: `Gmail SMTP transmission error: ${rawMessage}`,
      };
    }
  }

  /**
   * Resolves the verified sender address for Resend fallback.
   * Priority: RESEND_FROM_EMAIL > EMAIL_FROM > UrPlaced <onboarding@resend.dev>
   */
  public static getSenderEmail(): string {
    const configured = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM;
    if (configured && configured.trim().length > 0) {
      return configured.trim();
    }
    return "UrPlaced <onboarding@resend.dev>";
  }

  /**
   * Generates a branded, responsive HTML template for institutional staff invitations.
   * Strictly matches the UrPlaced design system (Outfit, Inter, #5052C9, #2E8F86, #EDECE7).
   */
  private static generateInvitationHtml(params: SendInvitationEmailParams): string {
    const roleTitle =
      params.role === "TRAINER"
        ? "Faculty / Training Specialist"
        : params.role === "PLACEMENT_STAFF"
        ? "Placement Officer"
        : params.role;

    const safeTenant = escapeHtml(params.tenantName);
    const safeRole = escapeHtml(roleTitle);
    const safeEmail = escapeHtml(params.toEmail);
    const safeUrl = escapeHtml(params.inviteUrl);
    const expiryText = params.expiresInHours ? `${params.expiresInHours} hours` : "72 hours";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invitation to Join ${safeTenant}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #EDECE7; margin: 0; padding: 40px 16px; color: #24283A;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #F8F7F3; border-radius: 16px; border: 1px solid #DDDCD5; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(36, 40, 58, 0.07);">
    <!-- Header Banner -->
    <tr>
      <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #DDDCD5;">
        <div style="display: inline-block; background: linear-gradient(135deg, #7779D8 0%, #5052C9 100%); color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
          UrPlaced
        </div>
        <p style="margin: 8px 0 0; font-size: 12px; color: #747683; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">
          Multi-College Placement Preparation SaaS
        </p>
      </td>
    </tr>

    <!-- Main Body -->
    <tr>
      <td style="padding: 32px;">
        <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #24283A;">
          You're invited to join ${safeTenant}
        </h1>
        <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #292D40;">
          The Placement Cell administrator has authorized institutional access for you on UrPlaced as a <strong>${safeRole}</strong>.
        </p>

        <!-- Role & Tenant Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FBFAF7; border: 1px solid #DDDCD5; border-radius: 8px; margin-bottom: 24px; padding: 16px;">
          <tr>
            <td style="font-size: 13px; color: #747683; padding: 4px 8px;">Institution:</td>
            <td style="font-size: 13px; font-weight: 600; color: #24283A; padding: 4px 8px;">${safeTenant}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #747683; padding: 4px 8px;">Assigned Role:</td>
            <td style="font-size: 13px; font-weight: 600; color: #2E8F86; padding: 4px 8px;">${safeRole}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #747683; padding: 4px 8px;">Bound Email:</td>
            <td style="font-size: 13px; font-weight: 600; color: #24283A; font-family: monospace; padding: 4px 8px;">${safeEmail}</td>
          </tr>
        </table>

        <!-- Call to Action Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${safeUrl}" target="_blank" style="display: inline-block; background-color: #5052C9; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(80, 82, 201, 0.25);">
                Accept Invitation &amp; Activate Account
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 12px; color: #747683; line-height: 1.5; text-align: center;">
          This single-use invitation link expires in <strong>${expiryText}</strong>.<br>
          If you were not expecting this invitation, you may safely disregard this email.
        </p>
      </td>
    </tr>

    <!-- Security Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #EDECE7; text-align: center; border-top: 1px solid #DDDCD5; font-size: 11px; color: #747683;">
        Secured with Supabase Authentication &amp; PostgreSQL Kernel Tenant Isolation.<br>
        UrPlaced Campus Enterprise &copy; 2026
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generates a plain-text fallback for email clients that do not render HTML.
   */
  private static generateInvitationPlainText(params: SendInvitationEmailParams): string {
    const roleTitle =
      params.role === "TRAINER"
        ? "Faculty / Training Specialist"
        : params.role === "PLACEMENT_STAFF"
        ? "Placement Officer"
        : params.role;

    const expiryText = params.expiresInHours ? `${params.expiresInHours} hours` : "72 hours";

    return [
      `You're invited to join ${params.tenantName} on UrPlaced`,
      `==================================================`,
      ``,
      `The Placement Cell administrator has authorized institutional access for you on UrPlaced as a ${roleTitle}.`,
      ``,
      `Institution:   ${params.tenantName}`,
      `Assigned Role: ${roleTitle}`,
      `Bound Email:   ${params.toEmail}`,
      ``,
      `To activate your account and set your password, open the link below:`,
      params.inviteUrl,
      ``,
      `This single-use invitation link expires in ${expiryText}.`,
      `If you were not expecting this invitation, you may safely disregard this email.`,
      ``,
      `UrPlaced Campus Enterprise — Multi-College Placement Preparation SaaS`,
    ].join("\n");
  }

  /**
   * Executes a direct POST to Resend API via Node https with IPv4 enforcement.
   */
  private static async postToResend(payload: {
    apiKey: string;
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  }): Promise<{ success: boolean; id?: string; error?: string }> {
    return new Promise((resolve) => {
      const postData = JSON.stringify({
        from: payload.from,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      const options: https.RequestOptions = {
        hostname: "api.resend.com",
        port: 443,
        path: "/emails",
        method: "POST",
        family: 4, // Strict IPv4 to eliminate Windows dual-stack connect timeouts
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${payload.apiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let rawBody = "";
        res.on("data", (chunk) => {
          rawBody += chunk;
        });
        res.on("end", () => {
          try {
            const data = JSON.parse(rawBody);
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, id: data.id });
            } else {
              const errMsg =
                data.message || data.error || `Resend HTTP error ${res.statusCode}`;
              resolve({ success: false, error: errMsg });
            }
          } catch {
            resolve({
              success: false,
              error: `Resend HTTP ${res.statusCode}: ${rawBody.slice(0, 120)}`,
            });
          }
        });
      });

      req.on("error", (err) => {
        resolve({
          success: false,
          error: `Network error connecting to Resend: ${err.message}`,
        });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({
          success: false,
          error: "Connection to Resend API timed out after 10 seconds.",
        });
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Universal transactional email dispatcher shared by all invitation and notification flows.
   * Priority:
   * 1. Real Gmail SMTP delivery via Nodemailer if GMAIL_USER and GMAIL_APP_PASSWORD are configured.
   * 2. Resend transactional API if RESEND_API_KEY is configured and Gmail is absent.
   * 3. Local test sink strictly in automated test runner (NODE_ENV === "test" || VITEST).
   * 4. Honest unconfigured error.
   */
  public static async dispatchTransactionalEmail(payload: {
    toEmail: string;
    subject: string;
    html: string;
    text: string;
    senderName?: string;
  }): Promise<EmailDeliveryResult> {
    const gmailConfig = this.getGmailConfig();
    const isTestEnvironment =
      process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

    // 1. Primary: Real Gmail SMTP Delivery via Nodemailer
    if (gmailConfig.isConfigured) {
      const displayName = payload.senderName || "UrPlaced";
      const fromAddress = `${displayName} <${gmailConfig.user}>`;

      const smtpResult = await this.sendViaGmailSmtp({
        user: gmailConfig.user,
        pass: gmailConfig.pass,
        from: fromAddress,
        to: payload.toEmail,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      if (!smtpResult.success) {
        // Enforce rule: Do not silently fall back to Resend if Gmail SMTP fails
        return {
          success: false,
          deliveryMethod: "GMAIL_SMTP",
          error: smtpResult.error || "Email delivery rejected by Gmail SMTP server.",
        };
      }

      return {
        success: true,
        messageId: smtpResult.messageId || `gmail-${Date.now()}`,
        deliveryMethod: "GMAIL_SMTP",
      };
    }

    // 2. Secondary: Resend API if configured and Gmail is absent
    const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "").trim();
    if (apiKey.length > 0) {
      const fromEmail = this.getSenderEmail();
      const resendResult = await this.postToResend({
        apiKey,
        from: fromEmail,
        to: [payload.toEmail],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      if (!resendResult.success) {
        return {
          success: false,
          deliveryMethod: "LIVE_PROVIDER",
          error: resendResult.error || "Email delivery rejected by Resend provider.",
        };
      }

      return {
        success: true,
        messageId: resendResult.id || `resend-${Date.now()}`,
        deliveryMethod: "LIVE_PROVIDER",
      };
    }

    // 3. Automated test runner sink strictly in unit tests without credentials
    if (isTestEnvironment) {
      return {
        success: true,
        messageId: `test-sink-${Date.now()}`,
        deliveryMethod: "LOCAL_DEV_SINK",
      };
    }

    // 4. Honest unconfigured error
    return {
      success: false,
      deliveryMethod: "UNCONFIGURED",
      error:
        "Gmail SMTP credentials (GMAIL_USER, GMAIL_APP_PASSWORD) are not configured in environment variables. Real email delivery cannot be completed.",
    };
  }

  /**
   * Dispatches an invitation email to a staff or faculty member.
   * Priority:
   * 1. Real Gmail SMTP delivery via Nodemailer if GMAIL_USER and GMAIL_APP_PASSWORD are configured.
   * 2. Resend transactional API if RESEND_API_KEY is configured and Gmail is absent.
   * 3. Local test sink strictly in automated test runner (NODE_ENV === "test" || VITEST).
   */
  public static async sendInvitation(
    params: SendInvitationEmailParams
  ): Promise<EmailDeliveryResult> {
    const subject = `You're invited to join ${params.tenantName} on UrPlaced — College / Cell`;
    const html = this.generateInvitationHtml(params);
    const text = this.generateInvitationPlainText(params);

    return this.dispatchTransactionalEmail({
      toEmail: params.toEmail,
      subject,
      html,
      text,
      senderName: "UrPlaced",
    });
  }

  /**
   * Dispatches a password reset link.
   */
  public static async sendPasswordReset(
    params: SendPasswordResetParams
  ): Promise<EmailDeliveryResult> {
    const gmailConfig = this.getGmailConfig();
    const isTestEnvironment =
      process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

    if (gmailConfig.isConfigured) {
      const fromAddress = `UrPlaced <${gmailConfig.user}>`;
      const subject = "Reset your UrPlaced password";
      const html = `<p>Click here to reset your password: <a href="${escapeHtml(
        params.resetUrl
      )}">${escapeHtml(params.resetUrl)}</a></p>`;
      const text = `Reset your UrPlaced password: ${params.resetUrl}`;

      const res = await this.sendViaGmailSmtp({
        user: gmailConfig.user,
        pass: gmailConfig.pass,
        from: fromAddress,
        to: params.toEmail,
        subject,
        html,
        text,
      });

      return {
        success: res.success,
        messageId: res.messageId,
        deliveryMethod: "GMAIL_SMTP",
        error: res.error,
      };
    }

    const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "").trim();
    if (apiKey.length > 0) {
      const fromEmail = this.getSenderEmail();
      const subject = "Reset your UrPlaced password";
      const html = `<p>Click here to reset your password: <a href="${escapeHtml(
        params.resetUrl
      )}">${escapeHtml(params.resetUrl)}</a></p>`;
      const text = `Reset your UrPlaced password: ${params.resetUrl}`;

      const res = await this.postToResend({
        apiKey,
        from: fromEmail,
        to: [params.toEmail],
        subject,
        html,
        text,
      });

      return {
        success: res.success,
        messageId: res.id,
        deliveryMethod: res.success ? "LIVE_PROVIDER" : "UNCONFIGURED",
        error: res.error,
      };
    }

    if (isTestEnvironment) {
      return {
        success: true,
        messageId: `test-reset-${Date.now()}`,
        deliveryMethod: "LOCAL_DEV_SINK",
      };
    }

    return {
      success: false,
      deliveryMethod: "UNCONFIGURED",
      error: "Email delivery credentials are not configured in environment variables.",
    };
  }

  /**
   * Dispatches an email verification link.
   */
  public static async sendVerification(
    params: SendVerificationEmailParams
  ): Promise<EmailDeliveryResult> {
    const gmailConfig = this.getGmailConfig();
    const isTestEnvironment =
      process.env.NODE_ENV === "test" || Boolean(process.env.VITEST);

    if (gmailConfig.isConfigured) {
      const fromAddress = `UrPlaced <${gmailConfig.user}>`;
      const subject = "Verify your email on UrPlaced";
      const html = `<p>Verify your email: <a href="${escapeHtml(params.verifyUrl)}">${escapeHtml(
        params.verifyUrl
      )}</a></p>`;
      const text = `Verify your email: ${params.verifyUrl}`;

      const res = await this.sendViaGmailSmtp({
        user: gmailConfig.user,
        pass: gmailConfig.pass,
        from: fromAddress,
        to: params.toEmail,
        subject,
        html,
        text,
      });

      return {
        success: res.success,
        messageId: res.messageId,
        deliveryMethod: "GMAIL_SMTP",
        error: res.error,
      };
    }

    const apiKey = (process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY || "").trim();
    if (apiKey.length > 0) {
      const fromEmail = this.getSenderEmail();
      const subject = "Verify your email on UrPlaced";
      const html = `<p>Verify your email: <a href="${escapeHtml(params.verifyUrl)}">${escapeHtml(
        params.verifyUrl
      )}</a></p>`;
      const text = `Verify your email: ${params.verifyUrl}`;

      const res = await this.postToResend({
        apiKey,
        from: fromEmail,
        to: [params.toEmail],
        subject,
        html,
        text,
      });

      return {
        success: res.success,
        messageId: res.id,
        deliveryMethod: res.success ? "LIVE_PROVIDER" : "UNCONFIGURED",
        error: res.error,
      };
    }

    if (isTestEnvironment) {
      return {
        success: true,
        messageId: `test-verify-${Date.now()}`,
        deliveryMethod: "LOCAL_DEV_SINK",
      };
    }

    return {
      success: false,
      deliveryMethod: "UNCONFIGURED",
      error: "Email delivery credentials are not configured in environment variables.",
    };
  }

  /**
   * Generates branded HTML template for College Placement Head onboarding invitations.
   * Dedicated template strictly adhering to UrPlaced Design System tokens.
   */
  private static generateCollegeInvitationHtml(params: SendCollegeInvitationParams): string {
    const safeCollege = escapeHtml(params.collegeName);
    const safeHeadName = escapeHtml(params.placementHeadName);
    const safeEmail = escapeHtml(params.toEmail);
    const safeUrl = escapeHtml(params.inviteUrl);
    const expiryText = params.expiresInHours ? `${params.expiresInHours} hours` : "72 hours";

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Set Up Your UrPlaced College Placement Account</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #EDECE7; margin: 0; padding: 40px 16px; color: #24283A;">
  <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; background-color: #F8F7F3; border-radius: 16px; border: 1px solid #DDDCD5; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(36, 40, 58, 0.07);">
    <!-- Header Banner -->
    <tr>
      <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #DDDCD5;">
        <div style="display: inline-block; background: linear-gradient(135deg, #7779D8 0%, #5052C9 100%); color: #ffffff; padding: 8px 16px; border-radius: 8px; font-weight: 800; font-size: 20px; letter-spacing: -0.5px;">
          UrPlaced
        </div>
        <p style="margin: 8px 0 0; font-size: 12px; color: #747683; font-family: monospace; text-transform: uppercase; letter-spacing: 1px;">
          Institutional Placement SaaS &bull; Platform Control Plane
        </p>
      </td>
    </tr>

    <!-- Main Content -->
    <tr>
      <td style="padding: 32px;">
        <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #24283A;">
          Set Up Your College Placement Account
        </h1>
        <p style="margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: #292D40;">
          Dear <strong>${safeHeadName}</strong>,
        </p>
        <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #292D40;">
          Your institution has been registered on UrPlaced by the platform administration team. You have been invited to set up the College Placement Head account for this institution.
        </p>

        <!-- Institution Details Card -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FBFAF7; border: 1px solid #DDDCD5; border-radius: 8px; margin-bottom: 24px; padding: 16px;">
          <tr>
            <td style="font-size: 13px; color: #747683; padding: 6px 8px;">Institution:</td>
            <td style="font-size: 13px; font-weight: 700; color: #24283A; padding: 6px 8px;">${safeCollege}</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #747683; padding: 6px 8px;">Designation / Role:</td>
            <td style="font-size: 13px; font-weight: 600; color: #2E8F86; padding: 6px 8px;">Placement Head (Administrator)</td>
          </tr>
          <tr>
            <td style="font-size: 13px; color: #747683; padding: 6px 8px;">Bound Institutional Email:</td>
            <td style="font-size: 13px; font-weight: 600; color: #24283A; font-family: monospace; padding: 6px 8px;">${safeEmail}</td>
          </tr>
        </table>

        <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #292D40;">
          Use the secure link below to create your login password and activate your account setup.
        </p>

        <!-- CTA Button -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center">
              <a href="${safeUrl}" target="_blank" style="display: inline-block; background-color: #5052C9; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; padding: 14px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(80, 82, 201, 0.25);">
                Complete College Account Setup
              </a>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0; font-size: 12px; color: #747683; line-height: 1.5; text-align: center;">
          This single-use invitation link expires in <strong>${expiryText}</strong>.<br>
          If you have questions, contact platform support at <strong>support@urplaced.com</strong>.
        </p>
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #EDECE7; text-align: center; border-top: 1px solid #DDDCD5; font-size: 11px; color: #747683;">
        Secured with Supabase Authentication &amp; Multi-Tenant Platform Control Plane.<br>
        UrPlaced &copy; 2026
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Generates plain-text fallback for College Placement Head onboarding invitations.
   */
  private static generateCollegeInvitationPlainText(params: SendCollegeInvitationParams): string {
    const expiryText = params.expiresInHours ? `${params.expiresInHours} hours` : "72 hours";
    return `UrPlaced — College Placement Head Onboarding

Dear ${params.placementHeadName},

Your institution (${params.collegeName}) has been registered on UrPlaced by the platform administration team. You have been invited to set up the College Placement Head account for this institution.

Complete your account setup using this secure link:
${params.inviteUrl}

This single-use invitation link expires in ${expiryText}.

Institution: ${params.collegeName}
Designation: Placement Head (Administrator)
Bound Email: ${params.toEmail}

Secured with Supabase Authentication & Multi-Tenant Platform Control Plane.
UrPlaced © 2026`;
  }

  /**
   * Dispatches an invitation email to a newly registered College Placement Head.
   * Leverages the exact same unified transactional email infrastructure as staff invitations,
   * while preserving the dedicated Placement Head branding, template, and secure signup link.
   */
  public static async sendCollegePlacementHeadInvitation(
    params: SendCollegeInvitationParams
  ): Promise<EmailDeliveryResult> {
    const subject = "You're Invited to Set Up Your UrPlaced College Placement Account";
    const html = this.generateCollegeInvitationHtml(params);
    const text = this.generateCollegeInvitationPlainText(params);

    return this.dispatchTransactionalEmail({
      toEmail: params.toEmail,
      subject,
      html,
      text,
      senderName: "UrPlaced Platform",
    });
  }
}
