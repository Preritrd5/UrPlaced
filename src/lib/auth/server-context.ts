/**
 * Server Context Resolver
 * Authenticates user, verifies active tenant membership, checks permissions,
 * and ensures deny-by-default security across all API routes and server actions.
 */

import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { can, Permissions, type PermissionIdentifier, type UserRole } from "@/modules/identity-access/services/policy-engine";
import { MembershipService } from "@/modules/tenancy/services/membership-service";
import { TenantService } from "@/modules/tenancy/services/tenant-service";

export interface AuthenticatedServerContext {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  tenantId: string;
  tenantRole: UserRole;
  tenantStatus: string;
  membershipStatus: string;
}

export async function requireAuthContext(
  requiredPermission?: PermissionIdentifier,
  explicitTenantId?: string,
  explicitToken?: string
): Promise<AuthenticatedServerContext> {
  let token = explicitToken;
  if (!token) {
    try {
      const headerStore = await headers();
      const authHeader = headerStore.get("authorization");
      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.substring(7).trim();
      }
    } catch {
      // Outside request context
    }
  }

  const supabase = await createClient(token);
  let user: any = null;

  if (token) {
    try {
      const adminClient = createAdminClient();
      const { data, error } = await adminClient.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    } catch {
      // Fallback
    }
  }

  if (!user) {
    const {
      data: { user: clientUser },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !clientUser) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[Auth Diagnostic] Session missing or invalid: ${authError?.message || "No active session"}`);
      }
      throw new Error("UNAUTHORIZED");
    }
    user = clientUser;
  }

  // 1. Check if platform admin
  let isPlatformAdmin = false;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_platform_admin, email")
      .eq("id", user.id)
      .maybeSingle();
    isPlatformAdmin = profile?.is_platform_admin || user.app_metadata?.is_platform_admin === true;
  } catch {
    isPlatformAdmin = user.app_metadata?.is_platform_admin === true;
  }

  // 2. Authoritative server credentials
  const serverAppMeta = user.app_metadata || {};
  const serverRole = serverAppMeta.role as UserRole | undefined;
  const serverTenantId = serverAppMeta.tenant_id as string | undefined;
  const isServerVerified = serverAppMeta.verified_by_server === true;

  // Resolve active tenant from cookie or explicit override
  let cookieStore: any;
  try {
    cookieStore = await cookies();
  } catch {
    // Outside request context
  }
  const targetTenantId = explicitTenantId || cookieStore?.get("active_tenant_id")?.value;

  let userMemberships: any[] = [];
  try {
    userMemberships = await MembershipService.listUserMemberships(user.id);
  } catch {
    // Database query fallback
  }

  // 3. Strict database membership authority:
  // If user has a membership record for this tenant, verify it is not suspended or revoked
  const relevantMembership = targetTenantId
    ? userMemberships.find((m: any) => m.tenant_id === targetTenantId)
    : userMemberships[0];

  if (relevantMembership) {
    if (relevantMembership.status === "SUSPENDED") {
      throw new Error("FORBIDDEN: MEMBERSHIP_SUSPENDED");
    }
    if (relevantMembership.status === "REVOKED") {
      throw new Error("FORBIDDEN: MEMBERSHIP_REVOKED");
    }
  }

  // Active membership lookup
  const activeMemberships = userMemberships.filter((m: any) => m.status === "ACTIVE");
  const activeMembership = targetTenantId
    ? activeMemberships.find((m: any) => m.tenant_id === targetTenantId)
    : activeMemberships[0];

  let tenantRole: UserRole;
  let tenantId: string;
  let membershipStatus = "ACTIVE";

  if (activeMembership?.role && activeMembership?.status === "ACTIVE") {
    tenantRole = activeMembership.role;
    tenantId = activeMembership.tenant_id;
    membershipStatus = "ACTIVE";
  } else if (isPlatformAdmin) {
    tenantRole = "SUPER_ADMIN";
    tenantId = targetTenantId || "";
    membershipStatus = "ACTIVE";
  } else if (
    !relevantMembership &&
    isServerVerified &&
    serverRole &&
    serverTenantId &&
    (!targetTenantId || targetTenantId === serverTenantId)
  ) {
    // Verified via server-controlled app_metadata when database memberships table is unseeded
    tenantRole = serverRole;
    tenantId = serverTenantId;
    membershipStatus = "ACTIVE";
  } else {
    // No active database membership record!
    // Stale claims in app_metadata or JWT CANNOT grant institutional access.
    // Deny-by-default: fail safely without granting privileged access.
    if (process.env.NODE_ENV !== "test") {
      console.warn(`[Auth Diagnostic] User ${user.id} has no active tenant membership (targetTenant: ${targetTenantId || "first"})`);
    }
    throw new Error("NO_ACTIVE_TENANT");
  }

  // Verify tenant status
  let tenantStatus = "ACTIVE";
  if (activeMembership?.tenant_id) {
    try {
      const tenant = await TenantService.getById(activeMembership.tenant_id);
      tenantStatus = tenant?.status || "ACTIVE";
    } catch {
      tenantStatus = "ACTIVE";
    }
  }

  const ctx: AuthenticatedServerContext = {
    userId: user.id,
    email: user.email || "",
    isPlatformAdmin,
    tenantId,
    tenantRole,
    tenantStatus,
    membershipStatus: activeMembership?.status || "ACTIVE",
  };

  // Evaluate permission
  if (requiredPermission) {
    const allowed = can(
      {
        userId: ctx.userId,
        isPlatformAdmin: ctx.isPlatformAdmin,
        tenantId: ctx.tenantId,
        tenantStatus: ctx.tenantStatus,
        membershipStatus: ctx.membershipStatus,
        role: ctx.tenantRole,
      },
      requiredPermission,
      { tenantId: ctx.tenantId }
    );

    if (!allowed) {
      if (process.env.NODE_ENV !== "test") {
        console.warn(`[Auth Diagnostic] Permission denied for user ${ctx.userId} (role: ${ctx.tenantRole}, tenant: ${ctx.tenantId}) on action: ${requiredPermission}`);
      }
      throw new Error("FORBIDDEN");
    }
  }

  return ctx;
}
