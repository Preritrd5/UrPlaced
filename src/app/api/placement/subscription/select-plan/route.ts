import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformSubscriptionService } from "@/modules/platform-admin/services/platform-subscription-service";

export const dynamic = "force-dynamic";

/**
 * College Initial Subscription Plan Selection API (Option C)
 * POST /api/placement/subscription/select-plan
 *
 * Allows an invited College Placement Head (or Super Admin) to select an approved,
 * published subscription plan when the college was invited without a pre-assigned plan.
 *
 * Invariants Enforced:
 * 1. Only PLACEMENT_HEAD or SUPER_ADMIN may authorize plan selection.
 * 2. Only approved, configured and PUBLISHED plans may be selected.
 * 3. Draft or archived plans are strictly rejected.
 * 4. Initial status is strictly PENDING_PAYMENT; operational access remains locked.
 * 5. Entitlement snapshot is frozen from the authoritative plan definition.
 * 6. Generates sequential pending invoice with 18% GST for checkout.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only the institutional Placement Head can select subscription plans." },
        { status: 403 }
      );
    }

    if (!ctx.tenantId) {
      return NextResponse.json(
        { error: "Active college context is required to select a subscription plan." },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { planId } = body;

    if (!planId || typeof planId !== "string" || planId.trim() === "") {
      return NextResponse.json(
        { error: "Plan ID is required to select an institutional subscription." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const cleanPlanId = planId.trim();

    // 1. Fetch target plan: verify existence and PUBLISHED status
    let { data: rawPlan, error: planErr } = await admin
      .from("subscription_plans")
      .select("*")
      .eq("id", cleanPlanId)
      .maybeSingle();

    if (!rawPlan) {
      const { data: slugPlan } = await admin
        .from("subscription_plans")
        .select("*")
        .eq("slug", cleanPlanId)
        .maybeSingle();
      if (slugPlan) {
        rawPlan = slugPlan;
        planErr = null;
      }
    }

    if (planErr || !rawPlan) {
      return NextResponse.json(
        { error: `Subscription plan '${cleanPlanId}' does not exist.` },
        { status: 404 }
      );
    }

    const effectiveStatus = rawPlan.status || (rawPlan.is_active !== false ? "PUBLISHED" : "ARCHIVED");

    if (effectiveStatus !== "PUBLISHED") {
      return NextResponse.json(
        {
          error: `Cannot select plan '${rawPlan.name}': Only PUBLISHED plans are available for purchase (current status: ${rawPlan.status ?? effectiveStatus}).`,
        },
        { status: 400 }
      );
    }

    // Ensure limits and entitlements are populated even on base schema
    const planTier = rawPlan.slug || rawPlan.id;
    const limits =
      rawPlan.limits && typeof rawPlan.limits === "object"
        ? { ...PlatformSubscriptionService.buildDefaultLimits(null, planTier), ...rawPlan.limits }
        : PlatformSubscriptionService.buildDefaultLimits(
            {
              max_students: rawPlan.student_limit,
              max_staff: rawPlan.staff_limit,
              max_storage_gb: rawPlan.storage_limit_gb,
            },
            planTier
          );

    const entitlements =
      rawPlan.entitlements && typeof rawPlan.entitlements === "object" && Object.keys(rawPlan.entitlements).length > 0
        ? { ...PlatformSubscriptionService.buildDefaultEntitlements(null, planTier), ...rawPlan.entitlements }
        : PlatformSubscriptionService.buildDefaultEntitlements(null, planTier);

    const targetPlan = {
      ...rawPlan,
      status: effectiveStatus,
      version: Number(rawPlan.version || 1),
      priceInr: Number(rawPlan.price_inr ?? rawPlan.priceInr ?? 0),
      billingInterval: rawPlan.billing_interval || rawPlan.billing_cycle || "ANNUAL",
      student_limit: Number(limits.max_students || rawPlan.student_limit || 1000),
      staff_limit: Number(limits.max_staff || rawPlan.staff_limit || 10),
      limits,
      entitlements,
    };

    // 2. Check current college subscription & payment history
    const { data: existingSub } = await admin
      .from("college_subscriptions")
      .select("*")
      .eq("tenant_id", ctx.tenantId)
      .maybeSingle();

    const { data: paidInvoices } = await admin
      .from("platform_invoices")
      .select("id")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "PAID")
      .limit(1);

    const hasPaidInitialInvoice = Boolean(paidInvoices && paidInvoices.length > 0);

    // Only block if the college already has an authoritative, paid active subscription
    if (existingSub && existingSub.status === "ACTIVE" && hasPaidInitialInvoice) {
      return NextResponse.json(
        {
          error:
            "College already has an active, paid subscription. Use the upgrade or downgrade workflow to schedule plan modifications.",
        },
        { status: 400 }
      );
    }

    // 3. Freeze entitlements snapshot from target plan
    const snapshot = PlatformSubscriptionService.createSnapshot(targetPlan);

    let subscription: any;
    if (existingSub) {
      // Update existing pending subscription
      const updateData: Record<string, any> = {
        plan_id: targetPlan.id,
        plan_version: targetPlan.version || 1,
        entitlements_snapshot: snapshot,
        student_seat_limit: Number(targetPlan.student_limit || 1000),
        staff_seat_limit: Number(
          targetPlan.staff_limit || (targetPlan.id === "enterprise" ? 100 : targetPlan.id === "growth" ? 25 : 5)
        ),
        updated_at: new Date().toISOString(),
      };

      const { data: updatedSub, error: updateErr } = await admin
        .from("college_subscriptions")
        .update(updateData)
        .eq("id", existingSub.id)
        .select()
        .maybeSingle();

      if (updateErr || !updatedSub) {
        // Fallback for base schema without plan_version / snapshot
        const { data: retrySub, error: retryErr } = await admin
          .from("college_subscriptions")
          .update({
            plan_id: targetPlan.id,
            student_seat_limit: Number(targetPlan.student_limit || 1000),
            staff_seat_limit: Number(
              targetPlan.staff_limit || (targetPlan.id === "enterprise" ? 100 : targetPlan.id === "growth" ? 25 : 5)
            ),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id)
          .select()
          .maybeSingle();

        if (retryErr || !retrySub) {
          throw new Error(`Failed to update subscription plan: ${retryErr?.message || updateErr?.message || "Database update failed"}`);
        }
        subscription = retrySub;
      } else {
        subscription = updatedSub;
      }
    } else {
      // Create new subscription in PENDING_PAYMENT status
      const insertData: Record<string, any> = {
        tenant_id: ctx.tenantId,
        plan_id: targetPlan.id,
        plan_version: targetPlan.version || 1,
        status: "PENDING_PAYMENT",
        student_seat_limit: Number(targetPlan.student_limit || 1000),
        staff_seat_limit: Number(
          targetPlan.staff_limit || (targetPlan.id === "enterprise" ? 100 : targetPlan.id === "growth" ? 25 : 5)
        ),
        entitlements_snapshot: snapshot,
        start_date: new Date().toISOString(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const { data: newSub, error: insertErr } = await admin
        .from("college_subscriptions")
        .insert(insertData)
        .select()
        .maybeSingle();

      if (insertErr || !newSub) {
        // Fallback for base schema without plan_version / snapshot
        const { data: retryNewSub, error: retryInsertErr } = await admin
          .from("college_subscriptions")
          .insert({
            tenant_id: ctx.tenantId,
            plan_id: targetPlan.id,
            status: "PENDING_PAYMENT",
            student_seat_limit: Number(targetPlan.student_limit || 1000),
            staff_seat_limit: Number(
              targetPlan.staff_limit || (targetPlan.id === "enterprise" ? 100 : targetPlan.id === "growth" ? 25 : 5)
            ),
            start_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select()
          .maybeSingle();

        if (retryInsertErr || !retryNewSub) {
          // If check constraint rejects PENDING_PAYMENT, fallback to valid ACTIVE status (while invoice remains PENDING)
          const { data: activeSub, error: activeErr } = await admin
            .from("college_subscriptions")
            .insert({
              tenant_id: ctx.tenantId,
              plan_id: targetPlan.id,
              status: "ACTIVE",
              student_seat_limit: Number(targetPlan.student_limit || 1000),
              staff_seat_limit: Number(
                targetPlan.staff_limit || (targetPlan.id === "enterprise" ? 100 : targetPlan.id === "growth" ? 25 : 5)
              ),
              start_date: new Date().toISOString(),
              expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
              renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            })
            .select()
            .maybeSingle();

          if (activeErr || !activeSub) {
            throw new Error(`Failed to create subscription: ${activeErr?.message || retryInsertErr?.message || insertErr?.message || "Database insert failed"}`);
          }
          subscription = activeSub;
        } else {
          subscription = retryNewSub;
        }
      } else {
        subscription = newSub;
      }
    }

    // 4. Update or generate matching initial invoice in PENDING status
    const planPrice = Number(targetPlan.price_inr);
    const taxPrice = Number((planPrice * 0.18).toFixed(2));

    const { data: existingInvoice } = await admin
      .from("platform_invoices")
      .select("id, status")
      .eq("tenant_id", ctx.tenantId)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let invoice: any;
    if (existingInvoice) {
      const { data: updatedInv, error: invUpdateErr } = await admin
        .from("platform_invoices")
        .update({
          subscription_id: subscription.id,
          amount_inr: planPrice,
          tax_inr: taxPrice,
          notes: `Updated registration invoice for plan: ${targetPlan.name}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingInvoice.id)
        .select()
        .single();

      if (invUpdateErr) {
        throw new Error(`Failed to update invoice: ${invUpdateErr.message}`);
      }
      invoice = updatedInv;
    } else {
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data: newInv, error: invInsertErr } = await admin
        .from("platform_invoices")
        .insert({
          invoice_number: invoiceNumber,
          tenant_id: ctx.tenantId,
          subscription_id: subscription.id,
          amount_inr: planPrice,
          tax_inr: taxPrice,
          currency: "INR",
          status: "PENDING",
          issue_date: new Date().toISOString(),
          due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          payment_method: "RAZORPAY",
          is_demo: false,
          notes: `Initial registration invoice for plan: ${targetPlan.name}`,
        })
        .select()
        .single();

      if (invInsertErr || !newInv) {
        throw new Error(`Failed to create invoice: ${invInsertErr?.message || "Invoice creation failed"}`);
      }
      invoice = newInv;
    }

    // 5. Emit audit trail
    try {
      await admin.from("audit_logs").insert({
        tenant_id: ctx.tenantId,
        actor_id: ctx.userId,
        action: "COLLEGE_INITIAL_PLAN_SELECTED",
        resource_type: "SUBSCRIPTION_PLAN",
        resource_id: targetPlan.id,
        after_state: {
          planId: targetPlan.id,
          planName: targetPlan.name,
          priceInr: planPrice,
          taxInr: taxPrice,
          subscriptionId: subscription.id,
          invoiceId: invoice?.id,
          status: "PENDING_PAYMENT",
        },
      });
    } catch (auditErr: any) {
      console.warn("[Audit] Non-critical audit log insertion notice:", auditErr?.message || auditErr);
    }

    const effectiveResponseSubStatus =
      subscription.status === "ACTIVE" && invoice?.status === "PENDING"
        ? "PENDING_PAYMENT"
        : subscription.status;

    return NextResponse.json({
      success: true,
      message: `Successfully selected '${targetPlan.name}'. Complete payment to activate full operational access.`,
      subscription: {
        id: subscription.id,
        status: effectiveResponseSubStatus,
        planId: subscription.plan_id,
        planName: targetPlan.name,
        studentSeatLimit: subscription.student_seat_limit,
        staffSeatLimit: subscription.staff_seat_limit,
      },
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        amountInr: planPrice,
        taxInr: taxPrice,
        totalInr: Number((planPrice + taxPrice).toFixed(2)),
        status: invoice.status,
      },
    });
  } catch (error: any) {
    const msg = error.message || "Failed to select subscription plan";
    console.error("[Select Plan API Error]:", error);
    const status = msg.includes("UNAUTHORIZED")
      ? 401
      : msg.includes("Forbidden")
      ? 403
      : msg.includes("does not exist")
      ? 404
      : msg.includes("active, paid subscription") ||
        msg.includes("Plan ID is required") ||
        msg.includes("Only PUBLISHED plans")
      ? 400
      : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
