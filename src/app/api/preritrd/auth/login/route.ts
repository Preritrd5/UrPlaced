import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, sessionToken: providedToken, userId: providedUserId } = body;

    if (!email && !providedToken) {
      return NextResponse.json(
        { error: "Email and credentials/session are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : "";
    const adminClient = createAdminClient();

    let userId: string;
    let userEmail: string = cleanEmail;
    let activeToken: string;

    if (providedToken) {
      // 1A. Validate pre-authenticated session from browser client signInWithPassword
      const { data: userData, error: userError } = await adminClient.auth.getUser(String(providedToken));
      if (userError || !userData?.user) {
        return NextResponse.json(
          { error: "Invalid or expired session. Please re-enter your credentials." },
          { status: 401 }
        );
      }
      userId = userData.user.id;
      userEmail = (userData.user.email || cleanEmail).toLowerCase();
      activeToken = String(providedToken);
    } else {
      // 1B. Authenticate with Supabase Auth via signInWithPassword
      if (!password) {
        return NextResponse.json(
          { error: "Password is required for authentication." },
          { status: 400 }
        );
      }

      const { data: authData, error: authError } = await adminClient.auth.signInWithPassword({
        email: cleanEmail,
        password: String(password),
      });

      if (authError || !authData.user || !authData.session) {
        return NextResponse.json(
          { error: authError?.message || "Invalid credentials. Access is restricted to authorized platform personnel." },
          { status: 401 }
        );
      }
      userId = authData.user.id;
      userEmail = (authData.user.email || cleanEmail).toLowerCase();
      activeToken = authData.session.access_token;
    }

    // 2. Strict Server Authority: Check profiles.is_platform_admin
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, email, is_platform_admin, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || !profile.is_platform_admin) {
      // Reject non-super-admins immediately!
      return NextResponse.json(
        { error: "Access Denied: Account is not authorized as a platform administrator in public.profiles." },
        { status: 403 }
      );
    }

    // 3. Check public.platform_admins status (must exist and be ACTIVE SUPER_ADMIN)
    const { data: adminRecord } = await adminClient
      .from("platform_admins")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (!adminRecord) {
      return NextResponse.json(
        { error: "Access Denied: Account is missing from the public.platform_admins registry. Provisioning required." },
        { status: 403 }
      );
    }

    if (adminRecord.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Your platform administrator access is suspended. Contact security operations." },
        { status: 403 }
      );
    }
    if (adminRecord.status === "REVOKED" || adminRecord.status === "INACTIVE") {
      return NextResponse.json(
        { error: "Administrator privileges have been revoked for this account." },
        { status: 403 }
      );
    }
    if (adminRecord.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Access Denied: Account role is not configured for SUPER_ADMIN platform administration." },
        { status: 403 }
      );
    }

    // Update last sign in
    await adminClient
      .from("platform_admins")
      .update({ last_sign_in_at: new Date().toISOString() })
      .eq("id", userId);

    // 4. Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "PLATFORM_ADMIN_LOGIN_SUCCESS",
      resourceType: "PLATFORM_AUTH",
      resourceId: userId,
      metadata: { email: userEmail },
      adminClient,
    });

    // 5. Genuine Supabase TOTP MFA Check / Challenge / Enrollment
    const userClient = await createClient(activeToken);
    const { data: factorsData } = await userClient.auth.mfa.listFactors();

    const verifiedFactor = factorsData?.totp?.find((f) => f.status === "verified");

    if (verifiedFactor) {
      // Step 2A: Already enrolled — initiate genuine TOTP challenge
      const { data: challengeData, error: challengeErr } = await userClient.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });

      if (challengeErr || !challengeData) {
        return NextResponse.json(
          { error: `Failed to initiate MFA challenge: ${challengeErr?.message || "Unable to initiate TOTP challenge."}` },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Credentials verified. MFA verification required for session elevation.",
        requiresMfa: true,
        mfaAction: "CHALLENGE",
        action: "CHALLENGE",
        factorId: verifiedFactor.id,
        challengeId: challengeData.id,
        userId,
        email: userEmail,
        sessionToken: activeToken,
      });
    } else {
      // Step 2B: Not yet enrolled — initiate genuine TOTP enrollment and challenge
      const unverifiedFactors = factorsData?.totp?.filter((f) => (f.status as string) === "unverified") || [];
      for (const unf of unverifiedFactors) {
        try {
          await userClient.auth.mfa.unenroll({ factorId: unf.id });
        } catch {
          // non-fatal
        }
      }

      const { data: enrollData, error: enrollErr } = await userClient.auth.mfa.enroll({
        factorType: "totp",
        issuer: "UrPlaced Super Admin",
        friendlyName: `${userEmail} Authenticator`,
      });

      if (enrollErr || !enrollData) {
        return NextResponse.json(
          { error: `Failed to initiate MFA enrollment: ${enrollErr?.message || "MFA enrollment disabled or unavailable"}` },
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

      return NextResponse.json({
        success: true,
        message: "Credentials verified. Authenticator app enrollment required for session elevation.",
        requiresMfa: true,
        mfaAction: "ENROLL",
        action: "ENROLL",
        factorId: enrollData.id,
        challengeId: challengeData.id,
        totpSecret: enrollData.totp.secret,
        qrCode: enrollData.totp.qr_code,
        uri: enrollData.totp.uri,
        userId,
        email: userEmail,
        sessionToken: activeToken,
      });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal authentication error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
