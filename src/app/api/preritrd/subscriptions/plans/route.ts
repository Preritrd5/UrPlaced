import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const plans = await PlatformSubscriptionService.listPlans();

    return NextResponse.json({
      success: true,
      plans,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load plans";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const {
      id,
      name,
      slug,
      description,
      priceInr,
      billingCycle,
      studentLimit,
      staffLimit,
      storageLimitGb,
      features,
      isActive,
    } = body;

    if (!id || !name || !slug || priceInr === undefined) {
      return NextResponse.json(
        { error: "Plan ID, Name, Slug, and Price are required." },
        { status: 400 }
      );
    }

    const plan = await PlatformSubscriptionService.upsertPlan({
      id,
      name,
      slug,
      description,
      priceInr: Number(priceInr),
      billingCycle: billingCycle || "ANNUAL",
      studentLimit: Number(studentLimit || 1000),
      staffLimit: Number(staffLimit || 10),
      storageLimitGb: Number(storageLimitGb || 20),
      features: Array.isArray(features) ? features : [],
      isActive: isActive !== false,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "Subscription plan saved successfully.",
      plan,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save plan";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
