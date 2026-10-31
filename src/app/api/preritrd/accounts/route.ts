import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformAdminManagementService } from "@/modules/platform-admin/services/platform-admin-management-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);

    const [admins, invitations] = await Promise.all([
      PlatformAdminManagementService.listAdmins(),
      PlatformAdminManagementService.listInvitations(),
    ]);

    return NextResponse.json({
      success: true,
      admins,
      invitations,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load admin accounts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const result = await PlatformAdminManagementService.createInvitation({
      email,
      adminId: admin.id,
    });

    return NextResponse.json({
      success: true,
      message: "Platform administrator invitation generated successfully.",
      invitationId: result.invitationId,
      inviteLink: result.inviteLink,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to invite administrator";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
