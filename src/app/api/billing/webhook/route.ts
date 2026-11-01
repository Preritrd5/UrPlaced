/**
 * Backward compatibility / safe alias for Razorpay Webhook.
 * 
 * CANONICAL ROUTE: /api/webhooks/razorpay (src/app/api/webhooks/razorpay/route.ts)
 * 
 * This file delegates directly to the canonical route handler to safely handle
 * any requests routed to /api/billing/webhook without differing cryptographic
 * verification, raw body handling, or reconciliation logic.
 */

export { POST, dynamic } from "@/app/api/webhooks/razorpay/route";
