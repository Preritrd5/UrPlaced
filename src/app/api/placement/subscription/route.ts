/**
 * College Placement Cell Subscription API
 * GET /api/placement/subscription
 * Permitted even under PENDING_PAYMENT to allow Placement Heads to view their billing status.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/server-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const ctx = await requireAuthContext();

    // Reconciled Billing RBAC: Only PLACEMENT_HEAD or platform super admin may access billing details
    if (ctx.tenantRole !== "PLACEMENT_HEAD" && !ctx.isPlatformAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only institutional placement administrators may access subscription and billing details." },
        { status: 403 }
      );
    }

    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    let targetTenantId = ctx.tenantId || (ctx.isPlatformAdmin ? searchParams.get("tenantId") : null);

    if (!targetTenantId) {
      if (ctx.isPlatformAdmin) {
        const { data: firstTenant } = await admin.from("tenants").select("id").limit(1).maybeSingle();
        if (firstTenant) {
          targetTenantId = firstTenant.id;
        }
      }
    }

    if (!targetTenantId) {
      return NextResponse.json({ error: "Active college context is required." }, { status: 400 });
    }

    // Query tenant and subscription
    let tenant: any = null;
    let { data: tenantData, error: tenantErr } = await admin
      .from("tenants")
      .select(`
        id,
        name,
        slug,
        official_email,
        contact_name,
        contact_phone,
        status,
        student_seat_limit,
        created_at,
        college_subscriptions (
          id,
          plan_id,
          status,
          renewal_date,
          created_at,
          subscription_plans (
            id,
            name,
            price_inr,
            features
          )
        )
      `)
      .eq("id", targetTenantId)
      .maybeSingle();

    if (tenantErr || !tenantData) {
      // Fallback query without joined subscription_plans if schema differs
      const { data: fallbackTenant } = await admin
        .from("tenants")
        .select(`
          id,
          name,
          slug,
          official_email,
          contact_name,
          contact_phone,
          status,
          student_seat_limit,
          created_at,
          college_subscriptions (
            id,
            plan_id,
            status,
            renewal_date,
            created_at
          )
        `)
        .eq("id", targetTenantId)
        .maybeSingle();

      if (!fallbackTenant) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }
      tenant = fallbackTenant;
    } else {
      tenant = tenantData;
    }

    const sub = Array.isArray(tenant.college_subscriptions)
      ? tenant.college_subscriptions[0]
      : tenant.college_subscriptions;

    let plan = sub
      ? Array.isArray(sub.subscription_plans)
        ? sub.subscription_plans[0]
        : sub.subscription_plans
      : null;

    // If plan details were not joined, query subscription_plans directly
    if (sub?.plan_id && !plan) {
      const { data: planData } = await admin
        .from("subscription_plans")
        .select("id, name, price_inr, features")
        .eq("id", sub.plan_id)
        .maybeSingle();
      if (planData) plan = planData;
    }

    // Query all invoices for this tenant to establish authoritative payment verification
    const { data: allInvoices } = await admin
      .from("platform_invoices")
      .select("id, invoice_number, amount_inr, tax_inr, currency, status, due_date, issue_date, paid_at, payment_method, notes")
      .eq("tenant_id", targetTenantId)
      .order("created_at", { ascending: false });

    const paidInvoices = allInvoices?.filter((i: any) => i.status === "PAID") || [];
    const hasPaidInitialInvoice = paidInvoices.length > 0;
    const pendingInvoice = allInvoices?.find((i: any) => i.status === "PENDING") || null;
    const latestInvoice = allInvoices?.[0] || null;

    const activeInv = pendingInvoice || latestInvoice;

    let invoiceType: "INITIAL_SUBSCRIPTION" | "RENEWAL" | "UPGRADE" = "RENEWAL";
    if (activeInv) {
      const notes = (activeInv.notes || "").toLowerCase();
      const isExplicitInitial = notes.includes("initial") || notes.includes("registration");
      const isExplicitRenewal = notes.includes("renewal") || notes.includes("renew");

      if (
        activeInv.invoice_number?.startsWith("INV-UPG-") ||
        activeInv.notes?.includes("[UPGRADE:")
      ) {
        invoiceType = "UPGRADE";
      } else if (isExplicitInitial) {
        invoiceType = "INITIAL_SUBSCRIPTION";
      } else if (isExplicitRenewal) {
        invoiceType = "RENEWAL";
      } else if (!hasPaidInitialInvoice) {
        invoiceType = "INITIAL_SUBSCRIPTION";
      } else {
        invoiceType = "RENEWAL";
      }
    }

    let invoiceData = activeInv
      ? {
          id: activeInv.id,
          invoiceNumber: activeInv.invoice_number,
          amountInr: Number(activeInv.amount_inr || 0),
          taxInr: Number(activeInv.tax_inr || 0),
          totalInr: Number((Number(activeInv.amount_inr || 0) + Number(activeInv.tax_inr || 0)).toFixed(2)),
          currency: activeInv.currency || "INR",
          status: activeInv.status,
          dueDate: activeInv.due_date,
          issueDate: activeInv.issue_date,
          paidAt: activeInv.paid_at,
          paymentMethod: activeInv.payment_method || "RAZORPAY",
          notes: activeInv.notes,
          type: invoiceType,
          razorpayOrderId: (activeInv as any).razorpay_order_id || null,
        }
      : null;

    // Determine authoritative subscription status:
    // If the college is not in an explicit terminal/restricted state (CANCELLED, EXPIRED, SUSPENDED),
    // but has an unpaid initial subscription invoice, its effective status is strictly PENDING_PAYMENT.
    const rawStatus = (sub?.status || "").toUpperCase();
    const isTerminalOrRestricted =
      rawStatus === "CANCELLED" ||
      rawStatus === "CANCELED" ||
      rawStatus === "EXPIRED" ||
      rawStatus === "SUSPENDED" ||
      tenant.status === "DECOMMISSIONED" ||
      tenant.status === "ARCHIVED";

    const hasPendingInitialInvoice = Boolean(
      pendingInvoice && (invoiceType === "INITIAL_SUBSCRIPTION" || !hasPaidInitialInvoice)
    );

    const effectiveSubStatus = isTerminalOrRestricted
      ? (sub?.status || "CANCELLED")
      : hasPendingInitialInvoice
      ? "PENDING_PAYMENT"
      : (sub?.status || "ACTIVE");

    // Option C / Workflow A: If college has preassigned plan in PENDING_PAYMENT but no invoice exists yet,
    // automatically generate the initial invoice so the Placement Head can immediately Pay Now!
    if (!invoiceData && sub && sub.status === "PENDING_PAYMENT" && plan) {
      const amountInr = Number(plan.price_inr || 129999);
      const taxInr = Number((amountInr * 0.18).toFixed(2));
      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { data: createdInv } = await admin
        .from("platform_invoices")
        .insert({
          invoice_number: invoiceNumber,
          tenant_id: targetTenantId,
          subscription_id: sub.id,
          amount_inr: amountInr,
          tax_inr: taxInr,
          currency: "INR",
          status: "PENDING",
          due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          payment_method: "RAZORPAY",
          notes: `Initial subscription invoice for ${tenant.name} (${plan.name})`,
        })
        .select("id, invoice_number, amount_inr, tax_inr, currency, status, due_date, payment_method, notes")
        .single();

      if (createdInv) {
        invoiceData = {
          id: createdInv.id,
          invoiceNumber: createdInv.invoice_number,
          amountInr: Number(createdInv.amount_inr),
          taxInr: Number(createdInv.tax_inr),
          totalInr: Number((Number(createdInv.amount_inr) + Number(createdInv.tax_inr)).toFixed(2)),
          currency: createdInv.currency || "INR",
          status: createdInv.status,
          dueDate: createdInv.due_date,
          issueDate: new Date().toISOString(),
          paidAt: null,
          paymentMethod: createdInv.payment_method || "RAZORPAY",
          notes: createdInv.notes,
          type: "INITIAL_SUBSCRIPTION",
          razorpayOrderId: null,
        };
      }
    }

    // Query published plans available for selection (Option C)
    let publishedPlans: any[] = [];
    const { data: plansData } = await admin
      .from("subscription_plans")
      .select("id, name, description, price_inr, student_limit, staff_limit, features")
      .order("price_inr", { ascending: true });

    if (plansData) {
      publishedPlans = plansData;
    }

    return NextResponse.json({
      tenantId: tenant.id,
      tenantStatus: tenant.status,
      collegeName: tenant.name,
      officialEmail: tenant.official_email,
      contactName: tenant.contact_name,
      contactPhone: tenant.contact_phone,
      studentSeatLimit: tenant.student_seat_limit,
      hasPreassignedPlan: Boolean(sub?.plan_id),
      hasPaidInitialInvoice,
      subscription: sub
        ? {
            id: sub.id,
            status: effectiveSubStatus,
            effectiveStatus: effectiveSubStatus,
            canAccessOperational: hasPaidInitialInvoice,
            startDate: sub.start_date || sub.created_at,
            expiryDate: sub.expiry_date || sub.renewal_date,
            renewalDate: sub.renewal_date,
            gracePeriodDays: sub.grace_period_days ?? 7,
            studentSeatLimit: sub.student_seat_limit || tenant.student_seat_limit,
            staffSeatLimit: sub.staff_seat_limit || 20,
            planId: sub.plan_id,
            planName: plan?.name || sub.plan_id,
            priceAnnual: plan?.price_inr || null,
            features: plan?.features || [],
            pendingPlanId: (sub as any).pending_plan_id || null,
            pendingPlanVersion: (sub as any).pending_plan_version || null,
          }
        : null,
      invoice: invoiceData,
      availablePlans: (publishedPlans || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        priceInr: Number(p.price_inr),
        billingInterval: p.billing_interval,
        studentLimit: p.student_limit,
        staffLimit: p.staff_limit,
        features: p.features || [],
      })),
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.startsWith("FORBIDDEN") || error.message === "NO_ACTIVE_TENANT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
