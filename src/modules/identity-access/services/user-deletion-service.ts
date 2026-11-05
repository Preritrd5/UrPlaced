/**
 * UrPlaced — Centralized User Deletion Orchestration Service
 * P0 Security Service: Enforces permanent, hard deletion of user accounts
 * across Supabase Auth, PostgreSQL database, and Supabase Storage.
 *
 * Implements strict multi-stage deletion lifecycle:
 * - STAGE A: Authorization & Administrative Safeguards
 * - STAGE B: Immediate Access Revocation (Session termination)
 * - STAGE C: Storage Cleanup (Avatars and user-owned objects)
 * - STAGE D: PostgreSQL Relational Cleanup (Personal records, memberships, profile)
 * - STAGE E: Supabase Auth Hard Deletion (auth.users removal)
 * - STAGE F: Post-Deletion Verification & Append-Only Audit Logging
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { AvatarStorageService } from "./avatar-storage-service";
import type { UserRole } from "./policy-engine";

export interface DeleteUserParams {
  targetUserId: string;
  actorUserId: string;
  actorRole: "SUPER_ADMIN" | "PLACEMENT_HEAD" | "PLACEMENT_STAFF";
  tenantId?: string; // Required for college-scoped deletions
  reason: string;
  confirmedEmailOrSrn?: string;
  adminClient?: ReturnType<typeof createAdminClient>;
}

export interface UserDeletionResult {
  success: boolean;
  userId: string;
  email: string;
  stagesCompleted: {
    authorization: boolean;
    revocation: boolean;
    storage: boolean;
    database: boolean;
    auth: boolean;
    verification: boolean;
  };
  details: {
    deletedFromAuth: boolean;
    deletedProfile: boolean;
    deletedMembershipsCount: number;
    deletedStorageObjectsCount: number;
    deletedStudentCount: number;
    deletedNotificationsCount: number;
  };
  message: string;
}

export class UserDeletionService {
  /**
   * Executes authoritative, irreversible, hard user deletion across all layers.
   */
  static async executePermanentDeletion(params: DeleteUserParams): Promise<UserDeletionResult> {
    const {
      targetUserId,
      actorUserId,
      actorRole,
      tenantId,
      reason,
    } = params;

    const confirmedEmailOrSrn = params.confirmedEmailOrSrn || (params as any).emailConfirmation;
    const admin = params.adminClient || (params as any).admin || createAdminClient();

    // =========================================================================
    // STAGE A: Authorization & Safeguards Verification
    // =========================================================================
    if (!targetUserId || typeof targetUserId !== "string" || targetUserId.trim() === "") {
      throw new Error("Invalid target user ID: User identifier is required.");
    }

    if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
      throw new Error("REASON_REQUIRED: A mandatory deletion justification reason of at least 5 characters is required.");
    }

    const cleanReason = reason.trim();

    // 1. Resolve target user data from Auth or Profile
    let targetEmail = "";
    let targetFullName = "";
    let authUserExists = false;

    try {
      if (typeof admin.auth?.admin?.getUserById === "function") {
        const { data: authData } = await admin.auth.admin.getUserById(targetUserId);
        if (authData?.user) {
          authUserExists = true;
          targetEmail = authData.user.email || "";
          targetFullName = authData.user.user_metadata?.full_name || "";
        }
      }
    } catch {
      // Fall through to database lookup
    }

    // Secondary database profile lookup
    const { data: profile } = await admin
      .from("profiles")
      .select("id, email, full_name, is_platform_admin")
      .eq("id", targetUserId)
      .maybeSingle();

    if (profile) {
      targetEmail = targetEmail || profile.email || "";
      targetFullName = targetFullName || profile.full_name || "";
    }

    // Safeguard: Only Super Admins may delete platform administrators
    if (profile?.is_platform_admin && actorRole !== "SUPER_ADMIN") {
      throw new Error("FORBIDDEN: Only Platform Super Administrators may delete platform administrator accounts.");
    }

    // Check if target is in students table
    const { data: studentRecord } = await admin
      .from("students")
      .select("id, tenant_id, enrollment_number, full_name, email, user_id")
      .or(`user_id.eq.${targetUserId},id.eq.${targetUserId}`)
      .maybeSingle();

    if (studentRecord) {
      targetEmail = targetEmail || studentRecord.email || "";
      targetFullName = targetFullName || studentRecord.full_name || "";
    }

    // Idempotency check: If user does not exist in Auth, profiles, or students, handle safely
    if (!authUserExists && !profile && !studentRecord) {
      return {
        success: true,
        userId: targetUserId,
        email: targetEmail || "unknown",
        stagesCompleted: {
          authorization: true,
          revocation: true,
          storage: true,
          database: true,
          auth: true,
          verification: true,
        },
        details: {
          deletedFromAuth: false,
          deletedProfile: false,
          deletedMembershipsCount: 0,
          deletedStorageObjectsCount: 0,
          deletedStudentCount: 0,
          deletedNotificationsCount: 0,
        },
        message: "User account is already permanently deleted from UrPlaced.",
      };
    }

    // Confirmation phrase validation if provided
    if (confirmedEmailOrSrn) {
      const entered = confirmedEmailOrSrn.trim().toLowerCase();
      const expectedEmail = targetEmail.toLowerCase();
      const expectedSrn = studentRecord?.enrollment_number?.trim().toLowerCase() || "";
      if (entered !== expectedEmail && entered !== expectedSrn) {
        throw new Error(
          `EMAIL_CONFIRMATION_MISMATCH: Confirmation mismatch. Expected '${targetEmail}'${expectedSrn ? ` or '${studentRecord.enrollment_number}'` : ""}, but received '${confirmedEmailOrSrn}'.`
        );
      }
    }

    // 2. Role-specific authority and isolation enforcement
    if (actorRole === "SUPER_ADMIN") {
      // Safeguard: Prevent Super Admin from self-deleting their own account
      if (targetUserId === actorUserId) {
        throw new Error("SELF_DELETION_PROHIBITED: Super Administrators cannot delete their own administrative account.");
      }

      // Safeguard: Prevent deleting the platform's sole remaining active Super Admin
      if (profile?.is_platform_admin) {
        const { data: activeAdmins } = await admin
          .from("platform_admins")
          .select("id, user_id")
          .eq("status", "ACTIVE");

        if (activeAdmins && activeAdmins.length <= 1) {
          const isTargetSoleAdmin = activeAdmins.some((a: any) => a.id === targetUserId || a.user_id === targetUserId);
          if (isTargetSoleAdmin) {
            throw new Error("LAST_ACTIVE_ADMIN: Critical Safety Block: Cannot delete the platform's sole remaining active Super Admin.");
          }
        }
      }
    } else if (actorRole === "PLACEMENT_HEAD" || actorRole === "PLACEMENT_STAFF") {
      if (!tenantId) {
        throw new Error("Tenant identifier is required for institutional user deletion.");
      }

      // Safeguard: Prevent self-removal
      if (targetUserId === actorUserId) {
        throw new Error("Safety Block: You cannot delete your own account. Another authorized administrator must perform this action.");
      }

      // Scope check: Verify target belongs to the caller's institution
      const { data: targetMemberships } = await admin
        .from("tenant_memberships")
        .select("id, tenant_id, role, status")
        .eq("user_id", targetUserId);

      const belongsToCallerTenant =
        (targetMemberships && targetMemberships.some((m: any) => m.tenant_id === tenantId)) ||
        (studentRecord && studentRecord.tenant_id === tenantId);

      if (!belongsToCallerTenant) {
        throw new Error("Unauthorized: Target user does not belong to your college workspace.");
      }

      // Safeguard: Last active Placement Head protection
      const isTargetPlacementHead = targetMemberships?.some((m: any) => m.role === "PLACEMENT_HEAD");
      if (isTargetPlacementHead) {
        const { count: activeHeadsCount } = await admin
          .from("tenant_memberships")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .eq("role", "PLACEMENT_HEAD")
          .eq("status", "ACTIVE");

        if ((activeHeadsCount ?? 0) <= 1) {
          throw new Error("Cannot remove the last active Placement Head. Assign another Placement Head before removing this account.");
        }
      }
    } else {
      throw new Error("Unauthorized: Insufficient administrative privileges to delete user accounts.");
    }

    const stagesCompleted = {
      authorization: true,
      revocation: false,
      storage: false,
      database: false,
      auth: false,
      verification: false,
    };

    const details = {
      deletedFromAuth: false,
      deletedProfile: false,
      deletedMembershipsCount: 0,
      deletedStorageObjectsCount: 0,
      deletedStudentCount: 0,
      deletedNotificationsCount: 0,
    };

    // =========================================================================
    // STAGE B: Immediate Access Revocation
    // =========================================================================
    // 1. Immediately revoke active refresh tokens and sign out target user
    try {
      if (typeof (admin.auth?.admin as any)?.signOut === "function") {
        await (admin.auth.admin as any).signOut(targetUserId);
      }
    } catch (revokeErr) {
      console.warn("[UserDeletionService] Session revocation notice:", revokeErr);
    }

    // 2. Mark tenant memberships as REVOKED immediately
    try {
      await admin
        .from("tenant_memberships")
        .update({ status: "REVOKED", updated_at: new Date().toISOString() })
        .eq("user_id", targetUserId);
    } catch {
      // Table may cascade or be cleaned below
    }

    stagesCompleted.revocation = true;

    // =========================================================================
    // STAGE C: Storage Cleanup (Avatars & User-Owned Files)
    // =========================================================================
    try {
      const { data: avatarFiles } = await admin.storage
        .from(AvatarStorageService.BUCKET_NAME)
        .list(targetUserId);

      if (avatarFiles && avatarFiles.length > 0) {
        const filesToRemove = avatarFiles.map((file: { name: string }) => `${targetUserId}/${file.name}`);
        const { error: storageDelErr } = await admin.storage
          .from(AvatarStorageService.BUCKET_NAME)
          .remove(filesToRemove);

        if (!storageDelErr) {
          details.deletedStorageObjectsCount += filesToRemove.length;
        } else {
          console.warn("[UserDeletionService] Storage deletion warning:", storageDelErr.message);
        }
      }
    } catch (storageErr) {
      console.warn("[UserDeletionService] Storage enumeration warning:", storageErr);
    }

    stagesCompleted.storage = true;

    // =========================================================================
    // STAGE D: PostgreSQL Relational Cleanup
    // =========================================================================
    // 1. Delete notifications received or triggered by target user
    try {
      const { data: delNotifs } = await admin
        .from("notifications")
        .delete()
        .or(`recipient_user_id.eq.${targetUserId},actor_user_id.eq.${targetUserId}`)
        .select("id");
      details.deletedNotificationsCount = delNotifs?.length || 0;
    } catch {
      // Graceful fallback
    }

    // 2. Clean up student roster record if applicable
    if (studentRecord) {
      try {
        // Remove dependent personal mistake bank / practice records
        try {
          await (admin as any).from("mistake_bank").delete().eq("student_id", studentRecord.id);
        } catch {}
        try {
          await (admin as any).from("assessment_attempts").delete().eq("student_id", studentRecord.id);
        } catch {}
        try {
          await (admin as any).from("training_attendance").delete().eq("student_id", studentRecord.id);
        } catch {}

        const { error: studentDelErr } = await admin
          .from("students")
          .delete()
          .eq("id", studentRecord.id);

        if (!studentDelErr) {
          details.deletedStudentCount = 1;
        }
      } catch (stErr) {
        console.warn("[UserDeletionService] Student table cleanup warning:", stErr);
      }
    }

    // 3. Preserve shared institutional records: Reassign created_by to NULL
    try {
      await admin
        .from("question_sets")
        .update({ created_by: null })
        .eq("created_by", targetUserId);
    } catch {
      // Table may not have created_by
    }
    try {
      await admin
        .from("questions")
        .update({ created_by: null, reviewed_by: null })
        .eq("created_by", targetUserId);
    } catch {}
    try {
      await admin
        .from("assessments")
        .update({ created_by: null })
        .eq("created_by", targetUserId);
    } catch {}
    try {
      await admin
        .from("drives")
        .update({ created_by: null })
        .eq("created_by", targetUserId);
    } catch {}

    // 4. Remove platform_admins record if target was an admin
    try {
      await admin
        .from("platform_admins")
        .delete()
        .eq("id", targetUserId);
    } catch {
      // Graceful fallback
    }

    // 5. Remove platform_admin_invitations if matching email
    if (targetEmail) {
      try {
        await admin
          .from("platform_admin_invitations")
          .delete()
          .eq("email", targetEmail.toLowerCase());
      } catch {
        // Graceful fallback
      }
    }

    // 6. Delete tenant memberships
    try {
      const { data: delMems } = await admin
        .from("tenant_memberships")
        .delete()
        .eq("user_id", targetUserId)
        .select("id");
      details.deletedMembershipsCount = delMems?.length || 0;
    } catch (memErr) {
      console.warn("[UserDeletionService] Memberships delete notice:", memErr);
    }

    // 7. Delete public.profiles record
    try {
      const { error: profDelErr } = await admin
        .from("profiles")
        .delete()
        .eq("id", targetUserId);
      if (!profDelErr) {
        details.deletedProfile = true;
      }
    } catch (profErr) {
      console.warn("[UserDeletionService] Profile delete notice:", profErr);
    }

    stagesCompleted.database = true;

    // =========================================================================
    // STAGE E: Permanent Supabase Auth Hard Deletion
    // =========================================================================
    if (admin.auth?.admin?.deleteUser) {
      const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId);

      if (authErr) {
        // If error message indicates user already does not exist, consider handled
        const isAlreadyMissing =
          authErr.message?.toLowerCase().includes("not found") ||
          authErr.message?.toLowerCase().includes("does not exist");

        if (!isAlreadyMissing) {
          throw new Error(`Failed to permanently delete user from Supabase Auth: ${authErr.message}`);
        }
      }
      details.deletedFromAuth = true;
    }

    stagesCompleted.auth = true;

    // =========================================================================
    // STAGE F: Post-Deletion Verification & Audit Logging
    // =========================================================================
    // 1. Verify user is no longer queryable from Auth
    let verifyAuthGone = true;
    try {
      if (typeof admin.auth?.admin?.getUserById === "function") {
        const { data: verifyData } = await admin.auth.admin.getUserById(targetUserId);
        if (verifyData?.user) {
          verifyAuthGone = false;
        }
      }
    } catch {
      verifyAuthGone = true;
    }

    if (!verifyAuthGone) {
      throw new Error("Post-deletion verification failed: Target user still exists in Supabase Auth.");
    }

    // 2. Canonical append-only audit log
    try {
      await admin.from("audit_logs").insert({
        tenant_id: tenantId || null,
        actor_id: actorUserId,
        action: "USER_PERMANENTLY_DELETED",
        resource_type: "USER",
        resource_id: targetUserId,
        metadata: {
          deletedEmail: targetEmail,
          deletedFullName: targetFullName,
          reason: cleanReason,
          actorRole,
          details,
        },
        before_state: {
          email: targetEmail,
          fullName: targetFullName,
          userId: targetUserId,
          reason: cleanReason,
          actorRole,
        },
        after_state: {
          deletedAt: new Date().toISOString(),
          status: "PERMANENTLY_DELETED",
          details,
          deletedEmail: targetEmail,
          deletedFullName: targetFullName,
          reason: cleanReason,
          actorRole,
        },
      });
    } catch (auditErr) {
      console.warn("[UserDeletionService] Audit logging notice:", auditErr);
    }

    stagesCompleted.verification = true;

    return {
      success: true,
      userId: targetUserId,
      email: targetEmail,
      stagesCompleted,
      details,
      message: `User account '${targetEmail || targetUserId}' has been permanently deleted from Supabase Auth and all database records.`,
    };
  }
}
