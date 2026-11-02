import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { UserDeletionService } from "@/modules/identity-access/services/user-deletion-service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/preritrd/users/[id]
 * Universal Super Admin endpoint for permanently deleting ANY user across UrPlaced:
 * - Placement Heads
 * - Placement Staff
 * - Trainers
 * - Students
 * - Platform Admins
 *
 * Enforces:
 * - Super Admin authorization (`requireSuperAdmin`)
 * - Hard deletion from Supabase Auth (`auth.users`)
 * - Relational cleanup of personal data, memberships, and profile
 * - Complete storage cleanup (avatars)
 * - Immediate session and JWT access revocation
 * - Preservation of shared institutional data (drives, companies, question banks)
 * - Preservation of append-only audit logs and financial records
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await PlatformAuthService.requireSuperAdmin(request);
    const { id: targetUserId } = await params;

    const body = await request.json().catch(() => ({}));
    const { reason, confirmedEmail } = body;

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      return NextResponse.json(
        { error: "A mandatory justification reason (at least 5 characters) is required to permanently delete a user." },
        { status: 400 }
      );
    }

    const result = await UserDeletionService.executePermanentDeletion({
      targetUserId,
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
    const msg = err instanceof Error ? err.message : "Failed to permanently delete user.";
    const status = msg.includes("UNAUTHORIZED") ? 401 : msg.includes("Safety Block") || msg.includes("Critical Safety") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
