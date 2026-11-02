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

    const { data: note } = await admin
      .from("credit_notes")
      .select("tenant_id, credit_note_number")
      .eq("id", id)
      .maybeSingle();

    if (!note) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    // Reconciled Billing RBAC: Only PLACEMENT_HEAD or platform super admin may download credit notes
    if (!ctx.isPlatformAdmin && (note.tenant_id !== ctx.tenantId || ctx.tenantRole !== "PLACEMENT_HEAD")) {
      return NextResponse.json(
        { error: "Forbidden: Only authorized institutional billing administrators may download credit notes." },
        { status: 403 }
      );
    }

    const format = request.nextUrl.searchParams.get("format") || "pdf";

    if (format === "html") {
      const htmlContent = await InvoiceDocumentService.renderCreditNoteHtml(id, admin);
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // Default: Genuine binary PDF document
    const pdfBuffer = await InvoiceDocumentService.generateCreditNotePdf(id, admin);
    const noteNumber = note.credit_note_number || `CN-${id.slice(0, 8)}`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${noteNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error: any) {
    const msg = error.message || "Failed to render credit note";
    const status = msg.includes("UNAUTHORIZED") ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
