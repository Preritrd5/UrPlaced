import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { InvoiceDocumentService } from "@/modules/billing/services/invoice-document-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext();
    const { id } = await params;
    const cleanId = (id || "").trim();
    const admin = createAdminClient();

    // Verify tenant authorization with dual UUID / ID / invoice_number support
    let invoice: any = null;
    const isExplicitInvoiceNumber = /^INV-\d{4}-/i.test(cleanId);

    if (isExplicitInvoiceNumber) {
      const { data: invByNum, error: numErr } = await admin
        .from("platform_invoices")
        .select("id, tenant_id, invoice_number")
        .eq("invoice_number", cleanId)
        .maybeSingle();
      if (invByNum) invoice = invByNum;
    }

    if (!invoice) {
      const { data: invById, error: idErr } = await admin
        .from("platform_invoices")
        .select("id, tenant_id, invoice_number")
        .eq("id", cleanId)
        .maybeSingle();

      if (invById) {
        invoice = invById;
      } else if (!isExplicitInvoiceNumber) {
        const { data: invByNum } = await admin
          .from("platform_invoices")
          .select("id, tenant_id, invoice_number")
          .eq("invoice_number", cleanId)
          .maybeSingle();
        if (invByNum) invoice = invByNum;
      }
    }

    if (!invoice) {
      return NextResponse.json({ error: `Invoice not found: ${cleanId}` }, { status: 404 });
    }

    // Reconciled Billing RBAC: Only PLACEMENT_HEAD or platform super admin may download tax invoices
    if (!ctx.isPlatformAdmin && (invoice.tenant_id !== ctx.tenantId || ctx.tenantRole !== "PLACEMENT_HEAD")) {
      return NextResponse.json(
        { error: "Forbidden: Only authorized institutional billing administrators may download tax invoices." },
        { status: 403 }
      );
    }

    const format = request.nextUrl.searchParams.get("format") || "pdf";

    if (format === "html") {
      const htmlContent = await InvoiceDocumentService.renderInvoiceHtml(invoice.id, admin);
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-transform, no-store, max-age=0",
        },
      });
    }

    // Default: Genuine binary PDF document
    const pdfBuffer = await InvoiceDocumentService.generateInvoicePdf(invoice.id, admin);
    const invoiceNumber = invoice.invoice_number || `INV-${invoice.id.slice(0, 8)}`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-transform, no-store, max-age=0",
      },
    });
  } catch (error: any) {
    const msg = error.message || "Failed to render invoice document";
    let status = 500;
    if (msg.includes("UNAUTHORIZED")) {
      status = 401;
    } else if (msg.includes("Forbidden") || msg.includes("FORBIDDEN")) {
      status = 403;
    } else if (msg.includes("not found") || msg.includes("NOT_FOUND")) {
      status = 404;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
