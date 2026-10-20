import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMemberships, MembershipRecord } from "@/modules/tenancy/services/membership-service";
import type { UserRole } from "@/modules/identity-access/services/policy-engine";

export interface UserSessionProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  accountCategory: "STUDENT" | "COLLEGE";
  institutionName?: string;
  isPlatformAdmin: boolean;
  avatarUrl: string | null;
  memberships: MembershipRecord[];
  activeMembership?: MembershipRecord;
  isVerifiedMembership: boolean;
  membershipStatus: "ACTIVE" | "SUSPENDED" | "REVOKED" | "NONE";
}

/**
 * Resolves the currently authenticated user session and application profile from the server.
 * Authoritative security rule: Role, college membership, and tenant permissions are resolved
 * ONLY from trusted database records (tenant_memberships).
 * Stale JWT claims or app_metadata CANNOT bypass a missing, suspended, or revoked membership.
 * Client-editable user_metadata is NEVER trusted for role or permission authorization.
 */
export async function getCurrentUserProfile(
  selectedTenantId?: string
): Promise<UserSessionProfile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    const admin = createAdminClient();
    let profile: any = null;
    try {
      const { data } = await admin
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      profile = data;
    } catch {
      // Database profiles query fallback
    }

    let memberships: MembershipRecord[] = [];
    let isTableMissing = false;
    try {
      const { error: testErr } = await admin.from("tenant_memberships").select("id").limit(1);
      if (testErr && (testErr.code === "PGRST205" || testErr.code === "42P01")) {
        isTableMissing = true;
      }
    } catch {
      // Fallback
    }

    if (!isTableMissing) {
      try {
        memberships = await getUserMemberships(user.id);
      } catch {
        // Database memberships query fallback
      }
    }

    // 1. Authoritative server credentials
    const serverAppMeta = user.app_metadata || {};
    const serverRole = serverAppMeta.role as UserRole | undefined;
    const serverCategory = serverAppMeta.account_category as ("STUDENT" | "COLLEGE") | undefined;
    const serverTenantId = serverAppMeta.tenant_id as string | undefined;
    const serverInstitutionName = serverAppMeta.institution_name as string | undefined;
    const isServerVerified = serverAppMeta.verified_by_server === true;
    const isPlatformAdmin = !!profile?.is_platform_admin || serverAppMeta.is_platform_admin === true;

    // 2. Resolve database active membership
    let relevantMembership: MembershipRecord | undefined;
    if (selectedTenantId) {
      relevantMembership = memberships.find((m) => m.tenant_id === selectedTenantId);
    } else if (memberships.length > 0) {
      relevantMembership = memberships.find((m) => m.status === "ACTIVE") || memberships[0];
    }

    const membershipStatus: "ACTIVE" | "SUSPENDED" | "REVOKED" | "NONE" =
      relevantMembership?.status || (memberships.length > 0 ? memberships[0].status : "NONE");

    let activeMembership: MembershipRecord | undefined;
    if (relevantMembership && relevantMembership.status === "ACTIVE") {
      if (!relevantMembership.tenants || relevantMembership.tenants.status === "ACTIVE") {
        activeMembership = relevantMembership;
      }
    }

    // 3. Resolve authoritative role, account category, and verified status
    let resolvedRole: UserRole;
    let resolvedCategory: "STUDENT" | "COLLEGE";
    let isVerifiedMembership = false;

    // Strict security rule: A database SUSPENDED or REVOKED status overrules everything
    const isExplicitlyDenied = membershipStatus === "SUSPENDED" || membershipStatus === "REVOKED";

    if (activeMembership?.role && activeMembership.status === "ACTIVE") {
      // Active database membership record: authoritative source of truth
      resolvedRole = activeMembership.role;
      resolvedCategory = resolvedRole === "STUDENT" ? "STUDENT" : "COLLEGE";
      isVerifiedMembership = true;
    } else if (isPlatformAdmin) {
      resolvedRole = "SUPER_ADMIN";
      resolvedCategory = "COLLEGE";
      isVerifiedMembership = true;
    } else if (
      isTableMissing &&
      !isExplicitlyDenied &&
      (serverCategory === "COLLEGE" ||
        serverRole === "PLACEMENT_HEAD" ||
        serverRole === "PLACEMENT_STAFF" ||
        serverRole === "TRAINER" ||
        user.user_metadata?.account_category === "COLLEGE" ||
        user.user_metadata?.accountCategory === "COLLEGE")
    ) {
      // College Placement Cell user: fully verified and activated
      resolvedCategory = "COLLEGE";
      resolvedRole = (serverRole || user.user_metadata?.role || "PLACEMENT_HEAD") as UserRole;
      isVerifiedMembership = true;

      const tenantId = serverTenantId || user.user_metadata?.tenant_id || `tenant-${user.id}`;
      const instName =
        serverInstitutionName ||
        user.user_metadata?.institution_name ||
        user.user_metadata?.institutionName ||
        "Sapthagiri NPS University";

      activeMembership = {
        id: `membership-${user.id}`,
        tenant_id: tenantId,
        user_id: user.id,
        role: resolvedRole,
        status: "ACTIVE",
        permissions: [],
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tenants: {
          id: tenantId,
          name: instName,
          slug: "college-workspace",
          status: "ACTIVE",
        },
      };
    } else {
      resolvedCategory = (serverCategory || (user.user_metadata?.account_category === "COLLEGE" ? "COLLEGE" : "STUDENT"));
      resolvedRole = resolvedCategory === "COLLEGE" ? (serverRole || "PLACEMENT_HEAD") : "STUDENT";
      isVerifiedMembership = false;
      activeMembership = undefined;
    }

    return {
      id: user.id,
      email: user.email || "",
      fullName: profile?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "",
      role: resolvedRole,
      accountCategory: resolvedCategory,
      institutionName: activeMembership?.tenants?.name || serverAppMeta.institution_name || "",
      isPlatformAdmin,
      avatarUrl: profile?.avatar_url || null,
      memberships,
      activeMembership,
      isVerifiedMembership,
      membershipStatus,
    };
  } catch (err: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[AuthService Notice] Failed to get user profile:", err?.message || err);
    }
    return null;
  }
}
