import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";

export interface SubscriptionPlanItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceInr: number;
  billingCycle: "MONTHLY" | "ANNUAL";
  studentLimit: number;
  staffLimit: number;
  storageLimitGb: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CollegeSubscriptionItem {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  planId: string;
  planName: string;
  status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
  startDate: string;
  expiryDate: string;
  renewalDate: string;
  gracePeriodDays: number;
  studentSeatLimit: number;
  staffSeatLimit: number;
  createdAt: string;
  updatedAt: string;
}

export class PlatformSubscriptionService {
  /**
   * Lists all platform subscription plans.
   */
  static async listPlans(admin = createAdminClient()): Promise<SubscriptionPlanItem[]> {
    const { data, error } = await admin
      .from("subscription_plans")
      .select("*")
      .order("price_inr", { ascending: true });

    if (error) {
      throw new Error(`Failed to list plans: ${error.message}`);
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      priceInr: Number(p.price_inr),
      billingCycle: p.billing_cycle,
      studentLimit: p.student_limit,
      staffLimit: p.staff_limit,
      storageLimitGb: p.storage_limit_gb,
      features: Array.isArray(p.features) ? p.features : [],
      isActive: p.is_active,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  /**
   * Creates or updates a subscription plan.
   */
  static async upsertPlan(params: {
    id: string;
    name: string;
    slug: string;
    description?: string;
    priceInr: number;
    billingCycle?: "MONTHLY" | "ANNUAL";
    studentLimit: number;
    staffLimit: number;
    storageLimitGb: number;
    features: string[];
    isActive?: boolean;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<SubscriptionPlanItem> {
    const {
      id,
      name,
      slug,
      description,
      priceInr,
      billingCycle = "ANNUAL",
      studentLimit,
      staffLimit,
      storageLimitGb,
      features,
      isActive = true,
      adminId,
      admin = createAdminClient(),
    } = params;

    const { data, error } = await admin
      .from("subscription_plans")
      .upsert({
        id,
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        description: description?.trim() || null,
        price_inr: Number(priceInr),
        billing_cycle: billingCycle,
        student_limit: Number(studentLimit),
        staff_limit: Number(staffLimit),
        storage_limit_gb: Number(storageLimitGb),
        features,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to save plan: ${error?.message || "Unknown error"}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_PLAN_UPSERT",
      resourceType: "SUBSCRIPTION_PLAN",
      resourceId: data.id,
      metadata: { planName: data.name, priceInr: data.price_inr },
      adminClient: admin,
    });

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      priceInr: Number(data.price_inr),
      billingCycle: data.billing_cycle,
      studentLimit: data.student_limit,
      staffLimit: data.staff_limit,
      storageLimitGb: data.storage_limit_gb,
      features: Array.isArray(data.features) ? data.features : [],
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Lists college subscriptions with institutional names and plan details.
   */
  static async listCollegeSubscriptions(params: {
    status?: string;
    planId?: string;
    admin?: ReturnType<typeof createAdminClient>;
  } = {}): Promise<CollegeSubscriptionItem[]> {
    const { status, planId, admin = createAdminClient() } = params;

    let query = admin
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
      query = query.eq("status", status);
    }
    if (planId && planId !== "ALL") {
      query = query.eq("plan_id", planId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list college subscriptions: ${error.message}`);
    }

    return (data || []).map((cs: any) => ({
      id: cs.id,
      tenantId: cs.tenant_id,
      tenantName: cs.tenants?.name || "Unknown College",
      tenantSlug: cs.tenants?.slug || "unknown",
      planId: cs.plan_id,
      planName: cs.subscription_plans?.name || cs.plan_id,
      status: cs.status,
      startDate: cs.start_date,
      expiryDate: cs.expiry_date,
      renewalDate: cs.renewal_date,
      gracePeriodDays: cs.grace_period_days,
      studentSeatLimit: cs.student_seat_limit,
      staffSeatLimit: cs.staff_seat_limit,
      createdAt: cs.created_at,
      updatedAt: cs.updated_at,
    }));
  }

  /**
   * Updates an existing college subscription plan, status, or seat limits.
   */
  static async updateCollegeSubscription(params: {
    tenantId: string;
    planId?: string;
    status?: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
    studentSeatLimit?: number;
    staffSeatLimit?: number;
    renewalDate?: string;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; subscription: any }> {
    const {
      tenantId,
      planId,
      status,
      studentSeatLimit,
      staffSeatLimit,
      renewalDate,
      adminId,
      admin = createAdminClient(),
    } = params;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (planId) updates.plan_id = planId;
    if (status) updates.status = status;
    if (studentSeatLimit) updates.student_seat_limit = Number(studentSeatLimit);
    if (staffSeatLimit) updates.staff_seat_limit = Number(staffSeatLimit);
    if (renewalDate) updates.renewal_date = renewalDate;

    const { data, error } = await admin
      .from("college_subscriptions")
      .update(updates)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to update subscription: ${error?.message || "Subscription not found"}`);
    }

    // Also update tenant seat limit if provided
    if (studentSeatLimit) {
      await admin
        .from("tenants")
        .update({ student_seat_limit: Number(studentSeatLimit) })
        .eq("id", tenantId);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_SUBSCRIPTION_UPDATE",
      resourceType: "COLLEGE_SUBSCRIPTION",
      resourceId: data.id,
      metadata: { tenantId, updates },
      adminClient: admin,
    });

    return {
      success: true,
      subscription: data,
    };
  }
}
