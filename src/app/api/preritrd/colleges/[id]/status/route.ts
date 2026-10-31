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

    const body = await request.json();
    const { status, reason } = body;

    if (!["ACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status value. Must be ACTIVE, SUSPENDED, or ARCHIVED." },
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
      message: `College account status successfully updated to ${status}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update college status";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
