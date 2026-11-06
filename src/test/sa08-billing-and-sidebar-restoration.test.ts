/**
 * URPLACED — Comprehensive Regression Test Suite:
 * 1. College Activation & Multi-tier Decommissioning Lifecycle
 * 2. Invoice Settlement & Resilient Order Creation (UUID & Invoice Number)
 * 3. Verified Payment Activation & Immediate Operational Access Restoration
 * 4. Full 7-Section Sidebar Navigation Resolver Verification
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";
import * as razorpayLib from "@/lib/payment/razorpay";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { PaymentReconciliationService } from "@/modules/billing/services/payment-reconciliation-service";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";
import { getAuthorizedNavigation } from "@/lib/navigation/navigation-config";

describe("URPLACED — College Billing, Super Admin Lifecycle & Sidebar Restoration Suite", () => {
  let mockDatabase: {
    tenants: any[];
    college_subscriptions: any[];
    subscription_plans: any[];
    platform_invoices: any[];
    payment_orders: any[];
    payment_transactions: any[];
    audit_logs: any[];
    students: any[];
    departments: any[];
  };

  let mockAdmin: any;

  beforeEach(() => {
    mockDatabase = {
      tenants: [
        {
          id: "tenant-snpsu-01",
          name: "Sapthagiri NPS University",
          slug: "sapthagiri-nps-university",
          status: "SUSPENDED",
          student_seat_limit: 500,
          official_email: "admin@snpsu.edu.in",
          contact_name: "SNPSU-HRD",
          onboarding_status: "COMPLETED",
          created_at: "2026-10-26T00:00:00Z",
          updated_at: "2026-10-26T00:00:00Z",
        },
      ],
      subscription_plans: [
        {
          id: "growth",
          slug: "growth",
          name: "Campus Growth",
          version: 1,
          price_inr: 129999,
          student_limit: 500,
          staff_limit: 20,
          features: {
            core_drives_management: true,
            student_roster_directory: true,
            company_management: true,
            standard_assessments: true,
            subject_question_banks: true,
            custom_question_sets: true,
            drivefit_evaluator: true,
            mistake_to_mastery: true,
            placement_memory_analytics: true,
          },
        },
      ],
      college_subscriptions: [
        {
          id: "sub-snpsu-01",
          tenant_id: "tenant-snpsu-01",
          plan_id: "growth",
          status: "SUSPENDED",
          student_seat_limit: 500,
          staff_seat_limit: 20,
          renewal_date: "2026-11-30T00:00:00Z",
          expiry_date: "2026-11-30T00:00:00Z",
          created_at: "2026-10-26T00:00:00Z",
          updated_at: "2026-10-26T00:00:00Z",
        },
      ],
      platform_invoices: [
        {
          id: "inv-uuid-8142",
          invoice_number: "INV-2026-8142",
          tenant_id: "tenant-snpsu-01",
          subscription_id: "sub-snpsu-01",
          amount_inr: 500000,
          tax_inr: 90000,
          currency: "INR",
          status: "PENDING",
          due_date: "2026-11-30T00:00:00Z",
          payment_method: "BANK_TRANSFER",
          notes: "Renewal invoice for Sapthagiri NPS University",
          created_at: "2026-10-31T00:00:00Z",
          updated_at: "2026-10-31T00:00:00Z",
        },
      ],
      payment_orders: [],
      payment_transactions: [],
      audit_logs: [],
      students: [{ id: "std-01", tenant_id: "tenant-snpsu-01", full_name: "Alice" }],
      departments: [{ id: "dept-01", tenant_id: "tenant-snpsu-01", name: "CSE" }],
    };

    mockAdmin = {
      from: vi.fn((table: string) => {
        const rows = mockDatabase[table as keyof typeof mockDatabase] || [];
        let filtered = [...rows];
        let pendingUpdate: any = null;
        let isDelete = false;
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
            if (isDelete) {
              const toKeep = rows.filter((r) => r[col] !== val);
              (mockDatabase as any)[table] = toKeep;
            }
            return chain;
          }),
          or: vi.fn((clause: string) => {
            return chain;
          }),
          ilike: vi.fn(() => chain),
          order: vi.fn(() => chain),
          limit: vi.fn((n: number) => {
            filtered = filtered.slice(0, n);
            return chain;
          }),
          single: vi.fn(() => {
            if (isInsert && insertData) {
              return Promise.resolve({ data: insertData, error: null });
            }
            return Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : { message: "Not found" } });
          }),
          maybeSingle: vi.fn(() => {
            return Promise.resolve({ data: filtered[0] || null, error: null });
          }),
          insert: vi.fn((data: any) => {
            isInsert = true;
            insertData = Array.isArray(data) ? data[0] : data;
            if (!insertData.id) insertData.id = `gen-${Date.now()}`;
            rows.push(insertData);
            return chain;
          }),
          upsert: vi.fn((data: any) => {
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
          delete: vi.fn(() => {
            isDelete = true;
            return chain;
          }),
          then: (resolve: (val: any) => void) => {
            if (isDelete) {
              resolve({ data: null, error: null });
            } else if (isInsert) {
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
      auth: {
        admin: {
          deleteUser: vi.fn().mockResolvedValue({ data: {}, error: null }),
        },
      },
      storage: {
        from: vi.fn(() => ({
          list: vi.fn().mockResolvedValue({ data: [], error: null }),
          remove: vi.fn().mockResolvedValue({ error: null }),
        })),
      },
    };

    process.env.RAZORPAY_KEY_ID = "rzp_test_snpsu_mock_key";
    process.env.RAZORPAY_KEY_SECRET = "mock_secret_snpsu_12345";
    process.env.RAZORPAY_MODE = "test";

    vi.spyOn(razorpayLib, "getRazorpayClient").mockReturnValue({
      orders: {
        create: vi.fn(async (args: any) => ({
          id: "order_rzp_8142_verified",
          amount: args.amount,
          currency: args.currency || "INR",
          receipt: args.receipt,
          status: "created",
        })),
      },
      payments: {
        fetch: vi.fn(async (paymentId: string) => ({
          id: paymentId,
          order_id: "order_rzp_8142_verified",
          amount: 59000000,
          currency: "INR",
          status: "captured",
          method: "card",
        })),
      },
    } as any);
  });

  // =========================================================================
  // TEST GROUP 1: Super Admin College Status & Decommissioning
  // =========================================================================
  describe("Super Admin College Status & Decommissioning", () => {
    it("1.1 Successfully activates a SUSPENDED college and keeps subscription in sync", async () => {
      const res = await PlatformCollegeService.updateCollegeStatus({
        tenantId: "tenant-snpsu-01",
        status: "ACTIVE",
        reason: "Institutional payment and KYC cleared",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("ACTIVE");

      const tenant = mockDatabase.tenants.find((t) => t.id === "tenant-snpsu-01");
      expect(tenant?.status).toBe("ACTIVE");

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "tenant-snpsu-01");
      expect(sub?.status).toBe("ACTIVE");
    });

    it("1.2 Successfully suspends an ACTIVE college and keeps subscription in sync", async () => {
      mockDatabase.tenants[0].status = "ACTIVE";
      mockDatabase.college_subscriptions[0].status = "ACTIVE";

      const res = await PlatformCollegeService.updateCollegeStatus({
        tenantId: "tenant-snpsu-01",
        status: "SUSPENDED",
        reason: "Administrative policy audit",
        adminId: "admin-super-01",
        admin: mockAdmin,
      });

      expect(res.success).toBe(true);
      expect(res.status).toBe("SUSPENDED");

      const tenant = mockDatabase.tenants.find((t) => t.id === "tenant-snpsu-01");
      expect(tenant?.status).toBe("SUSPENDED");

      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "tenant-snpsu-01");
      expect(sub?.status).toBe("SUSPENDED");
    });

    it("1.3 Decommissions college permanently by cleaning up child records without constraint failures", async () => {
      const res = await PlatformCollegeService.decommissionCollege({
        tenantId: "tenant-snpsu-01",
        adminId: "admin-super-01",
        reason: "Contract terminated by mutual agreement",
        hardDelete: true,
        admin: mockAdmin,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("permanently deleted");

      // Verify child records and tenant were deleted
      expect(mockDatabase.tenants.find((t) => t.id === "tenant-snpsu-01")).toBeUndefined();
      expect(mockDatabase.students.find((s) => s.tenant_id === "tenant-snpsu-01")).toBeUndefined();
      expect(mockDatabase.departments.find((d) => d.tenant_id === "tenant-snpsu-01")).toBeUndefined();
    });
  });

  // =========================================================================
  // TEST GROUP 2: Resilient Payment Order Creation & Invoice Resolution
  // =========================================================================
  describe("Resilient Payment Order Creation & Invoice Resolution", () => {
    it("2.1 Resolves invoice by exact UUID", async () => {
      const order = await PaymentReconciliationService.createPaymentOrder({
        invoiceId: "inv-uuid-8142",
        tenantId: "tenant-snpsu-01",
        userId: "user-snpsu-head",
        admin: mockAdmin,
      });

      expect(order.invoiceId).toBe("inv-uuid-8142");
      expect(order.invoiceNumber).toBe("INV-2026-8142");
      expect(order.amountInr).toBe(590000);
      expect(order.amountPaise).toBe(59000000);
    });

    it("2.2 Resolves invoice by human-readable invoice number (INV-2026-8142)", async () => {
      const order = await PaymentReconciliationService.createPaymentOrder({
        invoiceId: "INV-2026-8142",
        tenantId: "tenant-snpsu-01",
        userId: "user-snpsu-head",
        admin: mockAdmin,
      });

      expect(order.invoiceId).toBe("inv-uuid-8142");
      expect(order.invoiceNumber).toBe("INV-2026-8142");
      expect(order.amountInr).toBe(590000);
    });

    it("2.3 Resolves to tenant's pending invoice if an outdated cached ID was passed", async () => {
      const order = await PaymentReconciliationService.createPaymentOrder({
        invoiceId: "stale-cached-uuid-that-does-not-exist",
        tenantId: "tenant-snpsu-01",
        userId: "user-snpsu-head",
        admin: mockAdmin,
      });

      expect(order.invoiceId).toBe("inv-uuid-8142");
      expect(order.invoiceNumber).toBe("INV-2026-8142");
      expect(order.amountInr).toBe(590000);
    });
  });

  // =========================================================================
  // TEST GROUP 3: Post-Payment Entitlement Activation & Access Restoration
  // =========================================================================
  describe("Post-Payment Entitlement Activation & Access Restoration", () => {
    it("3.1 Verified payment marks invoice PAID and reactivates subscription & tenant atomically", async () => {
      const orderId = "order_rzp_8142_verified";
      const paymentId = "pay_rzp_8142_captured";

      // Seed payment order in mockDatabase
      mockDatabase.payment_orders.push({
        id: "po-8142",
        order_id: orderId,
        tenant_id: "tenant-snpsu-01",
        invoice_id: "inv-uuid-8142",
        amount_paise: 59000000,
        currency: "INR",
        status: "CREATED",
      });

      const validSignature = crypto
        .createHmac("sha256", "mock_secret_snpsu_12345")
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

      const reconResult = await PaymentReconciliationService.reconcilePayment({
        orderId,
        paymentId,
        signature: validSignature,
        source: "CHECKOUT_VERIFICATION",
        admin: mockAdmin,
      });

      expect(reconResult.success).toBe(true);

      // Verify invoice settled
      const invoice = mockDatabase.platform_invoices.find((i) => i.id === "inv-uuid-8142");
      expect(invoice?.status).toBe("PAID");

      // Verify subscription activated
      const sub = mockDatabase.college_subscriptions.find((s) => s.tenant_id === "tenant-snpsu-01");
      expect(sub?.status).toBe("ACTIVE");

      // Verify tenant status is ACTIVE
      const tenant = mockDatabase.tenants.find((t) => t.id === "tenant-snpsu-01");
      expect(tenant?.status).toBe("ACTIVE");
    });

    it("3.2 SubscriptionAccessService evaluates ACTIVE access with canAccessOperational = true", async () => {
      // Setup active subscription without snapshot column (live DB schema condition)
      mockDatabase.tenants[0].status = "ACTIVE";
      mockDatabase.college_subscriptions[0].status = "ACTIVE";
      delete mockDatabase.college_subscriptions[0].entitlements_snapshot;

      const access = await SubscriptionAccessService.evaluateAccess({
        tenantId: "tenant-snpsu-01",
        userRole: "PLACEMENT_HEAD",
        userId: "user-head-01",
        admin: mockAdmin,
        skipDenialLogging: true,
      });

      expect(access.allowed).toBe(true);
      expect(access.decision).toBe("ALLOW");
      expect(access.canAccessOperational).toBe(true);
      expect(access.subscriptionStatus).toBe("ACTIVE");
      expect(access.planId).toBe("growth");
      expect(access.entitlements?.student_roster_directory).toBe(true);
      expect(access.entitlements?.core_drives_management).toBe(true);
    });

    it("3.3 Navigation resolver generates all 7 operational navigation sections when ACTIVE", () => {
      const userRole = "PLACEMENT_HEAD";
      const isPlatformAdmin = false;
      const userPermissions: string[] = []; // Standard empty DB membership
      const effectiveSubStatus = "ACTIVE";
      const isGrace = false;

      const navSections = getAuthorizedNavigation(
        userRole,
        isPlatformAdmin,
        userPermissions,
        effectiveSubStatus,
        isGrace
      );

      expect(navSections.length).toBe(7);

      const sectionTitles = navSections.map((s) => s.title);
      expect(sectionTitles).toContain("Placement Overview");
      expect(sectionTitles).toContain("Student Operations");
      expect(sectionTitles).toContain("Recruitment Drives");
      expect(sectionTitles).toContain("Preparation & Training");
      expect(sectionTitles).toContain("Placement Intelligence");
      expect(sectionTitles).toContain("College Administration");
      expect(sectionTitles).toContain("Account & Subscription");

      // Verify specific items inside operational sections
      const overviewItems = navSections.find((s) => s.title === "Placement Overview")?.items.map((i) => i.name);
      expect(overviewItems).toContain("Command Center");

      const studentOpsItems = navSections.find((s) => s.title === "Student Operations")?.items.map((i) => i.name);
      expect(studentOpsItems).toContain("Student Directory");

      const driveItems = navSections.find((s) => s.title === "Recruitment Drives")?.items.map((i) => i.name);
      expect(driveItems).toContain("Recruitment Drives");
      expect(driveItems).toContain("Placement Offers");

      const adminItems = navSections.find((s) => s.title === "College Administration")?.items.map((i) => i.name);
      expect(adminItems).toContain("Academic Structure");
      expect(adminItems).toContain("Staff & Members");
    });
  });
});
