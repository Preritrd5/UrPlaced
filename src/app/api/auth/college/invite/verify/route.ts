import { NextRequest, NextResponse } from "next/server";
import { PlatformCollegeService } from "@/modules/platform-admin/services/platform-college-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        {
          valid: false,
          error: "TOKEN_MISSING",
          message: "An institutional onboarding token is required to verify your invitation.",
        },
        { status: 400 }
      );
    }

    const verification = await PlatformCollegeService.verifyInvitationToken(token);

    if (!verification.valid) {
      const status =
        verification.error === "INVITATION_NOT_FOUND"
          ? 404
          : verification.error === "INVITATION_ALREADY_CONSUMED"
          ? 410
          : verification.error === "INVITATION_EXPIRED"
          ? 410
          : verification.error === "INVITATION_REVOKED"
          ? 403
          : 400;

      return NextResponse.json(
        {
          valid: false,
          error: verification.error,
          message: verification.message,
          collegeName: verification.collegeName,
        },
        { status }
      );
    }

    return NextResponse.json({
      valid: true,
      collegeName: verification.collegeName,
      officialEmail: verification.officialEmail,
      contactName: verification.contactName,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to verify invitation";
    return NextResponse.json({ valid: false, error: "SERVER_ERROR", message: msg }, { status: 500 });
  }
}
