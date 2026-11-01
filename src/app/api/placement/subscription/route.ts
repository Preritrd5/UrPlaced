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

    if (ctx.tenantRole === "STUDENT") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const admin = createAdminClient();

    // Query tenant and subscription
    const { data: tenant, error: tenantErr } = await admin
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
            price_monthly,
            price_annual,
            features
          )
        )
      `)
      .eq("id", ctx.tenantId)
      .maybeSingle();

    if (tenantErr || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const sub = Array.isArray(tenant.college_subscriptions)
      ? tenant.college_subscriptions[0]
      : tenant.college_subscriptions;

    const plan = sub
      ? Array.isArray(sub.subscription_plans)
        ? sub.subscription_plans[0]
        : sub.subscription_plans
      : null;

    // Query latest platform invoice for this tenant
    const { data: latestInvoice } = await admin
      .from("platform_invoices")
      .select("id, invoice_number, amount_inr, tax_inr, currency, status, due_date, razorpay_order_id")
      .eq("tenant_id", ctx.tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      tenantId: tenant.id,
      collegeName: tenant.name,
      officialEmail: tenant.official_email,
      contactName: tenant.contact_name,
      contactPhone: tenant.contact_phone,
      studentSeatLimit: tenant.student_seat_limit,
      subscription: sub
        ? {
            id: sub.id,
            status: sub.status,
            renewalDate: sub.renewal_date,
            planId: sub.plan_id,
            planName: plan?.name || sub.plan_id,
            priceAnnual: plan?.price_annual || null,
            features: plan?.features || [],
          }
        : null,
      invoice: latestInvoice
        ? {
            id: latestInvoice.id,
            invoiceNumber: latestInvoice.invoice_number,
            amountInr: Number(latestInvoice.amount_inr),
            taxInr: Number(latestInvoice.tax_inr),
            totalInr: Number((Number(latestInvoice.amount_inr) + Number(latestInvoice.tax_inr)).toFixed(2)),
            currency: latestInvoice.currency || "INR",
            status: latestInvoice.status,
            dueDate: latestInvoice.due_date,
            razorpayOrderId: latestInvoice.razorpay_order_id,
          }
        : null,
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
