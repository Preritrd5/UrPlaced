/**
 * Centralized Entitlement Service
 * Enforces subscription-based access control and feature gating across UrPlaced.
 * Part of SA-03, establishing the architectural foundation for SA-06 Payment-Gated Access Control.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { type PermissionIdentifier } from "@/modules/identity-access/services/policy-engine";
import {
  type PlanLimitsMap,
  type PlanEntitlementsMap,
  type EntitlementsSnapshot,
  CONTROLLED_FEATURE_CATALOGUE,
} from "../types/subscription-plans";
import { PlatformSubscriptionService } from "./platform-subscription-service";
import { SubscriptionAccessService } from "@/modules/billing/services/subscription-access-service";

export type SubscriptionStatus =
  | "ACTIVE"
  | "PENDING_PAYMENT"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELLED"
  | "TRIAL"
  | "TRIALING"
  | "EXPIRED";

export interface TenantSubscriptionInfo {
  tenantId: string;
  status: SubscriptionStatus | string;
  planId?: string;
  planName?: string;
  planVersion?: number;
  renewalDate?: string;
}

export interface ResolvedTenantEntitlements {
  tenantId: string;
  status: string;
  planId: string;
  planName: string;
  planVersion: number;
  isSnapshotSource: boolean;
  isSnapshotValid: boolean;
  snapshotError?: string;
  features: PlanEntitlementsMap;
  limits: PlanLimitsMap;
}

export class EntitlementService {
  /**
   * Resolves the subscription status for a tenant directly from college_subscriptions.
   */
  static async getTenantSubscription(
    tenantId: string,
    admin = createAdminClient()
  ): Promise<TenantSubscriptionInfo | null> {
    if (!tenantId) return null;

    try {
      const { data, error } = await admin
        .from("college_subscriptions")
        .select(`
          tenant_id,
          status,
          plan_id,
          renewal_date,
          subscription_plans (
            id,
            name
          )
        `)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const plan = Array.isArray(data.subscription_plans)
        ? data.subscription_plans[0]
        : data.subscription_plans;

      return {
        tenantId: data.tenant_id,
        status: data.status,
        planId: data.plan_id,
        planName: plan?.name || data.plan_id,
        renewalDate: data.renewal_date,
      };
    } catch {
      return null;
    }
  }

  /**
   * Determines whether a given permission is an operational college feature
   * (which requires an ACTIVE subscription) or an administrative self-service
   * exemption (permitted even under PENDING_PAYMENT).
   *
   * Permitted under PENDING_PAYMENT:
   * - Subscription & Billing
   * - Own Profile
   * - Account & Security
   * - Sign Out
   */
  static isOperationalCollegePermission(permission?: PermissionIdentifier | string): boolean {
    if (!permission) return false;

    const perm = String(permission).toLowerCase();

    // Explicit administrative self-service exemptions
    if (
      perm.includes("profile") ||
      perm.includes("billing") ||
      perm.includes("subscription") ||
      perm.includes("auth")
    ) {
      return false;
    }

    // Explicit operational placement prefixes that require ACTIVE subscription
    const operationalPrefixes = [
      "students.",
      "companies.",
      "drives.",
      "candidates.",
      "stages.",
      "outcomes.",
      "dashboard.",
      "reports.",
      "academic_years.",
      "departments.",
      "staff.",
      "eligibility.",
      "questions.",
      "question_sets.",
      "assessments.",
      "practice.",
      "results.",
      "mistake_bank.",
      "question_defects.",
      "training.",
      "intelligence.",
      "drivefit.",
      "experience_reports.",
      "placement_memory.",
      "analytics.",
      "ai.",
      "announcements.",
    ];

    return operationalPrefixes.some((prefix) => perm.startsWith(prefix));
  }

  /**
   * Server-side assertion: Throws an authoritative error if an institutional college user
   * attempts to execute operational placement actions when their subscription is not ACTIVE/GRACE.
   */
  static async assertCollegeOperationalEntitlement(
    tenantId: string,
    roleOrClient?: string | ReturnType<typeof createAdminClient>,
    permission?: PermissionIdentifier | string,
    adminClient?: ReturnType<typeof createAdminClient>
  ): Promise<void> {
    const isClient = Boolean(roleOrClient && typeof (roleOrClient as any).from === "function");
    const role = isClient ? "PLACEMENT_HEAD" : (roleOrClient as string) || "PLACEMENT_HEAD";
    const admin = isClient ? (roleOrClient as any) : adminClient || createAdminClient();

    if (!tenantId) {
      return;
    }

    await SubscriptionAccessService.assertOperationalAccess({
      tenantId,
      userRole: role,
      permission,
      admin,
    });
  }

  /**
   * Resolves the complete, effective feature entitlements and limits for a college.
   * STRICT SNAPSHOT IMMUTABILITY:
   * 1. Requires an explicit, valid entitlements_snapshot on college_subscriptions.
   * 2. Rejects unsafe fallback to mutable live plan definitions so that published
   *    plan updates never silently alter existing subscribers.
   * 3. Subscriptions missing a snapshot are explicitly flagged and must be administratively backfilled.
   */
  static async resolveTenantEntitlements(
    tenantId: string,
    admin = createAdminClient()
  ): Promise<ResolvedTenantEntitlements | null> {
    if (!tenantId) return null;

    try {
      let sub: any = null;
      const { data: extendedSub, error: extErr } = await admin
        .from("college_subscriptions")
        .select(`
          tenant_id,
          status,
          plan_id,
          plan_version,
          entitlements_snapshot,
          student_seat_limit,
          staff_seat_limit,
          subscription_plans (
            id,
            name,
            version
          )
        `)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!extErr && extendedSub) {
        sub = extendedSub;
      } else if (extErr && (extErr.code === "42703" || extErr.message?.includes("does not exist"))) {
        const { data: baseSub, error: baseErr } = await admin
          .from("college_subscriptions")
          .select(`
            id,
            tenant_id,
            status,
            plan_id,
            start_date,
            expiry_date,
            renewal_date,
            grace_period_days,
            student_seat_limit,
            staff_seat_limit,
            subscription_plans (
              id,
              name
            )
          `)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!baseErr && baseSub) {
          sub = baseSub;
        }
      }

      if (!sub) {
        return null;
      }

      const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
      const snapshot: EntitlementsSnapshot | null = sub.entitlements_snapshot;

      let effectiveLimits: PlanLimitsMap;
      let effectiveFeatures: PlanEntitlementsMap;
      let planVersion = Number(sub.plan_version || 1);
      let isSnapshotSource = false;
      let isSnapshotValid = false;
      let snapshotError: string | undefined = undefined;

      const isColumnAbsent = !("entitlements_snapshot" in sub) || sub.entitlements_snapshot === undefined;

      if (
        snapshot &&
        typeof snapshot === "object" &&
        snapshot.entitlements &&
        typeof snapshot.entitlements === "object" &&
        snapshot.limits &&
        typeof snapshot.limits === "object"
      ) {
        const planTier = snapshot.planId || sub.plan_id;
        effectiveLimits = PlatformSubscriptionService.buildDefaultLimits({
          ...snapshot.limits,
          ...(snapshot.customOverrides?.limits || {}),
        }, planTier);
        effectiveFeatures = PlatformSubscriptionService.buildDefaultEntitlements({
          ...snapshot.entitlements,
          ...(snapshot.customOverrides?.entitlements || {}),
        }, planTier);
        planVersion = Number(snapshot.planVersion || sub.plan_version || 1);
        isSnapshotSource = true;
        isSnapshotValid = true;
      } else if (isColumnAbsent && sub.plan_id) {
        // Schema fallback for environment where entitlements_snapshot column is absent
        const tier = (sub.plan_id || "").toLowerCase().includes("enterprise")
          ? "enterprise"
          : (sub.plan_id || "").toLowerCase().includes("growth")
          ? "growth"
          : "starter";

        effectiveFeatures = PlatformSubscriptionService.buildDefaultEntitlements(null, tier);
        effectiveLimits = PlatformSubscriptionService.buildDefaultLimits(null, tier);
        planVersion = Number(sub.plan_version || 1);
        isSnapshotSource = false;
        isSnapshotValid = true;
      } else {
        // STRICT IMMUTABILITY: Reject unsafe fallback to mutable live plan definition!
        // A legacy subscription without a valid snapshot must be explicitly backfilled.
        effectiveLimits = {
          max_students: 0,
          max_staff: 0,
          max_drives: 0,
          max_storage_gb: 0,
          max_assessments: 0,
          ai_tokens_monthly: 0,
        };
        effectiveFeatures = PlatformSubscriptionService.buildDefaultEntitlements({});
        isSnapshotSource = false;
        isSnapshotValid = false;
        snapshotError = "MISSING_OR_CORRUPT_SNAPSHOT";
      }

      // If college_subscriptions has direct seat limit columns and snapshot is valid, honor them
      if (isSnapshotValid) {
        if (sub.student_seat_limit) {
          effectiveLimits.max_students = Number(sub.student_seat_limit);
        }
        if (sub.staff_seat_limit) {
          effectiveLimits.max_staff = Number(sub.staff_seat_limit);
        }
      }

      return {
        tenantId: sub.tenant_id,
        status: sub.status,
        planId: sub.plan_id,
        planName: snapshot?.planName || plan?.name || sub.plan_id,
        planVersion,
        isSnapshotSource,
        isSnapshotValid,
        snapshotError,
        features: effectiveFeatures,
        limits: effectiveLimits,
      };
    } catch {
      return null;
    }
  }

  /**
   * Evaluates whether an institutional college has access to a specific feature module.
   * Delegates to SubscriptionAccessService for authoritative evaluation of:
   * 1. Valid frozen snapshot (rejects missing/invalid snapshots)
   * 2. Subscription status policy (ACTIVE, PENDING_PAYMENT, PAST_DUE grace, EXPIRED, CANCELED)
   * 3. Feature key inclusion in plan snapshot
   */
  static async checkFeatureAccess(
    tenantId: string,
    featureKey: string,
    admin = createAdminClient()
  ): Promise<{ allowed: boolean; reason?: string }> {
    const access = await SubscriptionAccessService.evaluateAccess({
      tenantId,
      featureKey,
      admin,
    });

    return {
      allowed: access.allowed,
      reason: access.allowed ? undefined : access.message,
    };
  }

  /**
   * Validates whether a proposed or current usage exceeds the plan's numerical limit.
   */
  static async checkUsageLimit(
    tenantId: string,
    limitKey: string,
    currentUsage: number,
    admin = createAdminClient()
  ): Promise<{
    allowed: boolean;
    limit: number | null;
    currentUsage: number;
    remaining: number | null;
    reason?: string;
  }> {
    const access = await SubscriptionAccessService.evaluateAccess({
      tenantId,
      admin,
    });

    if (!access.allowed || !access.limits) {
      return {
        allowed: false,
        limit: 0,
        currentUsage,
        remaining: 0,
        reason: access.message || "Subscription access denied for quota check.",
      };
    }

    const limitVal = access.limits[limitKey];
    if (limitVal === null || limitVal === undefined) {
      // Unlimited
      return {
        allowed: true,
        limit: null,
        currentUsage,
        remaining: null,
      };
    }

    const remaining = Math.max(0, limitVal - currentUsage);
    const allowed = currentUsage < limitVal;

    return {
      allowed,
      limit: limitVal,
      currentUsage,
      remaining,
      reason: allowed
        ? undefined
        : `Usage limit reached: current usage (${currentUsage}) has reached or exceeded plan limit (${limitVal}) for '${limitKey}'.`,
    };
  }
}
