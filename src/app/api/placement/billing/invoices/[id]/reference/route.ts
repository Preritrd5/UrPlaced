import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only institutional placement administrators may submit payment references." },
        { status: 403 }
      );
    }

    const { id: invoiceId } = await params;
    const body = await request.json().catch(() => ({}));
    const { utrReference, bankName } = body;

    if (!utrReference || typeof utrReference !== "string" || utrReference.trim().length < 4) {
      return NextResponse.json(
        { error: "A valid transaction/UTR reference (at least 4 characters) is required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch invoice
    const { data: invoice, error: invErr } = await admin
      .from("platform_invoices")
      .select("id, invoice_number, tenant_id, status, notes, total_amount, amount_inr")
      .eq("id", invoiceId)
      .maybeSingle();

    if (invErr || !invoice) {
      return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    }

    if (invoice.tenant_id !== ctx.tenantId && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Invoice belongs to another institution." },
        { status: 403 }
      );
    }

    if (invoice.status === "PAID") {
      return NextResponse.json(
        { error: "This invoice has already been verified and marked as PAID." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const cleanUtr = utrReference.trim();
    const cleanBank = bankName?.trim() || "";

    const refString = `[UTR: ${cleanUtr}${cleanBank ? ` (${cleanBank})` : ""} submitted at ${now}]`;
    const updatedNotes = invoice.notes ? `${invoice.notes} | ${refString}` : refString;

    // 2. Update invoice with submitted payment reference in notes
    const { error: updateErr } = await admin
      .from("platform_invoices")
      .update({
        notes: updatedNotes,
        updated_at: now,
      })
      .eq("id", invoiceId);

    if (updateErr) {
      throw new Error(`Failed to update invoice: ${updateErr.message}`);
    }

    // 3. Log audit event
    await PlatformAuthService.logAuditEvent({
      actorId: ctx.userId,
      action: "BANK_TRANSFER_REFERENCE_SUBMITTED" as any,
      resourceType: "INVOICE",
      resourceId: invoiceId,
      metadata: {
        invoiceNumber: invoice.invoice_number,
        utrReference: cleanUtr,
        bankName: cleanBank,
        submittedAt: now,
      },
      adminClient: admin,
    });

    return NextResponse.json({
      success: true,
      message: `Payment reference '${cleanUtr}' has been successfully submitted for invoice ${invoice.invoice_number}. Administrative reconciliation will verify the credit.`,
      invoiceId,
      utrReference: cleanUtr,
    });
  } catch (error: any) {
    console.error("[Bank Transfer Reference Error]:", error);
    const msg = error.message || "Failed to submit payment reference.";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("Forbidden") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
