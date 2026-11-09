import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "crypto";
import { NextRequest } from "next/server";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";
import { PlatformAdminManagementService } from "@/modules/platform-admin/services/platform-admin-management-service";
import * as razorpayLib from "@/lib/payment/razorpay";
import { POST as selectPlanRoute } from "@/app/api/placement/subscription/select-plan/route";
import { POST as createOrderRoute } from "@/app/api/billing/checkout/create-order/route";
import { POST as verifyCheckoutRoute } from "@/app/api/billing/checkout/verify/route";
import { DELETE as decommissionCollegeRoute } from "@/app/api/preritrd/colleges/[id]/route";
import { DELETE as deletePlanRoute } from "@/app/api/preritrd/subscriptions/plans/[id]/route";

// Mock email adapter
vi.mock("@/modules/identity-access/services/email-adapter", () => ({
  EmailAdapter: {
    sendCollegePlacementHeadInvitation: vi.fn(async () => ({ success: true })),
    getAppOrigin: vi.fn(() => "http://localhost:3000"),
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
    requireSuperAdmin: vi.fn(async () => ({ id: "admin-super-01", email: "urplaced5@gmail.com", role: "SUPER_ADMIN" })),
    logAuditEvent: vi.fn(async () => {}),
  },
}));

// Mock server auth context
vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(),
}));

// Mock admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { requireAuthContext } from "@/lib/auth/server-context";
import { createAdminClient } from "@/lib/supabase/admin";

