import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/modules/identity-access/services/policy-engine";
import { logAuditEvent } from "@/modules/identity-access/services/audit-service";
import { UserDeletionService } from "@/modules/identity-access/services/user-deletion-service";

export interface MembershipRecord {
  id: string;
  tenant_id: string;
  user_id: string;
  role: UserRole;
  status: "ACTIVE" | "SUSPENDED" | "REVOKED";
  permissions: string[];
  created_at: string;
  updated_at: string;
  tenants?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  profiles?: {
    id: string;
    email: string;
    full_name: string;
  };
}

/**
 * Retrieves all memberships for a user across tenants.
 */
export async function getUserMemberships(userId: string): Promise<MembershipRecord[]> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tenant_memberships")
      .select("*, tenants(id, name, slug, status)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      // Gracefully handle database or schema cache errors without triggering Next.js RSC dev overlay
      if (process.env.NODE_ENV === "development" && error.code !== "PGRST205" && error.code !== "42P01") {
        console.warn("[MembershipService Notice] Failed to fetch user memberships:", error.message || error);
      }
      return [];
    }

    return (data || []) as unknown as MembershipRecord[];
  } catch {
    return [];
  }
}

/**
 * Retrieves an active membership for a specific user and tenant.
 * Returns null if tenant or membership is suspended/revoked.
 */
export async function getActiveTenantMembership(
  userId: string,
  tenantId: string,
  adminClient?: any
): Promise<MembershipRecord | null> {
  try {
    const admin = adminClient || createAdminClient();
    const { data, error } = await admin
      .from("tenant_memberships")
      .select("*, tenants(id, name, slug, status)")
      .eq("user_id", userId)
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .single();

    if (error || !data) {
      return null;
    }

    const record = data as unknown as MembershipRecord;
    if (record.tenants && record.tenants.status !== "ACTIVE") {
      // Tenant itself is not active
      return null;
    }

    return record;
  } catch {
    return null;
  }
}

/**
 * Lists all institutional staff members for a tenant (PLACEMENT_HEAD, PLACEMENT_STAFF, TRAINER).
 * Resolves user profiles separately without relying on schema cache foreign-key joins.
 */
export async function listTenantMembers(
  tenantId: string,
  options?: { roles?: UserRole[] }
): Promise<MembershipRecord[]> {
  try {
    const admin = createAdminClient();
    const targetRoles = options?.roles || ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"];

    const { data: memberships, error } = await admin
      .from("tenant_memberships")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("role", targetRoles)
      .order("created_at", { ascending: false });

    if (error) {
      if (
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.message?.includes("schema cache") ||
        error.message?.includes("does not exist")
      ) {
        return [];
      }
      throw new Error(`Failed to list tenant members: ${error.message}`);
    }

    if (!memberships || memberships.length === 0) {
      return [];
    }

    // Extract unique user IDs
    const userIds = Array.from(new Set(memberships.map((m: any) => m.user_id)));

    // Fetch corresponding profiles in a separate query to avoid schema cache / FK join limitations
    const profileMap = new Map<string, { id: string; email: string; full_name: string }>();

    try {
      const { data: profilesData } = await admin
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);

      if (profilesData) {
        for (const p of profilesData) {
          profileMap.set(p.id, {
            id: p.id,
            email: p.email || "",
            full_name: p.full_name || "",
          });
        }
      }
    } catch {
      // Gracefully continue to auth users fallback
    }

    // For any user without a complete profile in profiles table, fallback to auth.admin.listUsers()
    const missingUserIds = userIds.filter((uid) => !profileMap.has(uid) || !profileMap.get(uid)?.email);
    if (missingUserIds.length > 0) {
      try {
        const { data: { users } } = await admin.auth.admin.listUsers();
        if (users) {
          for (const u of users) {
            if (missingUserIds.includes(u.id)) {
              const existing = profileMap.get(u.id);
              profileMap.set(u.id, {
                id: u.id,
                email: u.email || existing?.email || "",
                full_name:
                  u.user_metadata?.full_name ||
                  u.user_metadata?.name ||
                  existing?.full_name ||
                  (u.email ? u.email.split("@")[0] : "Staff Member"),
              });
            }
          }
        }
      } catch {
        // Fallback gracefully
      }
    }

    return memberships.map((m: any) => {
      const prof = profileMap.get(m.user_id) || {
        id: m.user_id,
        email: "",
        full_name: m.role === "PLACEMENT_HEAD" ? "Placement Head" : "Staff Member",
      };
      return {
        ...m,
        profiles: prof,
      } as MembershipRecord;
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("schema cache") ||
      msg.includes("PGRST205") ||
      msg.includes("42P01") ||
      msg.includes("does not exist")
    ) {
      return [];
    }
    throw err;
  }
}

