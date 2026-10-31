import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    return NextResponse.json({
      authenticated: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
        mfaVerified: admin.mfaVerified,
      },
    }, { status: 200 });
  } catch {
    // Normal unauthenticated or unverified state on initial login visit
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
}
