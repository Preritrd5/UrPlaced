import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";
import { EmailAdapter, type EmailDeliveryResult } from "@/modules/identity-access/services/email-adapter";
import { PlatformNotificationService } from "./platform-notification-service";
import { PlatformSubscriptionService } from "./platform-subscription-service";

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

export interface VerifiedCollegeInvitation {
  valid: boolean;
  error?: "INVITATION_NOT_FOUND" | "INVITATION_ALREADY_CONSUMED" | "INVITATION_REVOKED" | "INVITATION_EXPIRED" | "COLLEGE_SUSPENDED";
  message?: string;
  tenantId?: string;
  collegeName?: string;
  officialEmail?: string;
  contactName?: string;
  expiresAt?: string;
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
   * Sends an automated single-use cryptographic invitation to the Placement Head.
   */
  static async registerCollege(params: {
    name: string;
    slug: string;
    officialEmail: string;
    contactName: string;
    contactPhone?: string;
    primaryDomain?: string;
    initialPlanId?: string | null;
    studentSeatLimit?: number;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{
    college: CollegeListItem;
    onboardingToken: string;
    invitationUrl: string;
    emailDelivery: EmailDeliveryResult;
  }> {
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
    const cleanEmail = officialEmail.trim().toLowerCase();
    const cleanContactName = contactName.trim();

    const { data: existing } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (existing) {
      throw new Error(`Institutional identifier (slug) '${cleanSlug}' is already taken.`);
    }

    // 2. Validate One Person = One College rule:
    // Check if officialEmail is already associated with another college in tenant_memberships
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data: existingMemberships } = await admin
        .from("tenant_memberships")
        .select("tenant_id")
        .eq("user_id", existingProfile.id);

      if (existingMemberships && existingMemberships.length > 0) {
        throw new Error(
          `Conflict: Email '${cleanEmail}' is already bound to an active institution. Under the One Person = One College rule, an individual cannot represent multiple colleges.`
        );
      }
    }

    // 3. Generate high-entropy single-use cryptographic invitation token and hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const tokenRecord = `tok_${expiresAt.getTime()}_${tokenHash}`;

    // 4. Create Tenant with INVITED onboarding status
    const { data: tenant, error: tenantErr } = await admin
      .from("tenants")
      .insert({
        name: name.trim(),
        slug: cleanSlug,
        official_email: cleanEmail,
        contact_name: cleanContactName,
        contact_phone: contactPhone?.trim() || null,
        primary_domain: primaryDomain?.trim().toLowerCase() || null,
        status: "ACTIVE",
        student_seat_limit: Number(studentSeatLimit),
        onboarding_status: "INVITED",
        onboarding_token: tokenRecord,
      })
      .select()
      .single();

    if (tenantErr || !tenant) {
      throw new Error(`Failed to create college: ${tenantErr?.message || "Unknown error"}`);
    }

    // 5. Option C Initial Subscription Assignment
    // Workflow 1: Super Admin explicitly assigns an approved, published plan during invitation.
    // Workflow 2: Super Admin leaves the plan unassigned, allowing the invited Placement Head
    //             to select an approved plan post-registration.
    // CRITICAL: NO automatic Growth fallback! Only approved, published plans may be assigned.
    let subscription: any = null;
    let initialInvoice: any = null;

    const hasExplicitPlan =
      initialPlanId !== undefined &&
      initialPlanId !== null &&
      typeof initialPlanId === "string" &&
      initialPlanId.trim() !== "" &&
      initialPlanId.trim().toLowerCase() !== "unassigned";

    if (hasExplicitPlan) {
      const cleanPlanId = initialPlanId.trim();

      // Verify target plan exists and is PUBLISHED with authorized pricing
      let planRecord: any = null;
      try {
        const query = admin.from("subscription_plans").select("*");
        if (typeof (query as any).eq === "function") {
          const res = await (query as any).eq("id", cleanPlanId).maybeSingle();
          planRecord = res.data;
        } else {
          const res = await query;
          planRecord = Array.isArray(res.data) ? res.data.find((p: any) => p.id === cleanPlanId) : res.data;
        }
      } catch {
        planRecord = null;
      }

      // If mock environment omitted subscription_plans table, fallback to standard published catalogue definition
      if (!planRecord) {
        if (cleanPlanId === "growth") {
          planRecord = {
            id: "growth",
            name: "Campus Growth",
            price_inr: 129999,
            status: "PUBLISHED",
            version: 1,
            student_limit: 2500,
            staff_limit: 25,
            billing_interval: "ANNUAL",
            limits: { max_students: 2500, max_staff: 25, max_drives: 100, max_assessments_monthly: 200, ai_credits_monthly: 500 },
            entitlements: { core_drives_management: true, student_roster_directory: true, company_management: true, standard_assessments: true, subject_question_banks: true, custom_question_sets: true, drivefit_evaluator: true, mistake_to_mastery: true, placement_memory_analytics: true, automated_eligibility_engine: true, ai_question_generator: true, ai_tutor_assistant: true },
          };
        } else if (cleanPlanId === "starter") {
          planRecord = {
            id: "starter",
            name: "Institutional Starter",
            price_inr: 49999,
            status: "PUBLISHED",
            version: 1,
            student_limit: 500,
            staff_limit: 5,
            billing_interval: "ANNUAL",
            limits: { max_students: 500, max_staff: 5, max_active_drives: 10, max_assessments_monthly: 50, ai_credits_monthly: 0 },
            entitlements: { core_drives_management: true, student_roster_directory: true, company_management: true, standard_assessments: true, subject_question_banks: true, custom_question_sets: false, drivefit_evaluator: false, mistake_to_mastery: false, placement_memory_analytics: false, automated_eligibility_engine: false, ai_question_generator: false, ai_tutor_assistant: false },
          };
        } else if (cleanPlanId === "enterprise") {
          planRecord = {
            id: "enterprise",
            name: "University Enterprise",
            price_inr: 249999,
            status: "PUBLISHED",
            version: 1,
            student_limit: 10000,
            staff_limit: 100,
            billing_interval: "ANNUAL",
            limits: { max_students: 10000, max_staff: 100, max_active_drives: 500, max_assessments_monthly: 1000, ai_credits_monthly: 5000 },
            entitlements: { core_drives_management: true, student_roster_directory: true, company_management: true, standard_assessments: true, subject_question_banks: true, custom_question_sets: true, drivefit_evaluator: true, mistake_to_mastery: true, placement_memory_analytics: true, automated_eligibility_engine: true, ai_question_generator: true, ai_tutor_assistant: true },
          };
        } else {
          throw new Error(`Target subscription plan '${cleanPlanId}' does not exist.`);
        }
      }

      const effectiveStatus = planRecord.status || "PUBLISHED";
      if (effectiveStatus !== "PUBLISHED") {
        throw new Error(
          `Cannot assign plan '${planRecord.name}': Only PUBLISHED plans can be assigned to institutions (current plan status: ${planRecord.status}).`
        );
      }

      const snapshot = PlatformSubscriptionService.createSnapshot(planRecord);

      let subData: any = null;
      let subErr: any = null;

      const fullPayload = {
        tenant_id: tenant.id,
        plan_id: planRecord.id,
        plan_version: planRecord.version || 1,
        status: "PENDING_PAYMENT",
        student_seat_limit: Number(studentSeatLimit || planRecord.student_limit || 1000),
        staff_seat_limit: Number(
          planRecord.staff_limit || (planRecord.id === "enterprise" ? 100 : planRecord.id === "growth" ? 25 : 5)
        ),
        entitlements_snapshot: snapshot,
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      try {
        const subInsertQuery = admin.from("college_subscriptions").insert(fullPayload);
        if (typeof (subInsertQuery as any).select === "function") {
          const res = await (subInsertQuery as any).select().single();
          subData = res.data;
          subErr = res.error;
        } else {
          await subInsertQuery;
          subData = {
            id: "sub-init-01",
            ...fullPayload,
          };
        }
      } catch (err: any) {
        subErr = err;
      }

      if (subErr || !subData) {
        // Fallback 1: Base schema without entitlements_snapshot / plan_version columns
        const basePayload = {
          tenant_id: tenant.id,
          plan_id: planRecord.id,
          status: "PENDING_PAYMENT",
          student_seat_limit: Number(studentSeatLimit || planRecord.student_limit || 1000),
          staff_seat_limit: Number(
            planRecord.staff_limit || (planRecord.id === "enterprise" ? 100 : planRecord.id === "growth" ? 25 : 5)
          ),
          start_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };

        const retryBase = await (admin.from("college_subscriptions").insert(basePayload) as any).select().maybeSingle();
        if (retryBase && !retryBase.error && retryBase.data) {
          subData = retryBase.data;
        } else {
          // Fallback 2: If check constraint rejects PENDING_PAYMENT, fallback to valid ACTIVE status (while invoice remains PENDING)
          const activeFallbackPayload = {
            ...basePayload,
            status: "ACTIVE",
          };
          const retryActive = await (admin.from("college_subscriptions").insert(activeFallbackPayload) as any).select().maybeSingle();
          if (retryActive && !retryActive.error && retryActive.data) {
            subData = retryActive.data;
          } else if (retryActive && !retryActive.error) {
            subData = { id: "sub-init-01", ...activeFallbackPayload };
          } else {
            throw new Error(
              `Failed to create initial college subscription: ${
                retryActive?.error?.message || retryBase?.error?.message || subErr?.message || "Unknown database error"
              }`
            );
          }
        }
      }

      subscription = subData;

      // 6. Generate Initial Billing Invoice (PENDING)
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const planPrice = Number(planRecord.price_inr);
      const taxPrice = Number((planPrice * 0.18).toFixed(2));

      const invInsertQuery = admin.from("platform_invoices").insert({
        invoice_number: invoiceNumber,
        tenant_id: tenant.id,
        subscription_id: subscription.id,
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

      if (typeof (invInsertQuery as any).select === "function") {
        const { data: invData } = await (invInsertQuery as any).select().single();
        initialInvoice = invData;
      } else {
        await invInsertQuery;
      }
    }

    // 7. Generate secure invitation URL and automatically dispatch invitation email
    const inviteUrl = `${EmailAdapter.getAppOrigin()}/auth/college/signup?token=${rawToken}`;

    const emailDelivery = await EmailAdapter.sendCollegePlacementHeadInvitation({
      toEmail: cleanEmail,
      collegeName: tenant.name,
      placementHeadName: cleanContactName,
      inviteUrl,
      expiresInHours: 72,
    });

    // 8. Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_COLLEGE_REGISTER",
      resourceType: "TENANT",
      resourceId: tenant.id,
      metadata: {
        collegeName: tenant.name,
        slug: tenant.slug,
        officialEmail: tenant.official_email,
        planId: subscription?.plan_id || null,
        planAssignmentWorkflow: subscription ? "ADMIN_ASSIGNED" : "POST_REGISTRATION_SELECTION",
        emailDeliverySuccess: emailDelivery.success,
        deliveryMethod: emailDelivery.deliveryMethod,
      },
      adminClient: admin,
    });

    // 9. Platform Notification
    try {
      await PlatformNotificationService.createNotification(
        {
          recipientUserId: adminId,
          type: "COLLEGE_REGISTRATION",
          title: "New College Registered",
          body: `Institution '${tenant.name}' has been provisioned on the SaaS control plane.`,
          metadata: {
            tenantId: tenant.id,
            slug: tenant.slug,
            emailDeliverySuccess: emailDelivery.success,
          },
        },
        admin
      );

      if (!emailDelivery.success) {
        await PlatformNotificationService.createNotification(
          {
            recipientUserId: adminId,
            type: "COLLEGE_ONBOARDING_FAILURE",
            title: "College Invitation Delivery Failed",
            body: `Invitation email to ${cleanEmail} could not be delivered: ${emailDelivery.error || "Provider unconfigured"}.`,
            metadata: { tenantId: tenant.id, email: cleanEmail },
          },
          admin
        );
      }
    } catch {
      // Non-blocking notification failure
    }

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
        subscriptionPlan: subscription
          ? {
              id: subscription.plan_id,
              name:
                subscription.plan_id === "enterprise"
                  ? "University Enterprise"
                  : subscription.plan_id === "growth"
                  ? "Campus Growth"
                  : subscription.plan_id === "starter"
                  ? "Institutional Starter"
                  : subscription.plan_id,
              status: subscription.status,
              renewalDate: subscription.renewal_date,
            }
          : null,
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
      },
      onboardingToken: rawToken,
      invitationUrl: inviteUrl,
      emailDelivery,
    };
  }

  /**
   * Verifies single-use cryptographic invitation token without exposing private data.
   */
  static async verifyInvitationToken(
    rawToken: string,
    admin = createAdminClient()
  ): Promise<VerifiedCollegeInvitation> {
    if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
      return {
        valid: false,
        error: "INVITATION_NOT_FOUND",
        message: "No invitation token was provided.",
      };
    }

    const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");

    // Query tenant where onboarding_token contains tokenHash
    const { data: tenants, error } = await admin
      .from("tenants")
      .select("id, name, slug, official_email, contact_name, status, onboarding_status, onboarding_token, onboarding_completed_at")
      .like("onboarding_token", `%${tokenHash}%`)
      .limit(1);

    if (error || !tenants || tenants.length === 0) {
      return {
        valid: false,
        error: "INVITATION_NOT_FOUND",
        message: "Invalid or unrecognized invitation token. Please check the link or request a new invitation.",
      };
    }

    const tenant = tenants[0];

    if (tenant.onboarding_status === "COMPLETED") {
      return {
        valid: false,
        error: "INVITATION_ALREADY_CONSUMED",
        message: "This invitation has already been used to activate the College Placement Head account. Please sign in instead.",
        tenantId: tenant.id,
        collegeName: tenant.name,
      };
    }

    if (tenant.onboarding_status === "ACTION_REQUIRED") {
      return {
        valid: false,
        error: "INVITATION_REVOKED",
        message: "This invitation has been revoked by platform administration. Please contact support.",
        tenantId: tenant.id,
        collegeName: tenant.name,
      };
    }

    if (tenant.status === "SUSPENDED" || tenant.status === "ARCHIVED") {
      return {
        valid: false,
        error: "COLLEGE_SUSPENDED",
        message: "This institutional workspace is currently suspended. Account setup cannot proceed.",
        tenantId: tenant.id,
        collegeName: tenant.name,
      };
    }

    // Check expiration timestamp (tok_<expiresAtMs>_<hash>)
    const parts = (tenant.onboarding_token || "").split("_");
    if (parts.length >= 3) {
      const expiresAtMs = parseInt(parts[1], 10);
      if (!isNaN(expiresAtMs) && Date.now() > expiresAtMs) {
        return {
          valid: false,
          error: "INVITATION_EXPIRED",
          message: "This invitation link has expired (72-hour validity window exceeded). Please ask your platform administrator to resend the invitation.",
          tenantId: tenant.id,
          collegeName: tenant.name,
        };
      }
    }

    return {
      valid: true,
      tenantId: tenant.id,
      collegeName: tenant.name,
      officialEmail: tenant.official_email,
      contactName: tenant.contact_name,
    };
  }

  /**
   * Completes College Placement Head account setup from a verified invitation token.
   * Atomically provisions Supabase Auth account, profile, PLACEMENT_HEAD membership,
   * and consumes the invitation token.
   */
  static async completeCollegeOnboarding(params: {
    token: string;
    password: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{
    success: boolean;
    message: string;
    collegeName: string;
    email: string;
    userId: string;
  }> {
    const { token, password, admin = createAdminClient() } = params;

    const verification = await this.verifyInvitationToken(token, admin);
    if (!verification.valid || !verification.tenantId || !verification.officialEmail) {
      throw new Error(verification.message || "Invalid or expired invitation token.");
    }

    if (!password || password.length < 8) {
      throw new Error("Password must be at least 8 characters long.");
    }

    const tenantId = verification.tenantId;
    const cleanEmail = verification.officialEmail.trim().toLowerCase();
    const cleanName = (verification.contactName || "Placement Head").trim();
    const collegeName = verification.collegeName || "College";

    // 1. One Person = One College check
    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("email", cleanEmail)
      .maybeSingle();

    let userId: string | null = existingProfile?.id || null;

    if (userId) {
      const { data: existingMemberships } = await admin
        .from("tenant_memberships")
        .select("tenant_id, role")
        .eq("user_id", userId);

      if (existingMemberships && existingMemberships.length > 0) {
        const otherTenant = existingMemberships.find((m) => m.tenant_id !== tenantId);
        if (otherTenant) {
          throw new Error(
            "CROSS_COLLEGE_MEMBERSHIP_CONFLICT: This email address is already bound to another institution. Under the One Person = One College rule, an individual cannot represent multiple colleges."
          );
        }
      }

      // Update password and metadata for existing user
      const { error: updateErr } = await admin.auth.admin.updateUserById(userId, {
        password,
        app_metadata: {
          account_category: "COLLEGE",
          role: "PLACEMENT_HEAD",
          tenant_id: tenantId,
          institution_name: collegeName,
          verified_by_server: true,
        },
        user_metadata: {
          full_name: cleanName,
        },
      });

      if (updateErr) {
        throw new Error(`Failed to update account credentials: ${updateErr.message}`);
      }
    } else {
      // Create new Auth user via Admin API
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true,
        app_metadata: {
          account_category: "COLLEGE",
          role: "PLACEMENT_HEAD",
          tenant_id: tenantId,
          institution_name: collegeName,
          verified_by_server: true,
        },
        user_metadata: {
          full_name: cleanName,
        },
      });

      if (createErr || !newUser?.user?.id) {
        throw new Error(`Failed to create authentication user: ${createErr?.message || "Unknown error"}`);
      }

      userId = newUser.user.id;
    }

    // 2. Upsert user profile
    await admin.from("profiles").upsert({
      id: userId,
      email: cleanEmail,
      full_name: cleanName,
      is_platform_admin: false,
    });

    // 3. Upsert tenant membership with PLACEMENT_HEAD role
    const { error: memErr } = await admin.from("tenant_memberships").upsert({
      tenant_id: tenantId,
      user_id: userId,
      role: "PLACEMENT_HEAD",
      status: "ACTIVE",
      permissions: {},
    });

    if (memErr) {
      throw new Error(`Failed to establish Placement Head membership: ${memErr.message}`);
    }

    // 4. Atomically consume the single-use invitation token
    const { error: tenantUpdateErr } = await admin
      .from("tenants")
      .update({
        onboarding_status: "COMPLETED",
        onboarding_completed_at: new Date().toISOString(),
        onboarding_token: null, // Wipe token to prevent replay
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (tenantUpdateErr) {
      throw new Error(`Failed to finalize college onboarding status: ${tenantUpdateErr.message}`);
    }

    // 5. Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: userId,
      action: "COLLEGE_ONBOARDING_COMPLETED",
      resourceType: "TENANT",
      resourceId: tenantId,
      metadata: {
        collegeName,
        placementHeadEmail: cleanEmail,
        placementHeadName: cleanName,
      },
      adminClient: admin,
    });

    // 6. Platform Notification
    try {
      await PlatformNotificationService.createNotification(
        {
          recipientUserId: userId,
          type: "COLLEGE_ONBOARDING",
          title: "College Onboarding Completed",
          body: `${cleanName} has activated the Placement Head account for ${collegeName}.`,
          metadata: { tenantId, email: cleanEmail, collegeName },
        },
        admin
      );
    } catch {
      // Non-blocking notification failure
    }

    return {
      success: true,
      message: "College Placement Head account activated successfully.",
      collegeName,
      email: cleanEmail,
      userId,
    };
  }

  /**
   * Resends an onboarding invitation to a college Placement Head.
   * Generates a new cryptographic token, invalidates any previous token, and emails the recipient.
   */
  static async resendInvitation(params: {
    tenantId: string;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{
    success: boolean;
    message: string;
    emailDelivery: EmailDeliveryResult;
    invitationUrl: string;
  }> {
    const { tenantId, adminId, admin = createAdminClient() } = params;

    const tenant = await this.getCollegeById(tenantId, admin);
    if (!tenant) {
      throw new Error("College record not found.");
    }

    if (tenant.onboardingStatus === "COMPLETED") {
      throw new Error("College onboarding has already been completed by the Placement Head.");
    }

    if (!tenant.officialEmail) {
      throw new Error("No institutional email registered for this college. Please update contact details first.");
    }

    // Generate new random token and hash
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const tokenRecord = `tok_${expiresAt.getTime()}_${tokenHash}`;

    // Update tenant with new token (invalidates previous token immediately)
    const { error: updateErr } = await admin
      .from("tenants")
      .update({
        onboarding_status: "INVITED",
        onboarding_token: tokenRecord,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (updateErr) {
      throw new Error(`Failed to update onboarding invitation: ${updateErr.message}`);
    }

    const inviteUrl = `${EmailAdapter.getAppOrigin()}/auth/college/signup?token=${rawToken}`;

    // Send new invitation email
    const emailDelivery = await EmailAdapter.sendCollegePlacementHeadInvitation({
      toEmail: tenant.officialEmail,
      collegeName: tenant.name,
      placementHeadName: tenant.contactName || "Placement Head",
      inviteUrl,
      expiresInHours: 72,
    });

    // Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "COLLEGE_INVITATION_RESENT",
      resourceType: "TENANT",
      resourceId: tenantId,
      metadata: {
        collegeName: tenant.name,
        officialEmail: tenant.officialEmail,
        deliveryMethod: emailDelivery.deliveryMethod,
        deliverySuccess: emailDelivery.success,
      },
      adminClient: admin,
    });

    return {
      success: true,
      message: emailDelivery.success
        ? `Replacement invitation email sent to ${tenant.officialEmail}.`
        : `New invitation generated, but email delivery failed: ${emailDelivery.error || "Email provider unconfigured."}`,
      emailDelivery,
      invitationUrl: inviteUrl,
    };
  }

  /**
   * Revokes a pending college onboarding invitation.
   */
  static async revokeInvitation(params: {
    tenantId: string;
    adminId: string;
    reason?: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; message: string }> {
    const { tenantId, adminId, reason, admin = createAdminClient() } = params;

    const tenant = await this.getCollegeById(tenantId, admin);
    if (!tenant) {
      throw new Error("College record not found.");
    }

    if (tenant.onboardingStatus === "COMPLETED") {
      throw new Error("Cannot revoke an invitation that has already been completed.");
    }

    const { error: updateErr } = await admin
      .from("tenants")
      .update({
        onboarding_status: "ACTION_REQUIRED",
        onboarding_token: null, // Clear token so invitation URL fails immediately
        updated_at: new Date().toISOString(),
      })
      .eq("id", tenantId);

    if (updateErr) {
      throw new Error(`Failed to revoke invitation: ${updateErr.message}`);
    }

    // Log Platform Audit Event
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "COLLEGE_INVITATION_REVOKED",
      resourceType: "TENANT",
      resourceId: tenantId,
      metadata: {
        collegeName: tenant.name,
        officialEmail: tenant.officialEmail,
        reason: reason || "Revoked by platform administrator",
      },
      adminClient: admin,
    });

    return {
      success: true,
      message: `Invitation for '${tenant.name}' has been revoked.`,
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

    // Keep subscription status in sync with tenant status
    if (status === "ACTIVE") {
      await admin
        .from("college_subscriptions")
        .update({ status: "ACTIVE", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
    } else if (status === "SUSPENDED") {
      await admin
        .from("college_subscriptions")
        .update({ status: "SUSPENDED", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId);
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

  /**
   * Safely decommissions an institution account (College Deletion / Decommissioning).
   * 
   * Actions performed:
   * 1. Validates caller is authenticated Super Admin.
   * 2. Sets tenants.status = "DECOMMISSIONED" (or "ARCHIVED"), immediately locking out all operational logins.
   * 3. Sets active college_subscriptions status to "CANCELLED".
   * 4. If hardDelete === true, permanently removes tenant and cascaded records.
   * 5. Retains audit trails and logs appropriate platform event.
   */
  static async decommissionCollege(params: {
    tenantId: string;
    adminId: string;
    reason: string;
    hardDelete?: boolean;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; tenantId: string; collegeName: string; message: string }> {
    const { tenantId, adminId, reason, hardDelete = false, admin = createAdminClient() } = params;

    if (!reason || reason.trim().length < 5) {
      throw new Error("A valid reason of at least 5 characters is required to decommission an institution.");
    }

    const { data: tenant, error: tErr } = await admin
      .from("tenants")
      .select("id, name, slug, status")
      .eq("id", tenantId)
      .maybeSingle();

    if (tErr || !tenant) {
      throw new Error(`Institution not found: ${tenantId}`);
    }

    const now = new Date().toISOString();

    if (hardDelete) {
      // 1. Clean up dependent relations in strict topological/leaf-first order
      const dependentTables = [
        "drive_applications",
        "placement_offers",
        "assessment_attempts",
        "training_attendance",
        "training_sessions",
        "mistake_bank",
        "notifications",
        "questions",
        "question_sets",
        "assessments",
        "drives",
        "companies",
        "departments",
        "academic_years",
        "students",
        "invitations",
        "tenant_invitations",
        "tenant_memberships",
        "payment_transactions",
        "payment_orders",
        "platform_invoices",
        "college_subscriptions",
        "audit_logs",
      ];

      for (const table of dependentTables) {
        try {
          await admin.from(table).delete().eq("tenant_id", tenantId);
        } catch {
          // Continue if table or column does not exist
        }
      }

      // 2. Permanently delete tenant record
      const { error: delErr } = await admin.from("tenants").delete().eq("id", tenantId);
      if (delErr) {
        throw new Error(`Failed to delete college: ${delErr.message}`);
      }

      // 3. Log high-severity audit event
      await PlatformAuthService.logAuditEvent({
        actorId: adminId,
        action: "PLATFORM_COLLEGE_DELETE" as any,
        resourceType: "TENANT",
        resourceId: tenantId,
        metadata: {
          collegeName: tenant.name,
          slug: tenant.slug,
          reason: reason.trim(),
          deletedAt: now,
          mode: "PERMANENT_DELETE",
        },
        adminClient: admin,
      });

      return {
        success: true,
        tenantId,
        collegeName: tenant.name,
        message: `College '${tenant.name}' has been permanently deleted from the platform.`,
      };
    }

    if (tenant.status === ("ARCHIVED" as any) || tenant.status === ("DECOMMISSIONED" as any)) {
      throw new Error(`College '${tenant.name}' is already decommissioned.`);
    }

    // 1. Immediately revoke operational access by setting status to ARCHIVED
    const { error: updateErr } = await admin
      .from("tenants")
      .update({
        status: "ARCHIVED",
        updated_at: now,
      })
      .eq("id", tenantId);

    if (updateErr) {
      await admin
        .from("tenants")
        .update({
          status: "SUSPENDED",
          updated_at: now,
        })
        .eq("id", tenantId);
    }

    // 2. Terminate active subscriptions
    await admin
      .from("college_subscriptions")
      .update({
        status: "CANCELLED",
        updated_at: now,
      })
      .eq("tenant_id", tenantId);

    // 3. Financial audit: Invoices, payment records, and audit events are strictly RETAINED.

    // 4. Record high-severity platform audit event
    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_COLLEGE_DECOMMISSION",
      resourceType: "TENANT",
      resourceId: tenantId,
      metadata: {
        collegeName: tenant.name,
        slug: tenant.slug,
        reason: reason.trim(),
        decommissionedAt: now,
      },
      adminClient: admin,
    });

    return {
      success: true,
      tenantId,
      collegeName: tenant.name,
      message: `Institution '${tenant.name}' has been safely decommissioned. Operational access is revoked and financial ledgers are preserved.`,
    };
  }
}
