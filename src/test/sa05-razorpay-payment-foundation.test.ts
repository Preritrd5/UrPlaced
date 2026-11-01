import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";
import { PlatformBillingService } from "@/modules/platform-admin/services/platform-billing-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import * as razorpayLib from "@/lib/payment/razorpay";
import { POST as createOrderRoute } from "@/app/api/billing/checkout/create-order/route";
import { POST as verifyPaymentRoute } from "@/app/api/billing/checkout/verify/route";
import { POST as webhookRoute } from "@/app/api/webhooks/razorpay/route";
import { POST as superAdminPayRoute } from "@/app/api/preritrd/billing/invoices/[id]/pay/route";

// Mock server-context for API route authorization
vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(),
}));

let activeMockAdmin: any = null;
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => activeMockAdmin,
}));

// Mock PlatformAuthService
vi.mock("@/modules/platform-admin/services/platform-auth-service", () => ({
  PlatformAuthService: {
    requireSuperAdmin: vi.fn(),
    logAuditEvent: vi.fn(async () => {}),
  },
}));

import { requireAuthContext } from "@/lib/auth/server-context";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

describe("SA-05 Step 01: Secure Razorpay Payment Foundation", () => {
  const TEST_KEY_ID = "rzp_test_urplaced_mock_12345";
  const TEST_KEY_SECRET = "mock_secret_key_987654321";
  const TEST_WEBHOOK_SECRET = "mock_webhook_secret_abcdef123";

  let mockDatabase: Record<string, any[]> = {};
  let mockRazorpayOrdersCreate: any;
  let mockRazorpayPaymentsFetch: any;

  const createMockAdmin = () => ({
    from: vi.fn((table: string) => {
      if (!mockDatabase[table]) mockDatabase[table] = [];

      return {
        select: vi.fn((columns?: string) => {
          let rows = [...(mockDatabase[table] || [])];
          return {
            eq: vi.fn(function (field: string, val: any) {
              rows = rows.filter((r) => r[field] === val);
              return {
                eq: vi.fn(function (f2: string, v2: any) {
                  rows = rows.filter((r) => r[f2] === v2);
                  return {
                    gte: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn(() => ({
                          maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
                        })),
                      })),
                    })),
                    maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
                    single: vi.fn(async () => ({ data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } })),
                  };
                }),
                gte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
                    })),
                  })),
                })),
                order: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
                  })),
                })),
                maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
                single: vi.fn(async () => ({ data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } })),
              };
            }),
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
              })),
            })),
            maybeSingle: vi.fn(async () => ({ data: rows[0] || null, error: null })),
            single: vi.fn(async () => ({ data: rows[0] || null, error: rows[0] ? null : { message: "Not found" } })),
          };
        }),
        insert: vi.fn(async (payload: any) => {
          const item = Array.isArray(payload) ? payload : [payload];
          const inserted = item.map((i) => ({
            id: i.id || `id-${Date.now()}-${Math.random()}`,
            created_at: new Date().toISOString(),
            ...i,
          }));
          mockDatabase[table].push(...inserted);
          return { data: inserted[0], error: null };
        }),
        upsert: vi.fn(async (payload: any, options?: any) => {
          const item = { ...payload };
          const conflictCol = options?.onConflict || "id";
          const idx = mockDatabase[table].findIndex((r) => r[conflictCol] === item[conflictCol]);
          if (idx >= 0) {
            mockDatabase[table][idx] = { ...mockDatabase[table][idx], ...item };
            return { data: mockDatabase[table][idx], error: null };
          } else {
            mockDatabase[table].push(item);
            return { data: item, error: null };
          }
        }),
        update: vi.fn((updateData: any) => ({
          eq: vi.fn(function (field: string, val: any) {
            return {
              neq: vi.fn(async (f2: string, v2: any) => {
                let updatedRow: any = null;
                mockDatabase[table] = (mockDatabase[table] || []).map((r) => {
                  if (r[field] === val && r[f2] !== v2) {
                    updatedRow = { ...r, ...updateData };
                    return updatedRow;
                  }
                  return r;
                });
                return { data: updatedRow, error: null };
              }),
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  let updatedRow: any = null;
                  mockDatabase[table] = (mockDatabase[table] || []).map((r) => {
                    if (r[field] === val) {
                      updatedRow = { ...r, ...updateData };
                      return updatedRow;
                    }
                    return r;
                  });
                  return { data: updatedRow, error: null };
                }),
              })),
              then: (resolve: any) => {
                let updatedRow: any = null;
                mockDatabase[table] = (mockDatabase[table] || []).map((r) => {
                  if (r[field] === val) {
                    updatedRow = { ...r, ...updateData };
                    return updatedRow;
                  }
                  return r;
                });
                return Promise.resolve({ data: updatedRow, error: null }).then(resolve);
              },
            };
          }),
        })),
      };
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    activeMockAdmin = createMockAdmin();

    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

    // Reset database with clean test fixtures
    mockDatabase = {
      tenants: [
        {
          id: "tenant-college-alpha",
          name: "Alpha Institute of Technology",
          status: "PENDING_PAYMENT",
          student_seat_limit: 500,
        },
        {
          id: "tenant-college-beta",
          name: "Beta College of Engineering",
          status: "PENDING_PAYMENT",
          student_seat_limit: 1000,
        },
      ],
      college_subscriptions: [
        {
          id: "sub-alpha-001",
          tenant_id: "tenant-college-alpha",
          plan_id: "campus_growth",
          plan_version: 1,
          status: "PENDING_PAYMENT",
          student_seat_limit: 500,
          staff_seat_limit: 10,
          entitlements_snapshot: {
            planId: "campus_growth",
            limits: { max_active_drives: 10 },
            entitlements: { core_drives_management: true },
          },
        },
      ],
      platform_invoices: [
        {
          id: "inv-alpha-001",
          invoice_number: "INV-2026-ALPHA-01",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-001",
          amount_inr: 50000.0,
          tax_inr: 9000.0,
          currency: "INR",
          status: "PENDING",
        },
        {
          id: "inv-alpha-paid",
          invoice_number: "INV-2026-ALPHA-PAID",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-001",
          amount_inr: 50000.0,
          tax_inr: 9000.0,
          currency: "INR",
          status: "PAID",
        },
        {
          id: "inv-beta-001",
          invoice_number: "INV-2026-BETA-01",
          tenant_id: "tenant-college-beta",
          subscription_id: null,
          amount_inr: 100000.0,
          tax_inr: 18000.0,
          currency: "INR",
          status: "PENDING",
        },
      ],
      payment_orders: [],
      payment_transactions: [],
      payment_webhook_events: [],
    };

    // Mock Razorpay SDK methods
    mockRazorpayOrdersCreate = vi.fn(async (args: any) => ({
      id: `order_mock_${Math.random().toString(36).substring(7)}`,
      amount: args.amount,
      currency: args.currency,
      receipt: args.receipt,
      status: "created",
    }));

    mockRazorpayPaymentsFetch = vi.fn(async (paymentId: string) => ({
      id: paymentId,
      order_id: "order_mock_test123",
      amount: 5900000, // ₹59,000.00 in paise
      currency: "INR",
      status: "captured",
      method: "card",
    }));

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: {
        create: mockRazorpayOrdersCreate,
      },
      payments: {
        fetch: mockRazorpayPaymentsFetch,
      },
    } as any);
  });

  // 1. Authorized Placement Head can initiate payment for an eligible invoice
  it("1. Authorized Placement Head can initiate payment for an eligible invoice", async () => {
    const admin = createMockAdmin();

    const order = await PaymentReconciliationService.createPaymentOrder({
      invoiceId: "inv-alpha-001",
      tenantId: "tenant-college-alpha",
      userId: "user-head-alpha",
      admin: admin as any,
    });

    expect(order.orderId).toBeDefined();
    expect(order.orderId).toMatch(/^order_mock_/);
    expect(order.amountInr).toBe(59000.0);
    expect(order.amountPaise).toBe(5900000);
    expect(order.currency).toBe("INR");
    expect(order.invoiceId).toBe("inv-alpha-001");

    // Persisted in mock database
    const savedOrder = mockDatabase.payment_orders.find((o) => o.order_id === order.orderId);
    expect(savedOrder).toBeDefined();
    expect(savedOrder.status).toBe("CREATED");
  });

  // 2. Unauthorized user cannot initiate payment
  it("2. Unauthorized user cannot initiate payment via API route", async () => {
    (requireAuthContext as any).mockResolvedValueOnce({
      userId: "student-uuid",
      tenantId: "tenant-college-alpha",
      tenantRole: "STUDENT",
    });

    const req = new NextRequest("http://localhost:3000/api/billing/checkout/create-order", {
      method: "POST",
      body: JSON.stringify({ invoiceId: "inv-alpha-001" }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  // 3. User cannot pay another college's invoice
  it("3. User cannot pay another college's invoice", async () => {
    const admin = createMockAdmin();

    await expect(
      PaymentReconciliationService.createPaymentOrder({
        invoiceId: "inv-beta-001", // Belongs to tenant-college-beta
        tenantId: "tenant-college-alpha", // Request from tenant-college-alpha
        userId: "user-head-alpha",
        admin: admin as any,
      })
    ).rejects.toThrow("Forbidden: You are not authorized to pay an invoice belonging to another college.");
  });

  // 4. Client-supplied amount manipulation is rejected / ignored (server authoritative)
  it("4. Server calculates order amount strictly from invoice record (client amount ignored)", async () => {
    const admin = createMockAdmin();

    (requireAuthContext as any).mockResolvedValueOnce({
      userId: "head-uuid",
      tenantId: "tenant-college-alpha",
      tenantRole: "PLACEMENT_HEAD",
    });

    // Client attempts to pass a tampered amount of ₹1.00
    const req = new NextRequest("http://localhost:3000/api/billing/checkout/create-order", {
      method: "POST",
      body: JSON.stringify({
        invoiceId: "inv-alpha-001",
        amountInr: 1.0,
        amountPaise: 100,
      }),
    });

    const res = await createOrderRoute(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    // Must be the true calculated server amount: 50,000 + 9,000 = 59,000
    expect(body.amountInr).toBe(59000.0);
    expect(body.amountPaise).toBe(5900000);
  });

  // 5. Invalid Razorpay signature is rejected
  it("5. Invalid Razorpay signature is rejected", async () => {
    const admin = createMockAdmin();
    mockDatabase.payment_orders.push({
      order_id: "order_mock_test123",
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId: "order_mock_test123",
        paymentId: "pay_test_999",
        signature: "invalid_forged_signature_hex",
        source: "CHECKOUT_VERIFICATION",
        admin: admin as any,
      })
    ).rejects.toThrow("Cryptographic verification failed: Invalid checkout signature.");
  });

  // 6. Valid signature but uncaptured payment is not treated as paid
  it("6. Valid signature but uncaptured payment is not treated as paid", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_test123";
    const paymentId = "pay_test_uncaptured";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    // Generate valid signature
    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Mock Razorpay returning 'authorized' status instead of 'captured'
    mockRazorpayPaymentsFetch.mockResolvedValueOnce({
      id: paymentId,
      order_id: orderId,
      amount: 5900000,
      currency: "INR",
      status: "authorized", // Not captured!
      method: "card",
    });

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: admin as any,
      })
    ).rejects.toThrow("Payment not captured");

    // Ensure invoice and subscription remain unpaid/pending
    const inv = mockDatabase.platform_invoices.find((i) => i.id === "inv-alpha-001");
    expect(inv.status).toBe("PENDING");
    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-001");
    expect(sub.status).toBe("PENDING_PAYMENT");
  });

  // 7. Wrong order ID is rejected
  it("7. Payment associated with a mismatched order ID is rejected", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_test123";
    const paymentId = "pay_test_wrong_order";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Mock gateway returning payment linked to a different order
    mockRazorpayPaymentsFetch.mockResolvedValueOnce({
      id: paymentId,
      order_id: "order_different_rogue_456",
      amount: 5900000,
      currency: "INR",
      status: "captured",
      method: "card",
    });

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: admin as any,
      })
    ).rejects.toThrow("Payment order mismatch");
  });

  // 8. Incorrect amount or currency is rejected
  it("8. Incorrect amount or currency is rejected", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_test123";
    const paymentId = "pay_test_amount_mismatch";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Gateway amount mismatch: ₹10,000 instead of ₹59,000
    mockRazorpayPaymentsFetch.mockResolvedValueOnce({
      id: paymentId,
      order_id: orderId,
      amount: 1000000,
      currency: "INR",
      status: "captured",
      method: "card",
    });

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: admin as any,
      })
    ).rejects.toThrow("Amount mismatch");
  });

  // 9. Duplicate payment processing does not create duplicate transactions
  it("9. Duplicate payment processing does not create duplicate transactions", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_test123";
    const paymentId = "pay_test_duplicate_check";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    mockRazorpayPaymentsFetch.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      amount: 5900000,
      currency: "INR",
      status: "captured",
      method: "card",
    });

    // First reconciliation
    const result1 = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: admin as any,
    });
    expect(result1.success).toBe(true);
    expect(result1.duplicate).toBe(false);

    // Second duplicate reconciliation attempt
    const result2 = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: admin as any,
    });
    expect(result2.success).toBe(true);
    expect(result2.duplicate).toBe(true);
    expect(result2.alreadyProcessed).toBe(true);

    // Assert only one transaction exists in ledger
    const transactions = mockDatabase.payment_transactions.filter((t) => t.payment_id === paymentId);
    expect(transactions.length).toBe(1);
  });

  // 10. Duplicate webhook delivery is idempotent
  it("10. Duplicate webhook delivery is idempotent", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_webhook123";
    const paymentId = "pay_mock_webhook456";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    mockRazorpayPaymentsFetch.mockResolvedValue({
      id: paymentId,
      order_id: orderId,
      amount: 5900000,
      currency: "INR",
      status: "captured",
      method: "upi",
    });

    const rawPayload = JSON.stringify({
      event: "order.paid",
      id: "evt_test_unique_receipt_001",
      created_at: 1730460000,
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 5900000,
            currency: "INR",
            status: "captured",
          },
        },
      },
    });

    const signature = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(rawPayload)
      .digest("hex");

    // First delivery
    const res1 = await PaymentReconciliationService.processWebhookEvent({
      rawBody: rawPayload,
      signature,
      eventIdHeader: "evt_test_unique_receipt_001",
      admin: admin as any,
    });
    expect(res1.received).toBe(true);
    expect(res1.duplicate).toBe(false);

    // Second duplicate delivery with identical event ID
    const res2 = await PaymentReconciliationService.processWebhookEvent({
      rawBody: rawPayload,
      signature,
      eventIdHeader: "evt_test_unique_receipt_001",
      admin: admin as any,
    });
    expect(res2.received).toBe(true);
    expect(res2.duplicate).toBe(true);
  });

  // 11. Out-of-order webhook events do not regress payment status
  it("11. Out-of-order webhook events do not regress payment status", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_test123";
    const paymentId = "pay_test_order_check";

    // Start with already PAID order
    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "PAID",
    });

    // Simulate an out-of-order or late failure notice for this order
    await PaymentReconciliationService.recordFailedPayment({
      orderId,
      paymentId: "pay_failed_attempt_early",
      errorCode: "BAD_REQUEST",
      errorDescription: "Late failure webhook received",
      source: "WEBHOOK",
      admin: admin as any,
    });

    // The order must NOT regress to FAILED; it must remain PAID
    const order = mockDatabase.payment_orders.find((o) => o.order_id === orderId);
    expect(order.status).toBe("PAID");
  });

  // 12. Failed payments never activate subscriptions
  it("12. Failed payments never activate subscriptions", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_failed_sub";
    const paymentId = "pay_mock_failed_777";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    await PaymentReconciliationService.recordFailedPayment({
      orderId,
      paymentId,
      errorCode: "CARD_DECLINED",
      errorDescription: "Insufficient funds on card",
      source: "CHECKOUT_VERIFICATION",
      admin: admin as any,
    });

    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-001");
    expect(sub.status).toBe("PENDING_PAYMENT");
    const inv = mockDatabase.platform_invoices.find((i) => i.id === "inv-alpha-001");
    expect(inv.status).toBe("PENDING");
  });

  // 13. Successful verified payment updates the correct invoice and subscription
  it("13. Successful verified payment updates the correct invoice and subscription", async () => {
    const admin = createMockAdmin();
    const orderId = "order_mock_test123";
    const paymentId = "pay_test_success_flow";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-001",
      amount_paise: 5900000,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    mockRazorpayPaymentsFetch.mockResolvedValueOnce({
      id: paymentId,
      order_id: orderId,
      amount: 5900000,
      currency: "INR",
      status: "captured",
      method: "netbanking",
    });

    const result = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: admin as any,
    });

    expect(result.success).toBe(true);

    // Invoice marked PAID
    const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-alpha-001");
    expect(invoice.status).toBe("PAID");
    expect(invoice.payment_method).toBe("RAZORPAY");
    expect(invoice.razorpay_payment_id).toBe(paymentId);

    // Subscription activated and snapshot preserved
    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-001");
    expect(sub.status).toBe("ACTIVE");
    expect(sub.start_date).toBeDefined();
    expect(sub.expiry_date).toBeDefined();
    expect(sub.entitlements_snapshot).toBeDefined();
    expect(sub.entitlements_snapshot.limits.max_active_drives).toBe(10);

    // Tenant updated to ACTIVE
    const tenant = mockDatabase.tenants.find((t) => t.id === "tenant-college-alpha");
    expect(tenant.status).toBe("ACTIVE");
  });

  // 14. Existing Super Admin manual-payment restrictions remain intact
  it("14. Existing Super Admin manual-payment restrictions remain intact", async () => {
    // Non-super-admin rejected
    (PlatformAuthService.requireSuperAdmin as any).mockRejectedValueOnce(
      new Error("UNAUTHORIZED: Super Admin access required")
    );

    const req = new NextRequest("http://localhost:3000/api/preritrd/billing/invoices/inv-alpha-001/pay", {
      method: "POST",
      body: JSON.stringify({ paymentMethod: "BANK_TRANSFER" }),
    });

    const res = await superAdminPayRoute(req, {
      params: Promise.resolve({ id: "inv-alpha-001" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Super Admin access required");
  });

  // 15. Demo payment bypass cannot be used in production
  it("15. Demo payment bypass cannot be used in production", async () => {
    (PlatformAuthService.requireSuperAdmin as any).mockResolvedValueOnce({
      id: "admin-uuid",
      email: "superadmin@urplaced.com",
    });

    const originalEnv = process.env.NODE_ENV;
    try {
      (process.env as any).NODE_ENV = "production";

      const req = new NextRequest("http://localhost:3000/api/preritrd/billing/invoices/inv-alpha-001/pay", {
        method: "POST",
        body: JSON.stringify({
          paymentMethod: "DEMO_BYPASS",
          isDemo: true,
        }),
      });

      const res = await superAdminPayRoute(req, {
        params: Promise.resolve({ id: "inv-alpha-001" }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("prohibited in production");
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
    }
  });
});
