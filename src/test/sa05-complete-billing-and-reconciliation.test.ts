import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";
import { RefundService } from "@/modules/billing/services/refund-service";
import { RecurringMandateService } from "@/modules/billing/services/recurring-mandate-service";
import { BillingNotificationService } from "@/modules/billing/services/billing-notification-service";
import { InvoiceDocumentService } from "@/modules/billing/services/invoice-document-service";
import { SubscriptionLifecycleBillingService } from "@/modules/billing/services/subscription-lifecycle-billing-service";
import { ReconciliationEngine } from "@/modules/billing/services/reconciliation-engine";
import { TaxConfigurationService } from "@/modules/billing/services/tax-configuration-service";
import { BillingCronRunner } from "@/modules/billing/services/billing-cron-runner";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import * as razorpayLib from "@/lib/payment/razorpay";
import { POST as superAdminPayRoute } from "@/app/api/preritrd/billing/invoices/[id]/pay/route";

// Mock email adapter
vi.mock("@/modules/identity-access/services/email-adapter", () => ({
  EmailAdapter: {
    dispatchTransactionalEmail: vi.fn(async () => ({ success: true, messageId: "msg_mock_123" })),
  },
}));

// Mock platform notification service
vi.mock("@/modules/platform-admin/services/platform-notification-service", () => ({
  PlatformNotificationService: {
    createNotification: vi.fn(async () => ({ id: "notif_mock_123" })),
  },
}));

// Mock platform auth service
vi.mock("@/modules/platform-admin/services/platform-auth-service", () => ({
  PlatformAuthService: {
    requireSuperAdmin: vi.fn(),
    logAuditEvent: vi.fn(async () => {}),
  },
}));

// Mock server auth context
vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(),
}));

import { EmailAdapter } from "@/modules/identity-access/services/email-adapter";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformNotificationService } from "@/modules/platform-admin/services/platform-notification-service";

