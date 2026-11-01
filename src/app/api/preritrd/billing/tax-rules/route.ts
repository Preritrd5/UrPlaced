import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { TaxConfigurationService } from "@/modules/billing/services/tax-configuration-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const admin = createAdminClient();

    const { data: rules, error } = await admin
      .from("platform_tax_rules")
      .select("*")
      .order("effective_from", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, rules: rules || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminUser = await PlatformAuthService.requireSuperAdmin(request);
    const body = await request.json().catch(() => ({}));

    const {
      ruleName,
      description,
      sacCode,
      ratePercent,
      sellerStateCode,
      isExempt,
      exemptionReason,
      effectiveFrom,
      effectiveTo,
      isActive,
    } = body;

    if (!ruleName || ratePercent === undefined || !sellerStateCode) {
      return NextResponse.json(
        { error: "ruleName, ratePercent, and sellerStateCode are required." },
        { status: 400 }
      );
    }

    const rule = await TaxConfigurationService.upsertTaxRule({
      ruleName,
      description,
      sacCode,
      ratePercent: Number(ratePercent),
      sellerStateCode,
      isExempt: Boolean(isExempt),
      exemptionReason,
      effectiveFrom,
      effectiveTo,
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      adminId: adminUser.id,
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to configure tax rule." }, { status: 500 });
  }
}
