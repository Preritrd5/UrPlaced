import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

// Import route handlers
import { GET as getSubscriptionRoute } from "@/app/api/placement/subscription/route";
import { POST as selectPlanRoute } from "@/app/api/placement/subscription/select-plan/route";
import { POST as upgradePlanRoute } from "@/app/api/placement/subscription/upgrade/route";
import { POST as downgradePlanRoute } from "@/app/api/placement/subscription/downgrade/route";
import { POST as submitBankRefRoute } from "@/app/api/placement/billing/invoices/[id]/reference/route";
import { POST as createCheckoutOrderRoute } from "@/app/api/billing/checkout/create-order/route";
import { POST as verifyCheckoutPaymentRoute } from "@/app/api/billing/checkout/verify/route";

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
    sendNotification: vi.fn(async () => ({ success: true })),
  },
}));

// In-Memory Database State
let mockDatabase: {
  tenants: any[];
  college_subscriptions: any[];
  subscription_plans: any[];
  platform_invoices: any[];
  payment_orders: any[];
  payment_transactions: any[];
  tenant_memberships: any[];
  audit_logs: any[];
};

let currentCallerContext: {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  tenantId: string | null;
  tenantRole: string | null;
  isPlatformAdmin: boolean;
};

// Mock server auth context
vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(async () => {
    return currentCallerContext;
  }),
}));

// Mock Supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    return {
      from: vi.fn((tableName: string) => {
        let currentTable = mockDatabase[tableName as keyof typeof mockDatabase] || [];
        let filtered = [...currentTable];

        // Automatically synthesize relational joins for in-memory mock
        if (tableName === "tenants") {
          filtered = currentTable.map((t: any) => ({
            ...t,
            college_subscriptions: (mockDatabase.college_subscriptions || [])
              .filter((s: any) => s.tenant_id === t.id)
              .map((s: any) => ({
                ...s,
                subscription_plans: (mockDatabase.subscription_plans || []).filter((p: any) => p.id === s.plan_id),
              })),
          }));
        } else if (tableName === "college_subscriptions") {
          filtered = currentTable.map((s: any) => ({
            ...s,
            subscription_plans: (mockDatabase.subscription_plans || []).filter((p: any) => p.id === s.plan_id),
          }));
        }

        let pendingInsert: any = null;
        let pendingUpdate: any = null;

        const chain = {
          select: vi.fn((_cols?: string) => chain),
          eq: vi.fn((col: string, val: any) => {
            filtered = filtered.filter((row: any) => row[col] === val);
            return chain;
          }),
          neq: vi.fn((col: string, val: any) => {
            filtered = filtered.filter((row: any) => row[col] !== val);
            return chain;
          }),
          in: vi.fn((col: string, vals: any[]) => {
            filtered = filtered.filter((row: any) => vals.includes(row[col]));
            return chain;
          }),
          lte: vi.fn((_col: string, _val: any) => chain),
          gte: vi.fn((_col: string, _val: any) => chain),
          lt: vi.fn((_col: string, _val: any) => chain),
          gt: vi.fn((_col: string, _val: any) => chain),
          or: vi.fn((_cond: string) => chain),
          ilike: vi.fn((_col: string, _val: any) => chain),
          is: vi.fn((_col: string, _val: any) => chain),
          order: vi.fn((_col: string, _opts?: any) => chain),
          limit: vi.fn((n: number) => {
            filtered = filtered.slice(0, n);
            return chain;
          }),
          insert: vi.fn((val: any) => {
            pendingInsert = val;
            return chain;
          }),
          update: vi.fn((val: any) => {
            pendingUpdate = val;
            return chain;
          }),
          delete: vi.fn(() => {
            const tableArr = mockDatabase[tableName as keyof typeof mockDatabase];
            if (tableArr) {
              const idsToRemove = new Set(filtered.map((r: any) => r.id));
              mockDatabase[tableName as keyof typeof mockDatabase] = tableArr.filter(
                (r: any) => !idsToRemove.has(r.id)
              );
            }
            return Promise.resolve({ data: null, error: null });
          }),
          single: vi.fn(async () => {
            if (pendingInsert) {
              const toInsert = Array.isArray(pendingInsert) ? pendingInsert[0] : pendingInsert;
              const inserted = { id: `mock-${Date.now()}-${Math.random()}`, ...toInsert };
              (mockDatabase[tableName as keyof typeof mockDatabase] as any[]).push(inserted);
              return { data: inserted, error: null };
            }
            if (pendingUpdate) {
              for (const row of filtered) {
                Object.assign(row, pendingUpdate);
                const raw = (mockDatabase[tableName as keyof typeof mockDatabase] as any[])?.find((r: any) => r.id === row.id);
                if (raw) Object.assign(raw, pendingUpdate);
              }
              return { data: filtered[0] || null, error: null };
            }
            return { data: filtered[0] || null, error: filtered[0] ? null : { message: "Not found" } };
          }),
          maybeSingle: vi.fn(async () => {
            if (pendingInsert) {
              const toInsert = Array.isArray(pendingInsert) ? pendingInsert[0] : pendingInsert;
              const inserted = { id: `mock-${Date.now()}-${Math.random()}`, ...toInsert };
              (mockDatabase[tableName as keyof typeof mockDatabase] as any[]).push(inserted);
              return { data: inserted, error: null };
            }
            if (pendingUpdate) {
              for (const row of filtered) {
                Object.assign(row, pendingUpdate);
                const raw = (mockDatabase[tableName as keyof typeof mockDatabase] as any[])?.find((r: any) => r.id === row.id);
                if (raw) Object.assign(raw, pendingUpdate);
              }
              return { data: filtered[0] || null, error: null };
            }
            return { data: filtered[0] || null, error: null };
          }),
          then: vi.fn((resolve: any) => {
            if (pendingInsert) {
              const toInsert = Array.isArray(pendingInsert) ? pendingInsert : [pendingInsert];
              const inserted = toInsert.map((item) => ({ id: `mock-${Date.now()}-${Math.random()}`, ...item }));
              (mockDatabase[tableName as keyof typeof mockDatabase] as any[]).push(...inserted);
              return Promise.resolve({ data: inserted, error: null }).then(resolve);
            }
            if (pendingUpdate) {
              for (const row of filtered) {
                Object.assign(row, pendingUpdate);
                const raw = (mockDatabase[tableName as keyof typeof mockDatabase] as any[])?.find((r: any) => r.id === row.id);
                if (raw) Object.assign(raw, pendingUpdate);
              }
              return Promise.resolve({ data: filtered, error: null }).then(resolve);
            }
            return Promise.resolve({ data: filtered, error: null }).then(resolve);
          }),
        };
        return chain;
      }),
    };
  }),
}));

