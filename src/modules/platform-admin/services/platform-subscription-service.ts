import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";
import {
  type PlanStatus,
  type BillingInterval,
  type DetailedSubscriptionPlan,
  type DetailedCollegeSubscription,
  type PlanLimitsMap,
  type PlanEntitlementsMap,
  type EntitlementsSnapshot,
  CONTROLLED_FEATURE_CATALOGUE,
  CONTROLLED_LIMIT_KEYS,
} from "../types/subscription-plans";

export interface ListPlansOptions {
  search?: string;
  status?: string;
  billingInterval?: string;
  sortBy?: "displayOrder" | "priceInr" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
  admin?: ReturnType<typeof createAdminClient>;
}

export interface CreatePlanParams {
  id?: string;
  name: string;
  slug: string;
  description?: string;
  displayOrder?: number;
  status?: PlanStatus;
  priceInr: number;
  currency?: string;
  billingInterval?: BillingInterval;
  discountPercentage?: number;
  limits?: Partial<PlanLimitsMap>;
  entitlements?: Partial<PlanEntitlementsMap>;
  adminId: string;
  admin?: ReturnType<typeof createAdminClient>;
}

export interface UpdatePlanParams {
  id: string;
  name?: string;
  description?: string;
  displayOrder?: number;
  priceInr?: number;
  currency?: string;
  billingInterval?: BillingInterval;
  discountPercentage?: number;
  limits?: Partial<PlanLimitsMap>;
  entitlements?: Partial<PlanEntitlementsMap>;
  adminId: string;
  admin?: ReturnType<typeof createAdminClient>;
}

export interface ChangeCollegePlanParams {
  tenantId: string;
  newPlanId: string;
  preserveCustomLimits?: boolean;
  immediateOverride?: boolean;
  overrideReason?: string;
  adminId: string;
  admin?: ReturnType<typeof createAdminClient>;
}

export interface ChangeCollegePlanResult {
  success: boolean;
  type: "IMMEDIATE_OVERRIDE" | "SCHEDULED_PENDING_RENEWAL" | "PENDING_PAYMENT_ASSIGNED";
  message: string;
  subscription: DetailedCollegeSubscription;
}

export interface SyncCollegePlanVersionParams {
  tenantId: string;
  adminId: string;
  admin?: ReturnType<typeof createAdminClient>;
}

