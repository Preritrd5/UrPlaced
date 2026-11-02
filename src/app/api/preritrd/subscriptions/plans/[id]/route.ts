import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    const plan = await PlatformSubscriptionService.getPlanById(id);
    if (!plan) {
      return NextResponse.json({ error: "Subscription plan not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      plan,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load plan";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    const body = await request.json();
    const {
      name,
      description,
      displayOrder,
      priceInr,
      currency,
      billingInterval,
      discountPercentage,
      limits,
      entitlements,
    } = body;

    const updatedPlan = await PlatformSubscriptionService.updatePlan({
      id,
      name,
      description,
      displayOrder,
      priceInr: priceInr !== undefined ? Number(priceInr) : undefined,
      currency,
      billingInterval,
      discountPercentage: discountPercentage !== undefined ? Number(discountPercentage) : undefined,
      limits,
      entitlements,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Plan '${updatedPlan.name}' updated successfully (Version: v${updatedPlan.version}).`,
      plan: updatedPlan,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update plan";
    const status = msg.includes("not found")
      ? 404
      : msg.includes("archived") || msg.includes("cannot be")
      ? 400
      : msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    const result = await PlatformSubscriptionService.deleteDraftPlan(id, admin.id);

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete plan";
    const status = msg.includes("not found")
      ? 404
      : msg.includes("referenced") || msg.includes("Only DRAFT")
      ? 400
      : msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
