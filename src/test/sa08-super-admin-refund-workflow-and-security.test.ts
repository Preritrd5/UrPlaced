import { describe, it, expect, vi, beforeEach } from "vitest";
import { RefundService } from "@/modules/billing/services/refund-service";
import * as razorpayLib from "@/lib/payment/razorpay";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

describe("URPLACED — Super Admin Billing Refund Service & Security Suite", () => {
  let mockDatabase: {
    tenants: any[];
    platform_invoices: any[];
    college_subscriptions: any[];
    refunds: any[];
    credit_notes: any[];
    audit_logs: any[];
  };

  let mockAdmin: any;

  beforeEach(() => {
    mockDatabase = {
      tenants: [
        { id: "tenant-college-alpha", name: "Alpha Tech", slug: "alpha-tech" },
        { id: "tenant-college-beta", name: "Beta College", slug: "beta-college" },
      ],
      platform_invoices: [
        {
          id: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          invoice_number: "INV-UPG-2026-76889",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-01",
          amount_inr: 1,
          tax_inr: 0.18,
          currency: "INR",
          status: "PAID",
          notes: "Settled via Razorpay (Payment ID: pay_Twpoofg4JdRKlE)",
          paid_at: new Date().toISOString(),
          payment_method: "RAZORPAY",
        },
        {
          id: "3e4a2d1f-8899-4a3b-837a-112233445566",
          invoice_number: "INV-2026-PENDING",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-01",
          amount_inr: 49999,
          tax_inr: 8999.82,
          currency: "INR",
          status: "PENDING",
          notes: "Pending checkout",
        },
      ],
      college_subscriptions: [
        {
          id: "sub-alpha-01",
          tenant_id: "tenant-college-alpha",
          plan_id: "starter",
          status: "ACTIVE",
        },
      ],
      refunds: [],
      credit_notes: [],
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
                if (r[col] === val) Object.assign(r, pendingUpdate);
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
          maybeSingle: vi.fn(() => Promise.resolve({ data: filtered[0] || null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : { message: "Not found" } })),
          insert: vi.fn((data: any) => {
            isInsert = true;
            insertData = Array.isArray(data) ? data[0] : data;
            if (!insertData.id) insertData.id = `gen-${Date.now()}`;
            rows.push(insertData);
            return chain;
          }),
          update: vi.fn((data: any) => {
            pendingUpdate = data;
            return chain;
          }),
          then: (resolve: (val: any) => void) => {
            if (isInsert) resolve({ data: insertData, error: null });
            else if (pendingUpdate) resolve({ data: filtered, error: null });
            else resolve({ data: filtered, error: null });
          },
        };
        return chain;
      }),
    };

    vi.spyOn(PlatformAuthService, "logAuditEvent").mockResolvedValue({ id: "audit-1" } as any);
  });

  // 1. Successful full refund with live/simulated gateway
  it("1. Successful full refund processes exactly 118 paise and updates invoice to REFUNDED", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockResolvedValue({
          id: "rfnd_test_full_123",
          amount: 118,
          currency: "INR",
          status: "processed",
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
      amountInr: 1.18,
      reason: "My Wish",
      subscriptionAction: "CANCEL_IMMEDIATELY",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.amountInr).toBe(1.18);
    expect(result.isFullRefund).toBe(true);
    expect(result.invoiceStatus).toBe("REFUNDED");
    expect(result.subscriptionStatus).toBe("CANCELED");

    // Verify invoice status in database
    const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
    expect(inv.status).toBe("REFUNDED");
  });

  // 2. Successful partial refund
  it("2. Successful partial refund updates status to PARTIALLY_REFUNDED and permits subsequent refund", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockResolvedValue({
          id: "rfnd_test_partial_01",
          amount: 50,
          currency: "INR",
          status: "processed",
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
      amountInr: 0.50,
      reason: "Partial adjustment",
      subscriptionAction: "KEEP_ACTIVE",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.amountInr).toBe(0.50);
    expect(result.isFullRefund).toBe(false);
    expect(result.invoiceStatus).toBe("PARTIALLY_REFUNDED");
    expect(result.subscriptionStatus).toBe("ACTIVE");
  });

  // 3. Lookup by invoice_number as well as UUID
  it("3. Lookup by invoice_number (INV-UPG-2026-76889) resolves without syntax error", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockResolvedValue({
          id: "rfnd_test_num_123",
          amount: 118,
          currency: "INR",
          status: "processed",
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "INV-UPG-2026-76889",
      amountInr: 1.18,
      reason: "By Invoice Number",
      subscriptionAction: "KEEP_ACTIVE",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.amountInr).toBe(1.18);
  });

  // 4. Reject non-paid invoice
  it("4. Rejects refund on invoice that is not in PAID or PARTIALLY_REFUNDED status", async () => {
    await expect(
      RefundService.issueRefund({
        invoiceId: "3e4a2d1f-8899-4a3b-837a-112233445566",
        reason: "Cannot refund pending",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Cannot issue refund for invoice with status 'PENDING'");
  });

  // 5. Reject refund amount exceeding remaining captured balance
  it("5. Rejects refund amount greater than remaining captured balance", async () => {
    await expect(
      RefundService.issueRefund({
        invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
        amountInr: 50.00,
        reason: "Excessive refund",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      })
    ).rejects.toThrow("exceeds remaining refundable captured balance");
  });

  // 6. Decoupled Action Q10: KEEP_ACTIVE preserves subscription ACTIVE status
  it("6. Decoupled Action Q10: KEEP_ACTIVE preserves subscription ACTIVE status on full refund", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockResolvedValue({
          id: "rfnd_test_keep_123",
          amount: 118,
          currency: "INR",
          status: "processed",
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
      amountInr: 1.18,
      reason: "Refund but keep service active",
      subscriptionAction: "KEEP_ACTIVE",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.subscriptionStatus).toBe("ACTIVE");

    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-01");
    expect(sub.status).toBe("ACTIVE");
  });

  // 7. Decoupled Action Q10: CANCEL_IMMEDIATELY cancels subscription
  it("7. Decoupled Action Q10: CANCEL_IMMEDIATELY cancels subscription immediately", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockResolvedValue({
          id: "rfnd_test_cancel_123",
          amount: 118,
          currency: "INR",
          status: "processed",
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
      amountInr: 1.18,
      reason: "Immediate cancellation",
      subscriptionAction: "CANCEL_IMMEDIATELY",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.subscriptionStatus).toBe("CANCELED");

    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-01");
    expect(sub.status).toBe("CANCELED");
  });

  // 7b. Decoupled Action Q10: CANCEL_AT_PERIOD_END sets cancel_at_period_end flag while retaining ACTIVE
  it("7b. Decoupled Action Q10: CANCEL_AT_PERIOD_END retains active access until paid period ends", async () => {
    // Reset subscription to ACTIVE
    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-01");
    if (sub) {
      sub.status = "ACTIVE";
      sub.cancel_at_period_end = false;
    }

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockResolvedValue({
          id: "rfnd_test_period_end_456",
          amount: 118,
          currency: "INR",
          status: "processed",
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
      amountInr: 1.18,
      reason: "Period end cancellation",
      subscriptionAction: "CANCEL_AT_PERIOD_END",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.subscriptionStatus).toBe("ACTIVE");
    expect(sub?.cancel_at_period_end).toBe(true);
  });

  // 8. Gateway error handles gracefully and records administrative reversal in dev/test
  it("8. Gateway rejection with simulated payment handles gracefully without crashing backend", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        refund: vi.fn().mockRejectedValue({
          statusCode: 400,
          error: { description: "The id provided does not exist" },
        }),
      },
    } as any);

    const result = await RefundService.issueRefund({
      invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
      amountInr: 1.18,
      reason: "Test fallback",
      subscriptionAction: "KEEP_ACTIVE",
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result.success).toBe(true);
    expect(result.refundId.startsWith("rfnd_sim_")).toBe(true);
  });

  // 9. Gateway pre-refund reconciliation prevents duplicate refund when already refunded on remote gateway
  it("9. Gateway pre-refund reconciliation rejects duplicate refund if payment is already refunded on Razorpay", async () => {
    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      payments: {
        fetch: vi.fn().mockResolvedValue({
          id: "pay_Twpoofg4JdRKlE",
          amount: 118,
          amount_refunded: 118,
          status: "refunded",
        }),
        refund: vi.fn(),
      },
    } as any);

    await expect(
      RefundService.issueRefund({
        invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
        amountInr: 1.18,
        reason: "Duplicate refund attempt",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      })
    ).rejects.toThrow("Gateway Reconciliation Notice: Payment pay_Twpoofg4JdRKlE has already been fully refunded on Razorpay");
  });
});
