import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { UserDeletionService } from "@/modules/identity-access/services/user-deletion-service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/preritrd/accounts/[id]
 * Permanently deletes a platform administrator user account across:
 * - Supabase Auth (auth.users hard delete)
 * - PostgreSQL (profiles, platform_admins, memberships)
 * - Supabase Storage (avatars bucket)
 *
 * Enforces strict Super Admin authorization and safety invariants:
 * - Self-deletion is prohibited.
 * - Deletion of the platform's sole remaining active Super Admin is blocked.
 * - Mandatory reason (>= 5 chars) is required.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id: targetAdminId } = await params;

    const body = await request.json().catch(() => ({}));
    const { reason, confirmedEmail } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A mandatory justification reason (at least 5 characters) is required to delete an administrator account." },
        { status: 400 }
      );
    }

    const result = await UserDeletionService.executePermanentDeletion({
      targetUserId: targetAdminId,
      actorUserId: admin.id,
      actorRole: "SUPER_ADMIN",
      reason: reason.trim(),
      confirmedEmailOrSrn: confirmedEmail,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      details: result.details,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete administrator account.";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("Safety Block") || msg.includes("Critical Safety") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
