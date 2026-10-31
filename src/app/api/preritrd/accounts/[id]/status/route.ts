import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformAdminManagementService } from "@/modules/platform-admin/services/platform-admin-management-service";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id } = await params;

    const body = await request.json();
    const { status } = body;

    if (!["ACTIVE", "INACTIVE", "SUSPENDED", "REVOKED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be ACTIVE, INACTIVE, SUSPENDED, or REVOKED." },
        { status: 400 }
      );
    }

    const result = await PlatformAdminManagementService.updateAdminStatus({
      targetAdminId: id,
      newStatus: status,
      currentAdminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: `Administrator status updated to ${status}.`,
      status: result.status,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update admin status";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
