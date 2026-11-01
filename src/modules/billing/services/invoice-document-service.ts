/**
 * Invoice Document & Tax Service (SA-05 Workstream 05)
 * Configurable GST tax rules (Q19), itemized breakdown, printable PDF/HTML invoices & credit notes,
 * and Super Admin financial transaction exports (Q14).
 */

import { createAdminClient } from "@/lib/supabase/admin";
import PDFDocument from "pdfkit";
import ExcelJS from "exceljs";
import { TaxConfigurationService, ImmutableTaxSnapshot } from "./tax-configuration-service";

export interface TaxCalculationResult {
  taxRate: number;
  taxType: string;
  baseAmountInr: number;
  cgstInr: number;
  sgstInr: number;
  igstInr: number;
  totalTaxInr: number;
  totalInr: number;
}

export class InvoiceDocumentService {
  /**
   * Computes configurable GST taxes for an invoice amount based on college GSTIN and state rules.
   * Q19: Configurable tax rates rather than hardcoded flat values.
   */
  static calculateTax(params: {
    amountInr: number;
    taxRate?: number;
    isInterState?: boolean;
    isExempt?: boolean;
  }): TaxCalculationResult {
    const { amountInr, taxRate = 18.0, isInterState = false, isExempt = false } = params;

    if (isExempt || taxRate === 0) {
      return {
        taxRate: 0,
        taxType: "EXEMPT",
        baseAmountInr: Number(amountInr.toFixed(2)),
        cgstInr: 0,
        sgstInr: 0,
        igstInr: 0,
        totalTaxInr: 0,
        totalInr: Number(amountInr.toFixed(2)),
      };
    }

    const rate = taxRate / 100;
    const totalTax = Number((amountInr * rate).toFixed(2));
    const total = Number((amountInr + totalTax).toFixed(2));

    if (isInterState) {
      return {
        taxRate,
        taxType: "IGST",
        baseAmountInr: Number(amountInr.toFixed(2)),
        cgstInr: 0,
        sgstInr: 0,
        igstInr: totalTax,
        totalTaxInr: totalTax,
        totalInr: total,
      };
    } else {
      const halfTax = Number((totalTax / 2).toFixed(2));
      return {
        taxRate,
        taxType: "CGST_SGST",
        baseAmountInr: Number(amountInr.toFixed(2)),
        cgstInr: halfTax,
        sgstInr: Number((totalTax - halfTax).toFixed(2)),
        igstInr: 0,
        totalTaxInr: totalTax,
        totalInr: total,
      };
    }
  }

