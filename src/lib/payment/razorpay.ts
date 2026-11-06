/**
 * Razorpay Payment Gateway Adapter (Test Mode Only)
 * Handles client initialization, environment validation, and cryptographic HMAC verification.
 */

import crypto from "crypto";
import Razorpay from "razorpay";

export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
}

let cachedRazorpayClient: Razorpay | null = null;

export function getRazorpayConfig(): RazorpayConfig {
  const keyId = process.env.RAZORPAY_KEY_ID?.replace(/^["']|["']$/g, "").trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.replace(/^["']|["']$/g, "").trim();
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.replace(/^["']|["']$/g, "").trim();
  const mode = (process.env.RAZORPAY_MODE || "test").replace(/^["']|["']$/g, "").trim().toLowerCase();

  if (mode !== "test") {
    throw new Error(
      "Safety violation: UrPlaced is configured in Razorpay TEST MODE only. Live mode is strictly prohibited."
    );
  }

  if (!keyId || !keySecret) {
    throw new Error(
      "Razorpay payment gateway configuration is missing. Ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set."
    );
  }

  // Strict constraint: SA-05 Step 01 operates in TEST MODE only
  if (!keyId.startsWith("rzp_test_")) {
    throw new Error(
      "Safety violation: UrPlaced is configured in Razorpay TEST MODE only. Live key identifiers are strictly prohibited in this phase."
    );
  }

  return {
    keyId,
    keySecret,
    webhookSecret,
  };
}

export function getRazorpayClient(): Razorpay {
  if (cachedRazorpayClient) {
    return cachedRazorpayClient;
  }

  const { keyId, keySecret } = getRazorpayConfig();
  cachedRazorpayClient = new Razorpay({
    key_id: keyId,
    key_secret: keySecret,
  });

  return cachedRazorpayClient;
}

/**
 * Verifies standard checkout signature returned by Razorpay checkout modal:
 * HMAC_SHA256(order_id + "|" + razorpay_payment_id, secret) == razorpay_signature
 */
export function verifyCheckoutSignature(params: {
  orderId: string;
  paymentId: string;
  signature: string;
  secret?: string;
}): boolean {
  try {
    const secret = params.secret || getRazorpayConfig().keySecret;
    const body = `${params.orderId}|${params.paymentId}`;

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (params.signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(params.signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("[Razorpay] Signature verification error:", error);
    return false;
  }
}

/**
 * Verifies server-to-server webhook signature using raw payload string:
 * HMAC_SHA256(rawBody, webhookSecret) == x-razorpay-signature
 */
export function verifyWebhookSignature(params: {
  rawBody: string;
  signature: string;
  secret?: string;
}): boolean {
  try {
    const secret = params.secret || getRazorpayConfig().webhookSecret;
    if (!secret) {
      console.error("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured.");
      return false;
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(params.rawBody)
      .digest("hex");

    if (params.signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(params.signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    console.error("[Razorpay Webhook] Signature verification error:", error);
    return false;
  }
}

/**
 * Convenience helper to retrieve current key ID.
 */
export function getRazorpayKeyId(): string {
  return getRazorpayConfig().keyId;
}

/**
 * Mask sensitive credentials and tokens for safe logging and UI display.
 */
export function maskSecret(secret?: string | null): string {
  if (!secret) return "";
  if (secret.length <= 8) return "********";
  return `${secret.slice(0, 9)}...${secret.slice(-4)}`;
}

/**
 * Real Razorpay Subscriptions / Recurring Mandate Gateway Integration (Correction E / Q4)
 */
export async function createRazorpaySubscription(params: {
  planId: string;
  totalCount?: number;
  quantity?: number;
  customerNotify?: 0 | 1;
  startAt?: number;
  notes?: Record<string, string>;
}): Promise<any> {
  const razorpay = getRazorpayClient();
  const { planId, totalCount = 10, quantity = 1, customerNotify = 1, startAt, notes } = params;

  return razorpay.subscriptions.create({
    plan_id: planId,
    total_count: totalCount,
    quantity,
    customer_notify: customerNotify,
    start_at: startAt,
    notes,
  } as any);
}

export async function fetchRazorpaySubscription(subscriptionId: string): Promise<any> {
  const razorpay = getRazorpayClient();
  return razorpay.subscriptions.fetch(subscriptionId);
}

export async function cancelRazorpaySubscription(
  subscriptionId: string,
  cancelAtCycleEnd = false
): Promise<any> {
  const razorpay = getRazorpayClient();
  return razorpay.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
}

export async function pauseRazorpaySubscription(subscriptionId: string): Promise<any> {
  const razorpay = getRazorpayClient();
  return (razorpay.subscriptions as any).pause(subscriptionId, { pause_at: "now" });
}

export async function resumeRazorpaySubscription(subscriptionId: string): Promise<any> {
  const razorpay = getRazorpayClient();
  return (razorpay.subscriptions as any).resume(subscriptionId, { resume_at: "now" });
}

// Named aliases for consistency across test suites and services
export const verifyRazorpayPaymentSignature = verifyCheckoutSignature;
export const verifyRazorpayWebhookSignature = verifyWebhookSignature;

