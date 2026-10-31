import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";

export interface CollegeListItem {
  id: string;
  name: string;
  slug: string;
  primaryDomain: string | null;
  status: "PENDING_SETUP" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
  studentSeatLimit: number;
  officialEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  onboardingStatus: "INVITED" | "PENDING_VERIFICATION" | "COMPLETED" | "ACTION_REQUIRED";
  onboardingToken: string | null;
  onboardingCompletedAt: string | null;
  subscriptionPlan: {
    id: string;
    name: string;
    status: string;
    renewalDate: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export class PlatformCollegeService {
  /**
   * Lists registered college accounts with filters and pagination.
   * STRICT OPTION A: Returns only control-plane institutional metadata.
   */
  static async listColleges(params: {
    search?: string;
    status?: string;
    planId?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ colleges: CollegeListItem[]; total: number }> {
    const { search, status, planId, admin = createAdminClient() } = params;

    let query = admin
      .from("tenants")
      .select(`
        id,
        name,
        slug,
        primary_domain,
        status,
        student_seat_limit,
        official_email,
        contact_name,
        contact_phone,
        onboarding_status,
        onboarding_token,
        onboarding_completed_at,
        created_at,
        updated_at,
        college_subscriptions (
          id,
          plan_id,
          status,
          renewal_date,
          subscription_plans (
            id,
            name
          )
        )
      `)
      .order("created_at", { ascending: false });

    if (status && status !== "ALL") {
      query = query.eq("status", status);
    }

    if (search && search.trim() !== "") {
      const term = `%${search.trim()}%`;
      query = query.or(`name.ilike.${term},slug.ilike.${term},official_email.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list colleges: ${error.message}`);
    }

    let colleges: CollegeListItem[] = (data || []).map((t: any) => {
      const sub = Array.isArray(t.college_subscriptions)
        ? t.college_subscriptions[0]
        : t.college_subscriptions;

      return {
        id: t.id,
        name: t.name,
        slug: t.slug,
        primaryDomain: t.primary_domain,
        status: t.status,
        studentSeatLimit: t.student_seat_limit,
        officialEmail: t.official_email,
        contactName: t.contact_name,
        contactPhone: t.contact_phone,
        onboardingStatus: t.onboarding_status,
        onboardingToken: t.onboarding_token,
        onboardingCompletedAt: t.onboarding_completed_at,
        subscriptionPlan: sub
          ? {
              id: sub.plan_id,
              name:
                (Array.isArray(sub.subscription_plans)
                  ? sub.subscription_plans[0]?.name
                  : (sub.subscription_plans as any)?.name) || sub.plan_id,
              status: sub.status,
              renewalDate: sub.renewal_date,
            }
          : null,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    });

    if (planId && planId !== "ALL") {
      colleges = colleges.filter((c) => c.subscriptionPlan?.id === planId);
    }

    return {
      colleges,
      total: colleges.length,
    };
  }

  /**
   * Retrieves single college platform metadata.
   */
  static async getCollegeById(
    tenantId: string,
    admin = createAdminClient()
  ): Promise<CollegeListItem | null> {
    const { data: t, error } = await admin
      .from("tenants")
      .select(`
        id,
        name,
        slug,
        primary_domain,
        status,
        student_seat_limit,
        official_email,
        contact_name,
        contact_phone,
        onboarding_status,
        onboarding_token,
        onboarding_completed_at,
        created_at,
        updated_at,
        college_subscriptions (
          id,
          plan_id,
          status,
          renewal_date,
          subscription_plans (
            id,
            name
          )
        )
      `)
      .eq("id", tenantId)
      .maybeSingle();

    if (error || !t) return null;

    const sub = Array.isArray(t.college_subscriptions)
      ? t.college_subscriptions[0]
      : t.college_subscriptions;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      primaryDomain: t.primary_domain,
      status: t.status,
      studentSeatLimit: t.student_seat_limit,
      officialEmail: t.official_email,
      contactName: t.contact_name,
      contactPhone: t.contact_phone,
      onboardingStatus: t.onboarding_status,
      onboardingToken: t.onboarding_token,
      onboardingCompletedAt: t.onboarding_completed_at,
      subscriptionPlan: sub
        ? {
            id: sub.plan_id,
            name:
              (Array.isArray(sub.subscription_plans)
                ? sub.subscription_plans[0]?.name
                : (sub.subscription_plans as any)?.name) || sub.plan_id,
            status: sub.status,
            renewalDate: sub.renewal_date,
          }
        : null,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  }

  /**
   * Registers a new College platform account with subscription and onboarding metadata.
   */
  static async registerCollege(params: {
    name: string;
    slug: string;
    officialEmail: string;
    contactName: string;
    contactPhone?: string;
    primaryDomain?: string;
    initialPlanId: string;
    studentSeatLimit?: number;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ college: CollegeListItem; onboardingToken: string }> {
    const {
      name,
      slug,
      officialEmail,
      contactName,
      contactPhone,
      primaryDomain,
      initialPlanId,
      studentSeatLimit = 1000,
      adminId,
      admin = createAdminClient(),
    } = params;

    // 1. Validate slug uniqueness
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { data: existing } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (existing) {
      throw new Error(`Institutional identifier (slug) '${cleanSlug}' is already taken.`);
    }

    // 2. Generate secure onboarding token
    const onboardingToken = `onb_${cleanSlug}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // 3. Create Tenant
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        official_email: officialEmail.trim().toLowerCase(),
        contact_name: contactName.trim(),
        contact_phone: contactPhone?.trim() || null,
        primary_domain: primaryDomain?.trim().toLowerCase() || null,
        status: "ACTIVE",
        student_seat_limit: Number(studentSeatLimit),
        onboarding_status: "INVITED",
        onboarding_token: onboardingToken,
      })
      .select()
      .single();

    if (tenantErr || !tenant) {
      throw new Error(`Failed to create college: ${tenantErr?.message || "Unknown error"}`);
    }

    // 4. Create Initial Subscription
    const planId = initialPlanId || "growth";
    const { data: subscription, error: subErr } = await admin
      .from("college_subscriptions")
      .insert({
        tenant_id: tenant.id,
        plan_id: planId,
        status: "ACTIVE",
        student_seat_limit: Number(studentSeatLimit),
        staff_seat_limit: planId === "enterprise" ? 100 : planId === "growth" ? 25 : 5,
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    // 5. Generate Initial Billing Invoice
    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const planPrice = planId === "enterprise" ? 249999 : planId === "growth" ? 129999 : 49999;
    const taxPrice = Number((planPrice * 0.18).toFixed(2));

    await admin.from("platform_invoices").insert({
      invoice_number: invoiceNumber,
      tenant_id: tenant.id,
      subscription_id: subscription?.id || null,
      amount_inr: planPrice,
      tax_inr: taxPrice,
      currency: "INR",
      status: "PENDING",
      issue_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      payment_method: "BANK_TRANSFER",
      is_demo: false,
      notes: `Initial registration invoice for ${tenant.name}`,
    });

    // 6. Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_COLLEGE_REGISTER",
      resourceType: "TENANT",
      resourceId: tenant.id,
      metadata: {
        collegeName: tenant.name,
        slug: tenant.slug,
        officialEmail: tenant.official_email,
        planId,
      },
      adminClient: admin,
    });

    return {
      college: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        primaryDomain: tenant.primary_domain,
        status: tenant.status,
        studentSeatLimit: tenant.student_seat_limit,
        officialEmail: tenant.official_email,
        contactName: tenant.contact_name,
        contactPhone: tenant.contact_phone,
        onboardingStatus: tenant.onboarding_status,
        onboardingToken: tenant.onboarding_token,
        onboardingCompletedAt: tenant.onboarding_completed_at,
        subscriptionPlan: {
          id: planId,
          name: planId === "enterprise" ? "University Enterprise" : planId === "growth" ? "Campus Growth" : "Institutional Starter",
          status: "ACTIVE",
          renewalDate: subscription?.renewal_date || new Date().toISOString(),
        },
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
      },
      onboardingToken,
    };
  }

  /**
   * Updates college operational status: ACTIVE, SUSPENDED, or ARCHIVED.
   * Suspension automatically restricts institutional logins and student workspaces.
   */
  static async updateCollegeStatus(params: {
    tenantId: string;
    status: "ACTIVE" | "SUSPENDED" | "ARCHIVED";
    reason?: string;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; status: string }> {
    const { tenantId, status, reason, adminId, admin = createAdminClient() } = params;

    const { data: tenant, error } = await admin
      .from("tenants")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId)
      .select("id, name, status")
      .single();

    if (error || !tenant) {
      throw new Error(`Failed to update college status: ${error?.message || "College not found"}`);
    }

    // Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: status === "SUSPENDED" ? "PLATFORM_COLLEGE_SUSPEND" : "PLATFORM_COLLEGE_ACTIVATE",
      resourceType: "TENANT",
      resourceId: tenantId,
      metadata: {
        collegeName: tenant.name,
        newStatus: status,
        reason: reason || "Administrative action",
      },
      adminClient: admin,
    });

    return {
      success: true,
      status: tenant.status,
    };
  }
}
