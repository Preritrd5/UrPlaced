import { NextRequest, NextResponse } from "next/server";
import { PlatformAuthService } from "@/modules/platform-admin/services/platform-auth-service";
import { createAdminClient } from "@/lib/supabase/admin";
import { InvoiceDocumentService } from "@/modules/billing/services/invoice-document-service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await PlatformAuthService.requireSuperAdmin(request);
    const admin = createAdminClient();

    const searchParams = request.nextUrl.searchParams;
    const format = searchParams.get("format") || "csv";
    const statusFilter = searchParams.get("status");
    const tenantIdFilter = searchParams.get("tenantId");
    const methodFilter = searchParams.get("method");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = admin
      .from("payment_transactions")
      .select(`
        *,
        tenants (
          name,
          slug
        ),
        platform_invoices (
          invoice_number
        )
      `)
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    }
    if (tenantIdFilter && tenantIdFilter !== "ALL") {
      query = query.eq("tenant_id", tenantIdFilter);
    }
    if (methodFilter && methodFilter !== "ALL") {
      query = query.eq("method", methodFilter);
    }
    if (startDate) {
      query = query.gte("created_at", new Date(startDate).toISOString());
    }
    if (endDate) {
      query = query.lte("created_at", new Date(endDate).toISOString());
    }

    const { data: transactions, error } = await query;

    if (error) {
      throw new Error(`Failed to query transactions for export: ${error.message}`);
    }

    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "xlsx") {
      const excelBuffer = await InvoiceDocumentService.generateTransactionsExcel(transactions || []);
      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="urplaced-financial-transactions-${dateStr}.xlsx"`,
          "Content-Length": String(excelBuffer.length),
        },
      });
    }

    const csvContent = InvoiceDocumentService.generateTransactionsCsv(transactions || []);

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="urplaced-financial-transactions-${dateStr}.csv"`,
      },
    });
  } catch (error: any) {
    const msg = error.message || "Export failed";
    const status = msg.includes("Super Admin") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
