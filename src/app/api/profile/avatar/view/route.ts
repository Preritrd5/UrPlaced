import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { AvatarStorageService } from "@/modules/identity-access/services/avatar-storage-service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const profile = await getCurrentUserProfile();
    if (!profile) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const path = searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "Missing path parameter." }, { status: 400 });
    }

    const canonicalPath = AvatarStorageService.extractStoragePath(path);
    if (!canonicalPath) {
      return NextResponse.json({ error: "Invalid avatar storage path." }, { status: 400 });
    }

    // Path must follow <userId>/<fileName>
    const pathParts = canonicalPath.split("/");
    const targetUserId = pathParts[0];

    // Enforce college tenant isolation:
    // User can always view their own avatar
    const isOwnAvatar = profile.id === targetUserId;

    if (!isOwnAvatar && !profile.isPlatformAdmin) {
      // If viewing another user's avatar, check that target user belongs to the same college tenant
      const admin = createAdminClient();
      const currentTenantId = profile.activeMembership?.tenant_id;

      if (!currentTenantId) {
        return NextResponse.json({ error: "FORBIDDEN: Tenant membership required." }, { status: 403 });
      }

      const { data: targetMembership } = await admin
        .from("tenant_memberships")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("tenant_id", currentTenantId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (!targetMembership) {
        return NextResponse.json(
          { error: "FORBIDDEN: Cross-college avatar access is prohibited." },
          { status: 403 }
        );
      }
    }

    const admin = createAdminClient();
    const signedUrl = await AvatarStorageService.createSignedAvatarUrl(canonicalPath, 3600, admin);
    if (!signedUrl) {
      return NextResponse.json({ error: "Avatar object not found." }, { status: 404 });
    }

    return NextResponse.redirect(signedUrl, 307);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error resolving avatar.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
