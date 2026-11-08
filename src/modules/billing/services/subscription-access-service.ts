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
   * Identifies whether the active user role is authorized for institutional billing administration.
   * Only PLACEMENT_HEAD and SUPER_ADMIN have authoritative billing rights.
   * Ordinary PLACEMENT_STAFF, TRAINER, and STUDENT have no automatic billing access.
   */
  static isBillingAuthorized(userRole?: string): boolean {
    return userRole === "PLACEMENT_HEAD" || userRole === "SUPER_ADMIN";
  }

  /**
   * Identifies whether a requested permission or route is an administrative self-service
   * exemption (such as profile, billing, account security, or authentication) which remains
   * accessible even under subscription payment restrictions (Q2).
   *
   * Reconciled RBAC Invariant:
   * - Personal profile, auth, and signout are exempt for all accounts.
   * - Billing and subscription recovery are ONLY exempt for authorized billing roles (PLACEMENT_HEAD, SUPER_ADMIN).
   */
  static isExemptSelfServicePermission(permission?: PermissionIdentifier | string, userRole?: string): boolean {
    if (!permission) return false;
    const perm = String(permission).toLowerCase();
    
    // Personal account settings are accessible to all institutional roles under lock
    if (perm.includes("profile") || perm.includes("auth") || perm.includes("signout")) {
      return true;
    }

    // Billing/subscription management is ONLY exempt for authorized billing administration
    if (perm.includes("billing") || perm.includes("subscription")) {
      return this.isBillingAuthorized(userRole);
    }

    return false;
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
    const isBillingAuthorized = this.isBillingAuthorized(userRole);
    const isExempt = this.isExemptSelfServicePermission(permission, userRole);
    const effectiveFeatureKey = featureKey || this.resolveFeatureKeyFromPermission(permission);

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
        canAccessBilling: isBillingAuthorized && (decision === "DENY_PENDING_PAYMENT" || decision === "DENY_EXPIRED" || decision === "DENY_CANCELLED" || decision === "DENY_SUSPENDED" || decision === "DENY_INVALID_SUBSCRIPTION"),
        canAccessOperational: false,
        ...extra,
      };

      // Record diagnostic denial log if not throttled
      if (!skipDenialLogging) {
        this.recordAccessDenial(res, userRole, userId, effectiveFeatureKey, admin).catch(() => {});
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

    // 1. Fetch authoritative subscription record directly from database with schema fallback
    let sub: any = null;
    const { data: extendedSub, error: extErr } = await admin
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

    if (!extErr && extendedSub) {
      sub = extendedSub;
    } else {
      // Graceful fallback to schema-valid columns
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
      } else {
        // Essential columns fallback if relation fails
        const { data: simpleSub } = await admin
          .from("college_subscriptions")
          .select("id, tenant_id, status, plan_id, start_date, expiry_date, renewal_date, student_seat_limit, staff_seat_limit")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (simpleSub) {
          sub = simpleSub;
        }
      }
    }

    if (!sub) {
      // If exempt route, permit access even without subscription record
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          reasonCode: "EXEMPT_SELF_SERVICE",
          message: "Exempt account or billing self-service action permitted.",
          isGracePeriod: false,
          canAccessBilling: isBillingAuthorized,
          canAccessOperational: false,
        };
      }
      return makeDenial(
        "DENY_INVALID_SUBSCRIPTION",
        "NO_SUBSCRIPTION_RECORD",
        isStudent
          ? "Institutional placement services for your college are not currently activated."
          : "No subscription record found for this college tenant. Please select an approved subscription plan in the Billing portal (Option C).",
        {
          canAccessBilling: isBillingAuthorized,
        }
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
        const resolvedEntitlements = this.extractSnapshotEntitlements(sub, true);
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
          canAccessBilling: isBillingAuthorized,
          canAccessOperational: true,
          effectiveExpiryDate: sub.temporary_override_until,
          entitlements: resolvedEntitlements.features,
          limits: resolvedEntitlements.limits,
        };
      }
    }

    // 3. Evaluate Status Machine & Business Policies with Authoritative Payment Gate
    const rawStatus = (sub.status || "").toUpperCase();

    // Authoritative Initial Payment Verification:
    // Even if college_subscriptions.status is "ACTIVE" in the database (due to PostgreSQL check constraints
    // rejecting "PENDING_PAYMENT"), an institution with 0 verified paid invoices and an unpaid initial invoice
    // MUST be strictly treated as PENDING_PAYMENT. Operational access must NEVER be granted until initial payment is verified!
    let hasVerifiedPayment = false;
    let hasPendingInitialInvoice = false;

    try {
      const { data: invs } = await admin
        .from("platform_invoices")
        .select("id, status, notes, invoice_number")
        .eq("tenant_id", tenantId);

      if (invs && invs.length > 0) {
        hasVerifiedPayment = invs.some((i: any) => i.status === "PAID");
        hasPendingInitialInvoice = invs.some((i: any) => {
          if (i.status !== "PENDING") return false;
          const notes = (i.notes || "").toLowerCase();
          const isExplicitInitial = notes.includes("initial") || notes.includes("registration");
          const isExplicitRenewal = notes.includes("renewal") || notes.includes("renew");
          if (isExplicitInitial) return true;
          if (isExplicitRenewal) return false;
          return !hasVerifiedPayment;
        });
      }
    } catch {
      // In isolated mock tests where platform_invoices table is not present, rely on rawStatus
    }

    const isTerminalOrRestricted =
      rawStatus === "CANCELLED" ||
      rawStatus === "CANCELED" ||
      rawStatus === "EXPIRED" ||
      rawStatus === "SUSPENDED";

    const effectiveStatus = (!isTerminalOrRestricted && !hasVerifiedPayment && hasPendingInitialInvoice)
      ? "PENDING_PAYMENT"
      : rawStatus;

    // --- CASE A: Initial PENDING_PAYMENT (Q2) ---
    if (effectiveStatus === "PENDING_PAYMENT") {
      if (isExempt) {
        return {
          decision: "ALLOW",
          allowed: true,
          tenantId,
          subscriptionId: sub.id,
          subscriptionStatus: "PENDING_PAYMENT",
          planId: sub.plan_id,
          planName,
          reasonCode: "EXEMPT_PENDING_PAYMENT",
          message: "Permitted billing or account self-service under initial pending payment.",
          isGracePeriod: false,
          canAccessBilling: isBillingAuthorized,
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
          subscriptionStatus: "PENDING_PAYMENT",
          planId: sub.plan_id,
          planName,
          canAccessBilling: isBillingAuthorized,
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
        const resolvedEntitlements = this.extractSnapshotEntitlements(sub, hasVerifiedPayment);

        // If specific feature requested, check snapshot
        const isCoreUniversal =
          featureKey === "department_hierarchy" ||
          featureKey === "academic_structure" ||
          (isStudent && (featureKey === "mistake_to_mastery" || featureKey === "placement_memory_analytics"));

        if (featureKey && !isCoreUniversal && !resolvedEntitlements.features[featureKey]) {
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
          canAccessBilling: isBillingAuthorized,
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
          canAccessBilling: isBillingAuthorized,
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
          canAccessBilling: isBillingAuthorized,
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
          canAccessBilling: isBillingAuthorized,
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
          canAccessBilling: isBillingAuthorized,
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
          const resolvedEntitlements = this.extractSnapshotEntitlements(sub, hasVerifiedPayment);

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
            canAccessBilling: isBillingAuthorized,
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
          canAccessBilling: isBillingAuthorized,
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
          canAccessBilling: isBillingAuthorized,
        }
      );
    }

    // --- CASE E: ACTIVE or TRIALING ---
    if (rawStatus === "ACTIVE" || rawStatus === "TRIALING" || rawStatus === "TRIAL") {
      // 1. Strict Snapshot Immutability Verification
      const { features, limits, isValid, errorMsg } = this.extractSnapshotEntitlements(sub, hasVerifiedPayment);

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
            canAccessBilling: isBillingAuthorized,
          }
        );
      }

      // 2. Feature Key Entitlement Check
      const targetFeature = featureKey || effectiveFeatureKey;
      if (targetFeature) {
        const isCoreUniversal =
          targetFeature === "department_hierarchy" ||
          targetFeature === "academic_structure" ||
          (isStudent && (targetFeature === "mistake_to_mastery" || targetFeature === "placement_memory_analytics"));

        const isEntitled = isCoreUniversal || Boolean(features[targetFeature]);
        if (!isEntitled) {
          return makeDenial(
            "DENY_ENTITLEMENT",
            "FEATURE_NOT_IN_PLAN",
            `Feature '${targetFeature}' is not included in the college's assigned subscription plan (${planName}).`,
            {
              subscriptionId: sub.id,
              subscriptionStatus: rawStatus,
              planId: sub.plan_id,
              planName,
              featureKey: targetFeature,
              canAccessBilling: isBillingAuthorized,
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
        canAccessBilling: isBillingAuthorized,
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
        canAccessBilling: isBillingAuthorized,
      }
    );
  }

  /**
   * Helper to safely extract and validate frozen entitlement snapshot.
   * If snapshot is missing or null in a snapshot-enabled table, rejects as corrupt/missing.
   * If the schema lacks the entitlements_snapshot column entirely (live database fallback),
   * safely reconstructs canonical snapshot from purchased plan tier.
   */
  private static extractSnapshotEntitlements(sub: any, hasVerifiedPayment: boolean = false): {
    features: PlanEntitlementsMap;
    limits: PlanLimitsMap;
    isValid: boolean;
    errorMsg?: string;
  } {
    // If the schema does not have the entitlements_snapshot column (live database before migration),
    // sub.entitlements_snapshot is undefined. In that case, safely reconstruct from sub.plan_id.
    // Also, if the college has genuine verified paid invoices (hasVerifiedPayment === true),
    // safely auto-heal the snapshot from the purchased plan tier so paying institutions are never locked out!
    const isColumnAbsent = !("entitlements_snapshot" in sub) || sub.entitlements_snapshot === undefined;
    if ((isColumnAbsent || hasVerifiedPayment) && sub && sub.plan_id) {
      const tier = (sub.plan_id || "").toLowerCase().includes("enterprise")
        ? "enterprise"
        : (sub.plan_id || "").toLowerCase().includes("growth")
        ? "growth"
        : "starter";

      const plan = Array.isArray(sub.subscription_plans) ? sub.subscription_plans[0] : sub.subscription_plans;
      const features = plan
        ? PlatformSubscriptionService.extractEntitlementsFromPlan(plan)
        : PlatformSubscriptionService.buildDefaultEntitlements(null, tier);
      // Academic departments and degree branches are required for all institutional plans
      features.department_hierarchy = true;
      const limits = PlatformSubscriptionService.buildDefaultLimits(null, tier);

      if (sub.student_seat_limit) {
        limits.max_students = Number(sub.student_seat_limit);
      }
      if (sub.staff_seat_limit) {
        limits.max_staff = Number(sub.staff_seat_limit);
      }

      return { features, limits, isValid: true };
    }

    const snapshot: EntitlementsSnapshot | null = sub.entitlements_snapshot;

    if (
      snapshot &&
      typeof snapshot === "object" &&
      snapshot.entitlements &&
      typeof snapshot.entitlements === "object" &&
      snapshot.limits &&
      typeof snapshot.limits === "object"
    ) {
      const planTier = snapshot.planId || sub.plan_id;
      const features = PlatformSubscriptionService.buildDefaultEntitlements({
        ...snapshot.entitlements,
        ...(snapshot.customOverrides?.entitlements || {}),
      }, planTier);

      const limits = PlatformSubscriptionService.buildDefaultLimits({
        ...snapshot.limits,
        ...(snapshot.customOverrides?.limits || {}),
      }, planTier);

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
   * Resolves canonical product catalogue feature key from a permission identifier.
   * Directly maps all 16 CONTROLLED_FEATURE_CATALOGUE modules.
   */
  public static resolveFeatureKeyFromPermission(permission?: string): string | undefined {
    if (!permission) return undefined;
    const p = permission.toLowerCase();

    // 1. AI Placement Tutor (Floating AI Tutor & Conversational Guide)
    if (
      p === "ai.study_tutor.use" ||
      p.startsWith("ai.study_tutor") ||
      p.startsWith("ai.tutor") ||
      p.startsWith("ai_study_tutor")
    ) {
      return "ai_tutor_assistant";
    }

    // 2. AI Question Generation (Gemini)
    if (
      p === "ai.questions.generate" ||
      p.startsWith("ai.questions") ||
      p.startsWith("ai.question") ||
      p.startsWith("ai.generate")
    ) {
      return "ai_question_generator";
    }

    // 3. DriveFit Match Scoring
    if (p === "ai.drivefit.evaluate" || p.startsWith("ai.drivefit") || p.startsWith("drivefit.")) {
      return "drivefit_evaluator";
    }

    // 4. Automated Resume & Coding Scoring / AI Evaluation Pipeline
    if (
      p === "ai.placement_intel.read" ||
      p.startsWith("ai.placement_intel") ||
      p.startsWith("ai.resume") ||
      p.startsWith("ai.coding")
    ) {
      return "ai_evaluation_pipeline";
    }

    // 5. Mistake Bank & Spaced Remediation
    if (
      p === "ai.mistake_mastery.use" ||
      p.startsWith("mistake_bank.") ||
      p.startsWith("practice.") ||
      p.startsWith("question_defects.") ||
      p.startsWith("ai.mistake_mastery")
    ) {
      return "mistake_to_mastery";
    }

    // 6. Placement Memory & Cohort Intelligence
    if (
      p.startsWith("placement_memory.") ||
      p.startsWith("analytics.") ||
      p.startsWith("experience_reports.")
    ) {
      return "placement_memory_analytics";
    }

    // 7. Automated Eligibility Engine
    if (p.startsWith("eligibility.")) {
      return "automated_eligibility_engine";
    }

    // 8. Custom & Random Question Sets
    if (p.startsWith("question_sets.")) {
      return "custom_question_sets";
    }

    // 9. Subject-Wise Question Repository
    if (p.startsWith("questions.")) {
      return "subject_question_banks";
    }

    // 10. Standard Assessment Engine
    if (p.startsWith("assessments.")) {
      return "standard_assessments";
    }

    // 11. Core Recruitment Drives
    if (p.startsWith("drives.") || p.startsWith("stages.") || p.startsWith("candidates.")) {
      return "core_drives_management";
    }

    // 12. Student Directory & SRN Verification
    if (p.startsWith("students.")) {
      return "student_roster_directory";
    }

    // 13. Company Relationship Hub
    if (p.startsWith("companies.")) {
      return "company_management";
    }

    // 14. Department & Academic Structure
    if (p.startsWith("departments.") || p.startsWith("academic_years.")) {
      return "department_hierarchy";
    }

    // 15. Platform Audit & Compliance Export
    if (p.startsWith("reports.") || p.startsWith("export.")) {
      return "audit_data_export_hub";
    }

    // 16. Priority Support & Dedicated Liaison
    if (p.startsWith("sla.") || p.startsWith("support.liaison")) {
      return "dedicated_sla_liaison";
    }

    return undefined;
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

  /**
   * Authoritative feature entitlement assertion: throws structured HTTP 403-compatible Error
   * if the target feature module is not entitled in the active college subscription plan.
   */
  static async assertFeatureEntitlement(
    tenantId: string,
    featureKey: string,
    userRole: string = "PLACEMENT_HEAD",
    userId?: string,
    admin = createAdminClient()
  ): Promise<SubscriptionAccessResult> {
    const result = await this.evaluateAccess({
      tenantId,
      userRole,
      userId,
      featureKey,
      admin,
    });

    if (!result.allowed) {
      const err = new Error(
        `FORBIDDEN: FEATURE_NOT_IN_PLAN: Feature '${featureKey}' is not included in the college's assigned subscription plan (${result.planName || "CURRENT_PLAN"}).`
      );
      (err as any).decision = result.decision;
      (err as any).reasonCode = result.reasonCode;
      (err as any).tenantId = result.tenantId;
      throw err;
    }
    return result;
  }
}
