import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import * as razorpayLib from "@/lib/payment/razorpay";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";

describe("URPLACED — Razorpay Standard Checkout Gateway Security & Integrity Suite", () => {
  const TEST_KEY_ID = "rzp_test_sec_mock_12345";
  const TEST_KEY_SECRET = "sec_mock_secret_abcdef98765";
  const TEST_WEBHOOK_SECRET = "whsec_mock_secret_12345";

  let mockDatabase: {
    tenants: any[];
    college_subscriptions: any[];
    subscription_plans: any[];
    platform_invoices: any[];
    payment_orders: any[];
    payment_transactions: any[];
    payment_webhook_events: any[];
    audit_logs: any[];
  };

  let mockAdmin: any;

  beforeEach(() => {
    process.env.RAZORPAY_KEY_ID = TEST_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = TEST_KEY_SECRET;
    process.env.RAZORPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    process.env.RAZORPAY_MODE = "test";

    mockDatabase = {
      tenants: [
        {
          id: "tenant-college-alpha",
          name: "Alpha Institute of Technology",
          slug: "alpha-tech",
          status: "SUSPENDED",
        },
        {
          id: "tenant-college-beta",
          name: "Beta College of Engineering",
          slug: "beta-eng",
          status: "SUSPENDED",
        },
      ],
      subscription_plans: [
        {
          id: "plan-growth",
          slug: "growth",
          name: "Campus Growth",
          version: 1,
          price_inr: 129999,
          student_limit: 2500,
          staff_limit: 20,
          features: { core_drives_management: true },
        },
      ],
      college_subscriptions: [
        {
          id: "sub-alpha-01",
          tenant_id: "tenant-college-alpha",
          plan_id: "plan-growth",
          status: "SUSPENDED",
          student_seat_limit: 2500,
          staff_seat_limit: 20,
        },
      ],
      platform_invoices: [
        {
          id: "inv-alpha-01",
          invoice_number: "INV-2026-ALPHA1",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-01",
          amount_inr: 129999,
          tax_inr: 23399.82,
          currency: "INR",
          status: "PENDING",
        },
        {
          id: "inv-beta-01",
          invoice_number: "INV-2026-BETA1",
          tenant_id: "tenant-college-beta",
          subscription_id: "sub-beta-01",
          amount_inr: 49999,
          tax_inr: 8999.82,
          currency: "INR",
          status: "PENDING",
        },
      ],
      payment_orders: [],
      payment_transactions: [],
      payment_webhook_events: [],
      audit_logs: [],
    };

    mockAdmin = {
      from: vi.fn((table: string) => {
        const rows = mockDatabase[table as keyof typeof mockDatabase] || [];
        let filtered = [...rows];
        let pendingUpdate: any = null;
        let isInsert = false;
        let insertData: any = null;

        const chain: any = {
          select: vi.fn(() => chain),
          eq: vi.fn((col: string, val: any) => {
            filtered = filtered.filter((r) => r[col] === val);
            if (pendingUpdate) {
              rows.forEach((r) => {
                if (r[col] === val) {
                  Object.assign(r, pendingUpdate);
                }
              });
            }
            return chain;
          }),
          or: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn((n: number) => {
            filtered = filtered.slice(0, n);
            return chain;
          }),
          single: vi.fn(() => {
            if (isInsert && insertData) {
              return Promise.resolve({ data: insertData, error: null });
            }
            return Promise.resolve({
              data: filtered[0] || null,
              error: filtered[0] ? null : { message: "Not found", code: "PGRST116" },
            });
          }),
          maybeSingle: vi.fn(() => {
            return Promise.resolve({ data: filtered[0] || null, error: null });
          }),
          insert: vi.fn((data: any) => {
            isInsert = true;
            insertData = Array.isArray(data) ? data[0] : data;
            if (!insertData.id) insertData.id = `gen-${Date.now()}-${Math.random()}`;
            rows.push(insertData);
            return chain;
          }),
          upsert: vi.fn((data: any) => {
            isInsert = true;
            insertData = Array.isArray(data) ? data[0] : data;
            if (!insertData.id) insertData.id = `gen-${Date.now()}-${Math.random()}`;
            rows.push(insertData);
            return chain;
          }),
          update: vi.fn((data: any) => {
            pendingUpdate = data;
            return chain;
          }),
          then: (resolve: (val: any) => void) => {
            if (isInsert) {
              resolve({ data: insertData, error: null });
            } else if (pendingUpdate) {
              resolve({ data: filtered, error: null });
            } else {
              resolve({ data: filtered, error: null });
            }
          },
        };
        return chain;
      }),
    };
  });

  // 1. Genuine Order Creation & Field Mapping
  it("1. Genuine order creation requests correct payload from Razorpay and maps fields accurately", async () => {
    const rzpOrderMock = {
      id: "order_sec_alpha_9999",
      amount: 15339882, // (129999 + 23399.82) * 100 paise rounded
      currency: "INR",
      receipt: "INV-2026-ALPHA1",
      status: "created",
    };

    const ordersCreateSpy = vi.fn().mockResolvedValue(rzpOrderMock);
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: ordersCreateSpy },
      payments: { fetch: vi.fn() },
    } as any);

    const result = await PaymentReconciliationService.createPaymentOrder({
      invoiceId: "inv-alpha-01",
      tenantId: "tenant-college-alpha",
      userId: "user-alpha-head",
      admin: mockAdmin,
    });

    expect(ordersCreateSpy).toHaveBeenCalledWith({
      amount: 15339882,
      currency: "INR",
      receipt: "INV-2026-ALPHA1",
      notes: expect.objectContaining({
        tenantId: "tenant-college-alpha",
        invoiceId: "inv-alpha-01",
        invoiceNumber: "INV-2026-ALPHA1",
      }),
    });

    expect(result.orderId).toBe("order_sec_alpha_9999");
    expect(result.amountPaise).toBe(15339882);
    expect(result.currency).toBe("INR");
    expect(result.keyId).toBe(TEST_KEY_ID);
    expect(result.invoiceId).toBe("inv-alpha-01");
    expect(result.invoiceNumber).toBe("INV-2026-ALPHA1");
    expect(result.tenantId).toBe("tenant-college-alpha");
  });

  // 2. Valid HMAC Accepted
  it("2. Valid HMAC-SHA256 signature is accepted by reconcilePayment", async () => {
    const orderId = "order_sec_valid_01";
    const paymentId = "pay_sec_valid_01";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 15339882,
          currency: "INR",
          status: "captured",
          method: "upi",
        }),
      },
    } as any);

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const result = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.invoiceId).toBe("inv-alpha-01");
  });

  // 3. Fabricated / Tampered Signature Rejected
  it("3. Fabricated or tampered signature is strictly rejected", async () => {
    const orderId = "order_sec_valid_02";
    const paymentId = "pay_sec_valid_02";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: { fetch: vi.fn() },
    } as any);

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: "fabricated_fake_hex_signature_1234567890",
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Cryptographic verification failed: Invalid checkout signature");
  });

  // 4. Fake order_test_ prefix CANNOT bypass verification
  it("4. Simulation bypass removal: 'order_test_' prefix cannot bypass signature check", async () => {
    const orderId = "order_test_bypass_attempt";
    const paymentId = "pay_test_bypass_attempt";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: { fetch: vi.fn() },
    } as any);

    // Using test_sig_ bypass string that previously worked in simulation mode
    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: "test_sig_attempt",
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Cryptographic verification failed: Invalid checkout signature");
  });

  // 5. Payment Fetch Failure Throws and Settle Is Aborted
  it("5. Payment-fetch network failure throws and halts settlement without marking invoice paid", async () => {
    const orderId = "order_sec_fetch_err";
    const paymentId = "pay_sec_fetch_err";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockRejectedValue(new Error("Gateway connection timeout (504)")),
      },
    } as any);

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Gateway connection timeout (504)");

    const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-alpha-01");
    expect(invoice?.status).toBe("PENDING");
  });

  // 6. Authorized but Not Captured Payment Cannot Settle
  it("6. Authorized payment (un-captured) cannot settle invoice", async () => {
    const orderId = "order_sec_auth_only";
    const paymentId = "pay_sec_auth_only";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 15339882,
          currency: "INR",
          status: "authorized", // NOT captured!
        }),
      },
    } as any);

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Payment not captured: Current status is 'authorized'");

    const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-alpha-01");
    expect(invoice?.status).toBe("PENDING");
  });

  // 7. Amount Mismatch Rejected
  it("7. Amount mismatch between order and gateway payment is rejected", async () => {
    const orderId = "order_sec_amount_mismatch";
    const paymentId = "pay_sec_amount_mismatch";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 10000, // Only 100 INR instead of 153398.82 INR!
          currency: "INR",
          status: "captured",
        }),
      },
    } as any);

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Amount mismatch: Expected 15339882 paise, received 10000 paise");
  });

  // 8. Currency Mismatch Rejected
  it("8. Currency mismatch between gateway and system is rejected", async () => {
    const orderId = "order_sec_currency_mismatch";
    const paymentId = "pay_sec_currency_mismatch";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 15339882,
          currency: "USD", // Mismatched currency
          status: "captured",
        }),
      },
    } as any);

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Currency mismatch: Expected INR, received USD");
  });

  // 9. Order ID Mismatch in Gateway Payment
  it("9. Order ID mismatch between gateway fetch and verification request is rejected", async () => {
    const orderId = "order_sec_order_mismatch";
    const paymentId = "pay_sec_order_mismatch";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: "order_different_9999", // Belongs to different order!
          amount: 15339882,
          currency: "INR",
          status: "captured",
        }),
      },
    } as any);

    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Payment order mismatch");
  });

  // 10. Cross-Tenant Verification Rejected
  it("10. Cross-tenant verification attempt is strictly forbidden", async () => {
    const orderId = "order_sec_tenant_cross";
    const paymentId = "pay_sec_tenant_cross";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha", // Belongs to Alpha
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 15339882,
          currency: "INR",
          status: "captured",
        }),
      },
    } as any);

    // Caller is authenticated as tenant-college-beta (attacker trying to verify Alpha's payment)
    await expect(
      PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        callerTenantId: "tenant-college-beta",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Forbidden: You are not authorized to verify a payment for another college.");
  });

  // 11. Webhook Signature Validation Succeeds with Valid HMAC
  it("11. Webhook signature validation succeeds with valid HMAC", async () => {
    const webhookPayload = JSON.stringify({
      entity: "event",
      account_id: "acc_sec_123",
      event: "payment.captured",
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: "pay_wh_valid_01",
            order_id: "order_wh_valid_01",
            amount: 15339882,
            currency: "INR",
            status: "captured",
          },
        },
      },
      created_at: Math.floor(Date.now() / 1000),
    });

    const validWebhookSig = crypto
      .createHmac("sha256", TEST_WEBHOOK_SECRET)
      .update(webhookPayload)
      .digest("hex");

    mockDatabase.payment_orders.push({
      order_id: "order_wh_valid_01",
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: "pay_wh_valid_01",
          order_id: "order_wh_valid_01",
          amount: 15339882,
          currency: "INR",
          status: "captured",
        }),
      },
    } as any);

    const result = await PaymentReconciliationService.processWebhookEvent({
      rawBody: webhookPayload,
      signature: validWebhookSig,
      eventIdHeader: "evt_test_sec_01",
      admin: mockAdmin,
    });

    expect(result.received).toBe(true);
    expect(result.duplicate).toBe(false);
  });

  // 12. Webhook Signature Validation Fails with Invalid HMAC
  it("12. Webhook signature validation fails and rejects invalid signature with 400 error", async () => {
    const webhookPayload = JSON.stringify({
      event: "payment.captured",
      payload: { payment: { entity: { id: "pay_tampered" } } },
    });

    await expect(
      PaymentReconciliationService.processWebhookEvent({
        rawBody: webhookPayload,
        signature: "invalid_tampered_signature_hex",
        eventIdHeader: "evt_tampered_01",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Invalid Razorpay webhook signature");
  });

  // 13. Idempotency Preserved Across Repeated Calls
  it("13. Idempotency is preserved across repeated verify calls without double settlement", async () => {
    const orderId = "order_sec_idempotent";
    const paymentId = "pay_sec_idempotent";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 15339882,
          currency: "INR",
          status: "captured",
        }),
      },
    } as any);

    // Call 1: First verification
    const firstResult = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: mockAdmin,
    });
    expect(firstResult.success).toBe(true);
    expect(firstResult.duplicate).toBeFalsy();

    // Call 2: Duplicate call (e.g. user refreshed or double-verify)
    const secondResult = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: mockAdmin,
    });
    expect(secondResult.success).toBe(true);
    expect(secondResult.duplicate).toBe(true);
    expect(secondResult.alreadyProcessed).toBe(true);
  });

  // 14. Captured Payment Settles Invoice & Activates Entitlements Atomically
  it("14. Captured payment transitions invoice to PAID and reactivates subscription & tenant", async () => {
    const orderId = "order_sec_atomic";
    const paymentId = "pay_sec_atomic";

    mockDatabase.payment_orders.push({
      order_id: orderId,
      tenant_id: "tenant-college-alpha",
      invoice_id: "inv-alpha-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const validSignature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: { create: vi.fn() },
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: paymentId,
          order_id: orderId,
          amount: 15339882,
          currency: "INR",
          status: "captured",
        }),
      },
    } as any);

    expect(mockDatabase.platform_invoices[0].status).toBe("PENDING");
    expect(mockDatabase.college_subscriptions[0].status).toBe("SUSPENDED");
    expect(mockDatabase.tenants[0].status).toBe("SUSPENDED");

    const result = await PaymentReconciliationService.reconcilePayment({
      orderId,
      paymentId,
      signature: validSignature,
      source: "CHECKOUT_VERIFICATION",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(mockDatabase.platform_invoices[0].status).toBe("PAID");
    expect(mockDatabase.college_subscriptions[0].status).toBe("ACTIVE");
    expect(mockDatabase.tenants[0].status).toBe("ACTIVE");
  });
});