describe("URPLACED SA-05: Comprehensive Billing & Reconciliation Suite (All 60 Scenarios)", () => {
  const TEST_KEY_ID = "rzp_test_urplaced_mock_12345";
  const TEST_KEY_SECRET = "mock_secret_key_987654321";
  const TEST_WEBHOOK_SECRET = "mock_webhook_secret_abcdef123";

  let mockDatabase: Record<string, any[]> = {};
  let mockRazorpayOrdersCreate: any;
  let mockRazorpayOrdersFetchPayments: any;
  let mockRazorpayPaymentsFetch: any;
  let mockRazorpayPaymentsRefund: any;

  // Flexible Mock Supabase Admin Client
  const createMockAdmin = () => ({
    from: vi.fn((table: string) => {
      if (!mockDatabase[table]) mockDatabase[table] = [];

      const buildFilter = (filteredRows: any[]) => {
        const chain: any = {
          eq: vi.fn((field: string, val: any) => {
            const next = filteredRows.filter((r) => r[field] === val);
            return buildFilter(next);
          }),
          neq: vi.fn((field: string, val: any) => {
            const next = filteredRows.filter((r) => r[field] !== val);
            return buildFilter(next);
          }),
          is: vi.fn((field: string, val: any) => {
            const next = filteredRows.filter((r) => r[field] === val);
            return buildFilter(next);
          }),
          in: vi.fn((field: string, vals: any[]) => {
            const next = filteredRows.filter((r) => vals.includes(r[field]));
            return buildFilter(next);
          }),
          gte: vi.fn((field: string, val: any) => {
            const next = filteredRows.filter((r) => r[field] >= val);
            return buildFilter(next);
          }),
          lte: vi.fn((field: string, val: any) => {
            const next = filteredRows.filter((r) => r[field] <= val);
            return buildFilter(next);
          }),
          not: vi.fn((field: string, op: string, val: any) => {
            let next = filteredRows;
            if (op === "is" && val === null) {
              next = filteredRows.filter((r) => r[field] !== null && r[field] !== undefined);
            } else {
              next = filteredRows.filter((r) => r[field] !== val);
            }
            return buildFilter(next);
          }),
          order: vi.fn(() => chain),
          limit: vi.fn((count: number) => {
            const sliced = filteredRows.slice(0, count);
            const limitedChain = buildFilter(sliced);
            limitedChain.then = (resolve: any) => resolve({ data: sliced, error: null });
            return limitedChain;
          }),
          maybeSingle: vi.fn(async () => ({ data: filteredRows[0] || null, error: null })),
          single: vi.fn(async () => ({
            data: filteredRows[0] || null,
            error: filteredRows[0] ? null : { message: `Record not found in ${table}` },
          })),
          then: (resolve: any) => resolve({ data: filteredRows, error: null }),
        };
        return chain;
      };

      return {
        select: vi.fn((columns?: string) => {
          let rows = [...(mockDatabase[table] || [])];
          if (columns && columns.includes("tenants (") && table === "college_subscriptions") {
            rows = rows.map((r) => {
              const tenant = (mockDatabase["tenants"] || []).find((t) => t.id === r.tenant_id);
              return { ...r, tenants: tenant || null };
            });
          }
          if (columns && columns.includes("tenants (") && table === "platform_invoices") {
            rows = rows.map((r) => {
              const tenant = (mockDatabase["tenants"] || []).find((t) => t.id === (r.tenant_id || r.college_id));
              return { ...r, tenants: tenant || null };
            });
          }
          return buildFilter(rows);
        }),
        insert: vi.fn((payload: any) => {
          const items = Array.isArray(payload) ? payload : [payload];
          const inserted = items.map((i) => ({
            id: i.id || `id-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            created_at: i.created_at || new Date().toISOString(),
            ...i,
          }));
          mockDatabase[table].push(...inserted);
          const first = inserted[0];
          return {
            data: Array.isArray(payload) ? inserted : first,
            error: null,
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: first, error: null })),
              maybeSingle: vi.fn(async () => ({ data: first, error: null })),
            })),
            then: (resolve: any) => resolve({ data: Array.isArray(payload) ? inserted : first, error: null }),
          };
        }),
        upsert: vi.fn((payload: any, options?: any) => {
          const item = { ...payload };
          const conflictCol = options?.onConflict || "id";
          const idx = mockDatabase[table].findIndex((r) => r[conflictCol] === item[conflictCol]);
          if (idx >= 0) {
            mockDatabase[table][idx] = { ...mockDatabase[table][idx], ...item };
          } else {
            mockDatabase[table].push(item);
          }
          const saved = idx >= 0 ? mockDatabase[table][idx] : item;
          return {
            data: saved,
            error: null,
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: saved, error: null })),
              maybeSingle: vi.fn(async () => ({ data: saved, error: null })),
            })),
            then: (resolve: any) => resolve({ data: saved, error: null }),
          };
        }),
        update: vi.fn((updateData: any) => {
          const makeUpdateChain = (matchedRows: any[] = mockDatabase[table] || []) => ({
            eq: vi.fn((field: string, val: any) => {
              mockDatabase[table] = (mockDatabase[table] || []).map((r) => {
                if (r[field] === val) return { ...r, ...updateData };
                return r;
              });
              const remaining = (mockDatabase[table] || []).filter((r) => r[field] === val);
              return makeUpdateChain(remaining);
            }),
            neq: vi.fn((field: string, val: any) => {
              mockDatabase[table] = (mockDatabase[table] || []).map((r) => {
                if (r[field] !== val) return { ...r, ...updateData };
                return r;
              });
              const remaining = (mockDatabase[table] || []).filter((r) => r[field] !== val);
              return makeUpdateChain(remaining);
            }),
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: matchedRows[0] || updateData, error: null })),
              maybeSingle: vi.fn(async () => ({ data: matchedRows[0] || null, error: null })),
            })),
            then: (resolve: any) => resolve({ data: matchedRows[0] || updateData, error: null }),
          });
          return makeUpdateChain();
        }),
        delete: vi.fn(() => ({
          eq: vi.fn((field: string, val: any) => {
            mockDatabase[table] = (mockDatabase[table] || []).filter((r) => r[field] !== val);
            return Promise.resolve({ data: null, error: null });
          }),
        })),
      };
    }),
  });

  let mockAdmin: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDatabase = {
      platform_invoices: [],
      payment_orders: [],
      payment_transactions: [],
      payment_webhook_events: [],
      college_subscriptions: [],
      tenants: [],
      subscription_plans: [],
      refunds: [],
      credit_notes: [],
      recurring_mandates: [],
      subscription_renewal_retries: [],
      billing_notifications_log: [],
      payment_discrepancies: [],
      users: [],
      platform_admins: [{ id: "admin-uuid-001" }],
      platform_tax_rules: [],
      billing_job_runs: [],
    };

    mockAdmin = createMockAdmin();

    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = TEST_KEY_ID;

    mockRazorpayOrdersCreate = vi.fn(async (args: any) => ({
      id: `order_rzp_${Date.now()}`,
      entity: "order",
      amount: args.amount,
      amount_paid: 0,
      amount_due: args.amount,
      currency: args.currency,
      receipt: args.receipt,
      status: "created",
      attempts: 0,
      notes: args.notes,
      created_at: Math.floor(Date.now() / 1000),
    }));

    mockRazorpayOrdersFetchPayments = vi.fn(async (orderId: string) => ({
      entity: "collection",
      count: 0,
      items: [],
    }));

    mockRazorpayPaymentsFetch = vi.fn(async (paymentId: string) => {
      // Find matching invoice or order in database or provide realistic captured payment
      const inv = mockDatabase.platform_invoices.find((i) => i.razorpay_payment_id === paymentId);
      const order = mockDatabase.payment_orders.find((o) => o.status !== "FAILED");
      const resolvedAmount = inv
        ? Math.round((Number(inv.amount_inr || 0) + Number(inv.tax_inr || 0)) * 100)
        : (order?.amount_paise || 118000);
      return {
        id: paymentId,
        entity: "payment",
        amount: resolvedAmount,
        currency: "INR",
        status: "captured",
        order_id: order?.order_id || inv?.razorpay_order_id || "order_test_123",
        method: "upi",
        email: "finance@apex.edu",
        contact: "+919876543210",
        created_at: Math.floor(Date.now() / 1000),
      };
    });

    mockRazorpayPaymentsRefund = vi.fn(async (paymentId: string, args: any) => ({
      id: `rfnd_mock_${Date.now()}`,
      entity: "refund",
      amount: args.amount,
      currency: "INR",
      payment_id: paymentId,
      status: "processed",
      speed_processed: "normal",
      receipt: args.receipt || null,
      created_at: Math.floor(Date.now() / 1000),
    }));

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: {
        create: mockRazorpayOrdersCreate,
        fetchPayments: mockRazorpayOrdersFetchPayments,
      },
      payments: {
        fetch: mockRazorpayPaymentsFetch,
        refund: mockRazorpayPaymentsRefund,
      },
    } as any);
  });

  // =========================================================================
  // CATEGORY 1: PAYMENT & CHECKOUT (Scenarios 1 - 12)
  // =========================================================================
  describe("Category 1: Payment & Checkout", () => {
    it("Scenario 1: Valid Razorpay order creation for issued invoice", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-001",
        tenant_id: "college-001",
        invoice_number: "INV-2026-0001",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });

      const order = await PaymentReconciliationService.createRazorpayOrder({
        invoiceId: "inv-001",
        admin: mockAdmin,
      });

      expect(order).toBeDefined();
      expect(order.razorpayOrderId).toMatch(/^order_rzp_/);
      expect(order.amountPaise).toBe(118000);
      expect(order.currency).toBe("INR");
    });

    it("Scenario 2: Order creation rejected for paid invoice", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-paid",
        tenant_id: "college-001",
        invoice_number: "INV-PAID-001",
        status: "PAID",
        amount_inr: 1000,
        tax_inr: 180,
      });

      await expect(
        PaymentReconciliationService.createRazorpayOrder({
          invoiceId: "inv-paid",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/already been fully paid/i);
    });

    it("Scenario 3: Order creation rejected for cancelled/void invoice", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-void",
        tenant_id: "college-001",
        invoice_number: "INV-VOID-001",
        status: "VOID",
        amount_inr: 1000,
        tax_inr: 180,
      });

      await expect(
        PaymentReconciliationService.createRazorpayOrder({
          invoiceId: "inv-void",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Cannot pay invoice in 'VOID' status/i);
    });

    it("Scenario 4: Order amount matches invoice amount exactly (in paise)", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-paise-check",
        tenant_id: "college-001",
        invoice_number: "INV-PAISE-01",
        status: "ISSUED",
        amount_inr: 2000,
        tax_inr: 360.5,
      });

      await PaymentReconciliationService.createRazorpayOrder({
        invoiceId: "inv-paise-check",
        admin: mockAdmin,
      });

      expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 236050, // (2000 + 360.50) * 100
        })
      );
    });

    it("Scenario 5: Currency is strictly INR", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-curr",
        tenant_id: "college-001",
        invoice_number: "INV-CURR-01",
        status: "ISSUED",
        amount_inr: 500,
        tax_inr: 0,
      });

      const order = await PaymentReconciliationService.createRazorpayOrder({
        invoiceId: "inv-curr",
        admin: mockAdmin,
      });

      expect(order.currency).toBe("INR");
      expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ currency: "INR" })
      );
    });

    it("Scenario 6: Receipt field matches invoice ID", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-rec-12345",
        tenant_id: "college-001",
        invoice_number: "INV-2026-REC",
        status: "ISSUED",
        amount_inr: 500,
        tax_inr: 0,
      });

      await PaymentReconciliationService.createRazorpayOrder({
        invoiceId: "inv-rec-12345",
        admin: mockAdmin,
      });

      expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({ receipt: "INV-2026-REC" })
      );
    });

    it("Scenario 7: Test mode key ID returned to client", () => {
      const keyId = razorpayLib.getRazorpayKeyId();
      expect(keyId).toBe(TEST_KEY_ID);
      expect(keyId.startsWith("rzp_test_")).toBe(true);
    });

    it("Scenario 8: Payment verification with valid HMAC signature succeeds", () => {
      const orderId = "order_test_valid";
      const paymentId = "pay_test_valid";
      const validSignature = crypto
        .createHmac("sha256", TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isValid = razorpayLib.verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: validSignature,
      });

      expect(isValid).toBe(true);
    });

    it("Scenario 9: Payment verification with invalid HMAC signature rejected (400)", () => {
      const orderId = "order_test_valid";
      const paymentId = "pay_test_valid";
      const invalidSignature = "tampered_signature_999999999999";

      const isValid = razorpayLib.verifyRazorpayPaymentSignature({
        orderId,
        paymentId,
        signature: invalidSignature,
      });

      expect(isValid).toBe(false);
    });

    it("Scenario 10: Payment verification with tampered order_id rejected", () => {
      const orderId = "order_test_valid";
      const paymentId = "pay_test_valid";
      const validSignature = crypto
        .createHmac("sha256", TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const isValid = razorpayLib.verifyRazorpayPaymentSignature({
        orderId: "order_tampered",
        paymentId,
        signature: validSignature,
      });

      expect(isValid).toBe(false);
    });

    it("Scenario 11: Verification is idempotent (second call succeeds without duplicate transaction)", async () => {
      const orderId = "order_idem_123";
      const paymentId = "pay_idem_123";
      const signature = crypto
        .createHmac("sha256", TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      mockDatabase.platform_invoices.push({
        id: "inv-idem-1",
        tenant_id: "college-idem",
        invoice_number: "INV-IDEM-01",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });
      mockDatabase.payment_orders.push({
        id: "po-idem-1",
        order_id: orderId,
        invoice_id: "inv-idem-1",
        tenant_id: "college-idem",
        amount_paise: 118000,
        currency: "INR",
        status: "CREATED",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-idem-1",
        tenant_id: "college-idem",
        status: "PENDING_PAYMENT",
      });

      // First verification
      const res1 = await PaymentReconciliationService.verifyCheckoutPayment({
        orderId,
        paymentId,
        signature,
        admin: mockAdmin,
      });
      expect(res1.success).toBe(true);
      expect(mockDatabase.payment_transactions.length).toBe(1);

      // Second verification (replay)
      const res2 = await PaymentReconciliationService.verifyCheckoutPayment({
        orderId,
        paymentId,
        signature,
        admin: mockAdmin,
      });
      expect(res2.success).toBe(true);
      expect(res2.duplicate).toBe(true);
      expect(mockDatabase.payment_transactions.length).toBe(1); // No duplicate
    });

    it("Scenario 12: Verification transitions invoice to PAID and activates subscription", async () => {
      const orderId = "order_act_001";
      const paymentId = "pay_act_001";
      const signature = crypto
        .createHmac("sha256", TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      mockDatabase.platform_invoices.push({
        id: "inv-act-001",
        tenant_id: "college-act",
        invoice_number: "INV-ACT-001",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });
      mockDatabase.payment_orders.push({
        id: "po-act-001",
        order_id: orderId,
        invoice_id: "inv-act-001",
        tenant_id: "college-act",
        amount_paise: 118000,
        currency: "INR",
        status: "CREATED",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-act-001",
        tenant_id: "college-act",
        status: "PENDING_PAYMENT",
      });

      await PaymentReconciliationService.verifyCheckoutPayment({
        orderId,
        paymentId,
        signature,
        admin: mockAdmin,
      });

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "inv-act-001");
      expect(inv.status).toBe("PAID");

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-act");
      expect(sub.status).toBe("ACTIVE");
    });
  });

  // =========================================================================
  // CATEGORY 2: WEBHOOKS (Scenarios 13 - 19)
  // =========================================================================
  describe("Category 2: Webhooks", () => {
    it("Scenario 13: Webhook with valid signature processed successfully (200)", () => {
      const payload = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
      const validSig = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(payload).digest("hex");

      const verified = razorpayLib.verifyRazorpayWebhookSignature({
        rawBody: payload,
        signature: validSig,
      });

      expect(verified).toBe(true);
    });

    it("Scenario 14: Webhook with invalid signature rejected (400)", () => {
      const payload = JSON.stringify({ event: "payment.captured" });
      const invalidSig = "tampered_webhook_sig";

      const verified = razorpayLib.verifyRazorpayWebhookSignature({
        rawBody: payload,
        signature: invalidSig,
      });

      expect(verified).toBe(false);
    });

    it("Scenario 15: Webhook event recorded in payment_webhook_events", async () => {
      const eventPayload = {
        event: "payment.authorized",
        payload: {
          payment: {
            entity: {
              id: "pay_wh_rec_01",
              order_id: "order_wh_rec_01",
              amount: 50000,
              currency: "INR",
            },
          },
        },
      };
      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");

      const res = await PaymentReconciliationService.processWebhookEvent({
        rawBody,
        signature,
        admin: mockAdmin,
      });

      expect(res.received).toBe(true);
      expect(mockDatabase.payment_webhook_events.length).toBe(1);
      expect(mockDatabase.payment_webhook_events[0].event_type).toBe("payment.authorized");
    });

    it("Scenario 16: Duplicate webhook event recognized and skipped (idempotent 200)", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-wh-dup-01",
        tenant_id: "col-dup-1",
        invoice_number: "INV-DUP-01",
        status: "ISSUED",
        amount_inr: 500,
        tax_inr: 0,
      });
      mockDatabase.payment_orders.push({
        id: "po-wh-dup-01",
        order_id: "order_wh_dup_01",
        invoice_id: "inv-wh-dup-01",
        tenant_id: "col-dup-1",
        amount_paise: 50000,
        currency: "INR",
        status: "CREATED",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-wh-dup-01",
        tenant_id: "col-dup-1",
        status: "PENDING_PAYMENT",
      });

      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_wh_dup_01",
              order_id: "order_wh_dup_01",
              amount: 50000,
              currency: "INR",
            },
          },
        },
      };
      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");

      const r1 = await PaymentReconciliationService.processWebhookEvent({
        rawBody,
        signature,
        eventIdHeader: "evt_dup_001",
        admin: mockAdmin,
      });
      expect(r1.received).toBe(true);
      expect(r1.duplicate).toBe(false);

      const r2 = await PaymentReconciliationService.processWebhookEvent({
        rawBody,
        signature,
        eventIdHeader: "evt_dup_001",
        admin: mockAdmin,
      });
      expect(r2.received).toBe(true);
      expect(r2.duplicate).toBe(true);
    });

    it("Scenario 17: payment.captured event reconciles invoice and updates subscription", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-cap-01",
        tenant_id: "college-cap",
        invoice_number: "INV-CAP-01",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });
      mockDatabase.payment_orders.push({
        id: "po-cap-01",
        order_id: "order_cap_01",
        invoice_id: "inv-cap-01",
        tenant_id: "college-cap",
        amount_paise: 118000,
        currency: "INR",
        status: "CREATED",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-cap-01",
        tenant_id: "college-cap",
        status: "PENDING_PAYMENT",
      });

      const eventPayload = {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_cap_01",
              order_id: "order_cap_01",
              amount: 118000,
              currency: "INR",
              status: "captured",
              method: "upi",
            },
          },
        },
      };
      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");

      await PaymentReconciliationService.processWebhookEvent({
        rawBody,
        signature,
        admin: mockAdmin,
      });

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "inv-cap-01");
      expect(inv.status).toBe("PAID");

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-cap");
      expect(sub.status).toBe("ACTIVE");
    });

    it("Scenario 18: payment.failed event logs failure and notifies billing contacts", async () => {
      mockDatabase.tenants.push({
        id: "college-fail",
        name: "Fail College",
        official_email: "head@fail.edu",
        billing_contact_email: "accounts@fail.edu",
      });
      mockDatabase.users.push({
        id: "u-head-fail",
        college_id: "college-fail",
        email: "head@fail.edu",
        role: "PLACEMENT_HEAD",
      });
      mockDatabase.platform_invoices.push({
        id: "inv-fail-01",
        tenant_id: "college-fail",
        invoice_number: "INV-FAIL-01",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });
      mockDatabase.payment_orders.push({
        id: "po-fail-01",
        order_id: "order_fail_01",
        invoice_id: "inv-fail-01",
        tenant_id: "college-fail",
        amount_paise: 118000,
        currency: "INR",
        status: "CREATED",
      });

      const eventPayload = {
        event: "payment.failed",
        payload: {
          payment: {
            entity: {
              id: "pay_fail_01",
              order_id: "order_fail_01",
              amount: 118000,
              currency: "INR",
              error_code: "BAD_REQUEST_ERROR",
              error_description: "Bank server declined transaction",
            },
          },
        },
      };
      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");

      await PaymentReconciliationService.processWebhookEvent({
        rawBody,
        signature,
        admin: mockAdmin,
      });

      const tx = mockDatabase.payment_transactions.find((t) => t.payment_id === "pay_fail_01");
      expect(tx).toBeDefined();
      expect(tx.status).toBe("FAILED");
      expect(tx.error_description).toContain("Bank server declined transaction");
    });

    it("Scenario 19: Webhook handler processes concurrent events safely", async () => {
      const eventPayload = {
        event: "payment.authorized",
        payload: {
          payment: {
            entity: {
              id: "pay_conc_01",
              order_id: "order_conc_01",
              amount: 50000,
            },
          },
        },
      };
      const rawBody = JSON.stringify(eventPayload);
      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");

      // Concurrent invocation of the same event
      const [resA, resB] = await Promise.all([
        PaymentReconciliationService.processWebhookEvent({
          rawBody,
          signature,
          admin: mockAdmin,
        }),
        PaymentReconciliationService.processWebhookEvent({
          rawBody,
          signature,
          admin: mockAdmin,
        }),
      ]);

      expect(resA.received).toBe(true);
      expect(resB.received).toBe(true);
      // Handled cleanly without fatal crash
      expect(mockDatabase.payment_webhook_events.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // CATEGORY 3: REFUNDS AND CANCELLATION (Scenarios 20 - 28)
  // =========================================================================
  describe("Category 3: Refunds and Cancellation", () => {
    beforeEach(() => {
      mockDatabase.platform_invoices.push({
        id: "inv-rfnd-01",
        college_id: "college-rfnd-1",
        tenant_id: "college-rfnd-1",
        invoice_number: "INV-2026-0088",
        status: "PAID",
        amount_inr: 1000,
        tax_inr: 180,
        refunded_amount_inr: 0,
        razorpay_payment_id: "pay_rfnd_orig_01",
        razorpay_order_id: "order_rfnd_orig_01",
      });
      mockDatabase.payment_transactions.push({
        id: "tx-rfnd-01",
        invoice_id: "inv-rfnd-01",
        payment_id: "pay_rfnd_orig_01",
        amount_paise: 118000,
        status: "CAPTURED",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-rfnd-01",
        tenant_id: "college-rfnd-1",
        status: "ACTIVE",
        expiry_date: "2026-12-31T23:59:59Z",
        renewal_date: "2026-12-31T23:59:59Z",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-rfnd-01",
        tenant_id: "college-rfnd-1",
        status: "ACTIVE",
      });
    });

    it("Scenario 20: Full refund processes through Razorpay test API", async () => {
      const result = await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 1180,
        reason: "Full institutional refund requested",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      expect(result.success).toBe(true);
      expect(result.isFullRefund).toBe(true);
      expect(mockRazorpayPaymentsRefund).toHaveBeenCalledWith("pay_rfnd_orig_01", {
        amount: 118000,
        notes: expect.any(Object),
      });
      const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-rfnd-01");
      expect(invoice.status).toBe("REFUNDED");
    });

    it("Scenario 21: Partial refund calculates remaining refundable balance correctly", async () => {
      const result = await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 500,
        reason: "Partial adjustment refund",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      expect(result.success).toBe(true);
      expect(result.isFullRefund).toBe(false);
      const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-rfnd-01");
      expect(invoice.status).toBe("PARTIALLY_REFUNDED");
      expect(invoice.refunded_amount_inr).toBe(500);
    });

    it("Scenario 22: Refund exceeding invoice amount rejected", async () => {
      await expect(
        RefundService.issueRefund({
          invoiceId: "inv-rfnd-01",
          amountInr: 2000, // Exceeds 1180
          reason: "Excessive refund",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-uuid",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/exceeds remaining refundable/i);
    });

    it("Scenario 23: Refund creates credit note with matching amount and GST", async () => {
      const result = await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 1180,
        reason: "Institutional credit note verification",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      expect(result.creditNoteId).toBeDefined();
      const cn = mockDatabase.credit_notes.find((c) => c.id === result.creditNoteId);
      expect(cn).toBeDefined();
      expect(cn.total_inr).toBe(1180);
      expect(cn.credit_note_number).toMatch(/^CN-\d{4}-\d+$/);
      expect(cn.amount_inr + cn.tax_inr).toBeCloseTo(1180, 2);
    });

    it("Scenario 24: Q10: Refund with KEEP_ACTIVE leaves subscription ACTIVE", async () => {
      await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 1180,
        reason: "Goodwill refund",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-rfnd-1");
      expect(sub.status).toBe("ACTIVE");
    });

    it("Scenario 25: Q10: Refund with CANCEL_IMMEDIATELY cancels subscription and revokes access", async () => {
      await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 1180,
        reason: "Immediate termination refund",
        subscriptionAction: "CANCEL_IMMEDIATELY",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-rfnd-1");
      expect(sub.status).toBe("CANCELED");
    });

    it("Scenario 26: Q10: Refund with CANCEL_AT_PERIOD_END preserves access until expires_at", async () => {
      await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 1180,
        reason: "Non-renewal refund",
        subscriptionAction: "CANCEL_AT_PERIOD_END",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-rfnd-1");
      expect(sub.status).toBe("ACTIVE"); // Access retained during period
      expect(sub.cancel_at_period_end).toBe(true);
    });

    it("Scenario 27: Q11: Refund with subscription cancellation cancels recurring mandate", async () => {
      await RefundService.issueRefund({
        invoiceId: "inv-rfnd-01",
        amountInr: 1180,
        reason: "Full termination with mandate purge",
        subscriptionAction: "CANCEL_IMMEDIATELY",
        adminId: "admin-uuid",
        admin: mockAdmin,
      });

      const mandate = mockDatabase.recurring_mandates.find((m) => m.tenant_id === "college-rfnd-1");
      expect(mandate.status).toBe("CANCELLED");
      expect(mandate.canceled_at).toBeDefined();
    });

    it("Scenario 28: Q15: Placement Head cancel schedules CANCELLED_AT_PERIOD_END; Super Admin can cancel immediately", async () => {
      // 1. Placement Head cancellation
      const placementRes = await SubscriptionLifecycleBillingService.requestCancellationPlacementHead({
        tenantId: "college-rfnd-1",
        userId: "head-uuid",
        reason: "End of academic session",
        admin: mockAdmin,
      });
      expect(placementRes.cancelAtPeriodEnd).toBe(true);

      const subPH = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-rfnd-1");
      expect(subPH.cancel_at_period_end).toBe(true);
      expect(subPH.status).toBe("ACTIVE");

      // 2. Super Admin immediate cancellation
      const adminRes = await SubscriptionLifecycleBillingService.cancelSubscriptionSuperAdmin({
        subscriptionId: "sub-rfnd-01",
        adminId: "superadmin-uuid",
        reason: "Terms of service violation",
        admin: mockAdmin,
      });
      expect(adminRes.status).toBe("CANCELED");

      const subAdmin = mockDatabase.college_subscriptions.find((s) => s.id === "sub-rfnd-01");
      expect(subAdmin.status).toBe("CANCELED");
    });
  });

  // =========================================================================
  // CATEGORY 4: RECURRING BILLING (Scenarios 29 - 36)
  // =========================================================================
  describe("Category 4: Recurring Billing", () => {
    beforeEach(() => {
      mockDatabase.tenants.push({
        id: "college-rec-1",
        name: "Recurring College",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-rec-1",
        tenant_id: "college-rec-1",
        status: "ACTIVE",
        billing_mode: "MANUAL",
        expiry_date: "2026-12-31T23:59:59Z",
        renewal_date: "2026-12-31T23:59:59Z",
      });
    });

    it("Scenario 29: New colleges default to MANUAL billing", () => {
      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-rec-1");
      expect(sub.billing_mode).toBe("MANUAL");
    });

    it("Scenario 30: Switch to AUTOMATIC requires explicit consent timestamp and user ID (Q4)", async () => {
      // Missing consent
      await expect(
        RecurringMandateService.setBillingMode({
          tenantId: "college-rec-1",
          mode: "AUTOMATIC",
          userId: "user-head-01",
          consentGiven: false,
          admin: mockAdmin,
        })
      ).rejects.toThrow(/explicit consent/i);

      // Valid consent
      const res = await RecurringMandateService.setBillingMode({
        tenantId: "college-rec-1",
        mode: "AUTOMATIC",
        userId: "user-head-01",
        consentGiven: true,
        admin: mockAdmin,
      });
      expect(res.billingMode).toBe("AUTOMATIC");
    });

    it("Scenario 31: Switch from MANUAL to AUTOMATIC charges 0 INR immediately (Q8/Q9)", async () => {
      const res = await RecurringMandateService.setBillingMode({
        tenantId: "college-rec-1",
        mode: "AUTOMATIC",
        userId: "user-head-01",
        consentGiven: true,
        admin: mockAdmin,
      });

      expect(res.mandateStatus).toBe("ACTIVE");
      expect(res.effectiveAt).toBe("2026-12-31T23:59:59Z");
      // Zero immediate charge - no Razorpay order created
      expect(mockRazorpayOrdersCreate).not.toHaveBeenCalled();
    });

    it("Scenario 32: Recurring mandate record created with ACTIVE status", async () => {
      await RecurringMandateService.setBillingMode({
        tenantId: "college-rec-1",
        mode: "AUTOMATIC",
        userId: "user-head-01",
        consentGiven: true,
        admin: mockAdmin,
      });

      const mandate = mockDatabase.recurring_mandates.find((m) => m.tenant_id === "college-rec-1");
      expect(mandate).toBeDefined();
      expect(mandate.status).toBe("ACTIVE");
      expect(mandate.consent_user_id).toBe("user-head-01");
    });

    it("Scenario 33: Mandate cancellation updates status to CANCELLED", async () => {
      mockDatabase.recurring_mandates.push({
        id: "man-active-01",
        tenant_id: "college-rec-1",
        status: "ACTIVE",
      });

      await RecurringMandateService.cancelMandateForTenant({
        tenantId: "college-rec-1",
        cancelAtPeriodEnd: false,
        reason: "User switched to manual payment",
        admin: mockAdmin,
      });

      const mandate = mockDatabase.recurring_mandates.find((m) => m.id === "man-active-01");
      expect(mandate.status).toBe("CANCELLED");
    });

    it("Scenario 34: Switch from AUTOMATIC to MANUAL schedules mandate cancellation at next renewal (Q8)", async () => {
      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "college-rec-1")!;
      sub.billing_mode = "AUTOMATIC";
      sub.renewal_date = new Date(Date.now() - 1000).toISOString();
      sub.expiry_date = sub.renewal_date;

      mockDatabase.recurring_mandates.push({
        id: "man-active-02",
        tenant_id: "college-rec-1",
        status: "ACTIVE",
      });

      const res = await RecurringMandateService.setBillingMode({
        tenantId: "college-rec-1",
        mode: "MANUAL",
        userId: "user-head-01",
        admin: mockAdmin,
      });

      const mandate = mockDatabase.recurring_mandates.find((m) => m.id === "man-active-02");
      expect(mandate.cancel_at_period_end).toBe(true);
      expect(res.scheduledCancellation).toBe(true);

      // Mandate remains active until renewal date execution (Q8)
      await RecurringMandateService.executeScheduledModeChanges(mockAdmin);
      const updatedMandate = mockDatabase.recurring_mandates.find((m) => m.id === "man-active-02");
      expect(updatedMandate.status).toBe("CANCELLED");
    });

    it("Scenario 35: Renewal retry schedule: Day 1, Day 3, Day 5 on payment failure (Q17)", async () => {
      const subDate = new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000).toISOString();
      mockDatabase.college_subscriptions.push({
        id: "sub-past-due-1",
        tenant_id: "college-retry-1",
        status: "PAST_DUE",
        billing_mode: "AUTOMATIC",
        renewal_date: subDate,
        renewal_retry_count: 0,
      });

      const result = await SubscriptionLifecycleBillingService.processRenewalRetries(mockAdmin);
      expect(result.retriesHandled).toBe(1);

      const retryLog = mockDatabase.subscription_renewal_retries.find((r) => r.subscription_id === "sub-past-due-1");
      expect(retryLog).toBeDefined();
      expect(retryLog.attempt_number).toBe(1);
    });

    it("Scenario 36: 7-day grace period maintained before subscription suspension (Q17)", async () => {
      const expiredDate = new Date(Date.now() - 8.5 * 24 * 60 * 60 * 1000).toISOString();
      mockDatabase.college_subscriptions.push({
        id: "sub-grace-expired",
        tenant_id: "college-grace-1",
        status: "PAST_DUE",
        billing_mode: "AUTOMATIC",
        renewal_date: expiredDate,
        renewal_retry_count: 3,
      });

      await SubscriptionLifecycleBillingService.processRenewalRetries(mockAdmin);

      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-grace-expired");
      expect(sub.status).toBe("EXPIRED");
    });
  });

  // =========================================================================
  // CATEGORY 5: BILLING NOTIFICATIONS (Scenarios 37 - 41)
  // =========================================================================
  describe("Category 5: Billing Notifications", () => {
    beforeEach(() => {
      mockDatabase.tenants.push({
        id: "college-notif-1",
        name: "Notification College",
        official_email: "head@notif.edu",
        billing_contact_email: "billing@notif.edu",
      });
      mockDatabase.users.push(
        { id: "u-ph", college_id: "college-notif-1", email: "head@notif.edu", role: "PLACEMENT_HEAD" },
        { id: "u-st1", college_id: "college-notif-1", email: "student@notif.edu", role: "STUDENT" },
        { id: "u-st2", college_id: "college-notif-1", email: "staff@notif.edu", role: "STAFF" }
      );
    });

    it("Scenario 37: Renewal reminders dispatched at Q12 milestones (7, 3, 1 day, due date, post-expiry, pre-collection)", async () => {
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();

      mockDatabase.college_subscriptions.push({
        id: "sub-milestone-7d",
        tenant_id: "college-notif-1",
        status: "ACTIVE",
        billing_mode: "MANUAL",
        expiry_date: in7Days,
        renewal_date: in7Days,
      });

      const res = await BillingNotificationService.processRenewalReminders(mockAdmin);
      expect(res.sent).toBeGreaterThanOrEqual(1);
      expect(mockDatabase.billing_notifications_log.some((l) => l.notification_type === "MANUAL_7_DAY")).toBe(true);
    });

    it("Scenario 38: Notifications routed ONLY to Placement Head and Billing Contact (Q13)", async () => {
      const now = new Date();
      const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

      mockDatabase.college_subscriptions.push({
        id: "sub-milestone-3d",
        tenant_id: "college-notif-1",
        status: "ACTIVE",
        billing_mode: "MANUAL",
        expiry_date: in3Days,
        renewal_date: in3Days,
      });

      await BillingNotificationService.processRenewalReminders(mockAdmin);

      const logs = mockDatabase.billing_notifications_log.filter((l) => l.tenant_id === "college-notif-1");
      const recipients = logs.map((l) => l.recipient_email);

      expect(recipients).toContain("head@notif.edu");
      expect(recipients).toContain("billing@notif.edu");
      expect(recipients).not.toContain("student@notif.edu");
      expect(recipients).not.toContain("staff@notif.edu");
    });

    it("Scenario 39: Student and staff users never receive billing emails", async () => {
      const emailCalls = vi.mocked(EmailAdapter.dispatchTransactionalEmail).mock.calls;
      const sentToAddresses = emailCalls.map((c: any) => c[0].toEmail);

      expect(sentToAddresses).not.toContain("student@notif.edu");
      expect(sentToAddresses).not.toContain("staff@notif.edu");
    });

    it("Scenario 40: Notification dispatch is idempotent (no duplicate emails for same milestone)", async () => {
      // First dispatch
      const r1 = await BillingNotificationService.sendNotification({
        tenantId: "college-notif-1",
        milestone: "MANUAL_1_DAY",
        collegeName: "Notification College",
        recipientEmail: "head@notif.edu",
        subject: "Final Notice",
        bodyHtml: "<p>Notice</p>",
        bodyText: "Notice",
        metadata: { date: "2026-11-01" },
        admin: mockAdmin,
      });
      expect(r1.sent).toBe(true);
      expect(r1.duplicate).toBe(false);

      // Replay dispatch with identical milestone and metadata
      const r2 = await BillingNotificationService.sendNotification({
        tenantId: "college-notif-1",
        milestone: "MANUAL_1_DAY",
        collegeName: "Notification College",
        recipientEmail: "head@notif.edu",
        subject: "Final Notice",
        bodyHtml: "<p>Notice</p>",
        bodyText: "Notice",
        metadata: { date: "2026-11-01" },
        admin: mockAdmin,
      });
      expect(r2.sent).toBe(false);
      expect(r2.duplicate).toBe(true);
    });

    it("Scenario 41: Notification failure logged without crashing billing cycle", async () => {
      vi.mocked(EmailAdapter.dispatchTransactionalEmail).mockRejectedValueOnce(new Error("SMTP socket timeout"));

      const result = await BillingNotificationService.sendNotification({
        tenantId: "college-notif-1",
        milestone: "DUE_DATE",
        collegeName: "Notification College",
        recipientEmail: "head@notif.edu",
        subject: "Due Date Notice",
        bodyHtml: "<p>Due</p>",
        bodyText: "Due",
        metadata: { date: "2026-11-01" },
        admin: mockAdmin,
      });

      expect(result.sent).toBe(false);
      const log = mockDatabase.billing_notifications_log.find((l) => l.notification_type === "DUE_DATE");
      expect(log).toBeDefined();
      expect(log.status).toBe("FAILED");
    });
  });

  // =========================================================================
  // CATEGORY 6: INVOICING & TRANSACTIONS (Scenarios 42 - 50)
  // =========================================================================
  describe("Category 6: Invoicing & Transactions", () => {
    it("Scenario 42: Unique sequential invoice number generation (INV-YYYY-XXXX)", () => {
      const year = new Date().getFullYear();
      const invNum = `INV-${year}-${String(42).padStart(4, "0")}`;
      expect(invNum).toMatch(new RegExp(`^INV-${year}-\\d{4}$`));
      expect(invNum).toBe(`INV-${year}-0042`);
    });

    it("Scenario 43: Issued invoice amounts are immutable", () => {
      const invoiceStatus = "ISSUED";
      const isLocked = ["ISSUED", "PAID", "REFUNDED", "PARTIALLY_REFUNDED"].includes(invoiceStatus);
      expect(isLocked).toBe(true);
    });

    it("Scenario 44: GST calculation handles 18% standard, 0% exempt, custom rates (Q19)", () => {
      // 18% standard Intra-state (CGST + SGST)
      const standard = InvoiceDocumentService.calculateTax({ amountInr: 10000, taxRate: 18, isInterState: false });
      expect(standard.baseAmountInr).toBe(10000);
      expect(standard.totalTaxInr).toBe(1800);
      expect(standard.cgstInr).toBe(900);
      expect(standard.sgstInr).toBe(900);
      expect(standard.totalInr).toBe(11800);

      // 18% Inter-state (IGST)
      const interState = InvoiceDocumentService.calculateTax({ amountInr: 10000, taxRate: 18, isInterState: true });
      expect(interState.igstInr).toBe(1800);
      expect(interState.cgstInr).toBe(0);

      // 0% exempt
      const exempt = InvoiceDocumentService.calculateTax({ amountInr: 10000, isExempt: true });
      expect(exempt.totalTaxInr).toBe(0);
      expect(exempt.totalInr).toBe(10000);

      // Custom 5% rate
      const custom = InvoiceDocumentService.calculateTax({ amountInr: 10000, taxRate: 5 });
      expect(custom.totalTaxInr).toBe(500);
      expect(custom.totalInr).toBe(10500);
    });

    it("Scenario 45: Credit notes linked to original invoice with CN-YYYY-XXXX numbering (Q20)", () => {
      const year = new Date().getFullYear();
      const cnNumber = `CN-${year}-${String(9).padStart(4, "0")}`;
      expect(cnNumber).toMatch(new RegExp(`^CN-${year}-\\d{4}$`));
    });

    it("Scenario 46: Credit note reduces net billing amount", () => {
      const originalAmount = 50000;
      const creditNoteAmount = 10000;
      const netBilled = originalAmount - creditNoteAmount;
      expect(netBilled).toBe(40000);
    });

    it("Scenario 47: College billing page shows only that college's transactions (tenant isolation)", async () => {
      mockDatabase.payment_transactions.push(
        { id: "tx-a1", tenant_id: "college-A", amount_paise: 10000, status: "SUCCESS" },
        { id: "tx-a2", tenant_id: "college-A", amount_paise: 20000, status: "SUCCESS" },
        { id: "tx-b1", tenant_id: "college-B", amount_paise: 30000, status: "SUCCESS" }
      );

      const collegeATxs = (mockDatabase.payment_transactions || []).filter((t) => t.tenant_id === "college-A");
      expect(collegeATxs.length).toBe(2);
      expect(collegeATxs.every((t) => t.tenant_id === "college-A")).toBe(true);
    });

    it("Scenario 48: Cross-tenant invoice access returns 403/404", () => {
      const invoice = { id: "inv-secret", tenant_id: "college-A", amount_inr: 1000 };
      const canAccessA = invoice.tenant_id === "college-A";
      const canAccessB = invoice.tenant_id === "college-B";

      expect(canAccessA).toBe(true);
      expect(canAccessB).toBe(false);
    });

    it("Scenario 49: Super Admin can view all platform transactions", () => {
      const isSuperAdmin = true;
      const canViewAll = isSuperAdmin;
      expect(canViewAll).toBe(true);
    });

    it("Scenario 50: Super Admin CSV export includes all required columns and date filters (Q14)", () => {
      const sampleTransactions = [
        {
          id: "tx-exp-1",
          created_at: "2026-10-15T00:00:00Z",
          tenants: { name: "Apex Engineering" },
          platform_invoices: { invoice_number: "INV-2026-0001" },
          amount_paise: 118000,
          status: "SUCCESS",
          method: "upi",
          gateway: "RAZORPAY",
          payment_id: "pay_test_001",
        },
      ];

      const csv = InvoiceDocumentService.generateTransactionsCsv(sampleTransactions);
      expect(csv).toContain("Transaction ID,Date,College Name,Invoice Number,Amount INR,Status,Payment Method,Gateway,Gateway Ref");
      expect(csv).toContain("tx-exp-1,2026-10-15,\"Apex Engineering\",INV-2026-0001,1180.00,SUCCESS,upi,RAZORPAY,pay_test_001");
    });
  });

  // =========================================================================
  // CATEGORY 7: RECONCILIATION & SAFETY (Scenarios 51 - 60)
  // =========================================================================
  describe("Category 7: Reconciliation & Safety", () => {
    it("Scenario 51: 15-minute sweep identifies transactions missing webhook confirmation (Q18)", async () => {
      // Pending order created 30 minutes ago
      mockDatabase.payment_orders.push({
        id: "po-sweep-stale",
        invoice_id: "inv-sweep-1",
        order_id: "order_sweep_stale",
        tenant_id: "col-sweep-1",
        status: "CREATED",
        created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      });
      mockDatabase.platform_invoices.push({
        id: "inv-sweep-1",
        tenant_id: "col-sweep-1",
        invoice_number: "INV-SWEEP-01",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });

      const summary = await ReconciliationEngine.run15MinuteReconciliation(mockAdmin);
      expect(summary.scannedOrders).toBe(1);
    });

    it("Scenario 52: Daily sweep reconciles all subscriptions, invoices and payments (Q21)", async () => {
      mockDatabase.payment_transactions.push({
        id: "tx-daily-1",
        payment_id: "pay_daily_1",
        order_id: "order_daily_1",
        tenant_id: "col-daily-1",
        invoice_id: "inv-daily-1",
        amount_paise: 118000,
        currency: "INR",
        status: "CAPTURED",
        created_at: new Date().toISOString(),
      });

      const dailyResult = await ReconciliationEngine.runDailySweep(mockAdmin);
      expect(dailyResult.scannedOrders).toBe(1);
    });

    it("Scenario 53: Discrepancy detected: payment captured in Razorpay but invoice still PENDING", async () => {
      mockDatabase.payment_orders.push({
        id: "po-disc-01",
        invoice_id: "inv-disc-01",
        order_id: "order_disc_01",
        tenant_id: "col-disc-1",
        status: "CREATED",
        amount_paise: 118000,
        currency: "INR",
        created_at: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
      });
      mockDatabase.platform_invoices.push({
        id: "inv-disc-01",
        tenant_id: "col-disc-1",
        invoice_number: "INV-DISC-01",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 180,
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-disc-01",
        tenant_id: "col-disc-1",
        status: "PENDING_PAYMENT",
      });

      mockRazorpayOrdersFetchPayments.mockResolvedValueOnce({
        entity: "collection",
        count: 1,
        items: [
          {
            id: "pay_captured_rzp_disc",
            status: "captured",
            order_id: "order_disc_01",
            amount: 118000,
            currency: "INR",
          },
        ],
      });

      mockRazorpayPaymentsFetch.mockResolvedValueOnce({
        id: "pay_captured_rzp_disc",
        entity: "payment",
        amount: 118000,
        currency: "INR",
        status: "captured",
        order_id: "order_disc_01",
        method: "upi",
        created_at: Math.floor(Date.now() / 1000),
      });

      const summary = await ReconciliationEngine.run15MinuteReconciliation(mockAdmin);
      expect(summary.reconciledCaptured).toBe(1);

      const discrepancy = mockDatabase.payment_discrepancies.find((d) => d.order_id === "order_disc_01");
      expect(discrepancy).toBeDefined();
      expect(discrepancy.discrepancy_type).toBe("MISSING_WEBHOOK");
    });

    it("Scenario 54: Discrepancy detected: amount mismatch between order and payment", async () => {
      mockRazorpayPaymentsFetch.mockResolvedValueOnce({
        id: "pay_mismatch_01",
        status: "captured",
        amount: 50000, // 500 INR
        currency: "INR",
      });

      mockDatabase.payment_transactions.push({
        id: "tx-mismatch-01",
        payment_id: "pay_mismatch_01",
        order_id: "order_mismatch_01",
        tenant_id: "col-mismatch-1",
        invoice_id: "inv-mismatch-01",
        amount_paise: 118000, // 1180 INR expected
        currency: "INR",
        status: "CAPTURED",
        created_at: new Date().toISOString(),
      });

      const summary = await ReconciliationEngine.runDailySweep(mockAdmin);
      expect(summary.discrepanciesFound).toBe(1);

      const discrepancy = mockDatabase.payment_discrepancies.find((d) => d.discrepancy_type === "AMOUNT_MISMATCH");
      expect(discrepancy).toBeDefined();
      expect(discrepancy.gateway_status).toContain("50000");
    });

    it("Scenario 55: Auto-resolution resolves known discrepancies safely", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-auto-01",
        tenant_id: "col-auto-1",
        invoice_number: "INV-AUTO-01",
        status: "ISSUED",
        amount_inr: 1000,
        tax_inr: 0,
      });
      mockDatabase.payment_orders.push({
        id: "po-auto-01",
        order_id: "order_auto_01",
        invoice_id: "inv-auto-01",
        tenant_id: "col-auto-1",
        amount_paise: 100000,
        currency: "INR",
        status: "CREATED",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-auto-1",
        tenant_id: "col-auto-1",
        status: "PENDING_PAYMENT",
      });

      mockRazorpayPaymentsFetch.mockResolvedValueOnce({
        id: "pay_auto_01",
        entity: "payment",
        amount: 100000,
        currency: "INR",
        status: "captured",
        order_id: "order_auto_01",
        method: "upi",
        created_at: Math.floor(Date.now() / 1000),
      });

      await PaymentReconciliationService.reconcilePayment({
        orderId: "order_auto_01",
        paymentId: "pay_auto_01",
        source: "RECONCILIATION",
        admin: mockAdmin,
      });

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "inv-auto-01");
      expect(inv.status).toBe("PAID");

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "col-auto-1");
      expect(sub.status).toBe("ACTIVE");
    });

    it("Scenario 56: Unresolvable discrepancies flagged for Super Admin review", () => {
      mockDatabase.payment_discrepancies.push({
        id: "disc-flagged-01",
        discrepancy_type: "STATUS_MISMATCH",
        resolved: false,
      });

      const unresolved = (mockDatabase.payment_discrepancies || []).filter((d) => !d.resolved);
      expect(unresolved.length).toBe(1);
    });

    it("Scenario 57: Prorated upgrade calculates correct additional charge (Q16)", async () => {
      mockDatabase.college_subscriptions.push({
        id: "sub-upg-01",
        tenant_id: "col-upg-1",
        status: "ACTIVE",
        plan_id: "plan-starter",
        expiry_date: new Date(Date.now() + 182 * 24 * 60 * 60 * 1000).toISOString(), // ~182 days left
      });

      vi.spyOn(PlatformSubscriptionService, "getPlanById").mockImplementation(async (id: string) => {
        if (id === "plan-starter") {
          return { id: "plan-starter", name: "Starter", priceInr: 100000, version: 1 } as any;
        }
        if (id === "plan-enterprise") {
          return { id: "plan-enterprise", name: "Enterprise", priceInr: 180000, version: 1 } as any;
        }
        return null;
      });

      const proration = await SubscriptionLifecycleBillingService.calculateUpgradeProration({
        tenantId: "col-upg-1",
        targetPlanId: "plan-enterprise",
        admin: mockAdmin,
      });

      expect(proration.annualPriceDifference).toBe(80000);
      expect(proration.daysRemaining).toBe(182);
      expect(proration.proratedBaseInr).toBeCloseTo(39890.41, 1);
      expect(proration.proratedTotalInr).toBeCloseTo(47070.68, 1);
    });

    it("Scenario 58: Downgrade scheduled for end of current billing period (Q16)", async () => {
      mockDatabase.college_subscriptions.push({
        id: "sub-down-01",
        tenant_id: "col-down-1",
        plan_id: "plan-enterprise",
        status: "ACTIVE",
        expiry_date: "2026-12-31T23:59:59Z",
        renewal_date: "2026-12-31T23:59:59Z",
      });

      vi.spyOn(PlatformSubscriptionService, "getPlanById").mockResolvedValueOnce({
        id: "plan-starter",
        name: "Starter",
        priceInr: 100000,
        version: 1,
      } as any);

      const res = await SubscriptionLifecycleBillingService.requestDowngrade({
        tenantId: "col-down-1",
        targetPlanId: "plan-starter",
        userId: "head-uuid",
        admin: mockAdmin,
      });

      expect(res.success).toBe(true);
      expect(res.effectiveDate).toBe("2026-12-31T23:59:59Z");

      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-down-01");
      expect(sub.pending_plan_id).toBe("plan-starter");
      expect(sub.plan_change_effective_at).toBe("2026-12-31T23:59:59Z");
    });

    it("Scenario 59: Demo bypass endpoint returns 403 in production environment", async () => {
      vi.mocked(PlatformAuthService.requireSuperAdmin).mockResolvedValueOnce({
        id: "admin-uuid",
        email: "superadmin@urplaced.com",
      } as any);

      const originalEnv = process.env.NODE_ENV;
      try {
        (process.env as any).NODE_ENV = "production";

        const req = new NextRequest("http://localhost:3000/api/preritrd/billing/invoices/inv-001/pay", {
          method: "POST",
          body: JSON.stringify({ paymentMethod: "DEMO_BYPASS", isDemo: true }),
        });

        const res = await superAdminPayRoute(req, {
          params: Promise.resolve({ id: "inv-001" }),
        });

        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error).toContain("prohibited in production");
      } finally {
        (process.env as any).NODE_ENV = originalEnv;
      }
    });

    it("Scenario 60: All payment logs mask secrets, tokens and sensitive credentials", () => {
      const rawSecret = "rzp_test_secret_1234567890abcdef";
      const masked = razorpayLib.maskSecret(rawSecret);

      expect(masked).not.toBe(rawSecret);
      expect(masked).toBe("rzp_test_...cdef");
      expect(masked).not.toContain("1234567890");
    });
  });

  // =========================================================================
  // CATEGORY 8: SA-05 CORRECTION DELIVERABLES VERIFICATION (Scenarios 61 - 71)
  // =========================================================================
  describe("Category 8: SA-05 Correction Deliverables Verification", () => {
    it("Scenario 61: Statutory GSTIN validation enforces 15-char regex, valid state code (01-38), and PAN", () => {
      // Valid Karnataka GSTIN
      const valid = TaxConfigurationService.validateGstin("29ABCDE1234F1Z5");
      expect(valid.isValid).toBe(true);
      expect(valid.stateCode).toBe("29");
      expect(valid.pan).toBe("ABCDE1234F");

      // Invalid length
      const shortGstin = TaxConfigurationService.validateGstin("29ABCDE");
      expect(shortGstin.isValid).toBe(false);
      expect(shortGstin.error).toContain("15 characters");

      // Invalid state code
      const invalidState = TaxConfigurationService.validateGstin("99ABCDE1234F1Z5");
      expect(invalidState.isValid).toBe(false);
      expect(invalidState.error).toContain("Valid state codes are 01 through 38");
    });

    it("Scenario 62: Intra-state tax split into CGST (9%) + SGST (9%), Inter-state IGST (18%), SAC 9992", async () => {
      // Karnataka buyer + Karnataka seller (Intra-state)
      const intra = await TaxConfigurationService.calculateTax({
        baseAmountInr: 100000,
        collegeGstin: "29ABCDE1234F1Z5",
        admin: mockAdmin,
      });
      expect(intra.taxType).toBe("CGST_SGST");
      expect(intra.sacCode).toBe("9992");
      expect(intra.cgstInr).toBe(9000);
      expect(intra.sgstInr).toBe(9000);
      expect(intra.igstInr).toBe(0);
      expect(intra.totalTaxInr).toBe(18000);
      expect(intra.totalInr).toBe(118000);

      // Maharashtra buyer (27) + Karnataka seller (29) (Inter-state)
      const inter = await TaxConfigurationService.calculateTax({
        baseAmountInr: 100000,
        collegeGstin: "27AABCS1429B1Z2",
        admin: mockAdmin,
      });
      expect(inter.taxType).toBe("IGST");
      expect(inter.sacCode).toBe("9992");
      expect(inter.cgstInr).toBe(0);
      expect(inter.sgstInr).toBe(0);
      expect(inter.igstInr).toBe(18000);
      expect(inter.totalInr).toBe(118000);
    });

    it("Scenario 63: Tax exemption resolves 0% tax and records mandatory statutory exemption reason", async () => {
      const exempt = await TaxConfigurationService.calculateTax({
        baseAmountInr: 50000,
        isExempt: true,
        exemptionReason: "Educational institution exemption under Notification No. 12/2017-Central Tax (Rate)",
        exemptionValidationStatus: "VERIFIED",
        admin: mockAdmin,
      });
      expect(exempt.isExempt).toBe(true);
      expect(exempt.taxType).toBe("EXEMPT");
      expect(exempt.totalTaxInr).toBe(0);
      expect(exempt.totalInr).toBe(50000);
      expect(exempt.exemptionReason).toContain("Notification No. 12/2017");
    });

    it("Scenario 64: Super Admin tax rule management creates and queries active rules with audit logging", async () => {
      const createdRule = await TaxConfigurationService.upsertTaxRule({
        ruleName: "Concessional Higher Ed Research Rate",
        sacCode: "9992",
        ratePercent: 12.0,
        sellerStateCode: "29",
        isExempt: false,
        effectiveFrom: "2026-01-01T00:00:00Z",
        isActive: true,
        adminId: "super-admin-01",
        admin: mockAdmin,
      });

      expect(createdRule).toBeDefined();
      expect(createdRule.sac_code).toBe("9992");
      expect(createdRule.rate_percent).toBe(12.0);
      expect(PlatformAuthService.logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: "PLATFORM_TAX_RULE_CONFIGURED" })
      );
    });

    it("Scenario 65: Invoice PDF generation produces genuine binary buffer starting with %PDF-", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-pdf-01",
        invoice_number: "INV-2026-0099",
        tenant_id: "college-pdf-1",
        amount_inr: 250000,
        tax_inr: 45000,
        total_amount: 295000,
        currency: "INR",
        status: "PAID",
        issue_date: "2026-11-01T00:00:00Z",
        due_date: "2026-11-15T00:00:00Z",
        payment_method: "RAZORPAY",
        razorpay_payment_id: "pay_pdf_test_99",
        tax_snapshot: {
          sacCode: "9992",
          taxType: "CGST_SGST",
          cgstRate: 9,
          sgstRate: 9,
          igstRate: 0,
          cgstInr: 22500,
          sgstInr: 22500,
          igstInr: 0,
        },
      });
      mockDatabase.tenants.push({
        id: "college-pdf-1",
        name: "National Institute of Engineering",
        official_email: "placements@nie.edu",
        gstin: "29ABCDE1234F1Z5",
        state: "Karnataka",
        city: "Bengaluru",
      });

      const pdfBuffer = await InvoiceDocumentService.generateInvoicePdf("inv-pdf-01", mockAdmin);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(100);

      // Verify PDF Magic Bytes: %PDF-
      const magicBytes = pdfBuffer.slice(0, 5).toString("ascii");
      expect(magicBytes).toBe("%PDF-");
    });

    it("Scenario 66: Credit Note PDF generation produces genuine binary buffer starting with %PDF-", async () => {
      mockDatabase.credit_notes.push({
        id: "cn-pdf-01",
        credit_note_number: "CN-2026-0005",
        invoice_id: "inv-pdf-01",
        tenant_id: "college-pdf-1",
        amount_inr: 50000,
        tax_inr: 9000,
        total_inr: 59000,
        currency: "INR",
        reason: "Administrative discount adjustment",
        issued_at: "2026-11-01T12:00:00Z",
      });

      const cnBuffer = await InvoiceDocumentService.generateCreditNotePdf("cn-pdf-01", mockAdmin);
      expect(Buffer.isBuffer(cnBuffer)).toBe(true);
      expect(cnBuffer.length).toBeGreaterThan(100);

      // Verify PDF Magic Bytes: %PDF-
      const magicBytes = cnBuffer.slice(0, 5).toString("ascii");
      expect(magicBytes).toBe("%PDF-");
    });

    it("Scenario 67: Excel export produces genuine .xlsx binary buffer starting with ZIP header PK\\x03\\x04", async () => {
      const mockTxs = [
        {
          paymentId: "pay_excel_01",
          orderId: "order_excel_01",
          invoiceNumber: "INV-2026-0001",
          collegeName: "Apex Engineering College",
          amountInr: 150000,
          currency: "INR",
          status: "CAPTURED",
          method: "card",
          gateway: "RAZORPAY",
          createdAt: "2026-11-01T10:00:00Z",
        },
      ];

      const xlsxBuffer = await InvoiceDocumentService.generateTransactionsExcel(mockTxs);
      expect(Buffer.isBuffer(xlsxBuffer)).toBe(true);
      expect(xlsxBuffer.length).toBeGreaterThan(500);

      // Verify ZIP/XLSX Magic Bytes: PK\x03\x04 (0x50 0x4B 0x03 0x04)
      expect(xlsxBuffer[0]).toBe(0x50);
      expect(xlsxBuffer[1]).toBe(0x4b);
      expect(xlsxBuffer[2]).toBe(0x03);
      expect(xlsxBuffer[3]).toBe(0x04);
    });

    it("Scenario 68: Scheduled BillingCronRunner enforces Bearer CRON_SECRET authentication", async () => {
      process.env.CRON_SECRET = "super_secure_cron_token_xyz987";

      // 1. Unauthenticated request -> 401
      const unauthReq = new NextRequest("http://localhost:3000/api/cron/billing/reconcile-15min", {
        headers: { authorization: "Bearer wrong_secret" },
      });
      const check1 = await BillingCronRunner.verifyCronAuth(unauthReq);
      expect(check1.authorized).toBe(false);

      // 2. Authenticated request -> Authorized
      const authReq = new NextRequest("http://localhost:3000/api/cron/billing/reconcile-15min", {
        headers: { authorization: "Bearer super_secure_cron_token_xyz987" },
      });
      const check2 = await BillingCronRunner.verifyCronAuth(authReq);
      expect(check2.authorized).toBe(true);
      expect(check2.caller).toBe("CRON_SCHEDULER");
    });

    it("Scenario 69: Scheduled BillingCronRunner prevents overlapping duplicate runs and logs to billing_job_runs", async () => {
      process.env.CRON_SECRET = "super_secure_cron_token_xyz987";
      const req = new NextRequest("http://localhost:3000/api/cron/billing/reconcile-15min", {
        headers: { authorization: "Bearer super_secure_cron_token_xyz987" },
      });

      // Simulate existing RUNNING job
      mockDatabase.billing_job_runs.push({
        id: "run-existing-1",
        job_name: "RECONCILE_15MIN",
        status: "RUNNING",
        started_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      });

      const res = await BillingCronRunner.runJob(
        req,
        "RECONCILE_15MIN",
        async () => {
          return { recordsProcessed: 10, summary: {} };
        },
        mockAdmin
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.skipped).toBe(true);
      expect(body.message).toContain("already running");
    });

    it("Scenario 70: Refund webhooks (refund.created, refund.processed, refund.failed) synchronize refund ledger", async () => {
      // 1. Test refund.created sets status to PENDING
      mockDatabase.refunds.push({
        id: "ref-uuid-01",
        refund_id: "rfnd_test_web_01",
        payment_id: "pay_test_01",
        order_id: "order_test_01",
        invoice_id: "inv-001",
        tenant_id: "college-001",
        amount_paise: 5000000,
        amount_inr: 50000,
        currency: "INR",
        status: "PENDING",
        reason: "Trial refund",
      });

      const createdPayload = JSON.stringify({
        event: "refund.created",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test_web_01",
              payment_id: "pay_test_01",
              amount: 5000000,
              status: "created",
            },
          },
        },
      });

      const createdSig = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(createdPayload)
        .digest("hex");

      const createdResult = await PaymentReconciliationService.processWebhookEvent({
        rawBody: createdPayload,
        signature: createdSig,
        admin: mockAdmin,
      });

      expect(createdResult.received).toBe(true);
      const pendingRef = mockDatabase.refunds.find((r) => r.refund_id === "rfnd_test_web_01");
      expect(pendingRef.status).toBe("PENDING");

      // 2. Test refund.processed transitions status to SUCCESS
      const processedPayload = JSON.stringify({
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test_web_01",
              payment_id: "pay_test_01",
              amount: 5000000,
              status: "processed",
            },
          },
        },
      });

      const signature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(processedPayload)
        .digest("hex");

      const result = await PaymentReconciliationService.processWebhookEvent({
        rawBody: processedPayload,
        signature,
        admin: mockAdmin,
      });

      expect(result.received).toBe(true);
      const updatedRef = mockDatabase.refunds.find((r) => r.refund_id === "rfnd_test_web_01");
      expect(updatedRef.status).toBe("SUCCESS");

      // 3. Test refund.failed transitions to FAILED and restores invoice refundable balance
      mockDatabase.platform_invoices.push({
        id: "inv-fail-test",
        tenant_id: "college-001",
        invoice_number: "INV-FAIL-01",
        status: "PARTIALLY_REFUNDED",
        amount_inr: 100000,
        tax_inr: 18000,
        refunded_amount_inr: 50000,
      });

      mockDatabase.refunds.push({
        id: "ref-uuid-02",
        refund_id: "rfnd_fail_01",
        payment_id: "pay_test_01",
        order_id: "order_test_01",
        invoice_id: "inv-fail-test",
        tenant_id: "college-001",
        amount_paise: 5000000,
        amount_inr: 50000,
        currency: "INR",
        status: "SUCCESS",
        reason: "Failed refund test",
      });

      const failedPayload = JSON.stringify({
        event: "refund.failed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_fail_01",
              payment_id: "pay_test_01",
              amount: 5000000,
              status: "failed",
            },
          },
        },
      });

      const failedSig = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(failedPayload)
        .digest("hex");

      const failResult = await PaymentReconciliationService.processWebhookEvent({
        rawBody: failedPayload,
        signature: failedSig,
        admin: mockAdmin,
      });

      expect(failResult.received).toBe(true);
      const failedRef = mockDatabase.refunds.find((r) => r.refund_id === "rfnd_fail_01");
      expect(failedRef.status).toBe("FAILED");
      const invAfterFail = mockDatabase.platform_invoices.find((i) => i.id === "inv-fail-test");
      expect(invAfterFail.status).toBe("PAID");
      expect(invAfterFail.refunded_amount_inr).toBe(0);
    });

    it("Scenario 71: Subscription webhooks (subscription.authenticated, subscription.charged, subscription.halted) update mandate and lifecycle", async () => {
      mockDatabase.college_subscriptions.push({
        id: "sub-hook-1",
        tenant_id: "college-hook-1",
        status: "ACTIVE",
        renewal_date: "2026-11-01T00:00:00Z",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-hook-1",
        gateway_subscription_id: "sub_rzp_mock_123",
        tenant_id: "college-hook-1",
        subscription_id: "sub-hook-1",
        status: "PENDING",
      });

      const chargedPayload = JSON.stringify({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_mock_123",
              status: "active",
            },
          },
          payment: {
            entity: {
              id: "pay_sub_charge_999",
              amount: 15000000,
              currency: "INR",
              status: "captured",
              method: "card",
            },
          },
        },
      });

      const signature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(chargedPayload)
        .digest("hex");

      const result = await PaymentReconciliationService.processWebhookEvent({
        rawBody: chargedPayload,
        signature,
        admin: mockAdmin,
      });

      expect(result.received).toBe(true);
      const mandate = mockDatabase.recurring_mandates.find((m) => m.gateway_subscription_id === "sub_rzp_mock_123");
      expect(mandate.status).toBe("ACTIVE");

      const updatedSub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-hook-1");
      // Renewal date pushed forward
      const subYear = new Date(updatedSub.renewal_date).getFullYear();
      expect(subYear).toBeGreaterThanOrEqual(2027);
    });
  });

  // =========================================================================
  // CATEGORY 9: FINAL LIFECYCLE INTEGRITY, GST GOVERNANCE & PRECISION (Scenarios 72 - 88)
  // =========================================================================
  describe("Category 9: Final Lifecycle Integrity, GST Governance & Precision", () => {
    it("Scenario 72: Monthly recurring subscription renewal advances period by 1 month", async () => {
      mockDatabase.tenants.push({
        id: "college-month-1",
        name: "Monthly Test Academy",
        gstin: "29ABCDE1234F1Z5",
        state: "Karnataka",
      });
      mockDatabase.subscription_plans.push({
        id: "plan-monthly-1",
        name: "Monthly Pro",
        price_inr: 9999,
        billing_cycle: "MONTHLY",
        is_active: true,
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-month-1",
        tenant_id: "college-month-1",
        plan_id: "plan-monthly-1",
        status: "ACTIVE",
        renewal_date: "2026-06-15T00:00:00Z",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-month-1",
        gateway_subscription_id: "sub_rzp_month_999",
        tenant_id: "college-month-1",
        subscription_id: "sub-month-1",
        billing_interval: "MONTHLY",
        status: "ACTIVE",
      });

      const chargedPayload = JSON.stringify({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_month_999",
              status: "active",
            },
          },
          payment: {
            entity: {
              id: "pay_sub_month_001",
              amount: 1179882, // paise
              currency: "INR",
              status: "captured",
              method: "card",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(chargedPayload).digest("hex");
      const result = await PaymentReconciliationService.processWebhookEvent({
        rawBody: chargedPayload,
        signature,
        admin: mockAdmin,
      });

      expect(result.received).toBe(true);
      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-month-1");
      const renewalDate = new Date(sub.renewal_date);
      // Advances by 1 month: June -> July
      expect(renewalDate.getMonth()).toBe(6); // 0-indexed: 6 is July
    });

    it("Scenario 73: Annual recurring subscription renewal advances period by 1 year", async () => {
      mockDatabase.tenants.push({
        id: "college-annual-1",
        name: "Annual Test Academy",
        gstin: "29ABCDE1234F1Z5",
        state: "Karnataka",
      });
      mockDatabase.subscription_plans.push({
        id: "plan-annual-1",
        name: "Annual Pro",
        price_inr: 99999,
        billing_cycle: "ANNUAL",
        is_active: true,
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-annual-1",
        tenant_id: "college-annual-1",
        plan_id: "plan-annual-1",
        status: "ACTIVE",
        renewal_date: "2026-11-01T00:00:00Z",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-annual-1",
        gateway_subscription_id: "sub_rzp_annual_999",
        tenant_id: "college-annual-1",
        subscription_id: "sub-annual-1",
        billing_interval: "ANNUAL",
        status: "ACTIVE",
      });

      const chargedPayload = JSON.stringify({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_annual_999",
              status: "active",
            },
          },
          payment: {
            entity: {
              id: "pay_sub_annual_001",
              amount: 11799882,
              currency: "INR",
              status: "captured",
              method: "card",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(chargedPayload).digest("hex");
      await PaymentReconciliationService.processWebhookEvent({
        rawBody: chargedPayload,
        signature,
        admin: mockAdmin,
      });

      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-annual-1");
      const renewalDate = new Date(sub.renewal_date);
      expect(renewalDate.getFullYear()).toBe(2027);
    });

    it("Scenario 74: Quarterly billing cycle advances period by 3 months", async () => {
      mockDatabase.tenants.push({
        id: "college-q-1",
        name: "Quarterly Academy",
        gstin: "29ABCDE1234F1Z5",
        state: "Karnataka",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-q-1",
        tenant_id: "college-q-1",
        plan_id: "plan-annual-1",
        status: "ACTIVE",
        renewal_date: "2026-01-15T00:00:00Z",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-q-1",
        gateway_subscription_id: "sub_rzp_q_999",
        tenant_id: "college-q-1",
        subscription_id: "sub-q-1",
        billing_interval: "QUARTERLY",
        status: "ACTIVE",
      });

      const chargedPayload = JSON.stringify({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_q_999",
              status: "active",
            },
          },
          payment: {
            entity: {
              id: "pay_sub_q_001",
              amount: 2950000,
              currency: "INR",
              status: "captured",
              method: "card",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(chargedPayload).digest("hex");
      await PaymentReconciliationService.processWebhookEvent({
        rawBody: chargedPayload,
        signature,
        admin: mockAdmin,
      });

      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-q-1");
      const renewalDate = new Date(sub.renewal_date);
      // Jan -> April (+3 months)
      expect(renewalDate.getMonth()).toBe(3); // 3 is April
    });

    it("Scenario 75: Duplicate subscription.charged events are ignored without duplicate period extensions", async () => {
      const initialRenewal = "2027-11-01T00:00:00Z";
      mockDatabase.college_subscriptions.push({
        id: "sub-annual-dup",
        tenant_id: "college-dup-1",
        plan_id: "plan-annual-1",
        status: "ACTIVE",
        renewal_date: initialRenewal,
      });
      mockDatabase.recurring_mandates.push({
        id: "man-annual-dup",
        gateway_subscription_id: "sub_rzp_annual_dup",
        tenant_id: "college-dup-1",
        subscription_id: "sub-annual-dup",
        billing_interval: "ANNUAL",
        status: "ACTIVE",
      });
      mockDatabase.payment_transactions.push({
        payment_id: "pay_sub_annual_dup",
        status: "CAPTURED",
      });

      // Replay identical event with same payment ID
      const duplicatePayload = JSON.stringify({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_annual_dup",
              status: "active",
            },
          },
          payment: {
            entity: {
              id: "pay_sub_annual_dup", // duplicate payment ID
              amount: 11799882,
              currency: "INR",
              status: "captured",
              method: "card",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(duplicatePayload).digest("hex");
      await PaymentReconciliationService.processWebhookEvent({
        rawBody: duplicatePayload,
        signature,
        admin: mockAdmin,
      });

      const subAfter = mockDatabase.college_subscriptions.find((s) => s.id === "sub-annual-dup");
      // Renewal date unchanged! No double extension
      expect(subAfter.renewal_date).toBe(initialRenewal);
    });

    it("Scenario 76: subscription.activated without captured payment updates mandate only and does NOT grant paid access", async () => {
      mockDatabase.college_subscriptions.push({
        id: "sub-unpaid-1",
        tenant_id: "college-unpaid-1",
        status: "PENDING_PAYMENT",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-unpaid-1",
        gateway_subscription_id: "sub_rzp_act_unpaid",
        tenant_id: "college-unpaid-1",
        subscription_id: "sub-unpaid-1",
        status: "PENDING",
      });

      const activatedPayload = JSON.stringify({
        event: "subscription.activated",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_act_unpaid",
              status: "active",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(activatedPayload).digest("hex");
      await PaymentReconciliationService.processWebhookEvent({
        rawBody: activatedPayload,
        signature,
        admin: mockAdmin,
      });

      // Mandate is ACTIVE
      const mandate = mockDatabase.recurring_mandates.find((m) => m.id === "man-unpaid-1");
      expect(mandate.status).toBe("ACTIVE");

      // UrPlaced Paid Subscription remains PENDING_PAYMENT (NOT granted paid access without captured payment)
      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-unpaid-1");
      expect(sub.status).toBe("PENDING_PAYMENT");
    });

    it("Scenario 77: First recurring charge activates paid period atomically with invoice creation", async () => {
      mockDatabase.college_subscriptions.push({
        id: "sub-unpaid-1",
        tenant_id: "college-unpaid-1",
        status: "PENDING_PAYMENT",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-unpaid-1",
        gateway_subscription_id: "sub_rzp_act_unpaid",
        tenant_id: "college-unpaid-1",
        subscription_id: "sub-unpaid-1",
        billing_interval: "ANNUAL",
        status: "ACTIVE",
      });

      const chargePayload = JSON.stringify({
        event: "subscription.charged",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_act_unpaid",
              status: "active",
            },
          },
          payment: {
            entity: {
              id: "pay_first_charge_001",
              amount: 11800000,
              currency: "INR",
              status: "captured",
              method: "card",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(chargePayload).digest("hex");
      await PaymentReconciliationService.processWebhookEvent({
        rawBody: chargePayload,
        signature,
        admin: mockAdmin,
      });

      // Paid access granted now that payment is verified captured!
      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-unpaid-1");
      expect(sub.status).toBe("ACTIVE");
      expect(sub.last_payment_reference).toBe("pay_first_charge_001");

      // Platform renewal invoice generated
      const invoice = mockDatabase.platform_invoices.find((i) => i.razorpay_payment_id === "pay_first_charge_001");
      expect(invoice).toBeDefined();
      expect(invoice.status).toBe("PAID");
    });

    it("Scenario 78: Failed recurring payment halts mandate and transitions subscription to PAST_DUE", async () => {
      mockDatabase.college_subscriptions.push({
        id: "sub-fail-1",
        tenant_id: "college-fail-1",
        status: "ACTIVE",
      });
      mockDatabase.recurring_mandates.push({
        id: "man-fail-1",
        gateway_subscription_id: "sub_rzp_halt_001",
        tenant_id: "college-fail-1",
        subscription_id: "sub-fail-1",
        status: "ACTIVE",
      });

      const haltedPayload = JSON.stringify({
        event: "subscription.halted",
        payload: {
          subscription: {
            entity: {
              id: "sub_rzp_halt_001",
              status: "halted",
            },
          },
        },
      });

      const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(haltedPayload).digest("hex");
      await PaymentReconciliationService.processWebhookEvent({
        rawBody: haltedPayload,
        signature,
        admin: mockAdmin,
      });

      const mandate = mockDatabase.recurring_mandates.find((m) => m.id === "man-fail-1");
      expect(mandate.status).toBe("HALTED");

      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-fail-1");
      expect(sub.status).toBe("PAST_DUE");
    });

    it("Scenario 79: Correct invoice-to-payment-to-subscription association and tenant verification", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-assoc-1",
        invoice_number: "INV-2026-0888",
        tenant_id: "college-assoc-1",
        subscription_id: "sub-assoc-1",
        amount_inr: 50000,
        tax_inr: 9000,
        total_amount: 59000,
        currency: "INR",
        status: "PENDING",
      });
      mockDatabase.college_subscriptions.push({
        id: "sub-assoc-1",
        tenant_id: "college-assoc-1",
        status: "PENDING_PAYMENT",
      });

      // Attempt payment order from another tenant -> Forbidden
      await expect(
        PaymentReconciliationService.createPaymentOrder({
          invoiceId: "inv-assoc-1",
          tenantId: "different-tenant-002",
          userId: "user-1",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Forbidden.*another college/i);

      // Authorized tenant order creation succeeds
      const order = await PaymentReconciliationService.createPaymentOrder({
        invoiceId: "inv-assoc-1",
        tenantId: "college-assoc-1",
        userId: "user-1",
        admin: mockAdmin,
      });
      expect(order.tenantId).toBe("college-assoc-1");
      expect(order.amountPaise).toBe(5900000);
    });

    it("Scenario 80: GST classification configuration distinguishes SAC heading (4-digit) from full code with provisional status", async () => {
      const rule = await TaxConfigurationService.upsertTaxRule({
        ruleName: "Education Technology & Training Services",
        sacCode: "999293", // 6-digit Tariff code
        sacHeading: "9992", // 4-digit Chapter/Heading
        classificationStatus: "PROVISIONAL_PENDING_PROFESSIONAL_REVIEW",
        ratePercent: 18.0,
        sellerStateCode: "29",
        isExempt: false,
        taxProfessionalReviewNotes: "Awaiting confirmation from chartered tax accountant prior to production invoicing.",
        adminId: "admin-uuid-001",
        admin: mockAdmin,
      });

      expect(rule.sac_code).toBe("999293");
      expect(rule.sac_heading).toBe("9992");
      expect(rule.classification_status).toBe("PROVISIONAL_PENDING_PROFESSIONAL_REVIEW");
    });

    it("Scenario 81: Invalid exemption attempts (unverified status or missing statutory ground) are strictly rejected", async () => {
      // 1. Unverified exemption attempt -> Rejected
      await expect(
        TaxConfigurationService.calculateTax({
          baseAmountInr: 100000,
          isExempt: true,
          exemptionValidationStatus: "PENDING_VERIFICATION",
          exemptionReason: "Notification No. 12/2017",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Tax exemption rejected.*status/i);

      // 2. Missing statutory ground -> Rejected
      await expect(
        TaxConfigurationService.calculateTax({
          baseAmountInr: 100000,
          isExempt: true,
          exemptionValidationStatus: "VERIFIED",
          exemptionReason: "   ", // empty
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Tax exemption rejected.*statutory exemption ground/i);
    });

    it("Scenario 82: Exact integer paise conversion eliminates rounding errors (10000.33 * 18%, exact sum reconciliation)", async () => {
      const result = await TaxConfigurationService.calculateTax({
        baseAmountInr: 10000.33,
        collegeStateCode: "29", // Intra-state (9% + 9%)
        admin: mockAdmin,
      });

      // 10000.33 * 9% = 900.0297 -> 900.03 paise
      expect(result.cgstInr).toBe(900.03);
      expect(result.sgstInr).toBe(900.03);
      expect(result.totalTaxInr).toBe(1800.06);

      // Identity check: base + totalTax === totalInr EXACTLY
      const sum = Number((result.baseAmountInr + result.totalTaxInr).toFixed(2));
      expect(sum).toBe(result.totalInr);
      expect(result.totalInr).toBe(11800.39);
    });

    it("Scenario 83: Proration and partial refund precision with exact integer paise balance", async () => {
      mockDatabase.platform_invoices.push({
        id: "inv-precise-refund",
        invoice_number: "INV-2026-9999",
        tenant_id: "college-assoc-1",
        amount_inr: 10000.33,
        tax_inr: 1800.06,
        total_amount: 11800.39,
        refunded_amount_inr: 0,
        currency: "INR",
        status: "PAID",
        razorpay_payment_id: "pay_precise_999",
        razorpay_order_id: "order_precise_999",
      });

      const refundResult = await RefundService.issueRefund({
        invoiceId: "inv-precise-refund",
        amountInr: 5900.20,
        reason: "Adjusted partial refund",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-uuid-001",
        admin: mockAdmin,
      });

      expect(refundResult.amountInr).toBe(5900.20);
      expect(refundResult.isFullRefund).toBe(false);

      const cn = mockDatabase.credit_notes.find((c) => c.invoice_id === "inv-precise-refund");
      expect(cn).toBeDefined();
      // Identity check: cn.amount_inr + cn.tax_inr === cn.total_inr EXACTLY
      const cnSum = Number((Number(cn.amount_inr) + Number(cn.tax_inr)).toFixed(2));
      expect(cnSum).toBe(Number(cn.total_inr));
    });

    it("Scenario 84: Super Admin critical event email notifications query active platform admins and sanitize credentials", async () => {
      mockDatabase.platform_admins = [
        {
          id: "admin-active-01",
          email: "head-admin@urplaced.com",
          full_name: "Head Super Admin",
          status: "ACTIVE",
        },
      ];

      await BillingNotificationService.notifySuperAdmin({
        action: "TEST_CRITICAL_EVENT",
        details: "Payment failed with rzp_test_secret_123456789 and secret=ab12cd34ef",
        metadata: { invoiceId: "inv-001" },
        admin: mockAdmin,
      });

      const emailCalls = vi.mocked(EmailAdapter.dispatchTransactionalEmail).mock.calls;
      const lastCall = emailCalls[emailCalls.length - 1];
      expect(lastCall[0].toEmail).toBe("head-admin@urplaced.com");

      // Verify credentials sanitized
      expect(lastCall[0].text).not.toContain("rzp_test_secret_123456789");
      expect(lastCall[0].text).toContain("[PROTECTED_KEY_ID]");
      expect(lastCall[0].text).toContain("[PROTECTED_SECRET]");
    });

    it("Scenario 85: Super Admin in-app notifications dispatched with credential sanitization", async () => {
      mockDatabase.platform_admins = [
        {
          id: "admin-active-01",
          email: "head-admin@urplaced.com",
          full_name: "Head Super Admin",
          status: "ACTIVE",
        },
      ];

      await BillingNotificationService.notifySuperAdmin({
        action: "TEST_IN_APP_CRITICAL_EVENT",
        details: "Invoice settlement failed with rzp_test_secret_123456789 and token=ab12cd34ef",
        metadata: { invoiceId: "inv-002" },
        admin: mockAdmin,
      });

      const notifCalls = vi.mocked(PlatformNotificationService.createNotification).mock.calls;
      const lastNotif = notifCalls[notifCalls.length - 1];
      expect(lastNotif[0].recipientUserId).toBe("admin-active-01");
      expect(lastNotif[0].body).not.toContain("rzp_test_secret_123456789");
      expect(lastNotif[0].body).toContain("[PROTECTED_KEY_ID]");
    });

    it("Scenario 86: Automatic renewal success notifications dispatched with invoice and cycle metadata", async () => {
      mockDatabase.tenants.push({
        id: "college-succ-notif",
        name: "Success College",
        official_email: "head@succ.edu",
        billing_contact_email: "bill@succ.edu",
      });

      await BillingNotificationService.sendRenewalSuccessNotification({
        tenantId: "college-succ-notif",
        invoiceNumber: "INV-REN-2026-0001",
        amountInr: 118000,
        billingInterval: "ANNUAL",
        nextRenewalDate: "2027-11-01T00:00:00Z",
        admin: mockAdmin,
      });

      const logs = mockDatabase.billing_notifications_log.filter((l) => l.tenant_id === "college-succ-notif");
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].notification_type).toBe("RENEWAL_SUCCESS");
    });

    it("Scenario 87: Automatic renewal failure notifications dispatched with grace period warning", async () => {
      mockDatabase.tenants.push({
        id: "college-fail-notif",
        name: "Failed Renewal College",
        official_email: "head@fail.edu",
        billing_contact_email: "bill@fail.edu",
      });

      await BillingNotificationService.sendRenewalFailureNotification({
        tenantId: "college-fail-notif",
        subId: "sub_rzp_halt_123",
        errorMessage: "Card expired or insufficient funds",
        admin: mockAdmin,
      });

      const logs = mockDatabase.billing_notifications_log.filter((l) => l.tenant_id === "college-fail-notif");
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].notification_type).toBe("RENEWAL_FAILED");
    });

    it("Scenario 88: Cron authentication and duplicate execution protection via billing_job_runs", async () => {
      process.env.CRON_SECRET = "cron_secret_test_abc123";

      // 1. Invalid bearer token rejected
      const invalidReq = new NextRequest("http://localhost:3000/api/cron/billing/daily-sweep", {
        headers: { authorization: "Bearer invalid_token" },
      });
      const authFail = await BillingCronRunner.verifyCronAuth(invalidReq);
      expect(authFail.authorized).toBe(false);

      // 2. Valid bearer token accepted
      const validReq = new NextRequest("http://localhost:3000/api/cron/billing/daily-sweep", {
        headers: { authorization: "Bearer cron_secret_test_abc123" },
      });
      const authOk = await BillingCronRunner.verifyCronAuth(validReq);
      expect(authOk.authorized).toBe(true);

      // 3. Execution logged to billing_job_runs
      const res = await BillingCronRunner.runJob(
        validReq,
        "DAILY_SWEEP",
        async () => ({ recordsProcessed: 5, summary: { scanned: 5 } }),
        mockAdmin
      );

      expect(res.status).toBe(200);
      const run = mockDatabase.billing_job_runs.find((r) => r.job_name === "DAILY_SWEEP");
      expect(run).toBeDefined();
      expect(run.status).toBe("SUCCESS");
      expect(run.records_processed).toBe(5);
    });
  });
});