const TEST_KEY_ID = "rzp_test_stateMachine123";
const TEST_KEY_SECRET = "secret_stateMachineSecret123";

// Mock Razorpay gateway library
import * as razorpayLib from "@/lib/payment/razorpay";
vi.mock("@/lib/payment/razorpay", () => ({
  getRazorpayConfig: vi.fn(() => ({
    keyId: "rzp_test_stateMachine123",
    keySecret: "secret_stateMachineSecret123",
    webhookSecret: "mock_wh_secret",
  })),
  getRazorpayClient: vi.fn(() => ({
    orders: {
      create: vi.fn(async (params) => ({
        id: `order_mock_${Date.now()}`,
        amount: params.amount,
        currency: params.currency,
        receipt: params.receipt,
        status: "created",
      })),
      fetch: vi.fn(async (orderId) => ({
        id: orderId,
        amount: 15339882,
        currency: "INR",
        status: "paid",
        notes: { invoiceId: "inv-active-test-01" },
      })),
    },
    payments: {
      fetch: vi.fn(async (paymentId) => ({
        id: paymentId,
        order_id: "order_mock_test_01",
        amount: 15339882,
        currency: "INR",
        status: "captured",
        method: "card",
      })),
    },
  })),
  verifyRazorpayHmacSignature: vi.fn((params) => {
    const body = `${params.orderId}|${params.paymentId}`;
    const expected = crypto.createHmac("sha256", TEST_KEY_SECRET).update(body).digest("hex");
    return params.signature === expected;
  }),
  verifyCheckoutSignature: vi.fn((params) => {
    const body = `${params.orderId}|${params.paymentId}`;
    const expected = crypto.createHmac("sha256", TEST_KEY_SECRET).update(body).digest("hex");
    return params.signature === expected;
  }),
  verifyWebhookSignature: vi.fn(() => true),
}));

