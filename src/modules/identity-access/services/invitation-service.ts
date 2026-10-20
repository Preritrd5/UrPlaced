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

/**
 * Normalizes email address to lowercase and trimmed.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
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
  const admin = createAdminClient();
  const normalizedEmail = normalizeEmail(params.email);
  const { rawToken, tokenHash } = generateInvitationToken();
  const expiryHours = params.expiresInHours || 72; // default 72 hours
  const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();

  // Invalidate any existing pending invitations for this email and tenant
  if (params.tenantId) {
    await admin
      .from("invitations")
      .update({ status: "REVOKED", updated_at: new Date().toISOString() })
      .eq("tenant_id", params.tenantId)
      .eq("email", normalizedEmail)
      .eq("status", "PENDING");
  }

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
    if (error?.code === "PGRST205" || error?.code === "42P01" || error?.message?.includes("schema cache")) {
      return {
        rawToken,
        invitation: {
          id: `inv-${Date.now()}`,
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
        },
      };
    }
    throw new Error(`Failed to create invitation: ${error?.message || "Unknown error"}`);
  }

  return {
    rawToken,
    invitation: data as InvitationRecord,
  };
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

  const { data, error } = await admin
    .from("invitations")
    .select("*, tenants(name, slug, status)")
    .eq("token_hash", tokenHash)
    .single();

  if (error || !data) {
    return { isValid: false, error: "Invalid invitation token." };
  }

  const invitation = data as unknown as InvitationRecord & {
    tenants?: { name: string; slug: string; status: string };
  };

  // Check status
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
    tenantName: invitation.tenants?.name || "UrPlaced Platform",
  };
}

/**
 * Atomically accepts an invitation for an authenticated user.
 * Binds the user to the tenant and role specified in the invitation.
 */
export async function acceptInvitation(params: {
  rawToken: string;
  userId: string;
  userEmail: string;
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
  const { error: inviteUpdateError } = await admin
    .from("invitations")
    .update({
      status: "ACCEPTED",
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitation.id)
    .eq("status", "PENDING");

  if (inviteUpdateError) {
    if (inviteUpdateError.code !== "PGRST205" && inviteUpdateError.code !== "42P01" && !inviteUpdateError.message?.includes("schema cache")) {
      throw new Error("Invitation could not be accepted or was already consumed.");
    }
  }

  // 2. If platform role (SUPER_ADMIN), update user profile
  if (invitation.role === "SUPER_ADMIN") {
    await admin
      .from("profiles")
      .update({ is_platform_admin: true, updated_at: new Date().toISOString() })
      .eq("id", params.userId);

    return { success: true, tenantId: null, role: "SUPER_ADMIN" };
  }

  // 3. If tenant-scoped, create active tenant membership
  if (invitation.tenant_id) {
    const { error: memberError } = await admin
      .from("tenant_memberships")
      .upsert(
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

    if (memberError) {
      if (memberError.code !== "PGRST205" && memberError.code !== "42P01" && !memberError.message?.includes("schema cache")) {
        throw new Error(`Failed to establish tenant membership: ${memberError.message}`);
      }
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
  let query = admin
    .from("invitations")
    .update({ status: "REVOKED", updated_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("status", "PENDING");

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(`Failed to revoke invitation: ${error.message}`);
  }
}
