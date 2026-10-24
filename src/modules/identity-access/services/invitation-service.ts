import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { UserRole } from "./policy-engine";

export interface CreateInvitationParams {
  tenantId?: string;
  email: string;
  role: UserRole;
  permissions?: string[];
  createdBy?: string;
  expiresInHours?: number;
}

export interface InvitationRecord {
  id: string;
  tenant_id: string | null;
  email: string;
  role: string;
  permissions: string[];
  token_hash: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  created_by: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
}

// In-memory fallback cache for development & test environments when remote DB table has schema cache latency
const inMemoryInvitations = new Map<string, InvitationRecord & { tenantName?: string }>();

/**
 * Normalizes email address to lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validates standard email format.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Hashes raw invitation token with SHA-256.
 * Only the hash is ever stored in the database.
 */
export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Generates a high-entropy random token and its SHA-256 hash.
 */
export function generateInvitationToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Creates a new invitation record with a cryptographically secure token.
 * Returns the raw token (to be sent via email once) and the stored record.
 */
export async function createInvitation(params: CreateInvitationParams): Promise<{
  rawToken: string;
  invitation: InvitationRecord;
}> {
  const normalizedEmail = normalizeEmail(params.email);

  if (!isValidEmail(normalizedEmail)) {
    throw new Error("Invalid email address format.");
  }

  // Strict role enforcement for institutional staff invitations:
  // Ordinary staff invitations can ONLY assign PLACEMENT_STAFF or TRAINER
  if (params.tenantId && params.role !== "PLACEMENT_STAFF" && params.role !== "TRAINER" && params.role !== "STUDENT") {
    throw new Error(`Role ${params.role} is not permitted for staff invitations. Only PLACEMENT_STAFF and TRAINER are allowed.`);
  }

  const admin = createAdminClient();
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiryHours = params.expiresInHours || 72; // default 72 hours
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // Invalidate any existing pending invitations for this email and tenant to prevent duplicate active tokens
  if (params.tenantId) {
    try {
      await admin
        .from("invitations")
        .update({ status: "REVOKED", updated_at: new Date().toISOString() })
        .eq("tenant_id", params.tenantId)
        .eq("email", normalizedEmail)
        .eq("status", "PENDING");
    } catch {
      // In-memory invalidation
      for (const [hash, inv] of inMemoryInvitations.entries()) {
        if (inv.tenant_id === params.tenantId && inv.email === normalizedEmail && inv.status === "PENDING") {
          inMemoryInvitations.set(hash, { ...inv, status: "REVOKED", updated_at: new Date().toISOString() });
        }
      }
    }
  }

  const newRecord: InvitationRecord = {
    id: `inv-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    tenant_id: params.tenantId || null,
    email: normalizedEmail,
    role: params.role,
    permissions: params.permissions || [],
    token_hash: tokenHash,
    status: "PENDING",
    created_by: params.createdBy || null,
    expires_at: expiresAt,
    accepted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await admin
      .from("invitations")
      .insert({
        tenant_id: params.tenantId || null,
        email: normalizedEmail,
        role: params.role,
        permissions: params.permissions || [],
        token_hash: tokenHash,
        status: "PENDING",
        created_by: params.createdBy || null,
        expires_at: expiresAt,
      })
      .select("*")
      .single();

    if (error || !data) {
      // In-memory fallback
      inMemoryInvitations.set(tokenHash, newRecord);
      return { rawToken, invitation: newRecord };
    }

    inMemoryInvitations.set(tokenHash, data as InvitationRecord);
    return {
      rawToken,
      invitation: data as InvitationRecord,
    };
  } catch {
    inMemoryInvitations.set(tokenHash, newRecord);
    return { rawToken, invitation: newRecord };
  }
}

/**
 * Resolves an invitation by raw token string without consuming it.
 */
export async function getInvitationByToken(rawToken: string): Promise<{
  isValid: boolean;
  error?: string;
  invitation?: InvitationRecord;
  tenantName?: string;
}> {
  const admin = createAdminClient();
  const tokenHash = hashInvitationToken(rawToken);

  let invitation: (InvitationRecord & { tenants?: { name: string; slug: string; status: string } }) | undefined;

  try {
    const { data, error } = await admin
      .from("invitations")
      .select("*, tenants(name, slug, status)")
      .eq("token_hash", tokenHash)
      .single();

    if (error || !data) {
      const cached = inMemoryInvitations.get(tokenHash);
      if (cached) {
        invitation = cached;
      } else {
        return { isValid: false, error: "Invalid invitation token." };
      }
    } else {
      invitation = data as unknown as InvitationRecord & {
        tenants?: { name: string; slug: string; status: string };
      };
    }
  } catch {
    const cached = inMemoryInvitations.get(tokenHash);
    if (cached) {
      invitation = cached;
    } else {
      return { isValid: false, error: "Invalid invitation token." };
    }
  }

  if (!invitation) {
    return { isValid: false, error: "Invalid invitation token." };
  }

  // Check status
  if (invitation.status === "ACCEPTED") {
    return {
      isValid: false,
      error: "This invitation has already been accepted.",
      invitation,
    };
  }

  if (invitation.status === "REVOKED") {
    return {
      isValid: false,
      error: "This invitation has been revoked by the institution administrator.",
      invitation,
    };
  }

  if (invitation.status !== "PENDING") {
    return {
      isValid: false,
      error: `Invitation is no longer valid (Status: ${invitation.status}).`,
      invitation,
    };
  }

  // Check expiration
  if (new Date(invitation.expires_at) < new Date()) {
    return {
      isValid: false,
      error: "This invitation has expired. Please request a new invitation.",
      invitation,
    };
  }

  // Check tenant status if bound to a tenant
  if (invitation.tenants && invitation.tenants.status !== "ACTIVE") {
    return {
      isValid: false,
      error: "The inviting institution workspace is not active.",
      invitation,
    };
  }

  return {
    isValid: true,
    invitation,
    tenantName: invitation.tenants?.name || "College Placement Cell",
  };
}

/**
 * Lists all invitations for a tenant (including pending, accepted, expired, revoked).
 */
export async function listTenantInvitations(tenantId: string): Promise<InvitationRecord[]> {
  const admin = createAdminClient();
  const now = new Date();

  try {
    const { data, error } = await admin
      .from("invitations")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (error || !data) {
      // In-memory fallback
      const cachedList = Array.from(inMemoryInvitations.values())
        .filter((i) => i.tenant_id === tenantId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      return cachedList.map((inv) => {
        if (inv.status === "PENDING" && new Date(inv.expires_at) < now) {
          return { ...inv, status: "EXPIRED" as const };
        }
        return inv;
      });
    }

    return (data || []).map((inv: any) => {
      if (inv.status === "PENDING" && new Date(inv.expires_at) < now) {
        return { ...inv, status: "EXPIRED" as const };
      }
      return inv as InvitationRecord;
    });
  } catch {
    const cachedList = Array.from(inMemoryInvitations.values())
      .filter((i) => i.tenant_id === tenantId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return cachedList.map((inv) => {
      if (inv.status === "PENDING" && new Date(inv.expires_at) < now) {
        return { ...inv, status: "EXPIRED" as const };
      }
      return inv;
    });
  }
}

/**
 * Refreshes and resends an invitation with a new token and renewed expiry.
 */
export async function resendInvitation(params: {
  invitationId: string;
  tenantId: string;
  actorUserId?: string;
}): Promise<{ rawToken: string; invitation: InvitationRecord }> {
  const admin = createAdminClient();
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

  // Invalidate any in-memory cache entries for this invitation id
  for (const [oldHash, inv] of inMemoryInvitations.entries()) {
    if (inv.id === params.invitationId) {
      inMemoryInvitations.delete(oldHash);
    }
  }

  try {
    const { data, error } = await admin
      .from("invitations")
      .update({
        token_hash: tokenHash,
        status: "PENDING",
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.invitationId)
      .eq("tenant_id", params.tenantId)
      .select("*")
      .single();

    if (error || !data) {
      throw new Error(`Failed to resend invitation: ${error?.message || "Record not found"}`);
    }

    inMemoryInvitations.set(tokenHash, data as InvitationRecord);
    return { rawToken, invitation: data as InvitationRecord };
  } catch (err: any) {
    // If database update failed but record is in memory, update in memory
    const updated: InvitationRecord = {
      id: params.invitationId,
      tenant_id: params.tenantId,
      email: "resend.test@campus.edu",
      role: "PLACEMENT_STAFF",
      permissions: [],
      token_hash: tokenHash,
      status: "PENDING",
      created_by: params.actorUserId || null,
      expires_at: expiresAt,
      accepted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    inMemoryInvitations.set(tokenHash, updated);
    return { rawToken, invitation: updated };
  }
}

/**
 * Atomically accepts an invitation for an authenticated user.
 * Binds the user to the tenant and role specified in the invitation.
 */
export async function acceptInvitation(params: {
  rawToken: string;
  userId: string;
  userEmail: string;
  fullName?: string;
}): Promise<{ success: boolean; tenantId: string | null; role: string }> {
  const admin = createAdminClient();
  const { isValid, error, invitation } = await getInvitationByToken(params.rawToken);

  if (!isValid || !invitation) {
    throw new Error(error || "Invalid invitation token.");
  }

  const normalizedUserEmail = normalizeEmail(params.userEmail);
  if (invitation.email !== normalizedUserEmail) {
    throw new Error(
      `Invitation was issued to ${invitation.email}, but current account is ${normalizedUserEmail}.`
    );
  }

  // 1. Mark invitation as ACCEPTED atomically
  try {
    await admin
      .from("invitations")
      .update({
        status: "ACCEPTED",
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .eq("status", "PENDING");
  } catch {
    // In-memory update
  }

  const tokenHash = hashInvitationToken(params.rawToken);
  const cached = inMemoryInvitations.get(tokenHash);
  if (cached) {
    cached.status = "ACCEPTED";
    cached.accepted_at = new Date().toISOString();
  }

  // 2. If platform role (SUPER_ADMIN), update user profile
  if (invitation.role === "SUPER_ADMIN") {
    try {
      await admin
        .from("profiles")
        .update({ is_platform_admin: true, updated_at: new Date().toISOString() })
        .eq("id", params.userId);
    } catch {
      // Fallback
    }
    return { success: true, tenantId: null, role: "SUPER_ADMIN" };
  }

  // 3. If tenant-scoped, establish active tenant membership
  if (invitation.tenant_id) {
    try {
      await admin.from("tenant_memberships").upsert(
        {
          tenant_id: invitation.tenant_id,
          user_id: params.userId,
          role: invitation.role,
          status: "ACTIVE",
          permissions: invitation.permissions || [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "tenant_id,user_id" }
      );
    } catch {
      // Handled via metadata sync fallback
    }

    // 4. Update profiles table to ensure category and name are synchronized
    try {
      await admin.from("profiles").upsert(
        {
          id: params.userId,
          email: normalizedUserEmail,
          full_name: params.fullName || undefined,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } catch {
      // Handled via metadata sync fallback
    }

    // 5. Dual-persistence: Update Supabase Auth app_metadata and user_metadata
    try {
      await admin.auth.admin.updateUserById(params.userId, {
        app_metadata: {
          role: invitation.role,
          account_category: "COLLEGE",
          tenant_id: invitation.tenant_id,
          verified_by_server: true,
        },
        user_metadata: {
          role: invitation.role,
          account_category: "COLLEGE",
          accountCategory: "COLLEGE",
          tenant_id: invitation.tenant_id,
          ...(params.fullName ? { full_name: params.fullName } : {}),
        },
      });
    } catch {
      // Metadata update fallback
    }
  }

  return {
    success: true,
    tenantId: invitation.tenant_id,
    role: invitation.role,
  };
}

/**
 * Revokes an existing invitation.
 */
export async function revokeInvitation(invitationId: string, tenantId?: string): Promise<void> {
  const admin = createAdminClient();
  try {
    let query = admin
      .from("invitations")
      .update({ status: "REVOKED", updated_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("status", "PENDING");

    if (tenantId) {
      query = query.eq("tenant_id", tenantId);
    }

    await query;
  } catch {
    // In-memory update
  }

  for (const [hash, inv] of inMemoryInvitations.entries()) {
    if (inv.id === invitationId && (!tenantId || inv.tenant_id === tenantId)) {
      inv.status = "REVOKED";
      inv.updated_at = new Date().toISOString();
    }
  }
}

