import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "@/modules/identity-access/services/policy-engine";
import { logAuditEvent } from "@/modules/identity-access/services/audit-service";

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
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("*, tenants(id, name, slug, status)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[MembershipService Error] Failed to fetch user memberships:", error);
    return [];
  }

  return (data || []) as unknown as MembershipRecord[];
}

/**
 * Retrieves an active membership for a specific user and tenant.
 * Returns null if tenant or membership is suspended/revoked.
 */
export async function getActiveTenantMembership(
  userId: string,
  tenantId: string
): Promise<MembershipRecord | null> {
  const admin = createAdminClient();
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
}

/**
 * Lists all members for a tenant.
 */
export async function listTenantMembers(tenantId: string): Promise<MembershipRecord[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tenant_memberships")
    .select("*, profiles(id, email, full_name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to list tenant members: ${error.message}`);
  }

  return (data || []) as unknown as MembershipRecord[];
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

  const { data: member } = await admin
    .from("tenant_memberships")
    .select("*")
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId)
    .single();

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

  const { data: member } = await admin
    .from("tenant_memberships")
    .select("*")
    .eq("id", params.membershipId)
    .eq("tenant_id", params.tenantId)
    .single();

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
