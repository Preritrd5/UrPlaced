import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const status = searchParams.get("status") || undefined;
    const billingInterval = searchParams.get("billingInterval") || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || "displayOrder";
    const sortOrder = (searchParams.get("sortOrder") as any) || "asc";

    const plans = await PlatformSubscriptionService.listPlans({
      search,
      status,
      billingInterval,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({
      success: true,
      plans,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load plans";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
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
      displayOrder,
      status,
      priceInr,
      currency,
      billingInterval,
      discountPercentage,
      limits,
      entitlements,
    } = body;

    if (!name || !slug || priceInr === undefined) {
      return NextResponse.json(
        { error: "Plan Name, Slug, and Price are required." },
        { status: 400 }
      );
    }

    const plan = await PlatformSubscriptionService.createPlan({
      id,
      name,
      slug,
      description,
      displayOrder: Number(displayOrder || 0),
      status: status || "PUBLISHED",
      priceInr: Number(priceInr),
      currency: currency || "INR",
      billingInterval: billingInterval || "ANNUAL",
      discountPercentage: Number(discountPercentage || 0),
      limits,
      entitlements,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Subscription plan '${plan.name}' created successfully.`,
      plan,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create plan";
    const status = msg.includes("already exists")
      ? 409
      : msg.includes("required") || msg.includes("must be") || msg.includes("cannot be")
      ? 400
      : msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
