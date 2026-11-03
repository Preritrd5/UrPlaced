/**
 * URPLACED — P0 Demo Unpaid College Initial Payment Enforcement & Access Lockdown
 *
 * Verifies that newly registered colleges (e.g. 'Demo', 'Sapthagiri NPS University') with an
 * unpaid initial subscription invoice:
 * 1. Receive ZERO operational entitlements in backend authorization guards.
 * 2. Are classified as INITIAL_SUBSCRIPTION (never RENEWAL).
 * 3. Have their navigation strictly locked to 'Subscription & Billing' and 'My Profile'.
 * 4. Surface STATE B in the billing UI ('Institutional Subscription Pending Activation'),
 *    never STATE D ('Outstanding Institutional Renewal Invoice' or 7-day grace).
 * 5. Unlock all operational modules immediately upon verified initial invoice settlement.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";
import { getAuthorizedNavigation } from "@/lib/navigation/navigation-config";
import { GET as getSubscriptionRoute } from "@/app/api/placement/subscription/route";
import { GET as getAuthContextRoute } from "@/app/api/auth/context/route";
import { Permissions } from "@/modules/identity-access/services/policy-engine";

// Mock Supabase admin and server contexts
let mockDatabase: {
  tenants: any[];
  college_subscriptions: any[];
  platform_invoices: any[];
  subscription_plans: any[];
  profiles: any[];
  tenant_memberships: any[];
};

let mockAdmin: any;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockAdmin,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({
          data: {
            user: {
              id: "user-demo-head-01",
              email: "placement@demo.edu",
              app_metadata: {
                role: "PLACEMENT_HEAD",
                account_category: "COLLEGE",
                tenant_id: "tenant-demo-01",
                verified_by_server: true,
              },
              user_metadata: {
                full_name: "Demo-HRD",
                institution_name: "Demo",
              },
            },
          },
          error: null,
        })
      ),
    },
  }),
}));

vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(async () => ({
    userId: "user-demo-head-01",
    email: "placement@demo.edu",
    fullName: "Demo-HRD",
    tenantId: "tenant-demo-01",
    tenantRole: "PLACEMENT_HEAD",
    isPlatformAdmin: false,
    permissions: [],
    accountCategory: "COLLEGE",
  })),
}));

describe("URPLACED — Unpaid College Initial Payment Enforcement & Access Lockdown", () => {
  beforeEach(() => {
    mockDatabase = {
      tenants: [
        {
          id: "tenant-demo-01",
          name: "Demo",
          slug: "demo",
          status: "ACTIVE",
          student_seat_limit: 1000,
          official_email: "placement@demo.edu",
          contact_name: "Demo-HRD",
          onboarding_status: "COMPLETED",
          created_at: "2026-11-03T00:00:00Z",
          updated_at: "2026-11-03T00:00:00Z",
        },
      ],
      subscription_plans: [
        {
          id: "growth",
          slug: "growth",
          name: "Campus Growth",
          version: 1,
          price_inr: 129999,
          student_limit: 1000,
          staff_limit: 25,
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
      // Sub is inserted as ACTIVE by DB constraint fallback, but invoice is PENDING
      college_subscriptions: [
        {
          id: "sub-demo-01",
          tenant_id: "tenant-demo-01",
          plan_id: "growth",
          status: "ACTIVE",
          student_seat_limit: 1000,
          staff_seat_limit: 25,
          start_date: "2026-11-03T00:00:00Z",
          expiry_date: "2027-11-03T00:00:00Z",
          renewal_date: "2027-11-03T00:00:00Z",
          created_at: "2026-11-03T00:00:00Z",
          updated_at: "2026-11-03T00:00:00Z",
        },
      ],
      platform_invoices: [
        {
          id: "inv-demo-8925",
          invoice_number: "INV-2026-8925",
          tenant_id: "tenant-demo-01",
          subscription_id: "sub-demo-01",
          amount_inr: 129999,
          tax_inr: 23399.82,
          currency: "INR",
          status: "PENDING",
          due_date: "2026-12-03T00:00:00Z",
          payment_method: "BANK_TRANSFER",
          notes: "Initial registration invoice for Demo",
          created_at: "2026-11-03T00:00:00Z",
          updated_at: "2026-11-03T00:00:00Z",
        },
      ],
      profiles: [
        {
          id: "user-demo-head-01",
          email: "placement@demo.edu",
          full_name: "Demo-HRD",
          is_platform_admin: false,
        },
      ],
      tenant_memberships: [
        {
          id: "mem-demo-01",
          user_id: "user-demo-head-01",
          tenant_id: "tenant-demo-01",
          role: "PLACEMENT_HEAD",
          status: "ACTIVE",
          tenants: {
            id: "tenant-demo-01",
            name: "Demo",
            status: "ACTIVE",
          },
        },
      ],
    };

    mockAdmin = {
      from: vi.fn((table: string) => {
        let rows = mockDatabase[table as keyof typeof mockDatabase] || [];
        let filtered = [...rows];

        // Synthesize relational joins for in-memory mock
        if (table === "tenants") {
          filtered = rows.map((t: any) => ({
            ...t,
            college_subscriptions: (mockDatabase.college_subscriptions || [])
              .filter((s: any) => s.tenant_id === t.id)
              .map((s: any) => ({
                ...s,
                subscription_plans: (mockDatabase.subscription_plans || []).filter((p: any) => p.id === s.plan_id),
              })),
          }));
        } else if (table === "college_subscriptions") {
          filtered = rows.map((s: any) => ({
            ...s,
            subscription_plans: (mockDatabase.subscription_plans || []).filter((p: any) => p.id === s.plan_id),
          }));
        }
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
                if (r[col] === val) Object.assign(r, pendingUpdate);
              });
            }
            if (isDelete) {
              const toKeep = rows.filter((r) => r[col] !== val);
              (mockDatabase as any)[table] = toKeep;
            }
            return chain;
          }),
          order: vi.fn(() => chain),
          limit: vi.fn((n: number) => {
            filtered = filtered.slice(0, n);
            return chain;
          }),
          single: vi.fn(() => Promise.resolve({ data: filtered[0] || null, error: filtered[0] ? null : { message: "Not found" } })),
          maybeSingle: vi.fn(() => Promise.resolve({ data: filtered[0] || null, error: null })),
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
          delete: vi.fn(() => {
            isDelete = true;
            return chain;
          }),
          then: (resolve: (val: any) => void) => {
            if (isDelete) resolve({ data: null, error: null });
            else if (isInsert) resolve({ data: insertData, error: null });
            else resolve({ data: filtered, error: null });
          },
        };

        return chain;
      }),
    };
  });

  // 1. Authoritative Backend Denial on Unpaid College
  it("1. Blocks operational placement actions for newly registered college with unpaid initial invoice", async () => {
    const access = await SubscriptionAccessService.evaluateAccess({
      tenantId: "tenant-demo-01",
      userRole: "PLACEMENT_HEAD",
      userId: "user-demo-head-01",
      permission: Permissions.DRIVES_MANAGE,
      admin: mockAdmin,
      skipDenialLogging: true,
    });

    expect(access.allowed).toBe(false);
    expect(access.decision).toBe("DENY_PENDING_PAYMENT");
    expect(access.reasonCode).toBe("INITIAL_SUBSCRIPTION_UNPAID");
    expect(access.canAccessOperational).toBe(false);
    expect(access.subscriptionStatus).toBe("PENDING_PAYMENT");
    expect(access.canAccessBilling).toBe(true);
  });

  // 2. Exempt Self-Service Route Access (Billing & Profile) Permitted
  it("2. Allows Placement Head to access billing self-service under unpaid initial status", async () => {
    const access = await SubscriptionAccessService.evaluateAccess({
      tenantId: "tenant-demo-01",
      userRole: "PLACEMENT_HEAD",
      userId: "user-demo-head-01",
      permission: "billing.read",
      admin: mockAdmin,
      skipDenialLogging: true,
    });

    expect(access.allowed).toBe(true);
    expect(access.decision).toBe("ALLOW");
    expect(access.canAccessOperational).toBe(false);
    expect(access.canAccessBilling).toBe(true);
    expect(access.subscriptionStatus).toBe("PENDING_PAYMENT");
  });

  // 3. Subscription API Classification
  it("3. /api/placement/subscription classifies invoice as INITIAL_SUBSCRIPTION with status PENDING_PAYMENT", async () => {
    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.subscription.status).toBe("PENDING_PAYMENT");
    expect(data.subscription.effectiveStatus).toBe("PENDING_PAYMENT");
    expect(data.subscription.canAccessOperational).toBe(false);
    expect(data.hasPaidInitialInvoice).toBe(false);
    expect(data.invoice.invoiceNumber).toBe("INV-2026-8925");
    expect(data.invoice.status).toBe("PENDING");
    expect(data.invoice.type).toBe("INITIAL_SUBSCRIPTION");
    expect(data.invoice.totalInr).toBe(153398.82);
  });

  // 4. Navigation Lockdown: Only Billing & Profile Visible
  it("4. Sidebar navigation renders strictly Subscription & Billing and My Profile for unpaid college", () => {
    const sections = getAuthorizedNavigation(
      "PLACEMENT_HEAD",
      false, // not platform admin
      [],
      "PENDING_PAYMENT", // locked effective sub status
      false // no grace period
    );

    // Only "Account & Subscription" section should be present
    expect(sections).toHaveLength(1);
    expect(sections[0].title).toBe("Account & Subscription");
    expect(sections[0].items).toHaveLength(2);
    expect(sections[0].items.map((i) => i.href)).toEqual([
      "/dashboard/billing",
      "/dashboard/profile",
    ]);

    // All operational modules (Questions, Assessments, Drives, Training, Mistakes, Memory, Analytics, Structure, Members) MUST BE ABSENT
    const allHrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(allHrefs).not.toContain("/dashboard");
    expect(allHrefs).not.toContain("/dashboard/questions");
    expect(allHrefs).not.toContain("/dashboard/assessments");
    expect(allHrefs).not.toContain("/dashboard/drives");
    expect(allHrefs).not.toContain("/dashboard/training");
    expect(allHrefs).not.toContain("/dashboard/mistakes");
    expect(allHrefs).not.toContain("/dashboard/memory");
    expect(allHrefs).not.toContain("/dashboard/analytics");
    expect(allHrefs).not.toContain("/dashboard/settings/academic");
    expect(allHrefs).not.toContain("/dashboard/members");
  });

  // 5. Post-Payment Unlocking: Immediate Operational Access
  it("5. Unlocks full operational access and all sidebar items immediately upon initial payment settlement", async () => {
    // Simulate payment settlement
    mockDatabase.platform_invoices[0].status = "PAID";
    mockDatabase.platform_invoices[0].paid_at = new Date().toISOString();

    const access = await SubscriptionAccessService.evaluateAccess({
      tenantId: "tenant-demo-01",
      userRole: "PLACEMENT_HEAD",
      userId: "user-demo-head-01",
      permission: Permissions.DRIVES_MANAGE,
      admin: mockAdmin,
      skipDenialLogging: true,
    });

    expect(access.allowed).toBe(true);
    expect(access.decision).toBe("ALLOW");
    expect(access.canAccessOperational).toBe(true);
    expect(access.subscriptionStatus).toBe("ACTIVE");

    // Subscription endpoint reflects verified payment
    const req = new NextRequest("http://localhost:3000/api/placement/subscription");
    const res = await getSubscriptionRoute(req);
    const data = await res.json();

    expect(data.subscription.status).toBe("ACTIVE");
    expect(data.subscription.canAccessOperational).toBe(true);
    expect(data.hasPaidInitialInvoice).toBe(true);
    expect(data.invoice.status).toBe("PAID");

    // Navigation reflects full operational suite
    const unlockedSections = getAuthorizedNavigation(
      "PLACEMENT_HEAD",
      false,
      [],
      "ACTIVE",
      false
    );

    const unlockedHrefs = unlockedSections.flatMap((s) => s.items.map((i) => i.href));
    expect(unlockedHrefs).toContain("/dashboard");
    expect(unlockedHrefs).toContain("/dashboard/questions");
    expect(unlockedHrefs).toContain("/dashboard/assessments");
    expect(unlockedHrefs).toContain("/dashboard/drives");
    expect(unlockedHrefs).toContain("/dashboard/training");
    expect(unlockedHrefs).toContain("/dashboard/mistakes");
    expect(unlockedHrefs).toContain("/dashboard/memory");
    expect(unlockedHrefs).toContain("/dashboard/analytics");
    expect(unlockedHrefs).toContain("/dashboard/billing");
    expect(unlockedHrefs).toContain("/dashboard/profile");
  });
});
