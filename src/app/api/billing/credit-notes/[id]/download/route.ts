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

    // Verify tenant authorization with dual UUID / ID / credit_note_number support
    let note: any = null;
    const isExplicitCnNumber = /^CN-\d{4}-/i.test(cleanId);

    if (isExplicitCnNumber) {
      const { data: noteByNum, error: numErr } = await admin
        .from("credit_notes")
        .select("id, tenant_id, credit_note_number")
        .eq("credit_note_number", cleanId)
        .maybeSingle();
      if (noteByNum) note = noteByNum;
    }

    if (!note) {
      const { data: noteById, error: idErr } = await admin
        .from("credit_notes")
        .select("id, tenant_id, credit_note_number")
        .eq("id", cleanId)
        .maybeSingle();

      if (noteById) {
        note = noteById;
      } else if (!isExplicitCnNumber) {
        const { data: noteByNum } = await admin
          .from("credit_notes")
          .select("id, tenant_id, credit_note_number")
          .eq("credit_note_number", cleanId)
          .maybeSingle();
        if (noteByNum) note = noteByNum;
      }
    }

    if (!note) {
      return NextResponse.json({ error: `Credit note not found: ${cleanId}` }, { status: 404 });
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
      const htmlContent = await InvoiceDocumentService.renderCreditNoteHtml(note.id, admin);
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "private, no-transform, no-store, max-age=0",
        },
      });
    }

    // Default: Genuine binary PDF document
    const pdfBuffer = await InvoiceDocumentService.generateCreditNotePdf(note.id, admin);
    const noteNumber = note.credit_note_number || `CN-${note.id.slice(0, 8)}`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${noteNumber}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-transform, no-store, max-age=0",
      },
    });
  } catch (error: any) {
    const msg = error.message || "Failed to render credit note";
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
