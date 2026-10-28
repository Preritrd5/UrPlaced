import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { removeTenantMember, updateMemberStatus } from "@/modules/tenancy/services/membership-service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/placement/members/[id]
 * Securely removes a staff member from the current college workspace.
 * Strict safeguards:
 * - Only Placement Head or users with STAFF_MANAGE permission in the college can invoke this.
 * - Prevents removing the last active Placement Head.
 * - Confined strictly to the current tenant (cannot remove members across colleges).
 * - Never deletes the user's auth account or global profile.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: membershipId } = await params;
    const profile = await getCurrentUserProfile();

    if (
      !profile ||
      !profile.isVerifiedMembership ||
      !profile.activeMembership ||
      profile.activeMembership.role !== "PLACEMENT_HEAD"
    ) {
      return NextResponse.json({ error: "Unauthorized: Placement Head access required." }, { status: 403 });
    }

    const tenantId = profile.activeMembership.tenant_id;

    await removeTenantMember({
      membershipId,
      tenantId,
      actorUserId: profile.id,
      reason: "API member removal request by Placement Head",
    });

    return NextResponse.json({
      success: true,
      message: "Staff member removed successfully.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to remove staff member.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/**
 * PATCH /api/placement/members/[id]
 * Updates member status (ACTIVE, SUSPENDED, REVOKED).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: membershipId } = await params;
    const body = await request.json();
    const { status, reason } = body;

    const profile = await getCurrentUserProfile();
    if (
      !profile ||
      !profile.isVerifiedMembership ||
      !profile.activeMembership ||
      profile.activeMembership.role !== "PLACEMENT_HEAD"
    ) {
      return NextResponse.json({ error: "Unauthorized: Placement Head access required." }, { status: 403 });
    }

    const tenantId = profile.activeMembership.tenant_id;

    await updateMemberStatus({
      membershipId,
      tenantId,
      newStatus: status,
      actorUserId: profile.id,
      reason: reason || `Status updated to ${status}`,
    });

    return NextResponse.json({
      success: true,
      message: `Member status updated to ${status}.`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update member status.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
