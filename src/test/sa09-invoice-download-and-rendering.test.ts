import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { InvoiceDocumentService } from "@/modules/billing/services/invoice-document-service";
import { GET as invoiceDownloadRoute } from "@/app/api/billing/invoices/[id]/download/route";
import { GET as creditNoteDownloadRoute } from "@/app/api/billing/credit-notes/[id]/download/route";
import * as serverContext from "@/lib/auth/server-context";
import * as supabaseAdmin from "@/lib/supabase/admin";

describe("URPLACED — Production Invoice & Credit Note Download Resilience Suite", () => {
  let mockInvoices: any[];
  let mockTenants: any[];
  let mockCreditNotes: any[];
  let mockAdmin: any;

  beforeEach(() => {
    mockTenants = [
      {
        id: "tenant-demo-uuid",
        name: "Demo Institute of Technology",
        slug: "demo",
        official_email: "placement@demo.edu",
        contact_name: "Dr. Placement Head",
        contact_phone: "+91 9876543210",
        // Note: billing_contact_name, billing_address, and gstin are deliberately absent to simulate production schema
      },
      {
        id: "foreign-tenant-uuid",
        name: "Foreign College",
        slug: "foreign",
        official_email: "placement@foreign.edu",
        contact_name: "Foreign Head",
        contact_phone: "+91 9999999999",
      },
    ];

    mockInvoices = [
      {
        id: "6ca0079c-7733-47d0-a923-c73b34d4316f",
        invoice_number: "INV-2026-2091",
        tenant_id: "tenant-demo-uuid",
        subscription_id: "sub-123",
        amount_inr: 1.0,
        tax_inr: 0.18,
        currency: "INR",
        status: "PAID",
        payment_method: "RAZORPAY",
        paid_at: "2026-11-06T10:04:43Z",
        issue_date: "2026-11-06T10:04:43Z",
        notes: "Settled via Razorpay (Payment ID: pay_Twqoj37vdi0rt0)",
      },
      {
        id: "foreign-invoice-uuid",
        invoice_number: "INV-2026-9999",
        tenant_id: "foreign-tenant-uuid",
        subscription_id: "sub-foreign",
        amount_inr: 49999,
        tax_inr: 8999.82,
        currency: "INR",
        status: "PAID",
        issue_date: "2026-11-01T00:00:00Z",
      },
    ];

    mockCreditNotes = [
      {
        id: "c1111111-2222-3333-4444-555555555555",
        credit_note_number: "CN-2026-0001",
        invoice_id: "6ca0079c-7733-47d0-a923-c73b34d4316f",
        tenant_id: "tenant-demo-uuid",
        amount_inr: 1.0,
        tax_inr: 0.18,
        total_inr: 1.18,
        reason: "Customer Satisfaction",
        status: "ISSUED",
        created_at: "2026-11-06T11:00:00Z",
      },
    ];

    mockAdmin = {
      from: vi.fn((table: string) => {
        let currentTable = table;
        let selectColumns = "*";
        let filterField = "";
        let filterValue = "";

        const queryObj: any = {
          select: vi.fn((cols: string) => {
            selectColumns = cols;
            // Throw schema error if caller requests non-existent columns in a joined query
            if (cols.includes("billing_contact_name") && cols.includes("tenants")) {
              return {
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "42703", message: "column tenants_1.billing_contact_name does not exist" },
                  }),
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "42703", message: "column tenants_1.billing_contact_name does not exist" },
                  }),
                })),
              };
            }
            return queryObj;
          }),
          eq: vi.fn((field: string, val: string) => {
            filterField = field;
            filterValue = val;
            return queryObj;
          }),
          single: vi.fn(async () => {
            return queryObj.maybeSingle();
          }),
          maybeSingle: vi.fn(async () => {
            if (currentTable === "platform_invoices") {
              const inv = mockInvoices.find((i) => i[filterField] === filterValue);
              if (!inv) return { data: null, error: null };
              return { data: { ...inv }, error: null };
            }
            if (currentTable === "tenants") {
              const t = mockTenants.find((tenant) => tenant[filterField] === filterValue);
              if (!t) return { data: null, error: null };
              return { data: { ...t }, error: null };
            }
            if (currentTable === "credit_notes") {
              const cn = mockCreditNotes.find((note) => note[filterField] === filterValue);
              if (!cn) return { data: null, error: null };
              return { data: { ...cn }, error: null };
            }
            return { data: null, error: null };
          }),
        };

        return queryObj;
      }),
    };

    vi.spyOn(supabaseAdmin, "createAdminClient").mockReturnValue(mockAdmin as any);
  });

  // 1. fetchInvoiceWithTenant lookup by UUID
  it("1. fetchInvoiceWithTenant retrieves invoice and tenant by UUID without 42703 column errors", async () => {
    const result = await InvoiceDocumentService.fetchInvoiceWithTenant(
      "6ca0079c-7733-47d0-a923-c73b34d4316f",
      mockAdmin
    );

    expect(result.invoice).toBeDefined();
    expect(result.invoice.id).toBe("6ca0079c-7733-47d0-a923-c73b34d4316f");
    expect(result.invoice.invoice_number).toBe("INV-2026-2091");
    expect(result.tenant.name).toBe("Demo Institute of Technology");
    expect(result.tenant.official_email).toBe("placement@demo.edu");
  });

  // 2. fetchInvoiceWithTenant lookup by human-readable invoice number
  it("2. fetchInvoiceWithTenant retrieves invoice by human-readable invoice number (INV-2026-2091)", async () => {
    const result = await InvoiceDocumentService.fetchInvoiceWithTenant("INV-2026-2091", mockAdmin);

    expect(result.invoice).toBeDefined();
    expect(result.invoice.id).toBe("6ca0079c-7733-47d0-a923-c73b34d4316f");
    expect(result.invoice.invoice_number).toBe("INV-2026-2091");
    expect(result.tenant.name).toBe("Demo Institute of Technology");
  });

  // 3. fetchInvoiceWithTenant throws clean 404 error when not found
  it("3. fetchInvoiceWithTenant throws descriptive 'Invoice not found: ...' error when nonexistent", async () => {
    await expect(
      InvoiceDocumentService.fetchInvoiceWithTenant("nonexistent-invoice-id", mockAdmin)
    ).rejects.toThrow("Invoice not found: nonexistent-invoice-id");
  });

  // 4. generateInvoicePdf generates genuine binary PDF buffer
  it("4. generateInvoicePdf produces valid binary PDF buffer starting with %PDF- header", async () => {
    const pdfBuffer = await InvoiceDocumentService.generateInvoicePdf(
      "6ca0079c-7733-47d0-a923-c73b34d4316f",
      mockAdmin
    );

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(100);
    // Standard PDF file signature: %PDF-
    const header = pdfBuffer.slice(0, 5).toString("utf-8");
    expect(header).toBe("%PDF-");
  });

  // 5. renderInvoiceHtml produces clean HTML with branding and invoice details
  it("5. renderInvoiceHtml generates valid standalone HTML document", async () => {
    const html = await InvoiceDocumentService.renderInvoiceHtml(
      "6ca0079c-7733-47d0-a923-c73b34d4316f",
      mockAdmin
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("INV-2026-2091");
    expect(html).toContain("Demo Institute of Technology");
    expect(html).toContain("UrPlaced");
  });

  // 6. API Route: Authorized Placement Head downloads PDF by UUID
  it("6. GET /api/billing/invoices/[id]/download streams genuine PDF with attachment headers", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-placement-head",
      email: "head@demo.edu",
      tenantId: "tenant-demo-uuid",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/billing/invoices/6ca0079c-7733-47d0-a923-c73b34d4316f/download"
    );
    const res = await invoiceDownloadRoute(req, {
      params: Promise.resolve({ id: "6ca0079c-7733-47d0-a923-c73b34d4316f" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="INV-2026-2091.pdf"');

    const bodyBuffer = Buffer.from(await res.arrayBuffer());
    expect(bodyBuffer.slice(0, 5).toString("utf-8")).toBe("%PDF-");
  });

  // 7. API Route: Authorized Placement Head downloads PDF using human-readable invoice number
  it("7. GET /api/billing/invoices/[id]/download supports human-readable invoice number lookup", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-placement-head",
      email: "head@demo.edu",
      tenantId: "tenant-demo-uuid",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest("http://localhost:3000/api/billing/invoices/INV-2026-2091/download");
    const res = await invoiceDownloadRoute(req, {
      params: Promise.resolve({ id: "INV-2026-2091" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="INV-2026-2091.pdf"');
  });

  // 8. API Route: ?format=html returns standalone HTML preview
  it("8. GET /api/billing/invoices/[id]/download?format=html returns text/html content", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-placement-head",
      email: "head@demo.edu",
      tenantId: "tenant-demo-uuid",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/billing/invoices/6ca0079c-7733-47d0-a923-c73b34d4316f/download?format=html"
    );
    const res = await invoiceDownloadRoute(req, {
      params: Promise.resolve({ id: "6ca0079c-7733-47d0-a923-c73b34d4316f" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const text = await res.text();
    expect(text).toContain("INV-2026-2091");
  });

  // 9. API Route: Cross-tenant isolation returns 403 Forbidden
  it("9. GET /api/billing/invoices/[id]/download returns 403 Forbidden for cross-tenant access", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-other-college",
      email: "head@other.edu",
      tenantId: "other-tenant-id",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/billing/invoices/6ca0079c-7733-47d0-a923-c73b34d4316f/download"
    );
    const res = await invoiceDownloadRoute(req, {
      params: Promise.resolve({ id: "6ca0079c-7733-47d0-a923-c73b34d4316f" }),
    });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain("Forbidden");
  });

  // 10. API Route: Nonexistent invoice returns 404 Not Found
  it("10. GET /api/billing/invoices/[id]/download returns 404 for nonexistent invoice", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-placement-head",
      email: "head@demo.edu",
      tenantId: "tenant-demo-uuid",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/billing/invoices/00000000-0000-0000-0000-000000000000/download"
    );
    const res = await invoiceDownloadRoute(req, {
      params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain("Invoice not found");
  });

  // 11. Credit Note Download API Route
  it("11. GET /api/billing/credit-notes/[id]/download streams genuine credit note PDF", async () => {
    vi.spyOn(serverContext, "requireAuthContext").mockResolvedValue({
      userId: "user-placement-head",
      email: "head@demo.edu",
      tenantId: "tenant-demo-uuid",
      tenantRole: "PLACEMENT_HEAD",
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      isPlatformAdmin: false,
    } as any);

    const req = new NextRequest(
      "http://localhost:3000/api/billing/credit-notes/c1111111-2222-3333-4444-555555555555/download"
    );
    const res = await creditNoteDownloadRoute(req, {
      params: Promise.resolve({ id: "c1111111-2222-3333-4444-555555555555" }),
    });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="CN-2026-0001.pdf"');
  });
});
