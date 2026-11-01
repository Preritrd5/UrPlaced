import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Plan ID is required." }, { status: 400 });
    }

    const plan = await PlatformSubscriptionService.archivePlan(id, admin.id);

    return NextResponse.json({
      success: true,
      message: `Plan '${plan.name}' has been archived and hidden from new assignments.`,
      plan,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to archive plan";
    const status = msg.includes("Cannot archive plan")
      ? 409 // Conflict: Active subscribers exist
      : msg.includes("not found")
      ? 404
      : msg.includes("UNAUTHORIZED")
      ? 401
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
