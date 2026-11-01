/**
 * Subscription Access Decision Service (UrPlaced SA-06)
 * Single, authoritative server-side engine for payment-gated access control,
 * subscription lifecycle gating, 7-day grace period enforcement (Q1),
 * initial payment restriction (Q2), and feature entitlement verification.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { type PermissionIdentifier } from "@/modules/identity-access/services/policy-engine";
import {
  type PlanEntitlementsMap,
  type PlanLimitsMap,
  type EntitlementsSnapshot,
  CONTROLLED_FEATURE_CATALOGUE,
} from "@/modules/platform-admin/types/subscription-plans";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";

export type AccessDecision =
  | "ALLOW"
  | "ALLOW_GRACE_PERIOD"
  | "DENY_PENDING_PAYMENT"
  | "DENY_EXPIRED"
  | "DENY_SUSPENDED"
  | "DENY_CANCELLED"
  | "DENY_ENTITLEMENT"
  | "DENY_INVALID_SUBSCRIPTION"
  | "DENY_UNAUTHORIZED_ROLE";

export interface SubscriptionAccessResult {
  decision: AccessDecision;
  allowed: boolean;
  tenantId: string;
  subscriptionId?: string;
  subscriptionStatus?: string;
  planId?: string;
  planName?: string;
  planVersion?: number;
  featureKey?: string;
  reasonCode: string;
  message: string;
  isGracePeriod: boolean;
  gracePeriodEndsAt?: string | null;
  canAccessBilling: boolean;
  canAccessOperational: boolean;
  effectiveExpiryDate?: string | null;
  isOverridden?: boolean;
  overrideUntil?: string | null;
  overrideReason?: string | null;
  entitlements?: PlanEntitlementsMap;
  limits?: PlanLimitsMap;
}

export interface EvaluateAccessParams {
  tenantId: string;
  userRole?: string;
  userId?: string;
  permission?: PermissionIdentifier | string;
  featureKey?: string;
  admin?: ReturnType<typeof createAdminClient>;
  skipDenialLogging?: boolean;
}

export class SubscriptionAccessService {
  // Throttled in-memory cache to prevent database flood on repetitive denial logging
  private static denialLogThrottle = new Map<string, number>();

  /**
   * Identifies whether a requested permission or route is an administrative self-service
   * exemption (such as profile, billing, account security, or authentication) which remains
   * accessible even under subscription payment restrictions (Q2).
   */
  static isExemptSelfServicePermission(permission?: PermissionIdentifier | string): boolean {
    if (!permission) return false;
    const perm = String(permission).toLowerCase();
    return (
      perm.includes("profile") ||
      perm.includes("billing") ||
      perm.includes("subscription") ||
      perm.includes("auth") ||
      perm.includes("signout")
    );
  }

  /**
   * Evaluates the complete, authoritative access decision for a tenant, user, and feature.
   */
  static async evaluateAccess(params: EvaluateAccessParams): Promise<SubscriptionAccessResult> {
    const {
      tenantId,
      userRole = "PLACEMENT_HEAD",
      userId,
      permission,
      featureKey,
      admin = createAdminClient(),
      skipDenialLogging = false,
    } = params;

    const isStudent = userRole === "STUDENT";
    const isExempt = this.isExemptSelfServicePermission(permission);

    // Default deny response structure
    const makeDenial = (
      decision: AccessDecision,
      reasonCode: string,
      message: string,
      extra: Partial<SubscriptionAccessResult> = {}
    ): SubscriptionAccessResult => {
      const res: SubscriptionAccessResult = {
        decision,
        allowed: false,
        tenantId,
        reasonCode,
        message,
        isGracePeriod: false,
        canAccessBilling: !isStudent && (decision === "DENY_PENDING_PAYMENT" || decision === "DENY_EXPIRED" || decision === "DENY_CANCELLED" || decision === "DENY_SUSPENDED"),
        canAccessOperational: false,
        ...extra,
      };

      // Record diagnostic denial log if not throttled
      if (!skipDenialLogging) {
        this.recordAccessDenial(res, userRole, userId, featureKey, admin).catch(() => {});
      }

      return res;
    };

    if (!tenantId) {
      return makeDenial(
        "DENY_INVALID_SUBSCRIPTION",
        "MISSING_TENANT_ID",
        "Tenant identifier is missing or unverified."
      );
    }

    // 1. Fetch authoritative subscription record directly from database
    const { data: sub, error } = await admin
      .from("college_subscriptions")
      .select(`
        id,
        tenant_id,
        status,
        plan_id,
        plan_version,
        start_date,
        expiry_date,
        renewal_date,
        cancel_at_period_end,
        canceled_at,
        cancellation_reason,
        grace_period_ends_at,
        renewal_retry_count,
        temporary_override_until,
        override_reason,
        override_by,
        student_seat_limit,
        staff_seat_limit,
        entitlements_snapshot,
        subscription_plans (
          id,
          name,
          version
        )
      `)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (error || !sub) {
      // If exempt route, permit access even without subscription record
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          reasonCode: "EXEMPT_SELF_SERVICE",
          message: "Exempt account or billing self-service action permitted.",
          isGracePeriod: false,
          canAccessBilling: !isStudent,
          canAccessOperational: false,
        };
      }
      return makeDenial(
        "DENY_INVALID_SUBSCRIPTION",
        "NO_SUBSCRIPTION_RECORD",
        isStudent
          ? "Institutional placement services for your college are not currently activated."
          : "No subscription record found for this college tenant."
      );
    }

    const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
    const planName = plan?.name || sub.plan_id;
    const now = new Date();
    const nowTime = now.getTime();

    // 2. Check Super Admin Temporary Override
    if (sub.temporary_override_until) {
      const overrideDate = new Date(sub.temporary_override_until);
      if (nowTime <= overrideDate.getTime()) {
        const resolvedEntitlements = this.extractSnapshotEntitlements(sub);
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: sub.status,
          planId: sub.plan_id,
          planName,
          planVersion: sub.plan_version,
          reasonCode: "SUPER_ADMIN_OVERRIDE_ACTIVE",
          message: `Super Admin temporary access override active until ${overrideDate.toISOString()}.`,
          isGracePeriod: false,
          isOverridden: true,
          overrideUntil: sub.temporary_override_until,
          overrideReason: sub.override_reason,
          canAccessBilling: !isStudent,
          canAccessOperational: true,
          effectiveExpiryDate: sub.temporary_override_until,
          entitlements: resolvedEntitlements.features,
          limits: resolvedEntitlements.limits,
        };
      }
    }

    // 3. Evaluate Status Machine & Business Policies
    const rawStatus = (sub.status || "").toUpperCase();

    // --- CASE A: Initial PENDING_PAYMENT (Q2) ---
    if (rawStatus === "PENDING_PAYMENT") {
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          planId: sub.plan_id,
          planName,
          reasonCode: "EXEMPT_PENDING_PAYMENT",
          message: "Permitted billing or account self-service under initial pending payment.",
          isGracePeriod: false,
          canAccessBilling: !isStudent,
          canAccessOperational: false,
        };
      }

      return makeDenial(
        "DENY_PENDING_PAYMENT",
        "INITIAL_SUBSCRIPTION_UNPAID",
        isStudent
          ? "Institutional placement service activation is pending for your college."
          : "College placement operations are locked until initial subscription payment is verified (PENDING_PAYMENT).",
        {
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          planId: sub.plan_id,
          planName,
          canAccessBilling: !isStudent,
        }
      );
    }

    // --- CASE B: Renewal PAST_DUE & 7-Day Grace Period (Q1) ---
    if (rawStatus === "PAST_DUE") {
      const renewalDate = sub.renewal_date ? new Date(sub.renewal_date) : new Date(sub.expiry_date || now);
      // 7 days from renewal due date
      const gracePeriodEnds = sub.grace_period_ends_at
        ? new Date(sub.grace_period_ends_at)
        : new Date(renewalDate.getTime() + 7 * 24 * 60 * 60 * 1000);

      const isWithinGrace = nowTime <= gracePeriodEnds.getTime();

      if (isWithinGrace) {
        // Full subscribed access retained during 7-day grace period (Q1)
        const resolvedEntitlements = this.extractSnapshotEntitlements(sub);

        // If specific feature requested, check snapshot
        if (featureKey && !resolvedEntitlements.features[featureKey]) {
          return makeDenial(
            "DENY_ENTITLEMENT",
            "FEATURE_NOT_IN_PLAN",
            `Feature '${featureKey}' is not included in the college's assigned subscription plan (${planName}).`,
            {
              subscriptionId: sub.id,
              subscriptionStatus: rawStatus,
              planId: sub.plan_id,
              planName,
              featureKey,
              isGracePeriod: true,
              gracePeriodEndsAt: gracePeriodEnds.toISOString(),
            }
          );
        }

        return {
          decision: "ALLOW_GRACE_PERIOD",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          planId: sub.plan_id,
          planName,
          planVersion: sub.plan_version,
          featureKey,
          reasonCode: "RENEWAL_GRACE_PERIOD_ACTIVE",
          message: `Subscription renewal is past due. Full operational access is protected under 7-day grace period until ${gracePeriodEnds.toISOString()}.`,
          isGracePeriod: true,
          gracePeriodEndsAt: gracePeriodEnds.toISOString(),
          canAccessBilling: !isStudent,
          canAccessOperational: true,
          effectiveExpiryDate: gracePeriodEnds.toISOString(),
          entitlements: resolvedEntitlements.features,
          limits: resolvedEntitlements.limits,
        };
      }

      // Grace period expired without payment
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          reasonCode: "EXEMPT_EXPIRED_GRACE",
          message: "Billing and account recovery permitted after grace period expiration.",
          isGracePeriod: false,
          canAccessBilling: !isStudent,
          canAccessOperational: false,
        };
      }

      return makeDenial(
        "DENY_EXPIRED",
        "GRACE_PERIOD_EXPIRED",
        isStudent
          ? "Institutional placement services are temporarily suspended. Please contact your College Placement Office."
          : "Your 7-day renewal grace period has expired. Operational access is suspended until payment is completed.",
        {
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          planId: sub.plan_id,
          planName,
          isGracePeriod: false,
          gracePeriodEndsAt: gracePeriodEnds.toISOString(),
          canAccessBilling: !isStudent,
        }
      );
    }

    // --- CASE C: EXPIRED or SUSPENDED ---
    if (rawStatus === "EXPIRED" || rawStatus === "SUSPENDED") {
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          reasonCode: `EXEMPT_${rawStatus}`,
          message: `Billing and account recovery permitted for ${rawStatus} subscription.`,
          isGracePeriod: false,
          canAccessBilling: !isStudent,
          canAccessOperational: false,
        };
      }

      return makeDenial(
        rawStatus === "EXPIRED" ? "DENY_EXPIRED" : "DENY_SUSPENDED",
        `SUBSCRIPTION_${rawStatus}`,
        isStudent
          ? "Institutional placement services are temporarily suspended. Please contact your College Placement Office."
          : `College subscription is ${rawStatus}. Operational placement access is restricted until reactivated.`,
        {
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          planId: sub.plan_id,
          planName,
          canAccessBilling: !isStudent,
        }
      );
    }

    // --- CASE D: CANCELED / CANCELLED ---
    if (rawStatus === "CANCELED" || rawStatus === "CANCELLED") {
      // Period-end cancellation check
      if (sub.cancel_at_period_end && sub.expiry_date) {
        const periodEndDate = new Date(sub.expiry_date);
        if (nowTime <= periodEndDate.getTime()) {
          // Retain paid operational access until effective end date
          const resolvedEntitlements = this.extractSnapshotEntitlements(sub);
          if (featureKey && !resolvedEntitlements.features[featureKey]) {
            return makeDenial(
              "DENY_ENTITLEMENT",
              "FEATURE_NOT_IN_PLAN",
              `Feature '${featureKey}' is not included in the college's assigned subscription plan (${planName}).`,
              { subscriptionId: sub.id, subscriptionStatus: rawStatus, planId: sub.plan_id, planName, featureKey }
            );
          }

          return {
            decision: "ALLOW",
            allowed: true,
            tenantId,
            subscriptionId: sub.id,
            subscriptionStatus: rawStatus,
            planId: sub.plan_id,
            planName,
            planVersion: sub.plan_version,
            featureKey,
            reasonCode: "CANCEL_AT_PERIOD_END_ACTIVE",
            message: `Subscription scheduled for cancellation at period end (${periodEndDate.toISOString()}). Full operational access active until end date.`,
            isGracePeriod: false,
            canAccessBilling: !isStudent,
            canAccessOperational: true,
            effectiveExpiryDate: sub.expiry_date,
            entitlements: resolvedEntitlements.features,
            limits: resolvedEntitlements.limits,
          };
        }
      }

      // Past period end or immediately canceled
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          reasonCode: "EXEMPT_CANCELED",
          message: "Billing and account history accessible for canceled subscription.",
          isGracePeriod: false,
          canAccessBilling: !isStudent,
          canAccessOperational: false,
        };
      }

      return makeDenial(
        "DENY_CANCELLED",
        "SUBSCRIPTION_CANCELED",
        isStudent
          ? "Institutional placement services are not active. Please contact your College Placement Office."
          : `College subscription has been canceled (CANCELED - ${sub.cancellation_reason || "Effective immediately"}). Operational access terminated.`,
        {
          subscriptionId: sub.id,
          subscriptionStatus: rawStatus,
          planId: sub.plan_id,
          planName,
          canAccessBilling: !isStudent,
        }
      );
    }

    // --- CASE E: ACTIVE or TRIALING ---
    if (rawStatus === "ACTIVE" || rawStatus === "TRIALING" || rawStatus === "TRIAL") {
      // 1. Strict Snapshot Immutability Verification
      const { features, limits, isValid, errorMsg } = this.extractSnapshotEntitlements(sub);

      if (!isValid) {
        return makeDenial(
          "DENY_INVALID_SUBSCRIPTION",
          "CORRUPT_OR_MISSING_SNAPSHOT",
          "Institutional subscription snapshot is missing or corrupt (snapshot is missing or invalid). Unsafe fallback to live plan definition rejected.",
          {
            subscriptionId: sub.id,
            subscriptionStatus: rawStatus,
            planId: sub.plan_id,
            planName,
            canAccessBilling: !isStudent,
          }
        );
      }

      // 2. Feature Key Entitlement Check
      if (featureKey) {
        const isEntitled = Boolean(features[featureKey]);
        if (!isEntitled) {
          return makeDenial(
            "DENY_ENTITLEMENT",
            "FEATURE_NOT_IN_PLAN",
            `Feature '${featureKey}' is not included in the college's assigned subscription plan (${planName}).`,
            {
              subscriptionId: sub.id,
              subscriptionStatus: rawStatus,
              planId: sub.plan_id,
              planName,
              featureKey,
              canAccessBilling: !isStudent,
              entitlements: features,
              limits,
            }
          );
        }
      }

      return {
        decision: "ALLOW",
        allowed: true,
        tenantId,
        subscriptionId: sub.id,
        subscriptionStatus: rawStatus,
        planId: sub.plan_id,
        planName,
        planVersion: sub.plan_version,
        featureKey,
        reasonCode: "SUBSCRIPTION_ACTIVE",
        message: "Subscription is active and authorized for operational features.",
        isGracePeriod: false,
        canAccessBilling: !isStudent,
        canAccessOperational: true,
        effectiveExpiryDate: sub.expiry_date,
        entitlements: features,
        limits,
      };
    }

    // Unknown / Unhandled Status -> Fail closed
    return makeDenial(
      "DENY_INVALID_SUBSCRIPTION",
      `UNKNOWN_STATUS_${rawStatus}`,
      `Subscription status '${rawStatus}' is unrecognized. Operational access denied.`,
      {
        subscriptionId: sub.id,
        subscriptionStatus: rawStatus,
        canAccessBilling: !isStudent,
      }
    );
  }

  /**
   * Helper to safely extract and validate frozen entitlement snapshot.
   */
  private static extractSnapshotEntitlements(sub: any): {
    features: PlanEntitlementsMap;
    limits: PlanLimitsMap;
    isValid: boolean;
    errorMsg?: string;
  } {
    const snapshot: EntitlementsSnapshot | null = sub.entitlements_snapshot;

    if (
      snapshot &&
      typeof snapshot === "object" &&
      snapshot.entitlements &&
      typeof snapshot.entitlements === "object" &&
      snapshot.limits &&
      typeof snapshot.limits === "object"
    ) {
      const features = PlatformSubscriptionService.buildDefaultEntitlements({
        ...snapshot.entitlements,
        ...(snapshot.customOverrides?.entitlements || {}),
      });

      const limits = PlatformSubscriptionService.buildDefaultLimits({
        ...snapshot.limits,
        ...(snapshot.customOverrides?.limits || {}),
      });

      if (sub.student_seat_limit) {
        limits.max_students = Number(sub.student_seat_limit);
      }
      if (sub.staff_seat_limit) {
        limits.max_staff = Number(sub.staff_seat_limit);
      }

      return { features, limits, isValid: true };
    }

    return {
      features: PlatformSubscriptionService.buildDefaultEntitlements({}),
      limits: {
        max_students: 0,
        max_staff: 0,
        max_drives: 0,
        max_storage_gb: 0,
        max_assessments: 0,
        ai_tokens_monthly: 0,
      },
      isValid: false,
      errorMsg: "Snapshot missing or corrupt",
    };
  }

  /**
   * Records a security-relevant access denial into public.subscription_access_denials.
   * Throttled to 1 entry per tenant/decision/feature every 60 seconds to prevent DB saturation.
   */
  private static async recordAccessDenial(
    result: SubscriptionAccessResult,
    userRole: string,
    userId?: string,
    featureKey?: string,
    admin = createAdminClient()
  ): Promise<void> {
    const throttleKey = `${result.tenantId}:${result.decision}:${featureKey || "route"}`;
    const now = Date.now();
    const lastLogged = this.denialLogThrottle.get(throttleKey) || 0;

    if (now - lastLogged < 60000) {
      return; // Throttled
    }

    this.denialLogThrottle.set(throttleKey, now);

    try {
      await admin.from("subscription_access_denials").insert({
        tenant_id: result.tenantId,
        subscription_id: result.subscriptionId || null,
        user_id: userId || null,
        user_role: userRole,
        feature_key: featureKey || null,
        route_category: "OPERATIONAL",
        decision: result.decision,
        reason_code: result.reasonCode,
        message: result.message,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Fire-and-forget: do not let logging failures crash the request pipeline
    }
  }

  /**
   * Authoritative server assertion: throws a structured HTTP 403-compatible Error
   * if access is denied. Used directly in requireAuthContext, route handlers, and server actions.
   */
  static async assertOperationalAccess(params: EvaluateAccessParams): Promise<SubscriptionAccessResult> {
    const result = await this.evaluateAccess(params);
    if (!result.allowed) {
      let errKey = `SUBSCRIPTION_${result.decision.replace("DENY_", "")}`;
      if (result.decision === "DENY_INVALID_SUBSCRIPTION") {
        errKey = result.reasonCode === "NO_SUBSCRIPTION_RECORD" ? "NO_SUBSCRIPTION" : "CORRUPT_OR_MISSING_SNAPSHOT";
      } else if (result.decision === "DENY_CANCELLED") {
        errKey = "SUBSCRIPTION_CANCELED";
      } else if (result.decision === "DENY_ENTITLEMENT") {
        errKey = "FEATURE_NOT_IN_PLAN";
      }
      const err = new Error(`FORBIDDEN: ${errKey}: ${result.message}`);
      (err as any).decision = result.decision;
      (err as any).reasonCode = result.reasonCode;
      (err as any).tenantId = result.tenantId;
      throw err;
    }
    return result;
  }
}
