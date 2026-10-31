import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformBillingService } from "@/modules/platform-admin/services/platform-billing-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get("tenantId") || undefined;
    const status = searchParams.get("status") || undefined;

    const invoices = await PlatformBillingService.listInvoices({
      tenantId,
      status,
    });

    return NextResponse.json({
      success: true,
      invoices,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load invoices";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const { tenantId, amountInr, taxInr, dueDate, notes } = body;

    if (!tenantId || amountInr === undefined) {
      return NextResponse.json(
        { error: "Tenant ID and invoice amount are required." },
        { status: 400 }
      );
    }

    const invoice = await PlatformBillingService.createInvoice({
      tenantId,
      amountInr: Number(amountInr),
      taxInr: taxInr !== undefined ? Number(taxInr) : undefined,
      dueDate,
      notes,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "Platform invoice created successfully.",
      invoice,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create invoice";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
