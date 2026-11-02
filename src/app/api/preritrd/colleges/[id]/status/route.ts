import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const { status, reason } = body;

    if (!status || (status !== "ACTIVE" && status !== "SUSPENDED")) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'ACTIVE' or 'SUSPENDED'." },
        { status: 400 }
      );
    }

    const result = await PlatformCollegeService.updateCollegeStatus({
      tenantId: id,
      status,
      reason,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      status: result.status,
      tenantId: id,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update college status";
    const httpStatus = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status: httpStatus });
  }
}
