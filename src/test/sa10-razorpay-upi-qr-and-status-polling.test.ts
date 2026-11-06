import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as statusRoute } from "@/app/api/billing/checkout/status/route";
import * as serverContext from "@/lib/auth/server-context";
import * as supabaseAdmin from "@/lib/supabase/admin";
import * as razorpayLib from "@/lib/payment/razorpay";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";

describe("URPLACED — Razorpay PhonePe UPI QR & Status Polling Suite", () => {
  let mockInvoice: any;
  let mockPaymentOrder: any;
  let mockAdmin: any;
  let mockRazorpayOrdersFetchPayments: any;

  beforeEach(() => {
    mockInvoice = {
      id: "6ca0079c-7733-47d0-a923-c73b34d4316f",
      invoice_number: "INV-2026-2091",
      tenant_id: "tenant-demo-uuid",
      subscription_id: "sub-demo-1",
      amount_inr: 1.0,
      tax_inr: 0.18,
      status: "PENDING",
    };

    mockPaymentOrder = {
      order_id: "order_Twqn6e2fMEtgtV",
      tenant_id: "tenant-demo-uuid",
      invoice_id: "6ca0079c-7733-47d0-a923-c73b34d4316f",
      amount_paise: 118,
      status: "CREATED",
    };

    mockRazorpayOrdersFetchPayments = vi.fn().mockResolvedValue({
      count: 0,
      items: [],
    });

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: {
        fetchPayments: mockRazorpayOrdersFetchPayments,
      },
    } as any);

    mockAdmin = {
      from: vi.fn((table: string) => {
        let currentTable = table;
        let filterField = "";
        let filterVal = "";

        const queryObj: any = {
          select: vi.fn(() => queryObj),
          eq: vi.fn((f: string, v: string) => {
            filterField = f;
            filterVal = v;
            return queryObj;
          }),
          maybeSingle: vi.fn(async () => {
            if (currentTable === "platform_invoices") {
              if (mockInvoice[filterField] === filterVal) {
                return { data: { ...mockInvoice }, error: null };
              }
              return { data: null, error: null };
            }
            if (currentTable === "payment_orders") {
              if (mockPaymentOrder[filterField] === filterVal) {
                return { data: { ...mockPaymentOrder }, error: null };
              }
              return { data: null, error: null };
            }
            return { data: null, error: null };
          }),
        };
        return queryObj;
      }),
    };

    vi.spyOn(supabaseAdmin, "createAdminClient").mockReturnValue(mockAdmin as any);

    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-placement-head",
      email: "head@demo.edu",
      tenantId: "tenant-demo-uuid",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);
  });

  // 1. When invoice is already PAID, status polling returns paid: true immediately
  it("1. GET /api/billing/checkout/status returns paid: true immediately if invoice is already settled", async () => {
    mockInvoice.status = "PAID";

    const req = new NextRequest(
      "http://localhost:3000/api/billing/checkout/status?orderId=order_Twqn6e2fMEtgtV&invoiceId=6ca0079c-7733-47d0-a923-c73b34d4316f"
    );
    const res = await statusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paid).toBe(true);
    expect(data.status).toBe("PAID");
    expect(mockRazorpayOrdersFetchPayments).not.toHaveBeenCalled();
  });

  // 2. When invoice is PENDING and Razorpay has no captured payment, status returns paid: false
  it("2. GET /api/billing/checkout/status returns paid: false when payment is still pending", async () => {
    mockInvoice.status = "PENDING";
    mockRazorpayOrdersFetchPayments.mockResolvedValueOnce({
      count: 0,
      items: [],
    });

    const req = new NextRequest(
      "http://localhost:3000/api/billing/checkout/status?orderId=order_Twqn6e2fMEtgtV&invoiceId=6ca0079c-7733-47d0-a923-c73b34d4316f"
    );
    const res = await statusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paid).toBe(false);
    expect(data.status).toBe("PENDING");
    expect(mockRazorpayOrdersFetchPayments).toHaveBeenCalledWith("order_Twqn6e2fMEtgtV");
  });

  // 3. When invoice is PENDING and user scanned QR on secondary device, status reconciles and settles payment
  it("3. GET /api/billing/checkout/status detects captured QR payment, reconciles atomically, and returns paid: true", async () => {
    mockInvoice.status = "PENDING";
    mockRazorpayOrdersFetchPayments.mockResolvedValueOnce({
      count: 1,
      items: [
        {
          id: "pay_Twqoj37vdi0rt0",
          order_id: "order_Twqn6e2fMEtgtV",
          status: "captured",
          amount: 118,
          currency: "INR",
          method: "upi",
        },
      ],
    });

    const reconcileSpy = vi
      .spyOn(PaymentReconciliationService, "reconcilePayment")
      .mockResolvedValueOnce({
        success: true,
        orderId: "order_Twqn6e2fMEtgtV",
        paymentId: "pay_Twqoj37vdi0rt0",
        invoiceId: "6ca0079c-7733-47d0-a923-c73b34d4316f",
        tenantId: "tenant-demo-uuid",
      });

    const req = new NextRequest(
      "http://localhost:3000/api/billing/checkout/status?orderId=order_Twqn6e2fMEtgtV&invoiceId=6ca0079c-7733-47d0-a923-c73b34d4316f"
    );
    const res = await statusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.paid).toBe(true);
    expect(data.status).toBe("PAID");
    expect(data.paymentId).toBe("pay_Twqoj37vdi0rt0");
    expect(data.reconciled).toBe(true);
    expect(reconcileSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order_Twqn6e2fMEtgtV",
        paymentId: "pay_Twqoj37vdi0rt0",
        source: "RECONCILIATION",
      })
    );
  });

  // 4. Strict RBAC: Cross-tenant access is rejected with 403 Forbidden
  it("4. GET /api/billing/checkout/status rejects unauthorized cross-tenant callers with 403 Forbidden", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-foreign",
      email: "head@other.edu",
      tenantId: "foreign-tenant-id",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/billing/checkout/status?orderId=order_Twqn6e2fMEtgtV&invoiceId=6ca0079c-7733-47d0-a923-c73b34d4316f"
    );
    const res = await statusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("Forbidden");
  });

  // 5. Missing parameters return 400 Bad Request
  it("5. GET /api/billing/checkout/status returns 400 when missing invoiceId and orderId", async () => {
    const req = new NextRequest("http://localhost:3000/api/billing/checkout/status");
    const res = await statusRoute(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toContain("required");
  });
});