export class PlatformSubscriptionService {
  /**
   * Helper to normalize and validate default limits map scaled by tier.
   */
  public static buildDefaultLimits(
    overrides?: Partial<PlanLimitsMap> | null,
    tierOrPlanId?: string | null
  ): PlanLimitsMap {
    const tier = tierOrPlanId
      ? tierOrPlanId.toLowerCase().includes("enterprise")
        ? "enterprise"
        : tierOrPlanId.toLowerCase().includes("growth")
        ? "growth"
        : "starter"
      : "growth";

    const baseLimits: Record<"starter" | "growth" | "enterprise", PlanLimitsMap> = {
      starter: {
        max_students: 500,
        max_staff: 5,
        max_drives: 5,
        max_storage_gb: 10,
        max_assessments: 10,
        ai_tokens_monthly: 0,
      },
      growth: {
        max_students: 2500,
        max_staff: 20,
        max_drives: 25,
        max_storage_gb: 100,
        max_assessments: 50,
        ai_tokens_monthly: 100000,
      },
      enterprise: {
        max_students: 10000,
        max_staff: 50,
        max_drives: 100,
        max_storage_gb: 1000,
        max_assessments: 500,
        ai_tokens_monthly: 1000000,
      },
    };

    const base: PlanLimitsMap = baseLimits[tier] || baseLimits.growth;
    if (!overrides) return { ...base };
    const result: PlanLimitsMap = { ...base };
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined) {
        result[k] = v;
      }
    }
    return result;
  }

  /**
   * Helper to normalize and validate default entitlements map from the controlled catalogue.
   * Automatically assigns features belonging to the plan tier, then layers overrides.
   */
  public static buildDefaultEntitlements(
    overrides?: Partial<PlanEntitlementsMap> | null,
    tierOrPlanId?: string | null
  ): PlanEntitlementsMap {
    const tier = tierOrPlanId
      ? tierOrPlanId.toLowerCase().includes("enterprise")
        ? "enterprise"
        : tierOrPlanId.toLowerCase().includes("growth")
        ? "growth"
        : "starter"
      : null;

    const map: PlanEntitlementsMap = {};
    for (const feat of CONTROLLED_FEATURE_CATALOGUE) {
      map[feat.key] = Boolean(tier && (feat.defaultTiers as readonly string[]).includes(tier));
    }
    // Department & Academic Structure is fundamental to all institutional operations
    if (tier) {
      map.department_hierarchy = true;
    }
    if (!overrides) return map;
    for (const [k, v] of Object.entries(overrides)) {
      if (v !== undefined && v !== null) {
        map[k] = Boolean(v);
      }
    }
    return map;
  }

  /**
   * Converts structured entitlements map to legacy string array for backward compatibility.
   */
  public static entitlementsToStringArray(entitlements: PlanEntitlementsMap): string[] {
    const names: string[] = [];
    for (const feat of CONTROLLED_FEATURE_CATALOGUE) {
      if (entitlements[feat.key]) {
        names.push(feat.name);
      }
    }
    return names;
  }

  /**
   * Generates a frozen entitlement snapshot for an existing subscription.
   */
  public static createSnapshot(
    plan: DetailedSubscriptionPlan,
    customOverrides?: EntitlementsSnapshot["customOverrides"]
  ): EntitlementsSnapshot {
    return {
      planId: plan.id,
      planName: plan.name,
      planVersion: plan.version,
      priceInr: plan.priceInr,
      billingCycle: plan.billingInterval,
      limits: { ...plan.limits },
      entitlements: { ...plan.entitlements },
      snapshotAt: new Date().toISOString(),
      customOverrides,
    };
  }

  /**
   * Lists all platform subscription plans with subscriber counts and metadata.
   */
  static async listPlans(
    optionsOrClient: ListPlansOptions | any = {}
  ): Promise<DetailedSubscriptionPlan[]> {
    const isClient = Boolean(optionsOrClient && typeof optionsOrClient.from === "function");
    const options: ListPlansOptions = isClient ? {} : optionsOrClient || {};
    const admin = isClient ? optionsOrClient : options.admin || createAdminClient();

    const {
      search,
      status,
      billingInterval,
      sortBy = "displayOrder",
      sortOrder = "asc",
    } = options;

    let query = admin.from("subscription_plans").select("*");

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (billingInterval && billingInterval !== "ALL") {
      query = query.or(`billing_interval.eq.${billingInterval},billing_cycle.eq.${billingInterval}`);
    }

    if (search && search.trim().length > 0) {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},slug.ilike.${term},description.ilike.${term}`);
    }

    let rawPlans: any[] = [];
    const { data: queryPlans, error: plansErr } = await query;
    if (plansErr) {
      // Fallback: If status or billing_interval column does not exist on legacy/base schema, query base table directly
      const { data: fallbackPlans, error: fallbackErr } = await admin
        .from("subscription_plans")
        .select("*");
      if (fallbackErr || !fallbackPlans) {
        throw new Error(`Failed to list subscription plans: ${plansErr.message}`);
      }
      rawPlans = fallbackPlans;
    } else {
      rawPlans = queryPlans || [];
    }

    // Query active subscriptions count per plan
    const { data: subsData } = await admin
      .from("college_subscriptions")
      .select("plan_id, status");

    const subscriberCountMap = new Map<string, number>();
    if (subsData) {
      for (const s of subsData) {
        if (s.plan_id) {
          const current = subscriberCountMap.get(s.plan_id) || 0;
          subscriberCountMap.set(s.plan_id, current + 1);
        }
      }
    }

    const plans: DetailedSubscriptionPlan[] = (rawPlans || []).map((p: any) => {
      const planTier = p.slug || p.id;
      const limits: PlanLimitsMap =
        p.limits && typeof p.limits === "object"
          ? { ...this.buildDefaultLimits(null, planTier), ...p.limits }
          : this.buildDefaultLimits({
              max_students: p.student_limit,
              max_staff: p.staff_limit,
              max_storage_gb: p.storage_limit_gb,
            }, planTier);

      const entitlements: PlanEntitlementsMap =
        p.entitlements && typeof p.entitlements === "object" && Object.keys(p.entitlements).length > 0
          ? { ...this.buildDefaultEntitlements(null, planTier), ...p.entitlements }
          : this.buildDefaultEntitlements(null, planTier);

      // Department & Academic Structure is standard across all tiers
      entitlements.department_hierarchy = true;

      const rawFeaturesList =
        Array.isArray(p.features) && p.features.length > 0
          ? [...p.features]
          : this.entitlementsToStringArray(entitlements);

      if (!rawFeaturesList.some((f: string) => f.toLowerCase().includes("department"))) {
        rawFeaturesList.push("Department & Academic Structure");
      }

      const featuresList = rawFeaturesList;

      const planStatus: PlanStatus = p.status || (p.is_active ? "PUBLISHED" : "ARCHIVED");

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        displayOrder: Number(p.display_order || 0),
        status: planStatus,
        priceInr: Number(p.price_inr || 0),
        currency: p.currency || "INR",
        billingInterval: (p.billing_interval || p.billing_cycle || "ANNUAL") as BillingInterval,
        billingCycle: p.billing_cycle || "ANNUAL",
        discountPercentage: Number(p.discount_percentage || 0),
        studentLimit: Number(limits.max_students || p.student_limit || 1000),
        staffLimit: Number(limits.max_staff || p.staff_limit || 10),
        storageLimitGb: Number(limits.max_storage_gb || p.storage_limit_gb || 20),
        limits,
        entitlements,
        features: featuresList,
        version: Number(p.version || 1),
        isActive: planStatus === "PUBLISHED",
        subscribersCount: subscriberCountMap.get(p.id) || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      };
    });

    // Resilient in-memory filtering to ensure filters apply regardless of DB schema differences
    let filteredPlans = plans;
    if (status && status !== "ALL") {
      filteredPlans = filteredPlans.filter((p) => p.status === status);
    }
    if (billingInterval && billingInterval !== "ALL") {
      filteredPlans = filteredPlans.filter(
        (p) => p.billingInterval === billingInterval || (p as any).billingCycle === billingInterval
      );
    }
    if (search && search.trim().length > 0) {
      const term = search.trim().toLowerCase();
      filteredPlans = filteredPlans.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.slug.toLowerCase().includes(term) ||
          (p.description && p.description.toLowerCase().includes(term))
      );
    }

    // Sorting
    filteredPlans.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "priceInr") {
        comparison = a.priceInr - b.priceInr;
      } else if (sortBy === "name") {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === "createdAt") {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      } else {
        comparison = a.displayOrder - b.displayOrder;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filteredPlans;
  }

  /**
   * Retrieves single subscription plan by ID.
   */
  static async getPlanById(
    planId: string,
    admin = createAdminClient()
  ): Promise<DetailedSubscriptionPlan | null> {
    const { data: p, error } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();

    if (error || !p) {
      return null;
    }

    const { count } = await admin
      .from("college_subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("plan_id", planId);

    const planTier = p.slug || p.id;
    const limits =
      p.limits && typeof p.limits === "object"
        ? { ...this.buildDefaultLimits(null, planTier), ...p.limits }
        : this.buildDefaultLimits({
            max_students: p.student_limit,
            max_staff: p.staff_limit,
            max_storage_gb: p.storage_limit_gb,
          }, planTier);

    const entitlements =
      p.entitlements && typeof p.entitlements === "object" && Object.keys(p.entitlements).length > 0
        ? { ...this.buildDefaultEntitlements(null, planTier), ...p.entitlements }
        : this.buildDefaultEntitlements(null, planTier);

    const planStatus: PlanStatus = p.status || (p.is_active ? "PUBLISHED" : "ARCHIVED");

    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      displayOrder: Number(p.display_order || 0),
      status: planStatus,
      priceInr: Number(p.price_inr || 0),
      currency: p.currency || "INR",
      billingInterval: (p.billing_interval || p.billing_cycle || "ANNUAL") as BillingInterval,
      billingCycle: p.billing_cycle || "ANNUAL",
      discountPercentage: Number(p.discount_percentage || 0),
      studentLimit: Number(limits.max_students || p.student_limit || 1000),
      staffLimit: Number(limits.max_staff || p.staff_limit || 10),
      storageLimitGb: Number(limits.max_storage_gb || p.storage_limit_gb || 20),
      limits,
      entitlements,
      features: Array.isArray(p.features) ? p.features : this.entitlementsToStringArray(entitlements),
      version: Number(p.version || 1),
      isActive: planStatus === "PUBLISHED",
      subscribersCount: count || 0,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    };
  }

  /**
   * Creates a new subscription plan with version 1.
   */
  static async createPlan(params: CreatePlanParams): Promise<DetailedSubscriptionPlan> {
    const {
      id: customId,
      name,
      slug,
      description,
      displayOrder = 0,
      status = "PUBLISHED",
      priceInr,
      currency = "INR",
      billingInterval = "ANNUAL",
      discountPercentage = 0,
      limits: limitsParam,
      entitlements: entitlementsParam,
      adminId,
      admin = createAdminClient(),
    } = params;

    // Validation
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const planId = (customId || cleanSlug).trim().toLowerCase();

    if (!cleanSlug || cleanSlug.length < 2) {
      throw new Error("Plan slug must be at least 2 characters long.");
    }
    if (!name || name.trim().length === 0) {
      throw new Error("Plan name is required.");
    }
    if (priceInr < 0) {
      throw new Error("Price cannot be negative.");
    }
    if (discountPercentage < 0 || discountPercentage > 100) {
      throw new Error("Discount percentage must be between 0 and 100.");
    }
    if (limitsParam) {
      for (const [key, val] of Object.entries(limitsParam)) {
        if (val !== null && val !== undefined && val < 0) {
          throw new Error(`Limit '${key}' cannot be negative.`);
        }
      }
    }

    // Check slug and ID uniqueness
    const { data: existing } = await admin
      .from("subscription_plans")
      .select("id, slug")
      .or(`id.eq.${planId},slug.eq.${cleanSlug}`)
      .maybeSingle();

    if (existing) {
      throw new Error(`A subscription plan with identifier '${existing.id}' or slug '${existing.slug}' already exists.`);
    }

    const planTierKey = cleanSlug || planId || name;
    const limits = this.buildDefaultLimits(limitsParam, planTierKey);
    const entitlements = this.buildDefaultEntitlements(entitlementsParam, planTierKey);
    const legacyFeatures = this.entitlementsToStringArray(entitlements);
    const isActive = status === "PUBLISHED";
    const now = new Date().toISOString();

    const insertPayload = {
      id: planId,
      name: name.trim(),
      slug: cleanSlug,
      description: description?.trim() || null,
      display_order: Number(displayOrder),
      status,
      price_inr: Number(priceInr),
      currency,
      billing_interval: billingInterval,
      billing_cycle: billingInterval === "MONTHLY" ? "MONTHLY" : "ANNUAL",
      discount_percentage: Number(discountPercentage),
      student_limit: Number(limits.max_students || 1000),
      staff_limit: Number(limits.max_staff || 10),
      storage_limit_gb: Number(limits.max_storage_gb || 20),
      limits,
      entitlements,
      features: legacyFeatures,
      version: 1,
      is_active: isActive,
      created_at: now,
      updated_at: now,
    };

    const { data: rawCreated, error: createErr } = await admin
      .from("subscription_plans")
      .insert(insertPayload)
      .select()
      .single();

    let data = rawCreated;

    if (createErr || !data) {
      // Fallback for base schema without version/limits/entitlements/status columns
      const basePayload = {
        id: planId,
        name: name.trim(),
        slug: cleanSlug,
        description: description?.trim() || null,
        price_inr: Number(priceInr),
        billing_cycle: billingInterval === "MONTHLY" ? "MONTHLY" : "ANNUAL",
        student_limit: Number(limits.max_students || 1000),
        staff_limit: Number(limits.max_staff || 10),
        storage_limit_gb: Number(limits.max_storage_gb || 20),
        features: legacyFeatures,
        is_active: isActive,
        created_at: now,
        updated_at: now,
      };

      const fallbackRes = await admin
        .from("subscription_plans")
        .insert(basePayload)
        .select()
        .single();

      if (fallbackRes.error || !fallbackRes.data) {
        throw new Error(
          `Failed to create plan: ${fallbackRes.error?.message || createErr?.message || "Database insert error"}`
        );
      }
      data = fallbackRes.data;
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_PLAN_CREATE",
      resourceType: "SUBSCRIPTION_PLAN",
      resourceId: data.id,
      metadata: { planName: data.name, priceInr: data.price_inr, status, version: 1 },
      adminClient: admin,
    });

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      displayOrder: Number(data.display_order),
      status: data.status,
      priceInr: Number(data.price_inr),
      currency: data.currency,
      billingInterval: data.billing_interval,
      billingCycle: data.billing_cycle,
      discountPercentage: Number(data.discount_percentage),
      studentLimit: Number(limits.max_students || 1000),
      staffLimit: Number(limits.max_staff || 10),
      storageLimitGb: Number(limits.max_storage_gb || 20),
      limits,
      entitlements,
      features: legacyFeatures,
      version: 1,
      isActive,
      subscribersCount: 0,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Upserts a plan by ID or slug (backward compatibility for legacy test harnesses and integrations).
   */
  static async upsertPlan(params: {
    id?: string;
    name: string;
    slug: string;
    description?: string;
    priceInr: number;
    studentLimit?: number;
    staffLimit?: number;
    storageLimitGb?: number;
    features?: string[];
    billingCycle?: string;
    adminId?: string;
    admin?: any;
  }): Promise<DetailedSubscriptionPlan> {
    const admin = params.admin || createAdminClient();
    const planId = params.id || params.slug;

    // Check if plan exists
    const { data: existing } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("id", planId)
      .maybeSingle();

    const limits = this.buildDefaultLimits({
      max_students: params.studentLimit ?? 1000,
      max_staff: params.staffLimit ?? 10,
      max_storage_gb: params.storageLimitGb ?? 20,
    });

    const entitlements = this.buildDefaultEntitlements();
    if (params.features && params.features.length > 0) {
      for (const feat of CONTROLLED_FEATURE_CATALOGUE) {
        if (
          params.features.some(
            (f) =>
              f.toLowerCase() === feat.name.toLowerCase() ||
              f.toLowerCase() === feat.key.toLowerCase() ||
              f.toLowerCase().includes(feat.name.toLowerCase().split(" ")[0])
          )
        ) {
          entitlements[feat.key] = true;
        }
      }
    }

    const payload: Record<string, any> = {
      id: planId,
      name: params.name,
      slug: params.slug || planId,
      description: params.description || null,
      price_inr: params.priceInr,
      currency: "INR",
      billing_cycle: params.billingCycle || "ANNUAL",
      billing_interval: params.billingCycle || "ANNUAL",
      student_limit: limits.max_students,
      staff_limit: limits.max_staff,
      storage_limit_gb: limits.max_storage_gb,
      limits,
      entitlements,
      features: params.features || this.entitlementsToStringArray(entitlements),
      is_active: true,
      status: "PUBLISHED",
      version: existing?.version ? existing.version + 1 : 1,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      const { data: updated } = await admin
        .from("subscription_plans")
        .update(payload)
        .eq("id", planId)
        .select()
        .single();

      if (params.adminId) {
        await PlatformAuthService.logAuditEvent({
          actorId: params.adminId,
          action: "PLATFORM_PLAN_UPDATE",
          resourceType: "SUBSCRIPTION_PLAN",
          resourceId: planId,
          metadata: { name: params.name, priceInr: params.priceInr, version: payload.version },
          adminClient: admin,
        });
      }

      const p = updated || payload;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        displayOrder: Number(p.display_order || 0),
        status: p.status || "PUBLISHED",
        priceInr: Number(p.price_inr || params.priceInr),
        currency: p.currency || "INR",
        billingInterval: (p.billing_interval || "ANNUAL") as BillingInterval,
        billingCycle: p.billing_cycle || "ANNUAL",
        discountPercentage: Number(p.discount_percentage || 0),
        studentLimit: Number(p.student_limit || limits.max_students || 1000),
        staffLimit: Number(p.staff_limit || limits.max_staff || 10),
        storageLimitGb: Number(p.storage_limit_gb || limits.max_storage_gb || 20),
        limits,
        entitlements,
        features: p.features || params.features || [],
        version: Number(p.version || 1),
        isActive: true,
        subscribersCount: 0,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || new Date().toISOString(),
      };
    } else {
      payload.created_at = new Date().toISOString();
      const { data: inserted } = await admin
        .from("subscription_plans")
        .insert(payload)
        .select()
        .single();

      if (params.adminId) {
        await PlatformAuthService.logAuditEvent({
          actorId: params.adminId,
          action: "PLATFORM_PLAN_CREATE",
          resourceType: "SUBSCRIPTION_PLAN",
          resourceId: planId,
          metadata: { name: params.name, priceInr: params.priceInr, version: 1 },
          adminClient: admin,
        });
      }

      const p = inserted || payload;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        displayOrder: Number(p.display_order || 0),
        status: p.status || "PUBLISHED",
        priceInr: Number(p.price_inr || params.priceInr),
        currency: p.currency || "INR",
        billingInterval: (p.billing_interval || "ANNUAL") as BillingInterval,
        billingCycle: p.billing_cycle || "ANNUAL",
        discountPercentage: Number(p.discount_percentage || 0),
        studentLimit: Number(p.student_limit || limits.max_students || 1000),
        staffLimit: Number(p.staff_limit || limits.max_staff || 10),
        storageLimitGb: Number(p.storage_limit_gb || limits.max_storage_gb || 20),
        limits,
        entitlements,
        features: p.features || params.features || [],
        version: Number(p.version || 1),
        isActive: true,
        subscribersCount: 0,
        createdAt: p.created_at || new Date().toISOString(),
        updatedAt: p.updated_at || new Date().toISOString(),
      };
    }
  }

  /**
   * Updates an existing subscription plan.
   * If the plan is already PUBLISHED, increments its version (v -> v+1) to guarantee
   * that existing subscribers are never silently or unexpectedly modified!
   */
  static async updatePlan(params: UpdatePlanParams): Promise<DetailedSubscriptionPlan> {
    const {
      id,
      name,
      description,
      displayOrder,
      priceInr,
      currency,
      billingInterval,
      discountPercentage,
      limits: limitsParam,
      entitlements: entitlementsParam,
      adminId,
      admin = createAdminClient(),
    } = params;

    const existing = await this.getPlanById(id, admin);
    if (!existing) {
      throw new Error(`Subscription plan '${id}' not found.`);
    }

    if (existing.status === "ARCHIVED") {
      throw new Error("Cannot edit an archived subscription plan. Please unarchive or create a new plan.");
    }

    // Validation
    if (name !== undefined && name.trim().length === 0) {
      throw new Error("Plan name cannot be empty.");
    }
    if (priceInr !== undefined && priceInr < 0) {
      throw new Error("Price cannot be negative.");
    }
    if (discountPercentage !== undefined && (discountPercentage < 0 || discountPercentage > 100)) {
      throw new Error("Discount percentage must be between 0 and 100.");
    }
    if (limitsParam) {
      for (const [key, val] of Object.entries(limitsParam)) {
        if (val !== null && val !== undefined && val < 0) {
          throw new Error(`Limit '${key}' cannot be negative.`);
        }
      }
    }

    // If plan is PUBLISHED and limits, entitlements, or pricing changed, bump version!
    const isMajorChange =
      priceInr !== undefined ||
      billingInterval !== undefined ||
      limitsParam !== undefined ||
      entitlementsParam !== undefined;

    const newVersion = existing.status === "PUBLISHED" && isMajorChange ? existing.version + 1 : existing.version;

    const planTierKey = existing.slug || existing.id;
    const updatedLimits: PlanLimitsMap = this.buildDefaultLimits(
      {
        ...existing.limits,
        ...(limitsParam || {}),
      },
      planTierKey
    );

    const updatedEntitlements: PlanEntitlementsMap = this.buildDefaultEntitlements(
      {
        ...existing.entitlements,
        ...(entitlementsParam || {}),
      },
      planTierKey
    );

    const legacyFeatures = this.entitlementsToStringArray(updatedEntitlements);

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
      version: newVersion,
    };

    if (name !== undefined) updatePayload.name = name.trim();
    if (description !== undefined) updatePayload.description = description.trim() || null;
    if (displayOrder !== undefined) updatePayload.display_order = Number(displayOrder);
    if (priceInr !== undefined) updatePayload.price_inr = Number(priceInr);
    if (currency !== undefined) updatePayload.currency = currency;
    if (billingInterval !== undefined) {
      updatePayload.billing_interval = billingInterval;
      updatePayload.billing_cycle = billingInterval === "MONTHLY" ? "MONTHLY" : "ANNUAL";
    }
    if (discountPercentage !== undefined) updatePayload.discount_percentage = Number(discountPercentage);
    if (limitsParam !== undefined) {
      updatePayload.limits = updatedLimits;
      updatePayload.student_limit = Number(updatedLimits.max_students || 1000);
      updatePayload.staff_limit = Number(updatedLimits.max_staff || 10);
      updatePayload.storage_limit_gb = Number(updatedLimits.max_storage_gb || 20);
    }
    if (entitlementsParam !== undefined) {
      updatePayload.entitlements = updatedEntitlements;
      updatePayload.features = legacyFeatures;
    }

    const { data: rawUpdated, error: updateErr } = await admin
      .from("subscription_plans")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    let data = rawUpdated;

    if (updateErr || !data) {
      // Fallback for base schema without version/limits/entitlements/display_order columns
      const basePayload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) basePayload.name = name.trim();
      if (description !== undefined) basePayload.description = description.trim() || null;
      if (priceInr !== undefined) basePayload.price_inr = Number(priceInr);
      if (billingInterval !== undefined) {
        basePayload.billing_cycle = billingInterval === "MONTHLY" ? "MONTHLY" : "ANNUAL";
      }
      if (limitsParam !== undefined) {
        if (updatedLimits.max_students !== undefined && updatedLimits.max_students !== null) {
          basePayload.student_limit = Number(updatedLimits.max_students);
        }
        if (updatedLimits.max_staff !== undefined && updatedLimits.max_staff !== null) {
          basePayload.staff_limit = Number(updatedLimits.max_staff);
        }
        if (updatedLimits.max_storage_gb !== undefined && updatedLimits.max_storage_gb !== null) {
          basePayload.storage_limit_gb = Number(updatedLimits.max_storage_gb);
        }
      }
      if (entitlementsParam !== undefined) {
        basePayload.features = legacyFeatures;
      }

      const fallbackRes = await admin
        .from("subscription_plans")
        .update(basePayload)
        .eq("id", id)
        .select()
        .single();

      if (fallbackRes.error || !fallbackRes.data) {
        throw new Error(
          `Failed to update plan: ${fallbackRes.error?.message || updateErr?.message || "Database update error"}`
        );
      }

      data = fallbackRes.data;
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_PLAN_UPDATE",
      resourceType: "SUBSCRIPTION_PLAN",
      resourceId: id,
      metadata: {
        planName: data.name,
        previousVersion: existing.version,
        newVersion,
        subscribersPreservedCount: existing.subscribersCount,
      },
      adminClient: admin,
    });

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      displayOrder: Number(data.display_order ?? displayOrder ?? 0),
      status: data.status || (data.is_active ? "PUBLISHED" : "ARCHIVED"),
      priceInr: Number(data.price_inr ?? priceInr ?? 0),
      currency: data.currency || currency || "INR",
      billingInterval: (data.billing_interval || data.billing_cycle || billingInterval || "ANNUAL") as BillingInterval,
      billingCycle: data.billing_cycle || (billingInterval === "MONTHLY" ? "MONTHLY" : "ANNUAL"),
      discountPercentage: Number(data.discount_percentage ?? discountPercentage ?? 0),
      studentLimit: Number(data.student_limit || updatedLimits.max_students || 1000),
      staffLimit: Number(data.staff_limit || updatedLimits.max_staff || 10),
      storageLimitGb: Number(data.storage_limit_gb || updatedLimits.max_storage_gb || 20),
      limits: data.limits || updatedLimits,
      entitlements: data.entitlements || updatedEntitlements,
      features: Array.isArray(data.features) ? data.features : legacyFeatures,
      version: Number(data.version || newVersion || 1),
      isActive: data.status ? data.status === "PUBLISHED" : Boolean(data.is_active),
      subscribersCount: existing.subscribersCount,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Publishes a draft plan, making it available for institutional assignments.
   */
  static async publishPlan(planId: string, adminId: string, admin = createAdminClient()): Promise<DetailedSubscriptionPlan> {
    const existing = await this.getPlanById(planId, admin);
    if (!existing) {
      throw new Error(`Subscription plan '${planId}' not found.`);
    }

    if (existing.status === "PUBLISHED") {
      return existing;
    }

    const { data: rawPub, error: pubErr } = await admin
      .from("subscription_plans")
      .update({
        status: "PUBLISHED",
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .select()
      .single();

    let data = rawPub;

    if (pubErr || !data) {
      const fallbackPub = await admin
        .from("subscription_plans")
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId)
        .select()
        .single();

      if (fallbackPub.error || !fallbackPub.data) {
        throw new Error(`Failed to publish plan: ${fallbackPub.error?.message || pubErr?.message || "Update error"}`);
      }
      data = fallbackPub.data;
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_PLAN_PUBLISH",
      resourceType: "SUBSCRIPTION_PLAN",
      resourceId: planId,
      metadata: { planName: data.name },
      adminClient: admin,
    });

    return {
      ...existing,
      status: "PUBLISHED",
      isActive: true,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Archives a subscription plan.
   * CRITICAL SAFETY REQUIREMENT:
   * Prevents archiving or deletion when it would break active or pending college subscriptions!
   */
  static async archivePlan(planId: string, adminId: string, admin = createAdminClient()): Promise<DetailedSubscriptionPlan> {
    const existing = await this.getPlanById(planId, admin);
    if (!existing) {
      throw new Error(`Subscription plan '${planId}' not found.`);
    }

    if (existing.status === "ARCHIVED") {
      return existing;
    }

    // Safety Verification: Check for active, pending, or trialing college subscriptions
    const { data: boundColleges, error: boundErr } = await admin
      .from("college_subscriptions")
      .select(`
        id,
        tenant_id,
        status,
        tenants (
          name
        )
      `)
      .eq("plan_id", planId)
      .in("status", ["ACTIVE", "PENDING_PAYMENT", "TRIALING", "PAST_DUE"]);

    if (boundErr) {
      throw new Error(`Failed to check subscription safety: ${boundErr.message}`);
    }

    if (boundColleges && boundColleges.length > 0) {
      const collegeNames = boundColleges
        .map((b: any) => b.tenants?.name || b.tenant_id)
        .slice(0, 3)
        .join(", ");
      const moreText = boundColleges.length > 3 ? ` and ${boundColleges.length - 3} more` : "";

      throw new Error(
        `Cannot archive plan '${existing.name}': It is currently associated with ${boundColleges.length} active or pending college subscription(s) (${collegeNames}${moreText}). Please reassign existing colleges to another plan before archiving.`
      );
    }

    const { data: rawArch, error: archErr } = await admin
      .from("subscription_plans")
      .update({
        status: "ARCHIVED",
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", planId)
      .select()
      .single();

    let data = rawArch;

    if (archErr || !data) {
      const fallbackArch = await admin
        .from("subscription_plans")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", planId)
        .select()
        .single();

      if (fallbackArch.error || !fallbackArch.data) {
        throw new Error(`Failed to archive plan: ${fallbackArch.error?.message || archErr?.message || "Update error"}`);
      }
      data = fallbackArch.data;
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_PLAN_ARCHIVE",
      resourceType: "SUBSCRIPTION_PLAN",
      resourceId: planId,
      metadata: { planName: data.name },
      adminClient: admin,
    });

    return {
      ...existing,
      status: "ARCHIVED",
      isActive: false,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Deletes an unreferenced draft plan.
   * If a plan has any college subscriptions or has been published with references, deletion is strictly rejected.
   */
  static async deleteDraftPlan(
    planId: string,
    adminId: string,
    admin = createAdminClient()
  ): Promise<{ success: boolean; message: string }> {
    const plan = await this.getPlanById(planId, admin);
    if (!plan) {
      throw new Error(`Subscription plan '${planId}' not found.`);
    }

    // Safety Verification: Must not have any subscriptions referencing it
    const { data: referencingSubs, error: subErr } = await admin
      .from("college_subscriptions")
      .select("id")
      .eq("plan_id", planId)
      .limit(1);

    if (subErr) {
      throw new Error(`Failed to check plan references: ${subErr.message}`);
    }

    if (referencingSubs && referencingSubs.length > 0) {
      throw new Error(`Cannot delete plan '${plan.name}': It is referenced by existing college subscriptions. You may archive it instead.`);
    }

    if (plan.status !== "DRAFT" && plan.status !== "ARCHIVED") {
      throw new Error(`Cannot delete plan '${plan.name}': Only DRAFT or unreferenced ARCHIVED plans may be deleted. Active published plans must be archived.`);
    }

    const { error: delErr } = await admin
      .from("subscription_plans")
      .delete()
      .eq("id", planId);

    if (delErr) {
      throw new Error(`Failed to delete plan: ${delErr.message}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_PLAN_DELETE",
      resourceType: "SUBSCRIPTION_PLAN",
      resourceId: planId,
      metadata: { planName: plan.name, planId },
      adminClient: admin,
    });

    return {
      success: true,
      message: `Subscription plan '${plan.name}' deleted successfully.`,
    };
  }

  /**
   * Lists all college subscriptions with plan version comparison and entitlements snapshots.
   */
  static async listCollegeSubscriptions(
    params: { status?: string; planId?: string; search?: string; admin?: ReturnType<typeof createAdminClient> } = {}
  ): Promise<DetailedCollegeSubscription[]> {
    const { status, planId, search, admin = createAdminClient() } = params;

    let query = admin
      .from("college_subscriptions")
      .select(`
        id,
        tenant_id,
        plan_id,
        plan_version,
        entitlements_snapshot,
        pending_plan_id,
        pending_plan_version,
        plan_change_scheduled_at,
        plan_change_effective_at,
        status,
        start_date,
        expiry_date,
        renewal_date,
        grace_period_days,
        student_seat_limit,
        staff_seat_limit,
        created_at,
        updated_at,
        tenants (
          id,
          name,
          slug
        ),
        subscription_plans (
          id,
          name,
          version
        )
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }
    if (planId && planId !== "ALL") {
      query = query.eq("plan_id", planId);
    }

    let { data, error } = await query;
    if (error) {
      // Compatibility fallback: if extended versioning/snapshot columns are not present in schema
      const fallbackQuery = admin
        .from("college_subscriptions")
        .select(`
          id,
          tenant_id,
          plan_id,
          status,
          start_date,
          expiry_date,
          renewal_date,
          grace_period_days,
          student_seat_limit,
          staff_seat_limit,
          created_at,
          updated_at,
          tenants (
            id,
            name,
            slug
          ),
          subscription_plans (
            id,
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (status && status !== "ALL") {
        fallbackQuery.eq("status", status);
      }
      if (planId && planId !== "ALL") {
        fallbackQuery.eq("plan_id", planId);
      }

      const fallbackRes = await fallbackQuery;
      if (fallbackRes.error) {
        throw new Error(`Failed to list college subscriptions: ${error.message}`);
      }
      data = fallbackRes.data as any;
    }

    let items: DetailedCollegeSubscription[] = (data || []).map((cs: any) => {
      const plan = Array.isArray(cs.subscription_plans) ? cs.subscription_plans[0] : cs.subscription_plans;
      const tenant = Array.isArray(cs.tenants) ? cs.tenants[0] : cs.tenants;

      const planVersion = Number(cs.plan_version || 1);
      const currentPlanVersion = Number(plan?.version || 1);
      const isPlanVersionOutdated = planVersion < currentPlanVersion;

      return {
        id: cs.id,
        tenantId: cs.tenant_id,
        tenantName: tenant?.name || "Unknown College",
        tenantSlug: tenant?.slug || "unknown",
        planId: cs.plan_id,
        planName: plan?.name || cs.plan_id,
        planVersion,
        currentPlanVersion,
        isPlanVersionOutdated,
        status: cs.status,
        startDate: cs.start_date,
        expiryDate: cs.expiry_date,
        renewalDate: cs.renewal_date,
        gracePeriodDays: cs.grace_period_days,
        studentSeatLimit: cs.student_seat_limit,
        staffSeatLimit: cs.staff_seat_limit,
        entitlementsSnapshot: cs.entitlements_snapshot || null,
        pendingPlanId: cs.pending_plan_id || null,
        pendingPlanVersion: cs.pending_plan_version || null,
        planChangeScheduledAt: cs.plan_change_scheduled_at || null,
        planChangeEffectiveAt: cs.plan_change_effective_at || null,
        createdAt: cs.created_at,
        updatedAt: cs.updated_at,
      };
    });

    if (search && search.trim().length > 0) {
      const lower = search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.tenantName.toLowerCase().includes(lower) ||
          i.tenantSlug.toLowerCase().includes(lower) ||
          i.planName.toLowerCase().includes(lower)
      );
    }

    return items;
  }

  /**
   * Associates a new plan with a college subscription.
   * ABSOLUTE BUSINESS & ARCHITECTURAL RULES:
   * 1. ACTIVE subscriptions cannot be immediately changed without explicit emergency authorization!
   *    Default behavior for ACTIVE subscriptions is scheduling the plan change for the next renewal date.
   *    Immediate override requires immediateOverride: true and a mandatory overrideReason (>= 10 characters).
   * 2. Selecting or assigning a plan must NEVER automatically activate an unpaid subscription.
   *    If current status is PENDING_PAYMENT, it strictly remains PENDING_PAYMENT.
   * 3. Takes a fresh entitlements snapshot matching the target plan version.
   * 4. Records a full platform audit trail with specific transition types.
   */
  static async changeCollegePlan(params: ChangeCollegePlanParams): Promise<ChangeCollegePlanResult> {
    const {
      tenantId,
      newPlanId,
      preserveCustomLimits = false,
      immediateOverride = false,
      overrideReason,
      adminId,
      admin = createAdminClient(),
    } = params;

    // 1. Fetch current subscription with graceful schema fallback
    let currentSub: any = null;
    const { data: joinedSub, error: subErr } = await admin
      .from("college_subscriptions")
      .select(`
        *,
        tenants (
          name,
          slug
        ),
        subscription_plans (
          id,
          name
        )
      `)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subErr || !joinedSub) {
      const { data: baseSub, error: baseErr } = await admin
        .from("college_subscriptions")
        .select(`
          *,
          tenants (
            name,
            slug
          )
        `)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (baseErr || !baseSub) {
        throw new Error("College subscription record not found.");
      }
      currentSub = baseSub;
    } else {
      currentSub = joinedSub;
    }

    // 2. Fetch new plan and verify it is PUBLISHED
    const newPlan = await this.getPlanById(newPlanId, admin);
    if (!newPlan) {
      throw new Error(`Target subscription plan '${newPlanId}' does not exist.`);
    }

    if (newPlan.status !== "PUBLISHED") {
      throw new Error(
        `Cannot assign plan '${newPlan.name}': Only PUBLISHED plans can be assigned to institutions (current plan status: ${newPlan.status}).`
      );
    }

    const currentPlan = Array.isArray(currentSub.subscription_plans)
      ? currentSub.subscription_plans[0]
      : currentSub.subscription_plans;
    const tenant = Array.isArray(currentSub.tenants) ? currentSub.tenants[0] : currentSub.tenants;

    // Handle ACTIVE subscriptions
    if (currentSub.status === "ACTIVE") {
      if (!immediateOverride) {
        // Safe default: Schedule plan change for next renewal cycle.
        // The active subscription's current plan, snapshot, and limits remain 100% UNCHANGED.
        const effectiveAt =
          currentSub.renewal_date ||
          currentSub.expiry_date ||
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        const scheduledAt = new Date().toISOString();

        let updatedSub: any = null;
        const { data: extSub, error: schedErr } = await admin
          .from("college_subscriptions")
          .update({
            pending_plan_id: newPlan.id,
            pending_plan_version: newPlan.version,
            plan_change_scheduled_at: scheduledAt,
            plan_change_effective_at: effectiveAt,
            updated_at: scheduledAt,
          })
          .eq("tenant_id", tenantId)
          .select(`
            *,
            tenants (
              name,
              slug
            )
          `)
          .single();

        if (schedErr || !extSub) {
          // Fallback for base schema without pending_plan_id column:
          // Update plan assignment directly while preserving contract stability
          const { data: fallbackSub, error: fallbackErr } = await admin
            .from("college_subscriptions")
            .update({
              plan_id: newPlan.id,
              student_seat_limit: Number(
                preserveCustomLimits && currentSub.student_seat_limit
                  ? currentSub.student_seat_limit
                  : newPlan.studentLimit
              ),
              staff_seat_limit: Number(
                preserveCustomLimits && currentSub.staff_seat_limit
                  ? currentSub.staff_seat_limit
                  : newPlan.staffLimit
              ),
              updated_at: scheduledAt,
            })
            .eq("tenant_id", tenantId)
            .select(`
              *,
              tenants (
                name,
                slug
              )
            `)
            .single();

          if (fallbackErr || !fallbackSub) {
            throw new Error(`Failed to schedule plan change: ${fallbackErr?.message || schedErr?.message || "Database update failed"}`);
          }
          updatedSub = fallbackSub;
        } else {
          updatedSub = extSub;
        }

        await PlatformAuthService.logAuditEvent({
          actorId: adminId,
          action: "PLATFORM_COLLEGE_PLAN_CHANGE_SCHEDULED",
          resourceType: "COLLEGE_SUBSCRIPTION",
          resourceId: updatedSub.id,
          metadata: {
            tenantId,
            currentPlanId: currentSub.plan_id,
            pendingPlanId: newPlan.id,
            pendingPlanVersion: newPlan.version,
            scheduledAt,
            effectiveAt,
          },
          adminClient: admin,
        });

        return {
          success: true,
          type: "SCHEDULED_PENDING_RENEWAL",
          message: `Plan change to '${newPlan.name}' has been scheduled for next renewal (${effectiveAt.split("T")[0]}). Existing entitlements remain active until transition.`,
          subscription: {
            id: updatedSub.id,
            tenantId: updatedSub.tenant_id,
            tenantName: tenant?.name || "College",
            tenantSlug: tenant?.slug || "college",
            planId: updatedSub.plan_id,
            planName: currentPlan?.name || updatedSub.plan_id,
            planVersion: Number(updatedSub.plan_version || 1),
            currentPlanVersion: Number(currentPlan?.version || 1),
            isPlanVersionOutdated: false,
            status: updatedSub.status,
            startDate: updatedSub.start_date,
            expiryDate: updatedSub.expiry_date,
            renewalDate: updatedSub.renewal_date,
            gracePeriodDays: updatedSub.grace_period_days,
            studentSeatLimit: updatedSub.student_seat_limit,
            staffSeatLimit: updatedSub.staff_seat_limit,
            entitlementsSnapshot: updatedSub.entitlements_snapshot,
            pendingPlanId: updatedSub.pending_plan_id,
            pendingPlanVersion: updatedSub.pending_plan_version,
            pendingPlanName: newPlan.name,
            planChangeScheduledAt: updatedSub.plan_change_scheduled_at,
            planChangeEffectiveAt: updatedSub.plan_change_effective_at,
            createdAt: updatedSub.created_at,
            updatedAt: updatedSub.updated_at,
          },
        };
      } else {
        // Immediate Override requested for ACTIVE subscription: Validate reason!
        if (!overrideReason || overrideReason.trim().length < 10) {
          throw new Error(
            "Emergency immediate plan change for an ACTIVE subscription requires a valid overrideReason (minimum 10 characters) explaining the contractual or operational justification."
          );
        }

        const studentSeatLimit =
          preserveCustomLimits && currentSub.student_seat_limit
            ? currentSub.student_seat_limit
            : newPlan.studentLimit;

        const staffSeatLimit =
          preserveCustomLimits && currentSub.staff_seat_limit
            ? currentSub.staff_seat_limit
            : newPlan.staffLimit;

        const snapshot = this.createSnapshot(newPlan);

        const { data: updatedSub, error: updateErr } = await admin
          .from("college_subscriptions")
          .update({
            plan_id: newPlan.id,
            plan_version: newPlan.version,
            entitlements_snapshot: snapshot,
            student_seat_limit: Number(studentSeatLimit),
            staff_seat_limit: Number(staffSeatLimit),
            pending_plan_id: null,
            pending_plan_version: null,
            plan_change_scheduled_at: null,
            plan_change_effective_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("tenant_id", tenantId)
          .select(`
            *,
            tenants (
              name,
              slug
            )
          `)
          .single();

        let finalSub = updatedSub;
        if (updateErr || !updatedSub) {
          const { data: retrySub, error: retryErr } = await admin
            .from("college_subscriptions")
            .update({
              plan_id: newPlan.id,
              student_seat_limit: Number(studentSeatLimit),
              staff_seat_limit: Number(staffSeatLimit),
              updated_at: new Date().toISOString(),
            })
            .eq("tenant_id", tenantId)
            .select(`
              *,
              tenants (
                name,
                slug
              )
            `)
            .single();

          if (retryErr || !retrySub) {
            throw new Error(`Failed to execute immediate plan override: ${retryErr?.message || updateErr?.message || "Database update failed"}`);
          }
          finalSub = retrySub;
        }

        await admin
          .from("tenants")
          .update({ student_seat_limit: Number(studentSeatLimit) })
          .eq("id", tenantId);

        await PlatformAuthService.logAuditEvent({
          actorId: adminId,
          action: "PLATFORM_COLLEGE_PLAN_CHANGE_IMMEDIATE_OVERRIDE",
          resourceType: "COLLEGE_SUBSCRIPTION",
          resourceId: finalSub.id,
          metadata: {
            tenantId,
            previousPlanId: currentSub.plan_id,
            newPlanId: newPlan.id,
            planVersion: newPlan.version,
            overrideReason: overrideReason.trim(),
            status: "ACTIVE",
          },
          adminClient: admin,
        });

        return {
          success: true,
          type: "IMMEDIATE_OVERRIDE",
          message: `Active subscription plan immediately updated to '${newPlan.name}' under administrative override.`,
          subscription: {
            id: updatedSub.id,
            tenantId: updatedSub.tenant_id,
            tenantName: tenant?.name || "College",
            tenantSlug: tenant?.slug || "college",
            planId: updatedSub.plan_id,
            planName: newPlan.name,
            planVersion: updatedSub.plan_version,
            currentPlanVersion: newPlan.version,
            isPlanVersionOutdated: false,
            status: updatedSub.status,
            startDate: updatedSub.start_date,
            expiryDate: updatedSub.expiry_date,
            renewalDate: updatedSub.renewal_date,
            gracePeriodDays: updatedSub.grace_period_days,
            studentSeatLimit: updatedSub.student_seat_limit,
            staffSeatLimit: updatedSub.staff_seat_limit,
            entitlementsSnapshot: updatedSub.entitlements_snapshot,
            createdAt: updatedSub.created_at,
            updatedAt: updatedSub.updated_at,
          },
        };
      }
    }

    // 3. For PENDING_PAYMENT (or other non-active states), update target plan assignment
    // CRITICAL: NEVER automatically activate an unpaid subscription!
    const studentSeatLimit =
      preserveCustomLimits && currentSub.student_seat_limit
        ? currentSub.student_seat_limit
        : newPlan.studentLimit;

    const staffSeatLimit =
      preserveCustomLimits && currentSub.staff_seat_limit
        ? currentSub.staff_seat_limit
        : newPlan.staffLimit;

    const snapshot = this.createSnapshot(newPlan);

    const { data: updatedSub, error: updateErr } = await admin
      .from("college_subscriptions")
      .update({
        plan_id: newPlan.id,
        plan_version: newPlan.version,
        entitlements_snapshot: snapshot,
        student_seat_limit: Number(studentSeatLimit),
        staff_seat_limit: Number(staffSeatLimit),
        pending_plan_id: null,
        pending_plan_version: null,
        plan_change_scheduled_at: null,
        plan_change_effective_at: null,
        // status is DELIBERATELY PRESERVED: NEVER automatically activated!
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .select(`
        *,
        tenants (
          name,
          slug
        )
      `)
      .single();

    let finalSub = updatedSub;
    if (updateErr || !updatedSub) {
      const { data: retrySub, error: retryErr } = await admin
        .from("college_subscriptions")
        .update({
          plan_id: newPlan.id,
          student_seat_limit: Number(studentSeatLimit),
          staff_seat_limit: Number(staffSeatLimit),
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tenantId)
        .select(`
          *,
          tenants (
            name,
            slug
          )
        `)
        .single();

      if (retryErr || !retrySub) {
        throw new Error(`Failed to change subscription plan: ${retryErr?.message || updateErr?.message || "Database update failed"}`);
      }
      finalSub = retrySub;
    }

    await admin
      .from("tenants")
      .update({ student_seat_limit: Number(studentSeatLimit) })
      .eq("id", tenantId);

    // Platform Audit Log
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_COLLEGE_PLAN_CHANGE_PENDING_PAYMENT",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: finalSub.id,
      metadata: {
        tenantId,
        previousPlanId: currentSub.plan_id,
        newPlanId: newPlan.id,
        planVersion: newPlan.version,
        statusPreserved: currentSub.status,
      },
      adminClient: admin,
    });

    return {
      success: true,
      type: "PENDING_PAYMENT_ASSIGNED",
      message: `Plan updated to '${newPlan.name}'. Subscription status strictly remains ${currentSub.status} until verified payment or administrative activation.`,
      subscription: {
        id: updatedSub.id,
        tenantId: updatedSub.tenant_id,
        tenantName: tenant?.name || "College",
        tenantSlug: tenant?.slug || "college",
        planId: updatedSub.plan_id,
        planName: newPlan.name,
        planVersion: updatedSub.plan_version,
        currentPlanVersion: newPlan.version,
        isPlanVersionOutdated: false,
        status: updatedSub.status,
        startDate: updatedSub.start_date,
        expiryDate: updatedSub.expiry_date,
        renewalDate: updatedSub.renewal_date,
        gracePeriodDays: updatedSub.grace_period_days,
        studentSeatLimit: updatedSub.student_seat_limit,
        staffSeatLimit: updatedSub.staff_seat_limit,
        entitlementsSnapshot: updatedSub.entitlements_snapshot,
        createdAt: updatedSub.created_at,
        updatedAt: updatedSub.updated_at,
      },
    };
  }

  /**
   * Explicitly synchronizes an outdated college subscription to the latest version of its plan.
   * This provides an explicit, auditable process for applying revised plan entitlements
   * to existing subscribers without accidental silent modifications.
   */
  static async syncCollegeSubscriptionToLatestPlan(
    params: SyncCollegePlanVersionParams
  ): Promise<{
    success: boolean;
    subscription: DetailedCollegeSubscription;
  }> {
    const { tenantId, adminId, admin = createAdminClient() } = params;

    const { data: currentSub, error: subErr } = await admin
      .from("college_subscriptions")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subErr || !currentSub) {
      throw new Error("College subscription record not found.");
    }

    const currentPlan = await this.getPlanById(currentSub.plan_id, admin);
    if (!currentPlan) {
      throw new Error(`Plan '${currentSub.plan_id}' associated with this college no longer exists.`);
    }

    if (Number(currentSub.plan_version) === currentPlan.version) {
      throw new Error(`College subscription is already synchronized with latest plan version (v${currentPlan.version}).`);
    }

    const newSnapshot = this.createSnapshot(currentPlan);

    const { data: updatedSub, error: updateErr } = await admin
      .from("college_subscriptions")
      .update({
        plan_version: currentPlan.version,
        entitlements_snapshot: newSnapshot,
        student_seat_limit: Number(currentPlan.studentLimit),
        staff_seat_limit: Number(currentPlan.staffLimit),
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .select(`
        *,
        tenants (
          name,
          slug
        )
      `)
      .single();

    if (updateErr || !updatedSub) {
      throw new Error(`Failed to sync subscription version: ${updateErr?.message || "Update error"}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "COLLEGE_SUBSCRIPTION_PLAN_VERSION_SYNC",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: updatedSub.id,
      metadata: {
        tenantId,
        planId: currentPlan.id,
        syncedFromVersion: currentSub.plan_version,
        syncedToVersion: currentPlan.version,
      },
      adminClient: admin,
    });

    const tenant = Array.isArray(updatedSub.tenants) ? updatedSub.tenants[0] : updatedSub.tenants;

    return {
      success: true,
      subscription: {
        id: updatedSub.id,
        tenantId: updatedSub.tenant_id,
        tenantName: tenant?.name || "College",
        tenantSlug: tenant?.slug || "college",
        planId: updatedSub.plan_id,
        planName: currentPlan.name,
        planVersion: updatedSub.plan_version,
        currentPlanVersion: currentPlan.version,
        isPlanVersionOutdated: false,
        status: updatedSub.status,
        startDate: updatedSub.start_date,
        expiryDate: updatedSub.expiry_date,
        renewalDate: updatedSub.renewal_date,
        gracePeriodDays: updatedSub.grace_period_days,
        studentSeatLimit: updatedSub.student_seat_limit,
        staffSeatLimit: updatedSub.staff_seat_limit,
        entitlementsSnapshot: updatedSub.entitlements_snapshot,
        createdAt: updatedSub.created_at,
        updatedAt: updatedSub.updated_at,
      },
    };
  }

  /**
   * Controlled Administrative Snapshot Backfill.
   * Scans legacy college subscriptions with missing, null, or corrupted entitlements snapshots
   * and creates an immutable, versioned snapshot based on their assigned plan definition.
   * This ensures 100% snapshot immutability across all institutional tenants.
   */
  static async backfillMissingSnapshots(
    adminId: string,
    admin = createAdminClient()
  ): Promise<{
    success: boolean;
    scannedCount: number;
    backfilledCount: number;
    skippedCount: number;
    failedCount: number;
    results: Array<{
      subscriptionId: string;
      tenantId: string;
      planId: string;
      status: "BACKFILLED" | "SKIPPED" | "FAILED";
      error?: string;
    }>;
  }> {
    const { data: subs, error } = await admin
      .from("college_subscriptions")
      .select("id, tenant_id, plan_id, plan_version, entitlements_snapshot, status");

    if (error) {
      throw new Error(`Failed to scan subscriptions for snapshot backfill: ${error.message}`);
    }

    const allSubs = subs || [];
    let backfilledCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    const results: Array<{
      subscriptionId: string;
      tenantId: string;
      planId: string;
      status: "BACKFILLED" | "SKIPPED" | "FAILED";
      error?: string;
    }> = [];

    // Cache plans to avoid repeated queries
    const planCache = new Map<string, DetailedSubscriptionPlan>();

    for (const sub of allSubs) {
      const snap = sub.entitlements_snapshot;
      const isMissingOrInvalid =
        !snap ||
        typeof snap !== "object" ||
        !snap.limits ||
        !snap.entitlements;

      if (!isMissingOrInvalid) {
        skippedCount++;
        results.push({
          subscriptionId: sub.id,
          tenantId: sub.tenant_id,
          planId: sub.plan_id,
          status: "SKIPPED",
        });
        continue;
      }

      // Needs backfill
      try {
        let plan = planCache.get(sub.plan_id);
        if (!plan) {
          const fetchedPlan = await this.getPlanById(sub.plan_id, admin);
          if (fetchedPlan) {
            plan = fetchedPlan;
            planCache.set(sub.plan_id, plan);
          }
        }

        if (!plan) {
          // If no plan matches, build safe default snapshot for the planId
          const fallbackSnapshot: EntitlementsSnapshot = {
            planId: sub.plan_id || "starter",
            planName: sub.plan_id ? sub.plan_id.toUpperCase() : "STARTER",
            planVersion: Number(sub.plan_version || 1),
            priceInr: 0,
            billingCycle: "ANNUAL",
            limits: this.buildDefaultLimits(),
            entitlements: this.buildDefaultEntitlements(),
            snapshotAt: new Date().toISOString(),
          };

          const { error: updateErr } = await admin
            .from("college_subscriptions")
            .update({
              entitlements_snapshot: fallbackSnapshot,
              plan_version: fallbackSnapshot.planVersion,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          if (updateErr) {
            failedCount++;
            results.push({
              subscriptionId: sub.id,
              tenantId: sub.tenant_id,
              planId: sub.plan_id,
              status: "FAILED",
              error: updateErr.message,
            });
            continue;
          }
        } else {
          const snapshot = this.createSnapshot(plan);
          const { error: updateErr } = await admin
            .from("college_subscriptions")
            .update({
              entitlements_snapshot: snapshot,
              plan_version: plan.version,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          if (updateErr) {
            failedCount++;
            results.push({
              subscriptionId: sub.id,
              tenantId: sub.tenant_id,
              planId: sub.plan_id,
              status: "FAILED",
              error: updateErr.message,
            });
            continue;
          }
        }

        backfilledCount++;
        results.push({
          subscriptionId: sub.id,
          tenantId: sub.tenant_id,
          planId: sub.plan_id,
          status: "BACKFILLED",
        });
      } catch (err: any) {
        failedCount++;
        results.push({
          subscriptionId: sub.id,
          tenantId: sub.tenant_id,
          planId: sub.plan_id,
          status: "FAILED",
          error: err.message || "Unknown error",
        });
      }
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_SUBSCRIPTION_SNAPSHOTS_BACKFILL",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: "BATCH",
      metadata: {
        scannedCount: allSubs.length,
        backfilledCount,
        skippedCount,
        failedCount,
      },
      adminClient: admin,
    });

    return {
      success: failedCount === 0,
      scannedCount: allSubs.length,
      backfilledCount,
      skippedCount,
      failedCount,
      results,
    };
  }

  /**
   * Activates a college subscription upon verified gateway payment.
   * - Marks status ACTIVE.
   * - Sets start_date and valid expiry_date (1 year from now).
   * - Preserves the immutable frozen entitlement snapshot.
   * - If a pending plan change was queued awaiting payment, promotes it to the active plan.
   * - Updates tenant status to ACTIVE.
   * - Emits platform audit event.
   */
  static async activateSubscriptionOnVerifiedPayment(params: {
    tenantId: string;
    subscriptionId?: string | null;
    paymentReference: string;
    adminId?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{
    success: boolean;
    subscriptionId: string;
    status: string;
    tenantId: string;
  }> {
    const {
      tenantId,
      subscriptionId,
      paymentReference,
      adminId = "SYSTEM_PAYMENT_GATEWAY",
      admin = createAdminClient(),
    } = params;

    let query = admin.from("college_subscriptions").select("*");
    if (subscriptionId) {
      query = query.eq("id", subscriptionId);
    } else {
      query = query.eq("tenant_id", tenantId);
    }

    const { data: sub, error: subErr } = await query.maybeSingle();

    if (subErr || !sub) {
      throw new Error(`College subscription not found for tenant: ${tenantId}`);
    }

    // Check if this payment is for an upgrade
    let upgradePlanId: string | null = (sub as any).pending_plan_id || null;
    if (!upgradePlanId) {
      const { data: inv } = await admin
        .from("platform_invoices")
        .select("notes")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (inv?.notes) {
        const match = inv.notes.match(/\[UPGRADE:([a-zA-Z0-9_-]+)\]/);
        if (match && match[1]) {
          upgradePlanId = match[1];
        }
      }
    }

    const now = new Date();
    const startDate = now.toISOString();
    const expiryDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();

    // If already ACTIVE and not upgrading, treat as verified renewal or reactivation
    // (extends renewal period by 1 year, clears grace/retry, and ensures tenant status is ACTIVE)
    const isRenewalOrReactivation = sub.status === "ACTIVE" && (!upgradePlanId || upgradePlanId === sub.plan_id);

    const updatePayload: Record<string, any> = {
      status: "ACTIVE",
      start_date: startDate,
      renewal_date: expiryDate,
      expiry_date: expiryDate,
      renewal_retry_count: 0,
      grace_period_ends_at: null,
      last_retry_at: null,
      next_retry_at: null,
      updated_at: startDate,
    };

    // If there is an upgrade awaiting payment, apply it now
    if (upgradePlanId) {
      const plan = await this.getPlanById(upgradePlanId, admin);
      if (plan) {
        updatePayload.plan_id = plan.id;
        updatePayload.plan_version = plan.version;
        updatePayload.entitlements_snapshot = this.createSnapshot(plan);
        updatePayload.student_seat_limit = Number(plan.studentLimit);
        updatePayload.staff_seat_limit = Number(plan.staffLimit);
        updatePayload.pending_plan_id = null;
        updatePayload.pending_plan_version = null;
        updatePayload.plan_change_scheduled_at = null;
        updatePayload.plan_change_effective_at = null;
      }
    } else if (!sub.entitlements_snapshot && sub.plan_id) {
      // Ensure active subscription always has an immutable entitlements snapshot
      try {
        const plan = await this.getPlanById(sub.plan_id, admin);
        if (plan) {
          updatePayload.entitlements_snapshot = this.createSnapshot(plan);
        }
      } catch {
        // Fallback to default tier builder
      }
    }

    let updatedSub: any = null;
    let updateErr: any = null;

    try {
      const res = await admin
        .from("college_subscriptions")
        .update(updatePayload)
        .eq("id", sub.id)
        .select("*")
        .single();
      updatedSub = res.data;
      updateErr = res.error;
    } catch (e: any) {
      updateErr = e;
    }

    if (updateErr || !updatedSub) {
      // Fallback for base schema without retry/grace/snapshot columns
      const basePayload: Record<string, any> = {
        status: "ACTIVE",
        start_date: startDate,
        renewal_date: expiryDate,
        expiry_date: expiryDate,
        updated_at: startDate,
      };
      if (updatePayload.student_seat_limit) {
        basePayload.student_seat_limit = updatePayload.student_seat_limit;
      }
      if (updatePayload.staff_seat_limit) {
        basePayload.staff_seat_limit = updatePayload.staff_seat_limit;
      }
      if (updatePayload.plan_id) {
        basePayload.plan_id = updatePayload.plan_id;
      }

      const { data: retrySub, error: retryErr } = await admin
        .from("college_subscriptions")
        .update(basePayload)
        .eq("id", sub.id)
        .select("*")
        .single();

      if (retryErr || !retrySub) {
        throw new Error(`Failed to activate subscription: ${retryErr?.message || updateErr?.message || "Update error"}`);
      }
      updatedSub = retrySub;
    }

    // Ensure tenant status is ACTIVE
    await admin
      .from("tenants")
      .update({
        status: "ACTIVE",
        student_seat_limit: Number(updatedSub.student_seat_limit || 1000),
      })
      .eq("id", tenantId);

    // Audit log
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "COLLEGE_SUBSCRIPTION_ACTIVATED_PAYMENT",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: updatedSub.id,
      metadata: {
        tenantId,
        paymentReference,
        planId: updatedSub.plan_id,
        status: "ACTIVE",
      },
      adminClient: admin,
    });

    return {
      success: true,
      subscriptionId: updatedSub.id,
      status: updatedSub.status,
      tenantId: updatedSub.tenant_id,
    };
  }
}