  /**
   * Generates a clean, standalone, printable HTML document for an invoice.
   * Browser printable to PDF with exact margins and branding.
   */
  static async renderInvoiceHtml(invoiceId: string, admin = createAdminClient()): Promise<string> {
    const { data: invoice, error } = await admin
      .from("platform_invoices")
      .select(`
        *,
        tenants (
          name,
          slug,
          official_email,
          contact_name,
          contact_phone,
          billing_contact_name,
          billing_contact_email,
          billing_address,
          gstin
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const tenant = invoice.tenants || {};
    const amount = Number(invoice.amount_inr);
    const tax = Number(invoice.tax_inr);
    const total = Number((amount + tax).toFixed(2));
    const refunded = Number(invoice.refunded_amount_inr || 0);
    const balance = Number((total - refunded).toFixed(2));

    const isPaid = invoice.status === "PAID";
    const isRefunded = invoice.status === "REFUNDED";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number} — UrPlaced</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #24283A;
      background-color: #FFFFFF;
      margin: 0;
      padding: 40px;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #DDDCD5;
      border-radius: 12px;
      padding: 36px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #5052C9;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo-text {
      font-size: 26px;
      font-weight: 800;
      color: #5052C9;
      letter-spacing: -0.5px;
    }
    .logo-sub {
      font-size: 11px;
      color: #747683;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .invoice-title {
      text-align: right;
    }
    .invoice-title h1 {
      margin: 0;
      font-size: 24px;
      color: #24283A;
    }
    .badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-top: 6px;
    }
    .badge-paid { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
    .badge-pending { background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; }
    .badge-refunded { background: #F3F4F6; color: #374151; border: 1px solid #E5E7EB; }
    .grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .col { width: 48%; }
    .col h3 {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #747683;
      margin: 0 0 8px 0;
    }
    .col p {
      margin: 2px 0;
      font-size: 13px;
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 30px;
    }
    th {
      background: #F8F7F3;
      color: #24283A;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 10px 14px;
      border-bottom: 1px solid #DDDCD5;
    }
    td {
      padding: 14px;
      border-bottom: 1px solid #EEE;
      font-size: 13px;
    }
    .totals {
      width: 320px;
      margin-left: auto;
      margin-bottom: 30px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .totals-row.grand {
      border-top: 2px solid #24283A;
      font-size: 16px;
      font-weight: 800;
      color: #5052C9;
      padding-top: 10px;
    }
    .footer {
      border-top: 1px solid #DDDCD5;
      padding-top: 20px;
      font-size: 11px;
      color: #747683;
      line-height: 1.6;
    }
    .print-btn {
      background: #5052C9;
      color: #FFF;
      border: none;
      padding: 10px 18px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 800px; margin: 0 auto 10px auto; text-align: right;">
    <button class="print-btn" onclick="window.print()">Print / Download PDF</button>
  </div>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="logo-text">UrPlaced</div>
        <div class="logo-sub">Campus Placement Acceleration SaaS</div>
        <p style="font-size: 11px; color: #747683; margin: 6px 0 0 0;">
          GSTIN: 29AABCU9603R1ZM &bull; Bangalore, Karnataka, India
        </p>
      </div>
      <div class="invoice-title">
        <h1>TAX INVOICE</h1>
        <div style="font-family: monospace; font-size: 13px; font-weight: bold; margin-top: 4px;">
          ${invoice.invoice_number}
        </div>
        <span class="badge ${isPaid ? "badge-paid" : isRefunded ? "badge-refunded" : "badge-pending"}">
          ${invoice.status}
        </span>
      </div>
    </div>

    <div class="grid">
      <div class="col">
        <h3>Billed To (Institutional Client)</h3>
        <p><strong>${tenant.name || "Client College"}</strong></p>
        <p>${tenant.billing_address || "Institutional Campus"}</p>
        <p>GSTIN: <strong>${tenant.gstin || invoice.college_gstin || "Unregistered / Exempt"}</strong></p>
        <p>Contact: ${tenant.billing_contact_name || tenant.contact_name || "Placement Head"}</p>
        <p>Email: ${tenant.billing_contact_email || tenant.official_email || "billing@college.edu"}</p>
      </div>
      <div class="col" style="text-align: right;">
        <h3>Invoice Details</h3>
        <p>Issue Date: <strong>${new Date(invoice.issue_date).toLocaleDateString("en-IN")}</strong></p>
        <p>Due Date: <strong>${new Date(invoice.due_date).toLocaleDateString("en-IN")}</strong></p>
        <p>Payment Method: <strong>${invoice.payment_method || "Razorpay / Bank Transfer"}</strong></p>
        ${
          invoice.razorpay_payment_id
            ? `<p>Gateway Ref: <strong style="font-family: monospace;">${invoice.razorpay_payment_id}</strong></p>`
            : ""
        }
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th style="text-align: center;">SAC / HSN</th>
          <th style="text-align: right;">Taxable Value</th>
          <th style="text-align: right;">GST (18%)</th>
          <th style="text-align: right;">Total Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <strong>Institutional Placement Management Subscription</strong><br>
            <span style="font-size: 11px; color: #747683;">
              Access to Student Directory, Drive Pipelines, AI Mistake Remediation, and Assessment Sentinel.
            </span>
          </td>
          <td style="text-align: center; font-family: monospace;">998315</td>
          <td style="text-align: right;">₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right;">₹${tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: bold;">₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal:</span>
        <span>₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="totals-row">
        <span>CGST (9.0%):</span>
        <span>₹${(tax / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="totals-row">
        <span>SGST (9.0%):</span>
        <span>₹${(tax / 2).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      <div class="totals-row grand">
        <span>Total Payable:</span>
        <span>₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
      </div>
      ${
        refunded > 0
          ? `
        <div class="totals-row" style="color: #DC2626;">
          <span>Refunded to Date:</span>
          <span>- ₹${refunded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
        <div class="totals-row" style="font-weight: bold; border-top: 1px solid #DDDCD5; padding-top: 6px;">
          <span>Net Balance:</span>
          <span>₹${balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
        </div>
      `
          : ""
      }
    </div>

    <div class="footer">
      <p><strong>Terms &amp; Statutory Notes:</strong> This tax invoice is an authoritative document generated by UrPlaced. Applicable taxes are charged under SAC 998315 (Hosting and SaaS services). For queries regarding this invoice, contact <span style="font-family: monospace;">urplaced5@gmail.com</span>.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generates a printable HTML document for a Credit Note.
   */
  static async renderCreditNoteHtml(creditNoteId: string, admin = createAdminClient()): Promise<string> {
    const { data: note, error } = await admin
      .from("credit_notes")
      .select(`
        *,
        platform_invoices (
          invoice_number,
          amount_inr,
          tax_inr,
          issue_date
        ),
        tenants (
          name,
          billing_address,
          gstin
        )
      `)
      .eq("id", creditNoteId)
      .single();

    if (error || !note) {
      throw new Error(`Credit Note not found: ${creditNoteId}`);
    }

    const tenant = note.tenants || {};
    const invoice = note.platform_invoices || {};
    const total = Number(note.total_inr);
    const amount = Number(note.amount_inr);
    const tax = Number(note.tax_inr);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Credit Note ${note.credit_note_number} — UrPlaced</title>
  <style>
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #24283A;
      background-color: #FFFFFF;
      margin: 0;
      padding: 40px;
    }
    .card {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #DDDCD5;
      border-radius: 12px;
      padding: 36px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 2px solid #2E8F86;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .logo { font-size: 24px; font-weight: 800; color: #5052C9; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #DDD; font-size: 13px; }
    th { background: #F8F7F3; font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="logo">UrPlaced</div>
        <p style="font-size: 11px; color: #747683; margin: 4px 0 0 0;">CREDIT ADJUSTMENT NOTE</p>
      </div>
      <div style="text-align: right;">
        <h2 style="margin: 0; color: #2E8F86;">CREDIT NOTE</h2>
        <div style="font-family: monospace; font-weight: bold;">${note.credit_note_number}</div>
        <div style="font-size: 12px; color: #747683; margin-top: 4px;">Date: ${new Date(note.issued_at).toLocaleDateString("en-IN")}</div>
      </div>
    </div>

    <div style="display: flex; justify-content: space-between; margin-bottom: 25px; font-size: 13px;">
      <div>
        <strong>Issued To:</strong><br>
        ${tenant.name || "Client"}<br>
        GSTIN: ${tenant.gstin || "Exempt / Unregistered"}
      </div>
      <div style="text-align: right;">
        <strong>Against Original Invoice:</strong><br>
        Invoice: <span style="font-family: monospace; font-weight: bold;">${invoice.invoice_number || "INV-ORIGINAL"}</span><br>
        Reason: ${note.reason}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Adjustment Description</th>
          <th style="text-align: right;">Base Credit</th>
          <th style="text-align: right;">Tax Credit (18%)</th>
          <th style="text-align: right;">Total Credited</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Refund adjustment against institutional subscription payment</td>
          <td style="text-align: right;">₹${amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right;">₹${tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
          <td style="text-align: right; font-weight: bold; color: #2E8F86;">₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
        </tr>
      </tbody>
    </table>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generates CSV export content of platform financial transactions for Super Admin (Q14).
   */
  static generateTransactionsCsv(transactions: any[]): string {
    const headers = [
      "Transaction ID",
      "Date",
      "College Name",
      "Invoice Number",
      "Amount INR",
      "Status",
      "Payment Method",
      "Gateway",
      "Gateway Ref",
    ];

    const rows = transactions.map((t) => [
      t.id,
      new Date(t.created_at).toISOString().split("T")[0],
      `"${(t.tenants?.name || "Unknown").replace(/"/g, '""')}"`,
      t.platform_invoices?.invoice_number || "",
      Number(t.amount_paise / 100).toFixed(2),
      t.status,
      t.method || "card",
      t.gateway,
      t.payment_id,
    ]);