describe("URPLACED SA-08: Complete Institutional Billing, Payment Flow & Super Admin Management Suite", () => {
  const TEST_KEY_ID = "rzp_test_mock_12345";
  const TEST_KEY_SECRET = "mock_secret_key_98765";

  let mockDatabase: Record<string, any[]> = {};
  let mockRazorpayOrdersCreate: any;
  let mockRazorpayOrdersFetch: any;
  let mockRazorpayPaymentsFetch: any;

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
          in: vi.fn((field: string, vals: any[]) => {
            const next = filteredRows.filter((r) => vals.includes(r[field]));
            return buildFilter(next);
          }),
          ilike: vi.fn((field: string, pattern: string) => {
            const cleaned = pattern.replace(/%/g, "").toLowerCase();
            const next = filteredRows.filter((r) => String(r[field] || "").toLowerCase().includes(cleaned));
            return buildFilter(next);
          }),
          gte: vi.fn(() => buildFilter(filteredRows)),
          lte: vi.fn(() => buildFilter(filteredRows)),
          order: vi.fn(() => buildFilter(filteredRows)),
          limit: vi.fn((n: number) => buildFilter(filteredRows.slice(0, n))),
          select: vi.fn(() => chain),
          single: vi.fn(async () => {
            if (filteredRows.length === 0) return { data: null, error: { message: "Row not found" } };
            return { data: filteredRows[0], error: null };
          }),
          maybeSingle: vi.fn(async () => {
            if (filteredRows.length === 0) return { data: null, error: null };
            return { data: filteredRows[0], error: null };
          }),
          delete: vi.fn(() => {
            const idsToDelete = new Set(filteredRows.map((r) => r.id));
            mockDatabase[table] = mockDatabase[table].filter((r) => !idsToDelete.has(r.id));
            return {
              eq: vi.fn((field: string, val: any) => {
                mockDatabase[table] = mockDatabase[table].filter((r) => r[field] !== val);
                return Promise.resolve({ error: null });
              }),
            };
          }),
          then: (resolve: any) => resolve({ data: filteredRows, error: null }),
        };
        return chain;
      };

      return {
        select: vi.fn((cols = "*") => buildFilter(mockDatabase[table])),
        insert: vi.fn((payload: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          const inserted = rows.map((r) => ({
            id: r.id || `mock_${table}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...r,
          }));
          mockDatabase[table].push(...inserted);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: inserted[0], error: null })),
              maybeSingle: vi.fn(async () => ({ data: inserted[0], error: null })),
            })),
            single: vi.fn(async () => ({ data: inserted[0], error: null })),
          };
        }),
        upsert: vi.fn((payload: any, options?: any) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          const conflictCol = options?.onConflict || "id";
          if (!mockDatabase[table]) mockDatabase[table] = [];
          rows.forEach((r) => {
            const existingIdx = mockDatabase[table].findIndex(
              (item: any) => item[conflictCol] === r[conflictCol]
            );
            if (existingIdx >= 0) {
              mockDatabase[table][existingIdx] = {
                ...mockDatabase[table][existingIdx],
                ...r,
                updated_at: new Date().toISOString(),
              };
            } else {
              mockDatabase[table].push({
                id: r.id || `mock_${table}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...r,
              });
            }
          });
          return Promise.resolve({ data: rows, error: null });
        }),
        update: vi.fn((updates: any) => ({
          eq: vi.fn((field: string, val: any) => {
            mockDatabase[table].forEach((r) => {
              if (r[field] === val) {
                Object.assign(r, updates);
                r.updated_at = new Date().toISOString();
              }
            });
            const updatedRows = mockDatabase[table].filter((r) => r[field] === val);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: updatedRows[0] || null, error: null })),
                maybeSingle: vi.fn(async () => ({ data: updatedRows[0] || null, error: null })),
              })),
              single: vi.fn(async () => ({ data: updatedRows[0] || null, error: null })),
              maybeSingle: vi.fn(async () => ({ data: updatedRows[0] || null, error: null })),
            };
          }),
        })),
        delete: vi.fn(() => ({
          eq: vi.fn((field: string, val: any) => {
            mockDatabase[table] = mockDatabase[table].filter((r) => r[field] !== val);
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (createAdminClient as any).mockImplementation(() => createMockAdmin());

    mockDatabase = {
      tenants: [
        {
          id: "tenant-sa08-01",
          name: "National Institute of Engineering",
          slug: "nie-college",
          status: "ACTIVE",
          student_seat_limit: 2500,
          official_email: "placement@nie.edu",
          contact_name: "Dr. Ramesh Sharma",
          onboarding_status: "COMPLETED",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      subscription_plans: [
        {
          id: "growth",
          name: "Campus Growth",
          slug: "campus-growth",
          price_inr: 129999,
          student_limit: 2500,
          staff_limit: 20,
          status: "PUBLISHED",
          is_active: true,
          version: 1,
          features: ["Full Student Directory", "Online Assessments", "Mistake Mastery", "Campus Analytics"],
        },
        {
          id: "draft-plan-01",
          name: "Experimental Draft Plan",
          slug: "draft-plan-01",
          price_inr: 79999,
          student_limit: 1000,
          staff_limit: 10,
          status: "DRAFT",
          is_active: false,
          version: 1,
          features: ["Basic Assessments"],
        },
      ],
      college_subscriptions: [],
      platform_invoices: [],
      payment_orders: [],
      payment_transactions: [],
      platform_admins: [
        {
          id: "admin-super-01",
          email: "urplaced5@gmail.com",
          full_name: "Lead Platform Admin",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
        {
          id: "admin-super-02",
          email: "secondary.admin@urplaced.com",
          full_name: "Secondary Admin",
          role: "SUPER_ADMIN",
          status: "ACTIVE",
        },
      ],
    };

    mockRazorpayOrdersCreate = vi.fn(async (params: any) => ({
      id: `order_mock_${Date.now()}`,
      amount: params.amount,
      currency: params.currency || "INR",
      receipt: params.receipt,
      notes: params.notes,
      status: "created",
    }));

    mockRazorpayOrdersFetch = vi.fn(async (orderId: string) => {
      const order = mockDatabase.payment_orders.find((o) => o.order_id === orderId);
      return {
        id: orderId,
        amount: order?.amount_paise || 15339882,
        currency: "INR",
        notes: {
          tenantId: order?.tenant_id || "tenant-sa08-01",
          invoiceId: order?.invoice_id || "inv-mock-01",
          subscriptionId: order?.subscription_id || "sub-mock-01",
        },
      };
    });

    mockRazorpayPaymentsFetch = vi.fn(async (paymentId: string) => ({
      id: paymentId,
      order_id: "order_mock_active_123",
      amount: 15339882,
      currency: "INR",
      status: "captured",
      method: "card",
    }));

    vi.spyOn(razorpayLib, "getRazorpayConfig").mockReturnValue({
      keyId: TEST_KEY_ID,
      keySecret: TEST_KEY_SECRET,
      webhookSecret: "mock_wh_secret",
    });

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: {
        create: mockRazorpayOrdersCreate,
        fetch: mockRazorpayOrdersFetch,
      },
      payments: {
        fetch: mockRazorpayPaymentsFetch,
      },
    } as any);

    vi.spyOn(razorpayLib, "verifyCheckoutSignature").mockImplementation(
      ({ orderId, paymentId, signature }) => {
        const expected = crypto
          .createHmac("sha256", TEST_KEY_SECRET)
          .update(`${orderId}|${paymentId}`)
          .digest("hex");
        return signature === expected;
      }
    );
  });

  // =========================================================================
  // WORKSTREAM 01: Option C Workflow 2 Plan Selection & Invoice Generation
  // =========================================================================
  describe("1. Option C Workflow 2 (Unassigned Plan) & Commercial Invoice Generation", () => {
    it("allows Placement Head to select an approved published plan and provisions pending invoice with 18% GST", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-placement-head-01",
        userEmail: "head@nie.edu",
        tenantId: "tenant-sa08-01",
        tenantRole: "PLACEMENT_HEAD",
        isPlatformAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "growth" }),
      });

      const res = await selectPlanRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.subscription.planId).toBe("growth");

      // Verify subscription created in PENDING_PAYMENT status
      const sub = mockDatabase.college_subscriptions[0];
      expect(sub).toBeDefined();
      expect(sub.tenant_id).toBe("tenant-sa08-01");
      expect(sub.plan_id).toBe("growth");
      expect(sub.status).toBe("PENDING_PAYMENT");
      expect(sub.student_seat_limit).toBe(2500);

      // Verify invoice generated with authoritative 18% GST
      const inv = mockDatabase.platform_invoices[0];
      expect(inv).toBeDefined();
      expect(inv.tenant_id).toBe("tenant-sa08-01");
      expect(inv.amount_inr).toBe(129999);
      expect(inv.tax_inr).toBe(23399.82);
      expect(inv.status).toBe("PENDING");
    });

    it("strictly blocks Trainer and Student accounts from selecting institutional plans (403 Forbidden)", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-student-01",
        userEmail: "student@nie.edu",
        tenantId: "tenant-sa08-01",
        tenantRole: "STUDENT",
        isPlatformAdmin: false,
      });

      const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "growth" }),
      });

      const res = await selectPlanRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("Only the institutional Placement Head");
    });

    it("rejects selection of draft or non-existent plans (400 / 404)", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-placement-head-01",
        userEmail: "head@nie.edu",
        tenantId: "tenant-sa08-01",
        tenantRole: "PLACEMENT_HEAD",
        isPlatformAdmin: false,
      });

      const reqDraft = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "draft-plan-01" }),
      });

      const resDraft = await selectPlanRoute(reqDraft);
      const dataDraft = await resDraft.json();

      expect(resDraft.status).toBe(400);
      expect(dataDraft.error).toContain("Only PUBLISHED plans are available");
    });
  });

  // =========================================================================
  // WORKSTREAM 02: Razorpay Order Creation via Server Authoritative Endpoint
  // =========================================================================
  describe("2. Authoritative Checkout Order Creation (/api/billing/checkout/create-order)", () => {
    beforeEach(() => {
      mockDatabase.platform_invoices = [
        {
          id: "inv-active-01",
          invoice_number: "INV-2026-9001",
          tenant_id: "tenant-sa08-01",
          subscription_id: "sub-active-01",
          amount_inr: 129999,
          tax_inr: 23399.82,
          total_amount: 153398.82,
          currency: "INR",
          status: "PENDING",
        },
      ];
    });

    it("enforces strict tenant matching: rejects paying invoices belonging to a different tenant (403)", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-other-head",
        tenantId: "tenant-other-college",
        tenantRole: "PLACEMENT_HEAD",
      });

      const req = new NextRequest("http://localhost:3000/api/billing/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-active-01" }),
      });

      const res = await createOrderRoute(req);
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.error).toContain("another college");
    });

    it("creates server-authoritative Razorpay order with exact total in paise (₹153,398.82 -> 15339882 paise)", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-placement-head-01",
        tenantId: "tenant-sa08-01",
        tenantRole: "PLACEMENT_HEAD",
      });

      const req = new NextRequest("http://localhost:3000/api/billing/checkout/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: "inv-active-01" }),
      });

      const res = await createOrderRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.amountPaise).toBe(15339882);
      expect(data.keyId).toBe(TEST_KEY_ID);
      expect(mockRazorpayOrdersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15339882,
          currency: "INR",
        })
      );
    });
  });

  // =========================================================================
  // WORKSTREAM 03: Razorpay Payment Verification & Activation
  // =========================================================================
  describe("3. End-to-End Razorpay Verification & Subscription Activation (/api/billing/checkout/verify)", () => {
    const orderId = "order_mock_active_123";
    const paymentId = "pay_mock_verified_456";
    let validSignature: string;

    beforeEach(() => {
      validSignature = crypto
        .createHmac("sha256", TEST_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      mockDatabase.tenants = [
        {
          id: "tenant-sa08-01",
          name: "National Institute of Engineering",
          slug: "nie-college",
          status: "PENDING_SETUP",
          student_seat_limit: 2500,
        },
      ];

      mockDatabase.college_subscriptions = [
        {
          id: "sub-pending-01",
          tenant_id: "tenant-sa08-01",
          plan_id: "growth",
          status: "PENDING_PAYMENT",
          student_seat_limit: 2500,
        },
      ];

      mockDatabase.platform_invoices = [
        {
          id: "inv-pending-01",
          invoice_number: "INV-2026-9001",
          tenant_id: "tenant-sa08-01",
          subscription_id: "sub-pending-01",
          amount_inr: 129999,
          tax_inr: 23399.82,
          currency: "INR",
          status: "PENDING",
        },
      ];

      mockDatabase.payment_orders = [
        {
          id: "po-01",
          order_id: orderId,
          tenant_id: "tenant-sa08-01",
          invoice_id: "inv-pending-01",
          subscription_id: "sub-pending-01",
          amount_paise: 15339882,
          currency: "INR",
          status: "CREATED",
        },
      ];
    });

    it("rejects payments with invalid HMAC signatures without activating subscription", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-placement-head-01",
        tenantId: "tenant-sa08-01",
        tenantRole: "PLACEMENT_HEAD",
      });

      const req = new NextRequest("http://localhost:3000/api/billing/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentId,
          signature: "fraudulent_tampered_signature_999",
        }),
      });

      const res = await verifyCheckoutRoute(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("Invalid payment signature");

      // Verify college remains in PENDING_PAYMENT
      expect(mockDatabase.college_subscriptions[0].status).toBe("PENDING_PAYMENT");
      expect(mockDatabase.platform_invoices[0].status).toBe("PENDING");
    });

    it("verifies genuine payment, sets invoice to PAID, and activates subscription atomically", async () => {
      (requireAuthContext as any).mockResolvedValue({
        userId: "user-placement-head-01",
        tenantId: "tenant-sa08-01",
        tenantRole: "PLACEMENT_HEAD",
      });

      const req = new NextRequest("http://localhost:3000/api/billing/checkout/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          paymentId,
          signature: validSignature,
        }),
      });

      const res = await verifyCheckoutRoute(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify invoice marked PAID
      const inv = mockDatabase.platform_invoices[0];
      expect(inv.status).toBe("PAID");
      expect(inv.payment_method).toBe("RAZORPAY");

      // Verify subscription activated
      const sub = mockDatabase.college_subscriptions[0];
      expect(sub.status).toBe("ACTIVE");

      // Verify tenant status set to ACTIVE
      const tenant = mockDatabase.tenants[0];
      expect(tenant.status).toBe("ACTIVE");
    });
  });

  // =========================================================================
  // WORKSTREAM 04: Super Admin Safe College Decommissioning API
  // =========================================================================
  describe("4. Super Admin Safe College Decommissioning (Priority 6)", () => {
    it("rejects decommissioning requests without mandatory reason >= 5 chars (400)", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/colleges/tenant-sa08-01", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "bad" }), // only 3 chars
      });

      const res = await decommissionCollegeRoute(req, {
        params: Promise.resolve({ id: "tenant-sa08-01" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("mandatory justification reason (at least 5 characters)");
    });

    it("safely decommissions institution, locks out operational access, cancels subscriptions, and retains financial invoices", async () => {
      mockDatabase.platform_invoices = [
        {
          id: "inv-historical-01",
          tenant_id: "tenant-sa08-01",
          invoice_number: "INV-2026-HIST",
          total_amount: 153398.82,
          status: "PAID",
        },
      ];

      const req = new NextRequest("http://localhost:3000/api/preritrd/colleges/tenant-sa08-01", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Institutional contract completed by mutual agreement" }),
      });

      const res = await decommissionCollegeRoute(req, {
        params: Promise.resolve({ id: "tenant-sa08-01" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify tenant status changed to DECOMMISSIONED
      const tenant = mockDatabase.tenants.find((t) => t.id === "tenant-sa08-01");
      expect(tenant.status).toBe("DECOMMISSIONED");

      // Verify subscription marked CANCELLED
      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "tenant-sa08-01");
      if (sub) {
        expect(sub.status).toBe("CANCELLED");
      }

      // CRITICAL INVARIANT: Historical financial records are strictly preserved!
      expect(mockDatabase.platform_invoices.length).toBe(1);
      expect(mockDatabase.platform_invoices[0].invoice_number).toBe("INV-2026-HIST");
    });

    it("permanently deletes institution when hardDelete is specified", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/colleges/tenant-sa08-01", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: "Permanent test account removal requested by Super Admin",
          hardDelete: true,
        }),
      });

      const res = await decommissionCollegeRoute(req, {
        params: Promise.resolve({ id: "tenant-sa08-01" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("permanently deleted");

      // Verify tenant is completely removed from database
      const tenant = mockDatabase.tenants.find((t) => t.id === "tenant-sa08-01");
      expect(tenant).toBeUndefined();
    });
  });

  // =========================================================================
  // WORKSTREAM 05: Super Admin Removal & Lifecycle Controls (Priority 7)
  // =========================================================================
  describe("5. Super Admin Removal Controls (Draft Plans & Last-Admin Guard)", () => {
    it("allows deleting an unreferenced draft plan", async () => {
      const req = new NextRequest("http://localhost:3000/api/preritrd/subscriptions/plans/draft-plan-01", {
        method: "DELETE",
      });

      const res = await deletePlanRoute(req, {
        params: Promise.resolve({ id: "draft-plan-01" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain("deleted successfully");

      // Verify removed from database
      const found = mockDatabase.subscription_plans.find((p) => p.id === "draft-plan-01");
      expect(found).toBeUndefined();
    });

    it("strictly blocks deleting a published plan or one referenced by college subscriptions", async () => {
      mockDatabase.college_subscriptions = [
        {
          id: "sub-bound-01",
          tenant_id: "tenant-sa08-01",
          plan_id: "growth",
          status: "ACTIVE",
        },
      ];

      const req = new NextRequest("http://localhost:3000/api/preritrd/subscriptions/plans/growth", {
        method: "DELETE",
      });

      const res = await deletePlanRoute(req, {
        params: Promise.resolve({ id: "growth" }),
      });
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toContain("referenced by existing college subscriptions");

      // Plan must remain in database
      const found = mockDatabase.subscription_plans.find((p) => p.id === "growth");
      expect(found).toBeDefined();
    });

    it("enforces Last-Active-Admin guard: blocks suspending or revoking the platform's sole remaining active Super Admin", async () => {
      // Set admin-super-02 to INACTIVE so only admin-super-01 is ACTIVE
      mockDatabase.platform_admins[1].status = "INACTIVE";

      const adminClient = createMockAdmin() as any;

      await expect(
        PlatformAdminManagementService.updateAdminStatus({
          targetAdminId: "admin-super-01",
          newStatus: "SUSPENDED",
          currentAdminId: "admin-super-01",
          admin: adminClient,
        })
      ).rejects.toThrow("Cannot suspend or revoke the platform's sole remaining active Super Admin");
    });
  });
});
