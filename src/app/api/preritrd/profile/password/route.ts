import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = body;

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json({ error: "New password is required." }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "New password must be at least 8 characters long." },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "New password and confirmation password do not match." },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // If current password was provided, verify it first against Supabase Auth
    if (currentPassword) {
      try {
        const { error: verifyErr } = await adminClient.auth.signInWithPassword({
          email: admin.email,
          password: currentPassword,
        });

        if (verifyErr) {
          return NextResponse.json(
            { error: "Current password verification failed. Please enter your existing password correctly." },
            { status: 400 }
          );
        }
      } catch {
        // Non-fatal if signInWithPassword check is restricted
      }
    }

    // Update password securely via Supabase Auth Admin API
    const { error: updateErr } = await adminClient.auth.admin.updateUserById(admin.id, {
      password: newPassword,
    });

    if (updateErr) {
      throw new Error(`Failed to update password: ${updateErr.message}`);
    }

    // Log platform audit event
    await PlatformAuthService.logAuditEvent({
      actorId: admin.id,
      action: "PLATFORM_CHANGE_PASSWORD",
      resourceType: "ADMIN_CREDENTIALS",
      resourceId: admin.id,
    });

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (err: any) {
    if (err.message === "UNAUTHORIZED" || err.message?.includes("MFA_REQUIRED")) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    if (err.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json(
      { error: err.message || "Failed to change administrator password." },
      { status: 500 }
    );
  }
}
