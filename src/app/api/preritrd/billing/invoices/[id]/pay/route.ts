import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformBillingService } from "@/modules/platform-admin/services/platform-billing-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    const body = await request.json();
    const { paymentMethod, isDemo, notes } = body;

    const result = await PlatformBillingService.recordPayment({
      invoiceId: id,
      paymentMethod: paymentMethod || "BANK_TRANSFER",
      isDemo: isDemo === true,
      notes,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "Payment successfully recorded.",
      invoice: result.invoice,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record payment";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
