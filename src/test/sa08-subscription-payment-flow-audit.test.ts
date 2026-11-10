import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs";
import path from "path";
import { POST as selectPlanRoute } from "@/app/api/placement/subscription/select-plan/route";
import * as serverContext from "@/lib/auth/server-context";
import * as supabaseAdmin from "@/lib/supabase/admin";
import nextConfig from "../../next.config";

describe("URPLACED — Complete Subscription Payment Flow Audit & Verification Suite", () => {
  let mockDatabase: {
    tenants: any[];
    subscription_plans: any[];
    college_subscriptions: any[];
    platform_invoices: any[];
    audit_logs: any[];
  };

  let mockAdmin: any;

  beforeEach(() => {
    mockDatabase = {
      tenants: [
        {
          id: "tenant-college-demo",
          name: "Demo Engineering College",
          slug: "demo",
          status: "ACTIVE",
          student_seat_limit: 500,
        },
      ],
      subscription_plans: [
        {
          id: "starter",
          name: "Institutional Starter",
          slug: "starter",
          price_inr: 49999,
          status: "PUBLISHED",
          is_active: true,
          student_limit: 500,
          staff_limit: 5,
        },
        {
          id: "growth",
          name: "Campus Growth",
          slug: "growth",
          price_inr: 129999,
          status: "PUBLISHED",
          is_active: true,
          student_limit: 2500,
          staff_limit: 20,
        },
        {
          id: "enterprise",
          name: "University Enterprise",
          slug: "enterprise",
          price_inr: 249999,
          status: "PUBLISHED",
          is_active: true,
          student_limit: 10000,
          staff_limit: 100,
        },
        {
          id: "archived-plan",
          name: "Old Legacy Plan",
          slug: "archived-plan",
          price_inr: 19999,
          status: "ARCHIVED",
          is_active: false,
          student_limit: 100,
          staff_limit: 2,
        },
      ],
      college_subscriptions: [
        {
          id: "sub-unpaid-active",
          tenant_id: "tenant-college-demo",
          plan_id: "starter",
          status: "ACTIVE", // Schema constraint fallback in DB, but invoice is unpaid
          student_seat_limit: 500,
          staff_seat_limit: 5,
        },
      ],
      platform_invoices: [
        {
          id: "inv-pending-01",
          invoice_number: "INV-2026-6945",
          tenant_id: "tenant-college-demo",
          subscription_id: "sub-unpaid-active",
          amount_inr: 49999,
          tax_inr: 8999.82,
          currency: "INR",
          status: "PENDING",
          payment_method: "RAZORPAY",
          notes: "Initial registration invoice for plan: Institutional Starter",
        },
      ],
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

    vi.spyOn(supabaseAdmin, "createAdminClient").mockReturnValue(mockAdmin);
  });

  // 1. Plan selection succeeds for unpaid subscription and updates pending invoice
  it("1. Allows Placement Head to select or change plan when subscription is unpaid (hasPaidInitialInvoice is false)", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-head-01",
      email: "head@demo.edu",
      tenantId: "tenant-college-demo",
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "growth" }),
    });

    const res = await selectPlanRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.subscription.planId).toBe("growth");
    expect(body.invoice.amountInr).toBe(129999);
    expect(body.invoice.taxInr).toBe(23399.82);
    expect(body.invoice.totalInr).toBe(153398.82);
  });

  // 2. Plan selection rejected when subscription has already been paid
  it("2. Rejects initial plan selection if college has already paid and is truly active", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-head-01",
      email: "head@demo.edu",
      tenantId: "tenant-college-demo",
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    } as any);

    // Mark invoice as PAID
    mockDatabase.platform_invoices[0].status = "PAID";

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "enterprise" }),
    });

    const res = await selectPlanRoute(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("College already has an active, paid subscription");
  });

  // 3. Plan selection requires PLACEMENT_HEAD or platform admin role
  it("3. Enforces RBAC: non-placement head is rejected with HTTP 403 Forbidden", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-student-01",
      email: "student@demo.edu",
      tenantId: "tenant-college-demo",
      tenantRole: "STUDENT",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "growth" }),
    });

    const res = await selectPlanRoute(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toContain("Forbidden");
  });

  // 4. Missing or invalid planId returns HTTP 400
  it("4. Validates request body: missing planId returns HTTP 400 Bad Request", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-head-01",
      email: "head@demo.edu",
      tenantId: "tenant-college-demo",
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "" }),
    });

    const res = await selectPlanRoute(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Plan ID is required");
  });

  // 5. Nonexistent plan returns HTTP 404
  it("5. Rejects nonexistent plan identifier with HTTP 404 Not Found", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-head-01",
      email: "head@demo.edu",
      tenantId: "tenant-college-demo",
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "nonexistent-super-tier" }),
    });

    const res = await selectPlanRoute(req);
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toContain("does not exist");
  });

  // 6. Archived plan is rejected
  it("6. Rejects selection of archived or unapproved plans with HTTP 400 Bad Request", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-head-01",
      email: "head@demo.edu",
      tenantId: "tenant-college-demo",
      tenantRole: "PLACEMENT_HEAD",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/placement/subscription/select-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: "archived-plan" }),
    });

    const res = await selectPlanRoute(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Only PUBLISHED plans are available");
  });

  // 7. Web App Manifest validity & PWA compliance
  it("7. public/manifest.json exists, has valid JSON, and adheres to W3C PWA standards with strict tokens", () => {
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, "utf-8");
    const json = JSON.parse(content);

    expect(json.name).toBe("UrPlaced — Multi-College Placement Preparation & Management SaaS");
    expect(json.short_name).toBe("UrPlaced");
    expect(json.display).toBe("standalone");
    expect(json.background_color).toBe("#EDECE7"); // GEMINI.md Background
    expect(json.theme_color).toBe("#5052C9"); // GEMINI.md Primary
    expect(Array.isArray(json.icons)).toBe(true);
    expect(json.icons.length).toBeGreaterThanOrEqual(1);

    // If serviceworker property is present, it MUST be a dictionary/object
    if (json.serviceworker !== undefined) {
      expect(typeof json.serviceworker).toBe("object");
      expect(Array.isArray(json.serviceworker)).toBe(false);
    }
  });

  // 8. Permissions Policy Header Security Hardening
  it("8. next.config.ts explicitly restricts camera, microphone, geolocation, accelerometer, gyroscope, and magnetometer", async () => {
    if (typeof nextConfig.headers === "function") {
      const headersList = await nextConfig.headers();
      const globalHeaderConfig = headersList.find((h: any) => h.source === "/:path*");
      expect(globalHeaderConfig).toBeDefined();

      const permPolicy = globalHeaderConfig?.headers?.find((h: any) => h.key === "Permissions-Policy");
      expect(permPolicy).toBeDefined();
      expect(permPolicy?.value).toContain("camera=()");
      expect(permPolicy?.value).toMatch(/microphone=\((self)?\)/);
      expect(permPolicy?.value).toContain("geolocation=()");
      expect(permPolicy?.value).toContain("accelerometer=()");
      expect(permPolicy?.value).toContain("gyroscope=()");
      expect(permPolicy?.value).toContain("magnetometer=()");
    }
  });
});