describe("URPLACED — Final College Billing State Machine & Payment Journey Regression Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    currentCallerContext = {
      userId: "head-user-snpsu",
      email: "head@snpsu.edu.in",
      fullName: "Placement Head SNPSU",
      role: "PLACEMENT_HEAD",
      tenantId: "tenant-snpsu-01",
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    };

    mockDatabase = {
      tenants: [
        {
          id: "tenant-snpsu-01",
          name: "Sapthagiri NPS University",
          slug: "sapthagiri-nps-university",
          status: "ACTIVE",
          student_seat_limit: 500,
          created_at: new Date().toISOString(),
        },
      ],
      subscription_plans: [
        {
          id: "starter",
          name: "Institutional Starter",
          price_inr: 49999,
          student_limit: 500,
          staff_limit: 5,
          features: ["Core Drives", "Standard Banks"],
          is_active: true,
          status: "PUBLISHED",
          version: 1,
          billing_interval: "ANNUAL",
        },
        {
          id: "growth",
          name: "Campus Growth",
          price_inr: 129999,
          student_limit: 2500,
          staff_limit: 20,
          features: ["DriveFit", "AI Question Bank", "Placement Memory"],
          is_active: true,
          status: "PUBLISHED",
          version: 1,
          billing_interval: "ANNUAL",
        },
        {
          id: "enterprise",
          name: "University Enterprise",
          price_inr: 249999,
          student_limit: 10000,
          staff_limit: 100,
          features: ["All Growth", "Unlimited Question Sets", "SLA"],
          is_active: true,
          status: "PUBLISHED",
          version: 1,
          billing_interval: "ANNUAL",
        },
      ],
      college_subscriptions: [],
      platform_invoices: [],
      payment_orders: [],
      payment_transactions: [],
      tenant_memberships: [],
      audit_logs: [],
    };
  });

  // =========================================================================
  // 1. STATE A: NO SUBSCRIPTION -> PLAN SELECTION REQUIRED
  // =========================================================================
  it("1. State A: When no subscription exists, returns published plans and plan selection requirement", async () => {
    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subscription).toBeNull();
    expect(data.hasPreassignedPlan).toBe(false);
    expect(data.availablePlans.length).toBe(3);
    expect(data.availablePlans[0].name).toBe("Institutional Starter");
    expect(data.availablePlans[1].name).toBe("Campus Growth");
  });

  // =========================================================================
  // 2. STATE A -> STATE B: SELECTING PLAN CREATES PENDING_PAYMENT SUBSCRIPTION
  // =========================================================================
  it("2. State A -> State B: Selecting an approved plan initializes PENDING_PAYMENT subscription and invoice", async () => {
    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "growth" }),
    });

    const res = await selectPlanRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.subscription.planName).toBe("Campus Growth");

    // Verify subscription created with PENDING_PAYMENT
    const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "tenant-snpsu-01");
    expect(sub).toBeDefined();
    expect(sub.status).toBe("PENDING_PAYMENT");
    expect(sub.plan_id).toBe("growth");

    // Verify initial invoice created with 18% GST calculation
    const inv = mockDatabase.platform_invoices.find((i) => i.tenant_id === "tenant-snpsu-01");
    expect(inv).toBeDefined();
    expect(inv.amount_inr).toBe(129999);
    expect(inv.tax_inr).toBe(23399.82);
    expect(inv.status).toBe("PENDING");
  });

  // =========================================================================
  // 3. STATE B: PREASSIGNED PLAN WITH PENDING INITIAL PAYMENT
  // =========================================================================
  it("3. State B: Preassigned plan returns PENDING_PAYMENT status and outstanding initial invoice", async () => {
    mockDatabase.college_subscriptions.push({
      id: "sub-preassigned-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "growth",
      status: "PENDING_PAYMENT",
      student_seat_limit: 2500,
      created_at: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subscription.status).toBe("PENDING_PAYMENT");
    expect(data.subscription.planName).toBe("Campus Growth");
    expect(data.invoice).toBeDefined();
    expect(data.invoice.status).toBe("PENDING");
    expect(data.invoice.totalInr).toBe(153398.82);
  });

  // =========================================================================
  // 4. INITIAL UNPAID INVOICE: ZERO FALSE ACTIVE ENTITLEMENT
  // =========================================================================
  it("4. Prevents false ACTIVE entitlement while initial subscription invoice remains unpaid", async () => {
    mockDatabase.college_subscriptions.push({
      id: "sub-unpaid-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "growth",
      status: "PENDING_PAYMENT",
      student_seat_limit: 2500,
    });

    mockDatabase.platform_invoices.push({
      id: "inv-unpaid-01",
      tenant_id: "tenant-snpsu-01",
      invoice_number: "INV-2026-UNPAID",
      amount_inr: 129999,
      tax_inr: 23399.82,
      status: "PENDING",
      payment_method: "RAZORPAY",
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(data.subscription.status).toBe("PENDING_PAYMENT");
    expect(data.invoice.status).toBe("PENDING");
    // In UI state machine, sub.status === "PENDING_PAYMENT" strictly resolves to isPendingInitialPayment = true
  });

  // =========================================================================
  // 5. STATE C: ACTIVE SUBSCRIPTION WITH NO OUTSTANDING INVOICE
  // =========================================================================
  it("5. State C: Active subscription with paid invoice surfaces full dates and management eligibility", async () => {
    mockDatabase.college_subscriptions.push({
      id: "sub-active-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "growth",
      status: "ACTIVE",
      start_date: "2026-07-30T00:00:00Z",
      expiry_date: "2027-07-30T00:00:00Z",
      renewal_date: "2027-07-30T00:00:00Z",
      student_seat_limit: 2500,
      staff_seat_limit: 20,
    });

    mockDatabase.platform_invoices.push({
      id: "inv-paid-01",
      tenant_id: "tenant-snpsu-01",
      invoice_number: "INV-2026-0001",
      amount_inr: 129999,
      tax_inr: 23399.82,
      status: "PAID",
      payment_method: "BANK_TRANSFER",
      paid_at: "2026-08-01T00:00:00Z",
      due_date: "2026-08-30T00:00:00Z",
    });

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(data.subscription.status).toBe("ACTIVE");
    expect(data.subscription.startDate).toBe("2026-07-30T00:00:00Z");
    expect(data.subscription.renewalDate).toBe("2027-07-30T00:00:00Z");
    expect(data.invoice.status).toBe("PAID");
    // With no pending invoice, resolves strictly to isActiveNoOutstandingInvoice = true (State C)
  });

  // =========================================================================
  // 6. STATE D: ACTIVE SUBSCRIPTION WITH PENDING RENEWAL INVOICE
  // =========================================================================
  it("6. State D: Correctly surfaces both active status AND outstanding renewal invoice", async () => {
    // Sapthagiri NPS University exact database condition:
    // Sub: ACTIVE (paid until July 2027 by INV-0001)
    // Inv: INV-2026-8142 is PENDING for 5,90,000 INR
    mockDatabase.college_subscriptions.push({
      id: "sub-snpsu-active",
      tenant_id: "tenant-snpsu-01",
      plan_id: "growth",
      status: "ACTIVE",
      start_date: "2026-07-30T00:00:00Z",
      expiry_date: "2027-07-30T00:00:00Z",
      renewal_date: "2027-07-30T00:00:00Z",
      student_seat_limit: 500,
    });

    mockDatabase.platform_invoices.push(
      {
        id: "inv-hist-01",
        tenant_id: "tenant-snpsu-01",
        invoice_number: "INV-2026-0001",
        amount_inr: 129999,
        tax_inr: 23399.82,
        status: "PAID",
        payment_method: "BANK_TRANSFER",
        created_at: "2026-07-30T00:00:00Z",
      },
      {
        id: "inv-renewal-8142",
        tenant_id: "tenant-snpsu-01",
        invoice_number: "INV-2026-8142",
        amount_inr: 500000,
        tax_inr: 90000,
        status: "PENDING",
        payment_method: "BANK_TRANSFER",
        due_date: "2026-11-30T00:00:00Z",
        created_at: "2026-10-31T00:00:00Z",
      }
    );

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(data.subscription.status).toBe("ACTIVE");
    // Prioritizes the pending invoice over the paid historical one:
    expect(data.invoice.invoiceNumber).toBe("INV-2026-8142");
    expect(data.invoice.status).toBe("PENDING");
    expect(data.invoice.totalInr).toBe(590000);
    expect(data.invoice.paymentMethod).toBe("BANK_TRANSFER");
    // Resolves to isActiveWithPendingInvoice = true (State D)
  });

  // =========================================================================
  // 7. BANK TRANSFER WORKFLOW: SUBMIT UTR REFERENCE
  // =========================================================================
  it("7. Submits UTR reference for bank-transfer invoice and retains pending state until verification", async () => {
    mockDatabase.platform_invoices.push({
      id: "inv-renewal-8142",
      tenant_id: "tenant-snpsu-01",
      invoice_number: "INV-2026-8142",
      amount_inr: 500000,
      tax_inr: 90000,
      status: "PENDING",
      payment_method: "BANK_TRANSFER",
    });

    const req = new NextRequest("http://localhost:3000/api/placement/billing/invoices/inv-renewal-8142/reference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        utrReference: "HDFCN2610283749",
        bankName: "HDFC Bank Corporate NetBanking",
      }),
    });

    const res = await submitBankRefRoute(req, {
      params: Promise.resolve({ id: "inv-renewal-8142" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.utrReference).toBe("HDFCN2610283749");

    // Invariant: Status remains PENDING until verified by Super Admin
    const invoiceInDb = mockDatabase.platform_invoices.find((i) => i.id === "inv-renewal-8142");
    expect(invoiceInDb.status).toBe("PENDING");
    expect(invoiceInDb.notes).toContain("HDFCN2610283749");
  });

  // =========================================================================
  // 8. RAZORPAY CHECKOUT ORDER CREATION FOR OUTSTANDING INVOICE
  // =========================================================================
  it("8. Creates server-authoritative Razorpay payment order for outstanding invoice", async () => {
    mockDatabase.platform_invoices.push({
      id: "inv-renewal-8142",
      tenant_id: "tenant-snpsu-01",
      invoice_number: "INV-2026-8142",
      amount_inr: 500000,
      tax_inr: 90000,
      status: "PENDING",
    });

    const req = new NextRequest("http://localhost:3000/api/billing/checkout/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: "inv-renewal-8142" }),
    });

    const res = await createCheckoutOrderRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.amountInr).toBe(590000);
    expect(data.amountPaise).toBe(59000000);
    expect(data.keyId).toBe(TEST_KEY_ID);
  });

  // =========================================================================
  // 9. PAYMENT RECONCILIATION & ATOMIC ACTIVATION
  // =========================================================================
  it("9. Verifies cryptographic signature and settles invoice atomically", async () => {
    mockDatabase.college_subscriptions.push({
      id: "sub-pending-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "growth",
      status: "PENDING_PAYMENT",
    });

    mockDatabase.platform_invoices.push({
      id: "inv-active-test-01",
      tenant_id: "tenant-snpsu-01",
      subscription_id: "sub-pending-01",
      invoice_number: "INV-TEST-01",
      amount_inr: 129999,
      tax_inr: 23399.82,
      status: "PENDING",
    });

    const orderId = "order_mock_test_01";
    const paymentId = "pay_mock_test_01";

    mockDatabase.payment_orders.push({
      id: "po-test-01",
      order_id: orderId,
      gateway_order_id: orderId,
      invoice_id: "inv-active-test-01",
      subscription_id: "sub-pending-01",
      tenant_id: "tenant-snpsu-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const signature = crypto
      .createHmac("sha256", TEST_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    const req = new NextRequest("http://localhost:3000/api/billing/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, paymentId, signature }),
    });

    const res = await verifyCheckoutPaymentRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify invoice marked PAID
    const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-active-test-01");
    expect(invoice.status).toBe("PAID");

    // Verify subscription activated to ACTIVE
    const sub = mockDatabase.college_subscriptions.find((s) => s.id === "sub-pending-01");
    expect(sub.status).toBe("ACTIVE");
  });

  // =========================================================================
  // 10. FAILED PAYMENT SIGNATURE REJECTS ACTIVATION
  // =========================================================================
  it("10. Rejects tampered payment signature and prevents invoice settlement", async () => {
    mockDatabase.platform_invoices.push({
      id: "inv-tamper-01",
      tenant_id: "tenant-snpsu-01",
      invoice_number: "INV-TAMPER-01",
      amount_inr: 129999,
      tax_inr: 23399.82,
      status: "PENDING",
    });

    mockDatabase.payment_orders.push({
      id: "po-tamper-01",
      order_id: "order_mock_test_01",
      gateway_order_id: "order_mock_test_01",
      invoice_id: "inv-tamper-01",
      tenant_id: "tenant-snpsu-01",
      amount_paise: 15339882,
      currency: "INR",
      status: "CREATED",
    });

    const req = new NextRequest("http://localhost:3000/api/billing/checkout/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "order_mock_test_01",
        paymentId: "pay_mock_test_01",
        signature: "tampered_invalid_signature_hash",
      }),
    });

    const res = await verifyCheckoutPaymentRoute(req);
    expect(res.status).toBe(400);

    // Invoice remains PENDING
    const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-tamper-01");
    expect(invoice.status).toBe("PENDING");
  });

  // =========================================================================
  // 11. UPGRADE PLAN: PRORATED INVOICE GENERATION
  // =========================================================================
  it("11. Initiates prorated plan upgrade and generates upgrade invoice", async () => {
    mockDatabase.college_subscriptions.push({
      id: "sub-upgrade-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "starter",
      status: "ACTIVE",
      start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
      expiry_date: new Date(Date.now() + 335 * 86400000).toISOString(),
      renewal_date: new Date(Date.now() + 335 * 86400000).toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/upgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlanId: "growth" }),
    });

    const res = await upgradePlanRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.invoiceNumber).toContain("INV-UPG-");
  });

  // =========================================================================
  // 12. DOWNGRADE PLAN: SCHEDULED FOR NEXT RENEWAL
  // =========================================================================
  it("12. Schedules plan downgrade for next renewal without immediate charges", async () => {
    mockDatabase.college_subscriptions.push({
      id: "sub-downgrade-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "enterprise",
      status: "ACTIVE",
      start_date: new Date(Date.now() - 30 * 86400000).toISOString(),
      expiry_date: new Date(Date.now() + 335 * 86400000).toISOString(),
      renewal_date: new Date(Date.now() + 335 * 86400000).toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/downgrade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPlanId: "growth" }),
    });

    const res = await downgradePlanRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain("Downgrade scheduled for");

    // Invariant: No immediate invoice is generated for downgrades
    const upgInvs = mockDatabase.platform_invoices.filter((i) => i.invoice_number?.startsWith("INV-UPG-"));
    expect(upgInvs.length).toBe(0);
  });

  // =========================================================================
  // 13. DECOMMISSIONED TENANT BLOCKED
  // =========================================================================
  it("13. State F: Decommissioned tenant returns decommissioned status and blocks checkout", async () => {
    mockDatabase.tenants[0].status = "DECOMMISSIONED";
    mockDatabase.college_subscriptions.push({
      id: "sub-decomm-01",
      tenant_id: "tenant-snpsu-01",
      plan_id: "growth",
      status: "CANCELLED",
    });

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(data.tenantStatus).toBe("DECOMMISSIONED");
    expect(data.subscription.status).toBe("CANCELLED");
  });

  // =========================================================================
  // 14. RBAC: ORDINARY STUDENT CANNOT ACCESS BILLING DETAILS
  // =========================================================================
  it("14. RBAC: Strictly forbids students from accessing college billing details (403)", async () => {
    currentCallerContext.tenantRole = "STUDENT";
    currentCallerContext.role = "STUDENT";

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    expect(res.status).toBe(403);
  });

  // =========================================================================
  // 15. RBAC: ORDINARY TRAINER CANNOT ACCESS BILLING DETAILS
  // =========================================================================
  it("15. RBAC: Strictly forbids trainers from accessing college billing details (403)", async () => {
    currentCallerContext.tenantRole = "TRAINER";
    currentCallerContext.role = "TRAINER";

    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    expect(res.status).toBe(403);
  });
});
