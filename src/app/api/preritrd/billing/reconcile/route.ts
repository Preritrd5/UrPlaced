import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { ReconciliationEngine } from "@/modules/billing/services/reconciliation-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const admin = createAdminClient();

    const { data: discrepancies, error } = await admin
      .from("payment_discrepancies")
      .select(`
        *,
        tenants (
          name,
          slug
        )
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, discrepancies: discrepancies || [] });
  } catch (error: any) {
    const msg = error.message || "Failed to list discrepancies";
    const status = msg.includes("Super Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const body = await request.json().catch(() => ({}));
    const sweepType = body.sweepType || "15_MIN";

    let result;
    if (sweepType === "DAILY") {
      result = await ReconciliationEngine.runDailySweep();
    } else {
      result = await ReconciliationEngine.run15MinuteReconciliation();
    }

    return NextResponse.json({
      success: true,
      sweepType,
      summary: result,
    });
  } catch (error: any) {
    const msg = error.message || "Reconciliation failed";
    const status = msg.includes("Super Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
