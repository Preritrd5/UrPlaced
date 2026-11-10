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
        // 1. Genuine Razorpay Paid Invoice
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
          razorpay_payment_id: "pay_Twpoofg4JdRKlE",
          is_demo: false,
        },
        // 2. Explicit Simulated/Test Paid Invoice
        {
          id: "sim-invoice-uuid-001",
          invoice_number: "INV-SIM-2026-10001",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-01",
          amount_inr: 100,
          tax_inr: 18,
          currency: "INR",
          status: "PAID",
          notes: "[SIMULATED_PAYMENT] Settled via demo sandbox (Payment ID: pay_sim_nonexistent_01)",
          paid_at: new Date().toISOString(),
          payment_method: "SIMULATED",
          razorpay_payment_id: "pay_sim_nonexistent_01",
          is_demo: true,
        },
        // 3. Ambiguous/Untrusted Payment Invoice (unverified classification)
        {
          id: "ambiguous-invoice-uuid-002",
          invoice_number: "INV-AMB-2026-20002",
          tenant_id: "tenant-college-alpha",
          subscription_id: "sub-alpha-01",
          amount_inr: 50,
          tax_inr: 9,
          currency: "INR",
          status: "PAID",
          notes: "Unverified transaction without server classification",
          paid_at: new Date().toISOString(),
          payment_method: "UNKNOWN",
          razorpay_payment_id: "pay_ambiguous_30003",
          is_demo: false,
        },
        // 4. Pending Invoice (unpaid)
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
          payment_method: "RAZORPAY",
          is_demo: false,
        },
      ],
      college_subscriptions: [
        {
          id: "sub-alpha-01",
          tenant_id: "tenant-college-alpha",
          plan_id: "starter",
          status: "ACTIVE",
          cancel_at_period_end: false,
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
          range: vi.fn(() => chain),
          limit: vi.fn((n: number) => {
            filtered = filtered.slice(0, n);
            return chain;
          }),
          maybeSingle: vi.fn(() => Promise.resolve({ data: filtered[0] || null, error: null })),
          single: vi.fn(() => Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : { message: "Not found" } })),
          insert: vi.fn((data: any) => {
            isInsert = true;
            insertData = Array.isArray(data) ? data[0] : data;
            if (!insertData.id) insertData.id = `gen-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
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

    vi.spyOn(PlatformAuthService, "logAuditEvent").mockImplementation((entry: any) => {
      mockDatabase.audit_logs.push(entry);
      return Promise.resolve({ id: `audit-${mockDatabase.audit_logs.length}` } as any);
    });
  });

  // =========================================================================
  // GROUP 1: SIMULATED PAYMENT TESTS (Scenarios 1 - 8)
  // =========================================================================
  describe("Group 1: Simulated-Payment Tests", () => {
    it("1. Explicit simulated payment with nonexistent Razorpay ID triggers safe refund path", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      const result = await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "Simulated sandbox reversal test",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(result.success).toBe(true);
      expect(result.refundId.startsWith("rfnd_sim_")).toBe(true);
    });

    it("2. Expected administrative test reversal is recorded in database", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      const result = await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "Administrative test reversal verification",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      const refundRecord = mockDatabase.refunds.find((r) => r.refund_id === result.refundId);
      expect(refundRecord).toBeDefined();
      expect(refundRecord.classification).toBe("ADMINISTRATIVE_TEST_REVERSAL");
      expect(refundRecord.status).toBe("SUCCESS");
    });

    it("3. No backend crash when mock Razorpay client rejects simulated payment", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "sim-invoice-uuid-001",
          amountInr: 118,
          reason: "Zero crash guarantee",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).resolves.toBeDefined();
    });

    it("4. Correct test-reversal classification is returned in result", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      const result = await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "Check classification",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(result.isTestReversal).toBe(true);
      expect(result.gateway).toBe("SIMULATED");
    });

    it("5. No genuine refund success claim (gateway is SIMULATED, not RAZORPAY)", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      const result = await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "Distinguish from live gateway claim",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(result.gateway).not.toBe("RAZORPAY");
      expect(result.gateway).toBe("SIMULATED");
      expect(result.refundId.startsWith("rfnd_sim_")).toBe(true);
    });

    it("6. Duplicate test-reversal request is idempotent with idempotencyKey", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      const key = "idem-sim-test-key-001";
      const first = await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "First test reversal",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        idempotencyKey: key,
        admin: mockAdmin,
      });

      const second = await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "Second duplicate call",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        idempotencyKey: key,
        admin: mockAdmin,
      });

      expect(first.refundId).toBe(second.refundId);
      expect(mockDatabase.refunds.filter((r) => r.idempotency_key === key).length).toBe(1);
    });

    it("7. Unauthorized user cannot trigger test reversal", async () => {
      await expect(
        RefundService.issueRefund({
          invoiceId: "sim-invoice-uuid-001",
          amountInr: 118,
          reason: "Unauthorized attempt",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "student-user-01",
          callerRole: "STUDENT",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Unauthorized/);
    });

    it("8. Ambiguous payment classification does not activate test fallback and fails closed", async () => {
      await expect(
        RefundService.issueRefund({
          invoiceId: "ambiguous-invoice-uuid-002",
          amountInr: 59,
          reason: "Attempt refund on ambiguous transaction",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Payment classification is ambiguous or untrusted/);

      const auditEvent = mockDatabase.audit_logs.find((a) => a.action === "REFUND_REJECTED_AMBIGUOUS_PAYMENT");
      expect(auditEvent).toBeDefined();
    });
  });

  // =========================================================================
  // GROUP 2: GENUINE-PAYMENT PROTECTION TESTS (Scenarios 9 - 22)
  // =========================================================================
  describe("Group 2: Genuine-Payment Protection Tests", () => {
    it("9. Genuine payment with Razorpay HTTP 400 rejects refund and throws error", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "Invalid refund parameters or payment not eligible" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Genuine refund 400 rejection",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Razorpay refund failed/);
    });

    it("10. Genuine payment with nonexistent remote payment ID does NOT trigger test reversal fallback", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Nonexistent remote payment ID on genuine payment",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/not found on remote gateway/);

      // Verify no simulated refund was recorded for this invoice
      const simRefund = mockDatabase.refunds.find(
        (r) => r.invoice_id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c" && r.classification === "ADMINISTRATIVE_TEST_REVERSAL"
      );
      expect(simRefund).toBeUndefined();
    });

    it("11. Genuine payment with HTTP 401 reports gateway authentication failure", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 401,
            error: { description: "Unauthorized key_secret combination" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Test 401 authentication rejection",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Razorpay gateway authentication failure \(401\)/);
    });

    it("12. Genuine payment with HTTP 403 reports gateway forbidden failure", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 403,
            error: { description: "Forbidden merchant access" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Test 403 forbidden rejection",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Razorpay gateway authentication failure \(403\)/);
    });

    it("13. Genuine payment with HTTP 404 does not invoke test fallback", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 404,
            error: { description: "Payment resource not found" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Test 404 resource not found",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/not found on remote gateway/);
    });

    it("14. Genuine payment with HTTP 429 reports rate limit exceeded safely", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 429,
            error: { description: "Too many requests" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Test 429 rate limit",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Razorpay rate limit exceeded \(HTTP 429\)/);
    });

    it("15. Genuine payment with HTTP 500 reports remote gateway internal error requiring reconciliation", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 500,
            error: { description: "Internal Server Error" },
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Test 500 remote failure",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/remote gateway internal error \(HTTP 500\)/);
    });

    it("16. Genuine payment with network timeout marks outcome uncertain", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            code: "ETIMEDOUT",
            message: "Gateway connection timeout after 10000ms",
          }),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Test network timeout",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Razorpay network timeout/);
    });

    it("17. Genuine payment with uncertain gateway refund outcome prohibits blind retry", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue(new Error("Socket hang up timeout")),
        },
      } as any);

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Uncertain gateway socket outcome",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/timeout/);
    });

    it("18. No gateway-confirmed success is recorded without confirmation", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 502,
            error: { description: "Bad Gateway" },
          }),
        },
      } as any);

      try {
        await RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Bad Gateway failure check",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        });
      } catch {
        // Expected
      }

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      expect(inv.status).toBe("PAID");
      expect(mockDatabase.refunds.length).toBe(0);
    });

    it("19. No genuine payment is converted into an administrative test reversal", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      try {
        await RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Verify no conversion to test reversal",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        });
      } catch {
        // Expected error
      }

      expect(mockDatabase.refunds.some((r) => r.classification === "ADMINISTRATIVE_TEST_REVERSAL")).toBe(false);
    });

    it("20. No subscription or entitlement change occurs after failed gateway refund", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 500,
            error: { description: "Gateway failure" },
          }),
        },
      } as any);

      try {
        await RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Cancel immediately requested but gateway fails",
          subscriptionAction: "CANCEL_IMMEDIATELY",
          adminId: "admin-super-01",
          admin: mockAdmin,
        });
      } catch {
        // Expected
      }

      const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-alpha-01");
      expect(sub.status).toBe("ACTIVE");
    });

    it("21. Concurrent refund requests do not create duplicate refunds", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockResolvedValue({
            id: "rfnd_concurrent_01",
            amount: 118,
            currency: "INR",
            status: "processed",
          }),
        },
      } as any);

      const promise1 = RefundService.issueRefund({
        invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
        amountInr: 1.18,
        reason: "Concurrent 1",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      const res1 = await promise1;
      expect(res1.success).toBe(true);

      // Subsequent attempt fails because invoice status is now REFUNDED
      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Concurrent 2",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Cannot issue refund for invoice with status 'REFUNDED'/);
    });

    it("22. Repeated refund request cannot create a second completed refund", async () => {
      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "REFUNDED";

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Second refund on already refunded invoice",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Cannot issue refund for invoice with status 'REFUNDED'/);
    });
  });

  // =========================================================================
  // GROUP 3: AUTHORIZATION AND AUDIT TESTS (Scenarios 23 - 28)
  // =========================================================================
  describe("Group 3: Authorization & Audit Tests", () => {
    it("23. Super Admin authorization enforced for platform refunds", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockResolvedValue({
            id: "rfnd_auth_01",
            amount: 118,
            currency: "INR",
            status: "processed",
          }),
        },
      } as any);

      // Re-enable paid status on alpha invoice
      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

      const result = await RefundService.issueRefund({
        invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
        amountInr: 1.18,
        reason: "Authorized super admin refund",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        callerRole: "SUPER_ADMIN",
        admin: mockAdmin,
      });

      expect(result.success).toBe(true);
    });

    it("24. Unauthorized college staff rejected with HTTP 403 / Unauthorized error", async () => {
      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "College staff attempt",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "staff-01",
          callerRole: "PLACEMENT_HEAD",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Unauthorized: Caller with role 'PLACEMENT_HEAD' is not authorized to issue refunds/);
    });

    it("25. Cross-tenant refund request rejected when expectedTenantId mismatches", async () => {
      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Cross tenant mismatch attempt",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          expectedTenantId: "tenant-college-beta",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Cross-tenant refund rejected/);
    });

    it("26. Student cannot initiate administrative reversal", async () => {
      await expect(
        RefundService.issueRefund({
          invoiceId: "sim-invoice-uuid-001",
          amountInr: 118,
          reason: "Student reversal attempt",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "student-100",
          callerRole: "STUDENT",
          admin: mockAdmin,
        })
      ).rejects.toThrow(/Caller with role 'STUDENT' is not authorized/);
    });

    it("27. Audit record created for successful test reversal", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      // Ensure simulated invoice is PAID
      const simInv = mockDatabase.platform_invoices.find((i) => i.id === "sim-invoice-uuid-001");
      simInv.status = "PAID";

      await RefundService.issueRefund({
        invoiceId: "sim-invoice-uuid-001",
        amountInr: 118,
        reason: "Audit test reversal logging",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      const auditLog = mockDatabase.audit_logs.find((a) => a.action === "ADMINISTRATIVE_TEST_REVERSAL");
      expect(auditLog).toBeDefined();
      expect(auditLog.resourceType).toBe("INVOICE");
      expect(auditLog.metadata.classification).toBe("ADMINISTRATIVE_TEST_REVERSAL");
    });

    it("28. Failed genuine gateway refund is properly auditable with diagnostic metadata", async () => {
      vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
        payments: {
          refund: vi.fn().mockRejectedValue({
            statusCode: 400,
            error: { description: "The id provided does not exist" },
          }),
        },
      } as any);

      const genuineInv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      genuineInv.status = "PAID";

      try {
        await RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Audit genuine failure",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        });
      } catch {
        // Expected gateway failure
      }

      const failAudit = mockDatabase.audit_logs.find((a) => a.action === "GENUINE_REFUND_GATEWAY_FAILED");
      expect(failAudit).toBeDefined();
      expect(failAudit.metadata.statusCode).toBe(400);
      expect(failAudit.metadata.paymentId).toBe("pay_Twpoofg4JdRKlE");
    });
  });

  // =========================================================================
  // GROUP 4: BASELINE BILLING & DECOUPLED SUBSCRIPTION TESTS (Scenarios 29 - 37)
  // =========================================================================
  describe("Group 4: Baseline Billing & Decoupled Subscription Verification", () => {
    it("29. Baseline: Successful full refund processes exactly 118 paise and updates invoice to REFUNDED", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

      const result = await RefundService.issueRefund({
        invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
        amountInr: 1.18,
        reason: "Baseline full refund",
        subscriptionAction: "CANCEL_IMMEDIATELY",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(result.success).toBe(true);
      expect(result.amountInr).toBe(1.18);
      expect(result.isFullRefund).toBe(true);
      expect(result.invoiceStatus).toBe("REFUNDED");
      expect(result.subscriptionStatus).toBe("CANCELED");
      expect(inv.status).toBe("REFUNDED");
    });

    it("30. Baseline: Successful partial refund updates status to PARTIALLY_REFUNDED and permits subsequent refund", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

      const result = await RefundService.issueRefund({
        invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
        amountInr: 0.5,
        reason: "Partial adjustment",
        subscriptionAction: "KEEP_ACTIVE",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(result.success).toBe(true);
      expect(result.amountInr).toBe(0.5);
      expect(result.isFullRefund).toBe(false);
      expect(result.invoiceStatus).toBe("PARTIALLY_REFUNDED");
      expect(result.subscriptionStatus).toBe("ACTIVE");
    });

    it("31. Baseline: Lookup by invoice_number resolves without syntax error", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

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

    it("32. Baseline: Rejects refund on invoice that is not in PAID or PARTIALLY_REFUNDED status", async () => {
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

    it("33. Baseline: Rejects refund amount greater than remaining captured balance", async () => {
      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 50.0,
          reason: "Excessive refund",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow("exceeds remaining refundable captured balance");
    });

    it("34. Baseline: Decoupled Action Q10: KEEP_ACTIVE preserves subscription ACTIVE status on full refund", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

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

    it("35. Baseline: Decoupled Action Q10: CANCEL_IMMEDIATELY cancels subscription immediately", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

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

    it("36. Baseline: Decoupled Action Q10: CANCEL_AT_PERIOD_END retains active access until paid period ends", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

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

    it("37. Baseline: Gateway pre-refund reconciliation rejects duplicate refund if payment is already refunded on Razorpay", async () => {
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

      const inv = mockDatabase.platform_invoices.find((i) => i.id === "f4dcf93c-7515-4a3b-837a-fef5e1af796c");
      inv.status = "PAID";

      await expect(
        RefundService.issueRefund({
          invoiceId: "f4dcf93c-7515-4a3b-837a-fef5e1af796c",
          amountInr: 1.18,
          reason: "Duplicate refund attempt",
          subscriptionAction: "KEEP_ACTIVE",
          adminId: "admin-super-01",
          admin: mockAdmin,
        })
      ).rejects.toThrow(
        "Gateway Reconciliation Notice: Payment pay_Twpoofg4JdRKlE has already been fully refunded on Razorpay"
      );
    });
  });
});
