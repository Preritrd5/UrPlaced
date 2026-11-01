import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";
import { EmailAdapter, type EmailDeliveryResult } from "@/modules/identity-access/services/email-adapter";
import { PlatformNotificationService } from "./platform-notification-service";

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
    initialPlanId: string;
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

    // 5. Create Initial Subscription (PENDING_PAYMENT until activated/invoiced in SA-06)
    const planId = initialPlanId || "growth";
    const { data: subscription } = await admin
      .from("college_subscriptions")
      .insert({
        tenant_id: tenant.id,
        plan_id: planId,
        status: "PENDING_PAYMENT",
        student_seat_limit: Number(studentSeatLimit),
        staff_seat_limit: planId === "enterprise" ? 100 : planId === "growth" ? 25 : 5,
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    // 6. Generate Initial Billing Invoice (PENDING)
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
        planId,
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
        subscriptionPlan: {
          id: planId,
          name:
            planId === "enterprise"
              ? "University Enterprise"
              : planId === "growth"
              ? "Campus Growth"
              : "Institutional Starter",
          status: "PENDING_PAYMENT",
          renewalDate: subscription?.renewal_date || new Date().toISOString(),
        },
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
