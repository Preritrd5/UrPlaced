import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, sessionToken } = body;

    if (!userId || !sessionToken) {
      return NextResponse.json(
        { error: "User ID and session token are required." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Verify session token identity
    const { data: userData, error: userError } = await adminClient.auth.getUser(String(sessionToken));
    if (userError || !userData?.user || userData.user.id !== userId) {
      return NextResponse.json(
        { error: "Invalid or expired session. Please re-enter credentials." },
        { status: 401 }
      );
    }

    // 2. Verify platform admin status
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, email, is_platform_admin")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !profile.is_platform_admin) {
      return NextResponse.json(
        { error: "Access Denied: Account is not authorized as a platform administrator." },
        { status: 403 }
      );
    }

    const { data: adminRecord } = await adminClient
      .from("platform_admins")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!adminRecord || adminRecord.status !== "ACTIVE" || adminRecord.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Active SUPER_ADMIN status required." },
        { status: 403 }
      );
    }

    // 3. Security Check: Prevent password-only authentication from removing already verified MFA factors
    const userClient = await createClient(sessionToken);
    const { data: factorsData } = await userClient.auth.mfa.listFactors();

    const hasVerifiedFactor = factorsData?.totp?.some(
      (f: any) => f.status === "verified"
    );

    if (hasVerifiedFactor) {
      // Check if current session has genuine AAL2 assurance
      let isAal2 = false;
      try {
        const parts = String(sessionToken).split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
          if (payload.aal === "aal2") isAal2 = true;
        }
      } catch {
        // Parse error
      }

      if (!isAal2) {
        const { data: aalData } = await userClient.auth.mfa.getAuthenticatorAssuranceLevel();
        if (aalData?.currentLevel === "aal2") isAal2 = true;
      }

      if (!isAal2) {
        return NextResponse.json(
          {
            error:
              "Security Violation: An already verified MFA factor cannot be removed or reset using password-only authentication. AAL2 elevation or administrative recovery is required.",
          },
          { status: 403 }
        );
      }
    }

    // Unenroll factors (unverified setup artifacts, or verified if authenticated with genuine AAL2)
    if (factorsData?.totp) {
      for (const factor of factorsData.totp) {
        try {
          await userClient.auth.mfa.unenroll({ factorId: factor.id });
        } catch {
          // non-fatal
        }
      }
    }

    // 4. Enroll fresh TOTP factor
    const userEmail = (userData.user.email || adminRecord.email || "").toLowerCase();
    const { data: enrollData, error: enrollErr } = await userClient.auth.mfa.enroll({
      factorType: "totp",
      issuer: "UrPlaced Super Admin",
      friendlyName: `${userEmail} Authenticator`,
    });

    if (enrollErr || !enrollData) {
      return NextResponse.json(
        { error: `Failed to initiate MFA enrollment: ${enrollErr?.message || "MFA enrollment unavailable"}` },
        { status: 500 }
      );
    }

    const { data: challengeData, error: challengeErr } = await userClient.auth.mfa.challenge({
      factorId: enrollData.id,
    });

    if (challengeErr || !challengeData) {
      return NextResponse.json(
        { error: `Failed to challenge newly enrolled MFA factor: ${challengeErr?.message || "Unable to initiate challenge"}` },
        { status: 500 }
      );
    }

    // 5. Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "PLATFORM_MFA_FACTOR_RESET",
      resourceType: "PLATFORM_AUTH",
      resourceId: userId,
      metadata: { email: userEmail, factorId: enrollData.id },
      adminClient,
    });

    return NextResponse.json({
      success: true,
      message: "New TOTP factor enrolled. Scan the QR code into your authenticator app.",
      mfaAction: "ENROLL",
      factorId: enrollData.id,
      challengeId: challengeData.id,
      totpSecret: enrollData.totp.secret,
      qrCode: enrollData.totp.qr_code,
      uri: enrollData.totp.uri,
      userId,
      email: userEmail,
      sessionToken,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reset MFA enrollment.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
