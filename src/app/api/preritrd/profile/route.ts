import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { PlatformAuditService } from "@/modules/platform-admin/services/platform-audit-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const adminClient = createAdminClient();

    // 1. Fetch complete profile record
    const { data: profile } = await adminClient
      .from("profiles")
      .select("id, email, full_name, avatar_url, phone, location, bio, preferences, created_at, updated_at")
      .eq("id", admin.id)
      .maybeSingle();

    // 2. Fetch platform_admins status and record
    const { data: adminRecord } = await adminClient
      .from("platform_admins")
      .select("*")
      .eq("id", admin.id)
      .maybeSingle();

    // 3. Fetch MFA factors and status from Supabase Auth
    let mfaFactors: any[] = [];
    try {
      const authHeader = request.headers.get("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : undefined;
      const supabase = await createClient(token);
      const { data: factorsData } = await supabase.auth.mfa.listFactors();
      mfaFactors = factorsData?.totp || [];
    } catch {
      // Non-fatal
    }

    // 4. Fetch admin's own recent platform audit events (STRICT OPTION A: tenant_id IS NULL only)
    let recentActivity: any[] = [];
    try {
      const auditResult = await PlatformAuditService.listPlatformAuditLogs({
        limit: 10,
        admin: adminClient,
      });
      // Filter strictly for this administrator's actions
      recentActivity = auditResult.logs.filter((log) => log.actorId === admin.id);
    } catch {
      // Non-fatal
    }

    // 5. Compute real account readiness
    const readiness = {
      profileComplete: Boolean(admin.fullName && admin.email),
      emailVerified: true,
      mfaEnrolled: admin.mfaVerified || mfaFactors.some((f) => f.status === "verified"),
      accountActive: admin.status === "ACTIVE",
    };

    return NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: "SUPER_ADMIN",
        status: admin.status,
        avatarUrl: admin.avatarUrl,
        phone: profile?.phone || admin.phone || null,
        location: profile?.location || admin.location || null,
        bio: profile?.bio || admin.bio || null,
        preferences: profile?.preferences || admin.preferences || {},
        createdAt: adminRecord?.created_at || profile?.created_at || null,
        lastSignInAt: adminRecord?.last_sign_in_at || null,
        mfaEnforced: admin.mfaEnforced,
        mfaVerified: admin.mfaVerified,
      },
      readiness,
      mfa: {
        enrolled: readiness.mfaEnrolled,
        factors: mfaFactors,
        assuranceLevel: admin.mfaVerified ? "aal2" : "aal1",
      },
      recentActivity,
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to load administrator profile." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();

    // STRICT OPTION A SECURITY INVARIANTS:
    // Disallow editing of platform privileges or status through the profile API
    if (
      body.isPlatformAdmin !== undefined ||
      body.is_platform_admin !== undefined ||
      body.role !== undefined ||
      body.status !== undefined ||
      body.tenantId !== undefined ||
      body.tenant_id !== undefined ||
      body.memberships !== undefined
    ) {
      return NextResponse.json(
        { error: "FORBIDDEN: Administrative privileges and role assignments are immutable via profile." },
        { status: 403 }
      );
    }

    const { fullName, phone, location, bio, preferences } = body;

    const adminClient = createAdminClient();

    // 1. Update public.profiles
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof fullName === "string" && fullName.trim().length > 0) {
      updates.full_name = fullName.trim();
    }
    if (phone !== undefined) {
      updates.phone = typeof phone === "string" ? phone.trim() : null;
    }
    if (location !== undefined) {
      updates.location = typeof location === "string" ? location.trim() : null;
    }
    if (bio !== undefined) {
      updates.bio = typeof bio === "string" ? bio.trim() : null;
    }
    if (preferences !== undefined && typeof preferences === "object") {
      updates.preferences = preferences;
    }

    const { error: profileErr } = await adminClient
      .from("profiles")
      .update(updates)
      .eq("id", admin.id);

    if (profileErr) {
      throw new Error(`Failed to update profile record: ${profileErr.message}`);
    }

    // 2. Update full_name on public.platform_admins if provided
    if (updates.full_name) {
      await adminClient
        .from("platform_admins")
        .update({
          full_name: updates.full_name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", admin.id);

      // Also mirror to auth.users user_metadata for identity display
      try {
        await adminClient.auth.admin.updateUserById(admin.id, {
          user_metadata: {
            full_name: updates.full_name,
          },
        });
      } catch {
        // Non-fatal
      }
    }

    // 3. Log platform audit event
    await PlatformAuthService.logAuditEvent({
      actorId: admin.id,
      action: "PLATFORM_UPDATE_PROFILE",
      resourceType: "ADMIN_PROFILE",
      resourceId: admin.id,
      metadata: {
        updatedFields: Object.keys(updates),
      },
    });

    return NextResponse.json({
      success: true,
      admin: {
        ...admin,
        fullName: updates.full_name || admin.fullName,
        phone: updates.phone !== undefined ? updates.phone : admin.phone,
        location: updates.location !== undefined ? updates.location : admin.location,
        bio: updates.bio !== undefined ? updates.bio : admin.bio,
        preferences: updates.preferences !== undefined ? updates.preferences : admin.preferences,
      },
    });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to update administrator profile." },
      { status: 500 }
    );
  }
}