/**
 * Updates a membership's operational status (e.g. SUSPENDED, ACTIVE, REVOKED).
 */
export async function updateMemberStatus(params: {
  membershipId: string;
  tenantId: string;
  newStatus: "ACTIVE" | "SUSPENDED" | "REVOKED";
  actorUserId?: string;
  reason?: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: member, error: fetchErr } = await admin
    .from("tenant_memberships")
    .select("*")
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId)
    .single();

  if (fetchErr && (fetchErr.code === "PGRST205" || fetchErr.code === "42P01")) {
    return;
  }

  if (!member) {
    throw new Error("Membership record not found.");
  }

  const { error } = await admin
    .from("tenant_memberships")
    .update({
      status: params.newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId);

  if (error) {
    throw new Error(`Failed to update membership status: ${error.message}`);
  }

  await logAuditEvent({
    tenantId: params.tenantId,
    actorId: params.actorUserId,
    action: `membership.${params.newStatus.toLowerCase()}`,
    resourceType: "TenantMembership",
    resourceId: params.membershipId,
    beforeState: { status: member.status, role: member.role },
    afterState: { status: params.newStatus, reason: params.reason },
  });
}

/**
 * Updates a member's role and granular permissions.
 */
export async function updateMemberRole(params: {
  membershipId: string;
  tenantId: string;
  newRole: UserRole;
  newPermissions?: string[];
  actorUserId?: string;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: member, error: fetchErr } = await admin
    .from("tenant_memberships")
    .select("*")
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId)
    .single();

  if (fetchErr && (fetchErr.code === "PGRST205" || fetchErr.code === "42P01")) {
    return;
  }

  if (!member) {
    throw new Error("Membership record not found.");
  }

  const { error } = await admin
    .from("tenant_memberships")
    .update({
      role: params.newRole,
      permissions: params.newPermissions || [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId);

  if (error) {
    throw new Error(`Failed to update member role: ${error.message}`);
  }

  await logAuditEvent({
    tenantId: params.tenantId,
    actorId: params.actorUserId,
    action: "membership.role_change",
    resourceType: "TenantMembership",
    resourceId: params.membershipId,
    beforeState: { role: member.role, permissions: member.permissions },
    afterState: { role: params.newRole, permissions: params.newPermissions },
  });
}

/**
 * Permanently removes an institutional staff member and their user account:
 * 1. Actor must be PLACEMENT_HEAD or possess STAFF_MANAGE permission in this college.
 * 2. Target member must belong exclusively to this college workspace.
 * 3. Cannot remove the last active PLACEMENT_HEAD of the college.
 * 4. Cannot remove one's own account (self-removal safeguard).
 * 5. Calls Supabase Auth Admin deleteUser to permanently delete the login account.
 *    - If Auth deletion fails, aborts immediately without leaving partial deletion.
 * 6. Database foreign-key ON DELETE CASCADE cleans up tenant_memberships and profiles.
 *    - Explicit cleanup guarantees clean state across all environments.
 * 7. Historical college records (drives, assessments, questions, logs) are preserved via ON DELETE SET NULL.
 * 8. Records comprehensive institutional audit trail.
 */
export async function removeTenantMember(params: {
  membershipId: string;
  tenantId: string;
  actorUserId: string;
  reason?: string;
  admin?: any;
}): Promise<void> {
  const admin = params.admin || createAdminClient();

  // 1. Authorize actor: actor must have PLACEMENT_HEAD role or STAFF_MANAGE in this tenant
  const actorMembership = await getActiveTenantMembership(params.actorUserId, params.tenantId, admin);
  if (!actorMembership || actorMembership.status !== "ACTIVE") {
    throw new Error("Unauthorized: Active tenant membership required.");
  }

  const isPlacementHead = actorMembership.role === "PLACEMENT_HEAD";
  const hasStaffManagePermission =
    Array.isArray(actorMembership.permissions) &&
    actorMembership.permissions.includes("STAFF_MANAGE");

  if (!isPlacementHead && !hasStaffManagePermission) {
    throw new Error("Unauthorized: Only a Placement Head or authorized staff administrator can remove members.");
  }

  // 2. Fetch target membership ensuring strict tenant boundary
  const { data: targetMember, error: fetchErr } = await admin
    .from("tenant_memberships")
    .select("*")
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId)
    .single();

  if (fetchErr && (fetchErr.code === "PGRST205" || fetchErr.code === "42P01")) {
    throw new Error("Tenant memberships service unavailable.");
  }

  if (!targetMember) {
    throw new Error("Staff member record not found in this college workspace.");
  }

  // 3. Self-removal safeguard
  if (targetMember.user_id === params.actorUserId) {
    throw new Error("You cannot remove your own staff account. Please have another administrator remove your account.");
  }

  // 4. Last Placement Head safeguard:
  // If target is a PLACEMENT_HEAD, ensure they are not the sole remaining active Placement Head in this college
  if (targetMember.role === "PLACEMENT_HEAD") {
    const { count: activeHeadsCount, error: countErr } = await admin
      .from("tenant_memberships")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", params.tenantId)
      .eq("role", "PLACEMENT_HEAD")
      .eq("status", "ACTIVE");

    if (countErr) {
      throw new Error(`Failed to verify administrator count: ${countErr.message}`);
    }

    if ((activeHeadsCount ?? 0) <= 1) {
      throw new Error(
        "Cannot remove the last active Placement Head. Please assign another Placement Head before removing this administrator."
      );
    }
  }

  const targetUserId = targetMember.user_id;

  // 5. Verify single-college ownership: ensure target has no conflicting multi-college memberships
  if (targetUserId) {
    const { data: userMemberships } = await admin
      .from("tenant_memberships")
      .select("id, tenant_id")
      .eq("user_id", targetUserId);

    if (userMemberships && userMemberships.length > 1) {
      const otherCollege = userMemberships.find((m: any) => m.tenant_id !== params.tenantId);
      if (otherCollege) {
        throw new Error("Data conflict detected: Account has conflicting multi-college memberships. Please resolve conflicts before removal.");
      }
    }
  }

  // 6. Permanently delete user login account from Supabase Auth & Storage via UserDeletionService
  // This is the authoritative action: deleting the auth user and storage permanently revokes login capability.
  if (targetUserId) {
    try {
      await UserDeletionService.executePermanentDeletion({
        targetUserId,
        actorUserId: params.actorUserId,
        actorRole: "PLACEMENT_HEAD",
        tenantId: params.tenantId,
        reason: params.reason || "Staff member account permanently removed by college administrator",
        adminClient: admin,
      });
    } catch (delErr: any) {
      if (
        delErr.message?.includes("Failed to permanently delete user from Supabase Auth") ||
        delErr.message?.includes("Internal Auth Provider Failure")
      ) {
        throw new Error(`Failed to delete staff authentication account: ${delErr.message}`);
      }
      if (admin.auth?.admin?.deleteUser) {
        const { error: authDelErr } = await admin.auth.admin.deleteUser(targetUserId);
        if (authDelErr) {
          throw new Error(`Failed to delete staff authentication account: ${authDelErr.message}`);
        }
      }
    }
  }

  // 7. Complete database cleanup: remove tenant_membership and profile
  // (In PostgreSQL, ON DELETE CASCADE handles this; explicit deletion guarantees clean state in all environments)
  const { error: deleteErr } = await admin
    .from("tenant_memberships")
    .delete()
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId);

  if (deleteErr) {
    throw new Error(`Failed to remove staff member membership: ${deleteErr.message}`);
  }

  if (targetUserId) {
    try {
      await admin.from("profiles").delete().eq("id", targetUserId);
    } catch {
      // Ignored if already cascaded
    }
  }

  // 8. Log institutional audit trail
  await logAuditEvent({
    tenantId: params.tenantId,
    actorId: params.actorUserId,
    action: "membership.removed",
    resourceType: "TenantMembership",
    resourceId: params.membershipId,
    beforeState: {
      id: targetMember.id,
      userId: targetMember.user_id,
      role: targetMember.role,
      status: targetMember.status,
    },
    afterState: {
      removed: true,
      authAccountDeleted: true,
      profileDeleted: true,
      reason: params.reason || "Staff member account permanently removed by college administrator",
    },
  });
}

export const MembershipService = {
  listUserMemberships: getUserMemberships,
  getTenantMembers: listTenantMembers,
  updateMemberRole,
  updateMemberStatus,
  removeTenantMember,
};

