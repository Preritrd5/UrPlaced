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
    const admin = createAdminClient();

    // Verify tenant authorization
    const { data: invoice } = await admin
      .from("platform_invoices")
      .select("tenant_id, invoice_number")
      .eq("id", id)
      .maybeSingle();

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
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
      const htmlContent = await InvoiceDocumentService.renderInvoiceHtml(id, admin);
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // Default: Genuine binary PDF document
    const pdfBuffer = await InvoiceDocumentService.generateInvoicePdf(id, admin);
    const invoiceNumber = invoice.invoice_number || `INV-${id.slice(0, 8)}`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoiceNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    const msg = error.message || "Failed to render invoice document";
    const status = msg.includes("UNAUTHORIZED") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