    return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  }

  /**
   * Generates genuine binary Excel (.xlsx) workbook for Super Admin transaction exports (Correction B / Q14).
   * Adheres strictly to genuine XLSX format starting with PK zip header.
   */
  static async generateTransactionsExcel(transactions: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "UrPlaced Control Plane";
    workbook.lastModifiedBy = "Platform Administration";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Platform Transactions", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    sheet.columns = [
      { header: "Transaction ID", key: "id", width: 36 },
      { header: "Date & Time", key: "date", width: 22 },
      { header: "College Name", key: "college", width: 32 },
      { header: "Invoice Number", key: "invoiceNumber", width: 20 },
      { header: "Amount (INR)", key: "amount", width: 16 },
      { header: "Status", key: "status", width: 14 },
      { header: "Payment Method", key: "method", width: 16 },
      { header: "Gateway", key: "gateway", width: 14 },
      { header: "Gateway Ref", key: "gatewayRef", width: 28 },
      { header: "Order ID", key: "orderId", width: 28 },
    ];

    // Style Header Row (UrPlaced Brand Primary: #5052C9)
    const headerRow = sheet.getRow(1);
    headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5052C9" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    transactions.forEach((t) => {
      const amountInr = Number((Number(t.amount_paise || 0) / 100).toFixed(2));
      const row = sheet.addRow({
        id: t.id,
        date: new Date(t.created_at).toLocaleString("en-IN"),
        college: t.tenants?.name || "Unknown College",
        invoiceNumber: t.platform_invoices?.invoice_number || "N/A",
        amount: amountInr,
        status: t.status,
        method: t.method || "card",
        gateway: t.gateway || "RAZORPAY",
        gatewayRef: t.payment_id || "N/A",
        orderId: t.order_id || "N/A",
      });

      // Format currency cell
      const amountCell = row.getCell("amount");
      amountCell.numFmt = "₹#,##0.00";
      amountCell.alignment = { horizontal: "right" };

      // Status styling
      const statusCell = row.getCell("status");
      if (t.status === "SUCCESS" || t.status === "CAPTURED") {
        statusCell.font = { color: { argb: "FF2E8F86" }, bold: true };
      } else if (t.status === "FAILED") {
        statusCell.font = { color: { argb: "FFD32F2F" }, bold: true };
      }
    });

    const uint8Array = await workbook.xlsx.writeBuffer();
    return Buffer.from(uint8Array);
  }

  /**
   * Generates genuine binary PDF bytes for an invoice (Correction C / Q19).
   * Fully conforms to PDF-1.3+ specifications starting with %PDF- header.
   */
  static async generateInvoicePdf(invoiceId: string, admin = createAdminClient()): Promise<Buffer> {
    const { data: invoice, error } = await admin
      .from("platform_invoices")
      .select(`
        *,
        tenants (
          name,
          slug,
          official_email,
          contact_name,
          contact_phone,
          billing_contact_name,
          billing_contact_email,
          billing_address,
          gstin
        )
      `)
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    const tenant = (invoice.tenants as any) || {};

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err: Error) => reject(err));

      // Header Brand
      doc.fillColor("#5052C9").fontSize(22).font("Helvetica-Bold").text("UrPlaced", 40, 40);
      doc.fillColor("#747683").fontSize(9).font("Helvetica").text("Institutional Campus Recruitment Control Plane", 40, 66);

      // Title & Number
      doc.fillColor("#24283A").fontSize(18).font("Helvetica-Bold").text("TAX INVOICE", 400, 40, { align: "right" });
      doc.fillColor("#5052C9").fontSize(11).font("Helvetica-Bold").text(invoice.invoice_number, 400, 64, { align: "right" });

      doc.moveTo(40, 85).lineTo(555, 85).strokeColor("#DDDCD5").lineWidth(1).stroke();

      // Meta grid
      const metaY = 95;
      doc.fillColor("#747683").fontSize(9).font("Helvetica");
      doc.text("Invoice Date:", 40, metaY);
      doc.text("Payment Status:", 200, metaY);
      doc.text("Due Date:", 400, metaY);

      doc.fillColor("#24283A").fontSize(10).font("Helvetica-Bold");
      doc.text(new Date(invoice.issue_date || invoice.created_at).toLocaleDateString("en-IN"), 40, metaY + 12);
      
      const statusColor = invoice.status === "PAID" ? "#2E8F86" : "#5052C9";
      doc.fillColor(statusColor).text(invoice.status, 200, metaY + 12);
      
      doc.fillColor("#24283A").text(
        invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-IN") : "Upon Receipt",
        400,
        metaY + 12
      );

      // Seller vs Buyer Grid
      const addrY = 135;
      doc.fillColor("#5052C9").fontSize(10).font("Helvetica-Bold").text("BILLED BY (SUPPLIER)", 40, addrY);
      doc.fillColor("#24283A").fontSize(9).font("Helvetica-Bold").text("UrPlaced Technologies Private Limited", 40, addrY + 14);
      doc.font("Helvetica").fillColor("#747683");
      doc.text("GSTIN: 29AAAAU1234A1Z5 (State: Karnataka / 29)", 40, addrY + 26);
      doc.text("SAC Code: 9992 (Educational Technical Services)", 40, addrY + 38);
      doc.text("Support: billing@urplaced.com", 40, addrY + 50);

      doc.fillColor("#5052C9").fontSize(10).font("Helvetica-Bold").text("BILLED TO (RECIPIENT)", 300, addrY);
      doc.fillColor("#24283A").fontSize(9).font("Helvetica-Bold").text(tenant.name || "Educational Client", 300, addrY + 14);
      doc.font("Helvetica").fillColor("#747683");
      doc.text(`GSTIN: ${tenant.gstin || invoice.college_gstin || "Unregistered / Exempt"}`, 300, addrY + 26);
      doc.text(`Billing Contact: ${tenant.billing_contact_name || tenant.contact_name || "Placement Cell"}`, 300, addrY + 38);
      doc.text(`Email: ${tenant.billing_contact_email || tenant.official_email || "N/A"}`, 300, addrY + 50);

      // Line Items Table Header
      const tableY = 215;
      doc.rect(40, tableY, 515, 24).fill("#F8F7F3");
      doc.fillColor("#24283A").fontSize(9).font("Helvetica-Bold");
      doc.text("DESCRIPTION", 50, tableY + 7);
      doc.text("SAC", 280, tableY + 7);
      doc.text("BASE (INR)", 360, tableY + 7, { width: 80, align: "right" });
      doc.text("TOTAL (INR)", 465, tableY + 7, { width: 80, align: "right" });

      // Table Row
      const rowY = tableY + 30;
      const baseInr = Number(invoice.amount_inr || 0);
      const taxInr = Number(invoice.tax_inr || 0);
      const totalInr = Number((baseInr + taxInr).toFixed(2));

      doc.fillColor("#24283A").fontSize(9).font("Helvetica");
      doc.text(invoice.notes || "Annual College Placement Platform Subscription", 50, rowY, { width: 220 });
      doc.text("9992", 280, rowY);
      doc.text(`₹${baseInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 360, rowY, { width: 80, align: "right" });
      doc.text(`₹${totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, rowY, { width: 80, align: "right" });

      doc.moveTo(40, rowY + 35).lineTo(555, rowY + 35).strokeColor("#DDDCD5").stroke();

      // Summary Breakdown
      const sumY = rowY + 50;
      const sumLeft = 340;
      doc.fillColor("#747683").fontSize(9).font("Helvetica");
      doc.text("Subtotal (Taxable Value):", sumLeft, sumY);
      doc.fillColor("#24283A").font("Helvetica-Bold").text(`₹${baseInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, sumY, { width: 80, align: "right" });

      // Tax breakdown
      const taxType = invoice.tax_type || "GST";
      doc.fillColor("#747683").font("Helvetica").text(`Tax (${taxType} ${invoice.tax_rate || 18}%):`, sumLeft, sumY + 16);
      doc.fillColor("#24283A").font("Helvetica-Bold").text(`₹${taxInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, sumY + 16, { width: 80, align: "right" });

      doc.rect(sumLeft, sumY + 34, 215, 26).fill("#F8F7F3");
      doc.fillColor("#5052C9").fontSize(11).font("Helvetica-Bold").text("Total Payable (INR):", sumLeft + 10, sumY + 41);
      doc.text(`₹${totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, sumY + 41, { width: 80, align: "right" });

      // Payment Audit Trail (if paid)
      if (invoice.status === "PAID" && (invoice.razorpay_payment_id || invoice.payment_method)) {
        const payY = sumY + 80;
        doc.rect(40, payY, 515, 36).strokeColor("#2E8F86").lineWidth(1).stroke();
        doc.fillColor("#2E8F86").fontSize(9).font("Helvetica-Bold").text("PAYMENT RECEIPT CONFIRMATION", 50, payY + 8);
        doc.fillColor("#24283A").fontSize(8).font("Helvetica");
        doc.text(`Gateway: ${invoice.payment_gateway || "RAZORPAY"}  |  Payment ID: ${invoice.razorpay_payment_id || "N/A"}  |  Settlement: ${invoice.paid_at ? new Date(invoice.paid_at).toLocaleString("en-IN") : "Verified"}`, 50, payY + 20);
      }

      // Footer
      doc.fillColor("#747683").fontSize(8).font("Helvetica").text(
        "This is an electronically generated statutory tax invoice from UrPlaced. No signature is required.",
        40,
        760,
        { align: "center", width: 515 }
      );

      doc.end();
    });
  }

  /**
   * Generates genuine binary PDF bytes for a credit note (Correction C / Q20).
   */
  static async generateCreditNotePdf(creditNoteId: string, admin = createAdminClient()): Promise<Buffer> {
    const { data: note, error } = await admin
      .from("credit_notes")
      .select(`
        *,
        tenants (
          name,
          slug,
          billing_address,
          gstin
        ),
        platform_invoices (
          invoice_number
        )
      `)
      .eq("id", creditNoteId)
      .single();

    if (error || !note) {
      throw new Error(`Credit note not found: ${creditNoteId}`);
    }

    const tenant = (note.tenants as any) || {};
    const invoice = (note.platform_invoices as any) || {};

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err: Error) => reject(err));

      // Header Brand
      doc.fillColor("#2E8F86").fontSize(22).font("Helvetica-Bold").text("UrPlaced", 40, 40);
      doc.fillColor("#747683").fontSize(9).font("Helvetica").text("Credit Adjustment Note", 40, 66);

      doc.fillColor("#24283A").fontSize(18).font("Helvetica-Bold").text("CREDIT NOTE", 400, 40, { align: "right" });
      doc.fillColor("#2E8F86").fontSize(11).font("Helvetica-Bold").text(note.credit_note_number, 400, 64, { align: "right" });

      doc.moveTo(40, 85).lineTo(555, 85).strokeColor("#DDDCD5").lineWidth(1).stroke();

      const metaY = 95;
      doc.fillColor("#747683").fontSize(9).font("Helvetica");
      doc.text("Issue Date:", 40, metaY);
      doc.text("Original Invoice:", 200, metaY);
      doc.text("Reason:", 380, metaY);

      doc.fillColor("#24283A").fontSize(10).font("Helvetica-Bold");
      doc.text(new Date(note.issued_at).toLocaleDateString("en-IN"), 40, metaY + 12);
      doc.text(invoice.invoice_number || "INV-ORIGINAL", 200, metaY + 12);
      doc.font("Helvetica").text(note.reason || "Refund Adjustment", 380, metaY + 12, { width: 175 });

      // Parties
      const addrY = 140;
      doc.fillColor("#2E8F86").fontSize(10).font("Helvetica-Bold").text("ISSUED TO CLIENT", 40, addrY);
      doc.fillColor("#24283A").fontSize(9).font("Helvetica-Bold").text(tenant.name || "Client", 40, addrY + 14);
      doc.font("Helvetica").fillColor("#747683");
      doc.text(`GSTIN: ${tenant.gstin || "Exempt / Unregistered"}`, 40, addrY + 26);

      // Amount Breakdown
      const tableY = 200;
      doc.rect(40, tableY, 515, 24).fill("#F8F7F3");
      doc.fillColor("#24283A").fontSize(9).font("Helvetica-Bold");
      doc.text("DESCRIPTION", 50, tableY + 7);
      doc.text("BASE CREDIT", 360, tableY + 7, { width: 80, align: "right" });
      doc.text("TOTAL CREDITED", 465, tableY + 7, { width: 80, align: "right" });

      const rowY = tableY + 30;
      const baseInr = Number(note.amount_inr || 0);
      const taxInr = Number(note.tax_inr || 0);
      const totalInr = Number(note.total_inr || (baseInr + taxInr));

      doc.fillColor("#24283A").fontSize(9).font("Helvetica");
      doc.text(`Refund adjustment against institutional invoice ${invoice.invoice_number || ""}`, 50, rowY, { width: 280 });
      doc.text(`₹${baseInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 360, rowY, { width: 80, align: "right" });
      doc.fillColor("#2E8F86").font("Helvetica-Bold").text(`₹${totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`, 465, rowY, { width: 80, align: "right" });

      doc.moveTo(40, rowY + 35).lineTo(555, rowY + 35).strokeColor("#DDDCD5").stroke();

      doc.fillColor("#747683").fontSize(8).font("Helvetica").text(
        "Statutory credit adjustment note issued by UrPlaced Technologies Private Limited.",
        40,
        760,
        { align: "center", width: 515 }
      );

      doc.end();
    });
  }
}

