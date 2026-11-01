import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformBillingService } from "@/modules/platform-admin/services/platform-billing-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

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

    // Strict security control: Demo bypass disabled in production
    if (isDemo === true && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Demo payment recording is strictly prohibited in production environments." },
        { status: 403 }
      );
    }

    const result = await PlatformBillingService.recordPayment({
      invoiceId: id,
      paymentMethod: paymentMethod || "BANK_TRANSFER",
      isDemo: isDemo === true,
      notes,
      adminId: admin.id,
    });

    // Consistent activation: if the invoice is tied to a subscription, activate it
    if (result.invoice.tenantId) {
      try {
        await PlatformSubscriptionService.activateSubscriptionOnVerifiedPayment({
          tenantId: result.invoice.tenantId,
          subscriptionId: result.invoice.subscriptionId,
          paymentReference: `MANUAL_${result.invoice.paymentMethod}_${result.invoice.invoiceNumber}`,
          adminId: admin.id,
        });
      } catch (actErr) {
        console.warn("[Super Admin Billing] Automatic subscription activation skipped/deferred:", actErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Payment successfully recorded.",
      invoice: result.invoice,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record payment";
    if (msg.includes("UNAUTHORIZED") || msg.includes("Super Admin access required")) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

