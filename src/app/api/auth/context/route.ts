import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import {
  RoleDefaultPermissions,
  type UserRole,
} from "@/modules/identity-access/services/policy-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      return NextResponse.json({
        authenticated: false,
        role: null,
        accountCategory: null,
        isVerifiedMembership: false,
      });
    }

    // Strict deny: If membership is explicitly suspended or revoked
    if (profile.membershipStatus === "SUSPENDED" || profile.membershipStatus === "REVOKED") {
      return NextResponse.json({
        authenticated: true,
        userId: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        avatarUrl: profile.avatarUrl,
        role: null,
        accountCategory: profile.accountCategory,
        membershipStatus: profile.membershipStatus,
        isPlatformAdmin: false,
        isVerifiedMembership: false,
        tenant: null,
        availableTenants: [],
        permissions: [],
      });
    }

    const role = profile.role;
    const accountCategory = profile.accountCategory;
    const activeMembership = profile.activeMembership;
    const effectivePermissions = RoleDefaultPermissions[role] || [];

    const availableTenants = (profile.memberships || [])
      .filter((m) => m.status === "ACTIVE" && m.tenants)
      .map((m) => ({
        id: m.tenant_id,
        name: m.tenants?.name || "College Workspace",
        role: m.role,
      }));

    return NextResponse.json({
      authenticated: true,
      userId: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      role,
      accountCategory,
      isPlatformAdmin: profile.isPlatformAdmin,
      isVerifiedMembership: true,
      tenant: activeMembership?.tenants
        ? {
            id: activeMembership.tenants.id,
            name: activeMembership.tenants.name,
          }
        : profile.institutionName
        ? {
            id: `tenant-${profile.id}`,
            name: profile.institutionName,
          }
        : null,
      availableTenants,
      permissions: effectivePermissions,
    });
  } catch (err: any) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Auth Context Notice]:", err?.message || err);
    }
    return NextResponse.json({
      authenticated: false,
      role: null,
      accountCategory: null,
      isVerifiedMembership: false,
    });
  }
}
