import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformAuditService } from "@/modules/platform-admin/services/platform-audit-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action") || undefined;
    const limit = Number(searchParams.get("limit") || "50");
    const offset = Number(searchParams.get("offset") || "0");

    const result = await PlatformAuditService.listPlatformAuditLogs({
      action,
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      logs: result.logs,
      total: result.total,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load audit logs";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
