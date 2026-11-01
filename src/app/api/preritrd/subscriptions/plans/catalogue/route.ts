import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import {
  CONTROLLED_FEATURE_CATALOGUE,
  CONTROLLED_LIMIT_KEYS,
} from "@/modules/platform-admin/types/subscription-plans";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    return NextResponse.json({
      success: true,
      features: CONTROLLED_FEATURE_CATALOGUE,
      limits: CONTROLLED_LIMIT_KEYS,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load catalogue";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
