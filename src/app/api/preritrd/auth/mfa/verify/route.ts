import { NextRequest, NextResponse } from "next/server";
import { createChunks } from "@supabase/ssr";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, factorId, challengeId, code, sessionToken } = body;

    if (!userId || !factorId || !challengeId || !code || !sessionToken) {
      return NextResponse.json(
        { error: "User ID, factor ID, challenge ID, verification code, and session token are required." },
        { status: 400 }
      );
    }

    const cleanCode = String(code).trim();
    if (!/^\d{6}$/.test(cleanCode)) {
      return NextResponse.json(
        { error: "Invalid verification code format. Must be a 6-digit TOTP code." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // 1. Verify user is an active platform admin
    const { data: adminRecord } = await adminClient
      .from("platform_admins")
      .select("id, email, status, role")
      .eq("id", userId)
      .maybeSingle();

    if (!adminRecord || adminRecord.status !== "ACTIVE" || adminRecord.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized administrator profile or inactive status." },
        { status: 403 }
      );
    }

    // 2. Perform genuine cryptographic Supabase TOTP verification
    const userClient = await createClient(sessionToken);
    const { data: verifyData, error: verifyError } = await userClient.auth.mfa.verify({
      factorId,
      challengeId,
      code: cleanCode,
    });

    if (verifyError || !verifyData?.access_token) {
      return NextResponse.json(
        { error: `MFA verification failed: ${verifyError?.message || "Invalid or expired authenticator code."}` },
        { status: 400 }
      );
    }

    // 3. Mark admin MFA status as enabled & update last sign in
    await adminClient
      .from("platform_admins")
      .update({
        mfa_enabled: true,
        last_sign_in_at: new Date().toISOString(),
      })
      .eq("id", userId);

    // 4. Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "PLATFORM_MFA_CHALLENGE_VERIFIED",
      resourceType: "PLATFORM_AUTH",
      resourceId: userId,
      metadata: { assuranceLevel: "AAL2", factorId },
      adminClient,
    });

    // 5. Establish session cookies for SSR page navigation
    const cookieClient = await createClient();
    try {
      if (verifyData.refresh_token) {
        await cookieClient.auth.setSession({
          access_token: verifyData.access_token,
          refresh_token: verifyData.refresh_token,
        });
      }
    } catch {
      // Non-fatal if running outside standard cookie-writable context
    }

    const response = NextResponse.json({
      success: true,
      message: "MFA challenge verified successfully. Session elevated to AAL2.",
      sessionToken: verifyData.access_token,
      refreshToken: verifyData.refresh_token,
      redirectTo: "/preritrd/dashboard",
    });

    // Also set explicit auth cookie for immediate document navigation
    response.cookies.set("sb-access-token", verifyData.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600, // 1 hour
    });

    try {
      const { supabaseUrl } = getSupabaseConfig();
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const cookieBaseName = `sb-${projectRef}-auth-token`;
      const sessionPayload = Buffer.from(
        JSON.stringify({
          access_token: verifyData.access_token,
          refresh_token: verifyData.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user: verifyData.user,
        })
      ).toString("base64url");

      const chunks = createChunks(cookieBaseName, `base64-${sessionPayload}`);
      for (const ch of chunks) {
        response.cookies.set(ch.name, ch.value, {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 3600 * 24 * 7,
        });
      }
    } catch {
      // Non-fatal if URL parsing fails
    }

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "MFA verification failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
