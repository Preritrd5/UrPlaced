import { NextResponse } from "next/server";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  RoleDefaultPermissions,
  type UserRole,
} from "@/modules/identity-access/services/policy-engine";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    let token: string | undefined;
    const authHeader = request.headers.get("authorization");
    if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
      token = authHeader.substring(7).trim();
    }
    const profile = await getCurrentUserProfile(undefined, token);

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

    let subscriptionStatus: string | null = null;
    let isGracePeriod = false;
    let gracePeriodEndsAt: string | null = null;
    let canAccessOperational = true;
    let accessDecision: string | null = null;
    let planId: string | null = null;
    let planName: string | null = null;
    let entitlements: Record<string, boolean> | null = null;
    let limits: Record<string, number | null> | null = null;

    if (activeMembership?.tenants?.id) {
      try {
        const access = await SubscriptionAccessService.evaluateAccess({
          tenantId: activeMembership.tenants.id,
          userRole: role,
          userId: profile.id,
          admin: createAdminClient(),
          skipDenialLogging: true,
        });
        subscriptionStatus = access.subscriptionStatus || null;
        isGracePeriod = access.isGracePeriod;
        gracePeriodEndsAt = access.gracePeriodEndsAt || null;
        canAccessOperational = access.canAccessOperational;
        accessDecision = access.decision;
        planId = access.planId || null;
        planName = access.planName || null;
        entitlements = access.entitlements || null;
        limits = access.limits || null;
      } catch {
        // Fallback
      }
    }

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
      phone: profile.phone || null,
      location: profile.location || null,
      bio: profile.bio || null,
      preferences: profile.preferences || null,
      role,
      accountCategory,
      isPlatformAdmin: profile.isPlatformAdmin,
      isVerifiedMembership: true,
      tenant: activeMembership?.tenants
        ? {
            id: activeMembership.tenants.id,
            name: activeMembership.tenants.name,
            subscriptionStatus,
            isGracePeriod,
            gracePeriodEndsAt,
            canAccessOperational,
            accessDecision,
            planId,
            planName,
            entitlements,
            limits,
          }
        : profile.institutionName
        ? {
            id: `tenant-${profile.id}`,
            name: profile.institutionName,
            subscriptionStatus: null,
            isGracePeriod: false,
            gracePeriodEndsAt: null,
            canAccessOperational: true,
            accessDecision: null,
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
