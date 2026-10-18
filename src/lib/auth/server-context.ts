/**
 * Server Context Resolver
 * Authenticates user, verifies active tenant membership, checks permissions,
 * and ensures deny-by-default security across all API routes and server actions.
 */

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
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
  explicitTenantId?: string
): Promise<AuthenticatedServerContext> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("UNAUTHORIZED");
  }

  // Check if platform admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_platform_admin, email")
    .eq("id", user.id)
    .maybeSingle();

  const isPlatformAdmin = profile?.is_platform_admin || false;

  // Resolve active tenant
  const cookieStore = await cookies();
  const tenantCookie = explicitTenantId || cookieStore.get("active_tenant_id")?.value;

  const memberships = await MembershipService.listUserMemberships(user.id);
  const activeMemberships = memberships.filter((m: any) => m.status === "ACTIVE");

  let activeMembership = activeMemberships.find((m: any) => m.tenant_id === tenantCookie);
  if (!activeMembership && activeMemberships.length > 0) {
    activeMembership = activeMemberships[0];
  }

  if (!activeMembership && !isPlatformAdmin) {
    throw new Error("NO_ACTIVE_TENANT");
  }

  const tenantId = activeMembership?.tenant_id || tenantCookie || "";
  const tenantRole = (activeMembership?.role as UserRole) || (isPlatformAdmin ? "SUPER_ADMIN" : "STUDENT");

  // Verify tenant status
  let tenantStatus = "ACTIVE";
  if (tenantId) {
    const tenant = await TenantService.getById(tenantId);
    tenantStatus = tenant?.status || "SUSPENDED";
  }

  const ctx: AuthenticatedServerContext = {
    userId: user.id,
    email: user.email || profile?.email || "",
    isPlatformAdmin,
    tenantId,
    tenantRole,
    tenantStatus,
    membershipStatus: activeMembership?.status || (isPlatformAdmin ? "ACTIVE" : "SUSPENDED"),
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
      throw new Error("FORBIDDEN");
    }
  }

  return ctx;
}
