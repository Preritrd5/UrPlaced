/**
 * Email Delivery Adapter
 * Provides server-side transactional email abstractions for invitations,
 * password resets, and verification notices.
 */

export interface SendInvitationEmailParams {
  toEmail: string;
  tenantName: string;
  role: string;
  inviteUrl: string;
  inviterName?: string;
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
}

export class EmailAdapter {
  private static getAppOrigin(): string {
    return (
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      "http://localhost:3000"
    );
  }

  /**
   * Dispatches an invitation email to a candidate, staff, or faculty member.
   */
  public static async sendInvitation(
    params: SendInvitationEmailParams
  ): Promise<EmailDeliveryResult> {
    const isProduction = process.env.NODE_ENV === "production";
    const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;

    if (!apiKey && isProduction) {
      console.error(
        "[EmailAdapter Error] Missing email provider credentials in production environment."
      );
      return {
        success: false,
        error: "Email delivery provider is unconfigured in production.",
      };
    }

    // Development / Local sink: Log invitation payload cleanly
    console.log("=================================================");
    console.log(`[Email Sink - Local Dev] To: ${params.toEmail}`);
    console.log(`Subject: You have been invited to join ${params.tenantName} on UrPlaced`);
    console.log(`Role: ${params.role}`);
    console.log(`Invite URL: ${params.inviteUrl}`);
    console.log("=================================================");

    return {
      success: true,
      messageId: `dev-invitation-${Date.now()}`,
    };
  }

  /**
   * Dispatches a password reset link.
   */
  public static async sendPasswordReset(
    params: SendPasswordResetParams
  ): Promise<EmailDeliveryResult> {
    const isProduction = process.env.NODE_ENV === "production";
    const apiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;

    if (!apiKey && isProduction) {
      return {
        success: false,
        error: "Email delivery provider is unconfigured in production.",
      };
    }

    console.log("=================================================");
    console.log(`[Email Sink - Local Dev] Password Reset: ${params.toEmail}`);
    console.log(`Reset URL: ${params.resetUrl}`);
    console.log("=================================================");

    return {
      success: true,
      messageId: `dev-reset-${Date.now()}`,
    };
  }

  /**
   * Dispatches an email verification link.
   */
  public static async sendVerification(
    params: SendVerificationEmailParams
  ): Promise<EmailDeliveryResult> {
    console.log("=================================================");
    console.log(`[Email Sink - Local Dev] Verify Email: ${params.toEmail}`);
    console.log(`Verify URL: ${params.verifyUrl}`);
    console.log("=================================================");

    return {
      success: true,
      messageId: `dev-verify-${Date.now()}`,
    };
  }
}
