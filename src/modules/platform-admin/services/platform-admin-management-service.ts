import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";

export interface PlatformAdminUserItem {
  id: string;
  email: string;
  fullName: string;
  role: "SUPER_ADMIN";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REVOKED";
  mfaEnabled: boolean;
  mfaEnforced: boolean;
  lastSignInAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAdminInvitationItem {
  id: string;
  email: string;
  role: "SUPER_ADMIN";
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  createdAt: string;
}

export class PlatformAdminManagementService {
  /**
   * Lists all registered platform administrators.
   */
  static async listAdmins(admin = createAdminClient()): Promise<PlatformAdminUserItem[]> {
    const { data, error } = await admin
      .from("platform_admins")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      throw new Error(`Failed to list platform admins: ${error.message}`);
    }

    return (data || []).map((a: any) => ({
      id: a.id,
      email: a.email,
      fullName: a.full_name,
      role: a.role,
      status: a.status,
      mfaEnabled: a.mfa_enabled,
      mfaEnforced: a.mfa_enforced,
      lastSignInAt: a.last_sign_in_at,
      createdAt: a.created_at,
      updatedAt: a.updated_at,
    }));
  }

  /**
   * Lists pending admin invitations.
   */
  static async listInvitations(admin = createAdminClient()): Promise<PlatformAdminInvitationItem[]> {
    const { data, error } = await admin
      .from("platform_admin_invitations")
      .select("id, email, role, status, expires_at, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Failed to list invitations: ${error.message}`);
    }

    return (data || []).map((i: any) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      expiresAt: i.expires_at,
      createdAt: i.created_at,
    }));
  }

  /**
   * Creates an administrative invitation for a new Super Admin.
   */
  static async createInvitation(params: {
    email: string;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ invitationId: string; inviteLink: string }> {
    const { email, adminId, admin = createAdminClient() } = params;
    const cleanEmail = email.trim().toLowerCase();

    // Check if already an active admin
    const { data: existingAdmin } = await admin
      .from("platform_admins")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingAdmin) {
      throw new Error("This email is already registered as an active platform administrator.");
    }

    const token = `adm_inv_${Date.now()}_${Math.random().toString(36).substring(2, 12)}`;
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error } = await admin
      .from("platform_admin_invitations")
      .insert({
        email: cleanEmail,
        role: "SUPER_ADMIN",
        token_hash: token,
        status: "PENDING",
        invited_by: adminId,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error || !invite) {
      throw new Error(`Failed to create invitation: ${error?.message || "Unknown error"}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_ADMIN_INVITE",
      resourceType: "ADMIN_INVITATION",
      resourceId: invite.id,
      metadata: { targetEmail: cleanEmail },
      adminClient: admin,
    });

    const inviteLink = `/preritrd/login?invitation=${token}&email=${encodeURIComponent(cleanEmail)}`;

    return {
      invitationId: invite.id,
      inviteLink,
    };
  }

  /**
   * Updates an administrator's status (ACTIVE, SUSPENDED, REVOKED).
   * Invariant protection: Blocks operation if it would leave the platform with 0 active admins.
   */
  static async updateAdminStatus(params: {
    targetAdminId: string;
    newStatus: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REVOKED";
    currentAdminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; status: string }> {
    const { targetAdminId, newStatus, currentAdminId, admin = createAdminClient() } = params;

    // Check active admin count if attempting to deactivate/suspend/revoke
    if (newStatus !== "ACTIVE") {
      const { data: activeAdmins } = await admin
        .from("platform_admins")
        .select("id")
        .eq("status", "ACTIVE");

      if (activeAdmins && activeAdmins.length <= 1) {
        const isSelf = activeAdmins.some((a) => a.id === targetAdminId);
        if (isSelf) {
          throw new Error("Critical Safety Block: Cannot suspend or revoke the platform's sole remaining active Super Admin.");
        }
      }
    }

    const updatedAt = new Date().toISOString();
    const { data: updatedAdmin, error } = await admin
      .from("platform_admins")
      .update({
        status: newStatus,
        updated_at: updatedAt,
      })
      .eq("id", targetAdminId)
      .select()
      .single();

    if (error || !updatedAdmin) {
      throw new Error(`Failed to update admin status: ${error?.message || "Admin not found"}`);
    }

    // Keep profiles.is_platform_admin synchronized
    await admin
      .from("profiles")
      .update({
        is_platform_admin: newStatus === "ACTIVE",
        updated_at: updatedAt,
      })
      .eq("id", targetAdminId);

    await PlatformAuthService.logAuditEvent({
      actorId: currentAdminId,
      action: "PLATFORM_ADMIN_STATUS_UPDATE",
      resourceType: "PLATFORM_ADMIN",
      resourceId: targetAdminId,
      metadata: { targetAdminId, newStatus },
      adminClient: admin,
    });

    return {
      success: true,
      status: updatedAdmin.status,
    };
  }
}
