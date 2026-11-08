import { createAdminClient } from "@/lib/supabase/admin";
import { PlatformAuthService } from "./platform-auth-service";

export interface PlatformInvoiceItem {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  subscriptionId: string | null;
  amountInr: number;
  taxInr: number;
  totalInr: number;
  currency: string;
  status: "PAID" | "PENDING" | "OVERDUE" | "CANCELED" | "REFUNDED";
  issueDate: string;
  dueDate: string;
  paidAt: string | null;
  paymentMethod: string;
  isDemo: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export class PlatformBillingService {
  /**
   * Lists platform billing invoices with filters.
   */
  static async listInvoices(params: {
    tenantId?: string;
    status?: string;
    admin?: ReturnType<typeof createAdminClient>;
  } = {}): Promise<PlatformInvoiceItem[]> {
    const { tenantId, status, admin = createAdminClient() } = params;

    let query = admin
      .from("platform_invoices")
      .select(`
        id,
        invoice_number,
        tenant_id,
        subscription_id,
        amount_inr,
        tax_inr,
        currency,
        status,
        issue_date,
        due_date,
        paid_at,
        payment_method,
        is_demo,
        notes,
        created_at,
        updated_at,
        tenants (
          id,
          name,
          slug
        )
      `)
      .order("issue_date", { ascending: false });

    if (tenantId && tenantId !== "ALL") {
      query = query.eq("tenant_id", tenantId);
    }
    if (status && status !== "ALL") {
      if (status === "PENDING_PAYMENT" || status === "PENDING") {
        query = query.in("status", ["PENDING", "PENDING_PAYMENT"]);
      } else {
        query = query.eq("status", status);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list invoices: ${error.message}`);
    }

    return (data || []).map((inv: any) => {
      const amount = Number(inv.amount_inr);
      const tax = Number(inv.tax_inr);
      return {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        tenantId: inv.tenant_id,
        tenantName: inv.tenants?.name || "Unknown College",
        tenantSlug: inv.tenants?.slug || "unknown",
        subscriptionId: inv.subscription_id,
        amountInr: amount,
        taxInr: tax,
        totalInr: Number((amount + tax).toFixed(2)),
        currency: inv.currency,
        status: inv.status,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
        paymentMethod: inv.payment_method,
        isDemo: inv.is_demo,
        notes: inv.notes,
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
      };
    });
  }

  /**
   * Records a verified payment against an invoice.
   * Clearly flags demo payment behavior if invoked under demo mode.
   */
  static async recordPayment(params: {
    invoiceId: string;
    paymentMethod: string;
    isDemo?: boolean;
    notes?: string;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<{ success: boolean; invoice: PlatformInvoiceItem }> {
    const {
      invoiceId,
      paymentMethod,
      isDemo = false,
      notes,
      adminId,
      admin = createAdminClient(),
    } = params;

    const paidAt = new Date().toISOString();
    const { data: inv, error } = await admin
      .from("platform_invoices")
      .update({
        status: "PAID",
        payment_method: paymentMethod,
        is_demo: isDemo,
        paid_at: paidAt,
        notes: notes || (isDemo ? "Demonstration payment verified via Super Admin" : "Payment recorded via Super Admin"),
        updated_at: paidAt,
      })
      .eq("id", invoiceId)
      .select(`
        id,
        invoice_number,
        tenant_id,
        subscription_id,
        amount_inr,
        tax_inr,
        currency,
        status,
        issue_date,
        due_date,
        paid_at,
        payment_method,
        is_demo,
        notes,
        created_at,
        updated_at,
        tenants (
          id,
          name,
          slug
        )
      `)
      .single();

    if (error || !inv) {
      throw new Error(`Failed to record payment: ${error?.message || "Invoice not found"}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_INVOICE_PAID",
      resourceType: "INVOICE",
      resourceId: inv.id,
      metadata: {
        invoiceNumber: inv.invoice_number,
        amount: inv.amount_inr,
        paymentMethod,
        isDemo,
      },
      adminClient: admin,
    });

    const amount = Number(inv.amount_inr);
    const tax = Number(inv.tax_inr);

    return {
      success: true,
      invoice: {
        id: inv.id,
        invoiceNumber: inv.invoice_number,
        tenantId: inv.tenant_id,
        tenantName: (inv.tenants as any)?.name || "Unknown College",
        tenantSlug: (inv.tenants as any)?.slug || "unknown",
        subscriptionId: inv.subscription_id,
        amountInr: amount,
        taxInr: tax,
        totalInr: Number((amount + tax).toFixed(2)),
        currency: inv.currency,
        status: inv.status,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        paidAt: inv.paid_at,
        paymentMethod: inv.payment_method,
        isDemo: inv.is_demo,
        notes: inv.notes,
        createdAt: inv.created_at,
        updatedAt: inv.updated_at,
      },
    };
  }

  /**
   * Creates a new manual platform invoice.
   */
  static async createInvoice(params: {
    tenantId: string;
    amountInr: number;
    taxInr?: number;
    dueDate?: string;
    notes?: string;
    adminId: string;
    admin?: ReturnType<typeof createAdminClient>;
  }): Promise<PlatformInvoiceItem> {
    const {
      tenantId,
      amountInr,
      taxInr = Number((amountInr * 0.18).toFixed(2)),
      dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      notes,
      adminId,
      admin = createAdminClient(),
    } = params;

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data: inv, error } = await admin
      .from("platform_invoices")
      .insert({
        invoice_number: invoiceNumber,
        tenant_id: tenantId,
        amount_inr: amountInr,
        tax_inr: taxInr,
        currency: "INR",
        status: "PENDING",
        issue_date: new Date().toISOString(),
        due_date: dueDate,
        payment_method: "BANK_TRANSFER",
        is_demo: false,
        notes: notes || null,
      })
      .select(`
        id,
        invoice_number,
        tenant_id,
        subscription_id,
        amount_inr,
        tax_inr,
        currency,
        status,
        issue_date,
        due_date,
        paid_at,
        payment_method,
        is_demo,
        notes,
        created_at,
        updated_at,
        tenants (
          id,
          name,
          slug
        )
      `)
      .single();

    if (error || !inv) {
      throw new Error(`Failed to create invoice: ${error?.message || "Unknown error"}`);
    }

    await PlatformAuthService.logAuditEvent({
      actorId: adminId,
      action: "PLATFORM_INVOICE_CREATE",
      resourceType: "INVOICE",
      resourceId: inv.id,
      metadata: { invoiceNumber: inv.invoice_number, amountInr },
      adminClient: admin,
    });

    const amount = Number(inv.amount_inr);
    const tax = Number(inv.tax_inr);

    return {
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      tenantId: inv.tenant_id,
      tenantName: (inv.tenants as any)?.name || "Unknown College",
      tenantSlug: (inv.tenants as any)?.slug || "unknown",
      subscriptionId: inv.subscription_id,
      amountInr: amount,
      taxInr: tax,
      totalInr: Number((amount + tax).toFixed(2)),
      currency: inv.currency,
      status: inv.status,
      issueDate: inv.issue_date,
      dueDate: inv.due_date,
      paidAt: inv.paid_at,
      paymentMethod: inv.payment_method,
      isDemo: inv.is_demo,
      notes: inv.notes,
      createdAt: inv.created_at,
      updatedAt: inv.updated_at,
    };
  }
}
