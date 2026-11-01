import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const resolvedParams = await params;
    const tenantId = resolvedParams.id;

    if (!tenantId) {
      return NextResponse.json({ error: "College ID is required." }, { status: 400 });
    }

    let reason: string | undefined;
    try {
      const body = await request.json();
      reason = body.reason;
    } catch {
      // Body is optional
    }

    const result = await PlatformCollegeService.revokeInvitation({
      tenantId,
      adminId: admin.id,
      reason,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to revoke invitation";
    const status = msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("FORBIDDEN")
      ? 403
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
