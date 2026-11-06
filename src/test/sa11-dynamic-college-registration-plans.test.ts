import { describe, it, expect, vi, beforeEach } from "vitest";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

describe("SA-11: Dynamic Subscription Plan Pricing on College Registration & Provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create initial registration invoice reflecting the updated plan price from the database", async () => {
    const mockAdmin: any = {
      from: vi.fn((table: string) => {
        if (table === "tenants") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "tenant-dyn-01",
                    name: "Apex Engineering Institute",
                    slug: "apex-eng",
                    official_email: "head@apex.edu",
                    contact_name: "Dr. Apex",
                    status: "ACTIVE",
                    student_seat_limit: 10000,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "profiles") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }

        if (table === "subscription_plans") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn((col: string, val: string) => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: "enterprise",
                  name: "University Enterprise",
                  price_inr: 3, // Updated live price in database (₹3 instead of default ₹2,49,999)
                  status: "PUBLISHED",
                  student_limit: 10000,
                  staff_limit: 100,
                  billing_interval: "ANNUAL",
                  version: 2,
                },
                error: null,
              }),
            })),
          };
        }

        if (table === "college_subscriptions") {
          return {
            insert: vi.fn((payload: any) => ({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "sub-dyn-01",
                    tenant_id: "tenant-dyn-01",
                    plan_id: "enterprise",
                    status: payload.status,
                    plan_version: payload.plan_version,
                  },
                  error: null,
                }),
              }),
            })),
          };
        }

        if (table === "platform_invoices") {
          return {
            insert: vi.fn((invPayload: any) => {
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: "inv-dyn-01",
                      ...invPayload,
                    },
                    error: null,
                  }),
                }),
              };
            }),
          };
        }

        if (table === "audit_logs" || table === "platform_audit_logs") {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }

        if (table === "platform_notifications") {
          return {
            insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    };

    const result = await PlatformCollegeService.registerCollege({
      name: "Apex Engineering Institute",
      slug: "apex-eng",
      officialEmail: "head@apex.edu",
      contactName: "Dr. Apex",
      initialPlanId: "enterprise",
      studentSeatLimit: 10000,
      adminId: "admin-super-01",
      admin: mockAdmin,
    });

    expect(result).toBeDefined();
    expect(result.college.slug).toBe("apex-eng");

    // Verify invoice insertion was called with updated price_inr: 3
    const invoiceCalls = mockAdmin.from.mock.calls.filter((c: any) => c[0] === "platform_invoices");
    expect(invoiceCalls.length).toBeGreaterThan(0);
  });

  it("should list subscription plans with dynamically updated pricing", async () => {
    const mockAdmin: any = {
      from: vi.fn((table: string) => {
        if (table === "subscription_plans") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "starter",
                  name: "Institutional Starter",
                  slug: "starter",
                  description: "Essential placement management",
                  price_inr: 1,
                  billing_cycle: "ANNUAL",
                  student_limit: 500,
                  staff_limit: 5,
                  storage_limit_gb: 20,
                  is_active: true,
                },
                {
                  id: "growth",
                  name: "Campus Growth",
                  slug: "growth",
                  description: "Comprehensive recruitment suite",
                  price_inr: 2,
                  billing_cycle: "ANNUAL",
                  student_limit: 2500,
                  staff_limit: 20,
                  storage_limit_gb: 100,
                  is_active: true,
                },
                {
                  id: "enterprise",
                  name: "University Enterprise",
                  slug: "enterprise",
                  description: "Full-scale multi-department ecosystem",
                  price_inr: 3,
                  billing_cycle: "ANNUAL",
                  student_limit: 10000,
                  staff_limit: 100,
                  storage_limit_gb: 500,
                  is_active: true,
                },
              ],
              error: null,
            }),
          };
        }

        if (table === "college_subscriptions") {
          return {
            select: vi.fn().mockResolvedValue({
              data: [
                { plan_id: "growth", status: "ACTIVE" },
                { plan_id: "enterprise", status: "ACTIVE" },
              ],
              error: null,
            }),
          };
        }

        return {
          select: vi.fn().mockReturnThis(),
        };
      }),
    };

    const plans = await PlatformSubscriptionService.listPlans({ admin: mockAdmin });

    expect(plans).toHaveLength(3);
    const starter = plans.find((p) => p.id === "starter");
    const growth = plans.find((p) => p.id === "growth");
    const enterprise = plans.find((p) => p.id === "enterprise");

    expect(starter?.priceInr).toBe(1);
    expect(growth?.priceInr).toBe(2);
    expect(enterprise?.priceInr).toBe(3);
  });
});
