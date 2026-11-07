import { describe, it, expect } from "vitest";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";

describe("Student Mastery and Mistake Bank Universal Access", () => {
  it("allows student to access mistake_to_mastery and placement_memory_analytics even when college is on Starter plan", async () => {
    const mockDatabase: Record<string, any[]> = {
      college_subscriptions: [
        {
          id: "sub-starter-123",
          tenant_id: "tenant-starter-123",
          status: "ACTIVE",
          plan_id: "starter",
          plan_version: 1,
          expiry_date: new Date(Date.now() + 86400000 * 30).toISOString(),
          entitlements_snapshot: {
            planId: "starter",
            planName: "Institutional Starter",
            planVersion: 1,
            entitlements: {
              mistake_to_mastery: false,
              placement_memory_analytics: false,
              department_hierarchy: true,
              academic_structure: true,
            },
            limits: {},
          },
        },
      ],
      tenants: [
        {
          id: "tenant-starter-123",
          status: "ACTIVE",
          name: "Test College",
        },
      ],
      subscription_invoices: [
        {
          id: "inv-1",
          tenant_id: "tenant-starter-123",
          payment_status: "PAID",
        },
      ],
    };

    const createMockAdmin = () => ({
      from: (tableName: string) => {
        if (!mockDatabase[tableName]) {
          mockDatabase[tableName] = [];
        }
        const tableData = mockDatabase[tableName];
        return {
          select: () => ({
            eq: (col: string, val: any) => ({
              eq: (col2: string, val2: any) => ({
                single: async () => ({
                  data: tableData.find((r) => r[col] === val && r[col2] === val2) || null,
                  error: null,
                }),
                maybeSingle: async () => ({
                  data: tableData.find((r) => r[col] === val && r[col2] === val2) || null,
                  error: null,
                }),
                data: tableData.filter((r) => r[col] === val && r[col2] === val2),
                error: null,
              }),
              order: () => ({
                limit: () => ({
                  data: tableData.filter((r) => r[col] === val),
                  error: null,
                }),
                data: tableData.filter((r) => r[col] === val),
                error: null,
              }),
              single: async () => ({
                data: tableData.find((r) => r[col] === val) || null,
                error: null,
              }),
              maybeSingle: async () => ({
                data: tableData.find((r) => r[col] === val) || null,
                error: null,
              }),
              data: tableData.filter((r) => r[col] === val),
              error: null,
            }),
            order: () => ({
              limit: () => ({
                data: tableData,
                error: null,
              }),
              data: tableData,
              error: null,
            }),
            maybeSingle: async () => ({
              data: tableData[0] || null,
              error: null,
            }),
            data: tableData,
            error: null,
          }),
          insert: async (data: any) => {
            const arr = Array.isArray(data) ? data : [data];
            tableData.push(...arr);
            return { data: arr, error: null };
          },
        };
      },
    });

    const mockAdmin = createMockAdmin();

    // 1. Student access to mistake_to_mastery must be ALLOWED
    const studentMistakeResult = await SubscriptionAccessService.evaluateAccess({
      tenantId: "tenant-starter-123",
      userRole: "STUDENT",
      userId: "student-user-1",
      permission: "mistake_bank.manage_own",
      admin: mockAdmin as any,
    });

    expect(studentMistakeResult.allowed).toBe(true);
    expect(studentMistakeResult.decision).toBe("ALLOW");

    // 2. Student access to placement_memory_analytics must be ALLOWED
    const studentAnalyticsResult = await SubscriptionAccessService.evaluateAccess({
      tenantId: "tenant-starter-123",
      userRole: "STUDENT",
      userId: "student-user-1",
      permission: "analytics.read_own",
      admin: mockAdmin as any,
    });

    expect(studentAnalyticsResult.allowed).toBe(true);
    expect(studentAnalyticsResult.decision).toBe("ALLOW");

    // 3. Institutional staff access to un-entitled mistake_to_mastery on Starter plan must still be gated
    const staffMistakeResult = await SubscriptionAccessService.evaluateAccess({
      tenantId: "tenant-starter-123",
      userRole: "PLACEMENT_HEAD",
      userId: "staff-user-1",
      featureKey: "mistake_to_mastery",
      admin: mockAdmin as any,
    });

    expect(staffMistakeResult.allowed).toBe(false);
    expect(staffMistakeResult.decision).toBe("DENY_ENTITLEMENT");
  });
});
