import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const result = await PlatformSubscriptionService.backfillMissingSnapshots(admin.id);

    return NextResponse.json({
      success: result.success,
      message: `Snapshot backfill completed: ${result.backfilledCount} backfilled, ${result.skippedCount} skipped, ${result.failedCount} failed.`,
      result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to backfill subscription snapshots";
    const status = msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
