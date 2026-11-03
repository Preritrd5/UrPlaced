"use client";

import * as React from "react";
import {
  Receipt,
  PlusCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  CreditCard,
  Building2,
  FileText,
  DollarSign,
  Info,
  ShieldCheck,
  Download,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlatformInvoiceItem } from "@/modules/platform-admin/services/platform-billing-service";
import type { CollegeListItem } from "@/modules/platform-admin/services/platform-college-service";

export default function PlatformBillingPage() {
  const [invoices, setInvoices] = React.useState<PlatformInvoiceItem[]>([]);
  const [colleges, setColleges] = React.useState<CollegeListItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter
  const [statusFilter, setStatusFilter] = React.useState("ALL");

  // Record Payment Modal
  const [payTarget, setPayTarget] = React.useState<PlatformInvoiceItem | null>(null);
  const [paymentMethod, setPaymentMethod] = React.useState("BANK_TRANSFER");
  const [isDemoPayment, setIsDemoPayment] = React.useState(false);
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [payLoading, setPayLoading] = React.useState(false);

  // Create Invoice Modal
  const [showCreateModal, setShowCreateModal] = React.useState(false);
  const [createTenantId, setCreateTenantId] = React.useState("");
  const [createAmount, setCreateAmount] = React.useState("49999");
  const [createNotes, setCreateNotes] = React.useState("");
  const [createLoading, setCreateLoading] = React.useState(false);

  // Refund Modal (Q10 & Q20)
  const [refundTarget, setRefundTarget] = React.useState<PlatformInvoiceItem | null>(null);
  const [refundAmount, setRefundAmount] = React.useState("");
  const [refundReason, setRefundReason] = React.useState("");
  const [subscriptionAction, setSubscriptionAction] = React.useState<"KEEP_ACTIVE" | "CANCEL_IMMEDIATELY" | "CANCEL_AT_PERIOD_END">("KEEP_ACTIVE");
  const [refundLoading, setRefundLoading] = React.useState(false);

  // Reconciliation state (Q18 & Q21)
  const [reconciling, setReconciling] = React.useState(false);

  const fetchBillingData = React.useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const [invRes, colRes] = await Promise.all([
        fetch(`/api/preritrd/billing/invoices?${params.toString()}`),
        fetch("/api/preritrd/colleges"),
      ]);

      const invData = await invRes.json();
      const colData = await colRes.json();

      if (invRes.ok) setInvoices(invData.invoices || []);
      if (colRes.ok) setColleges(colData.colleges || []);
    } catch {
      setFeedback({ type: "error", text: "Network error loading billing invoices." });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  React.useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  // Handle Record Payment
  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payTarget) return;
    setPayLoading(true);

    try {
      const res = await fetch(`/api/preritrd/billing/invoices/${payTarget.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod,
          isDemo: isDemoPayment,
          notes: paymentNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to record payment." });
      } else {
        setFeedback({
          type: "success",
          text: `Payment of ₹${payTarget.totalInr.toLocaleString()} recorded for invoice ${payTarget.invoiceNumber}.`,
        });
        setPayTarget(null);
        setPaymentNotes("");
        await fetchBillingData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error recording payment." });
    } finally {
      setPayLoading(false);
    }
  }

  // Handle Create Invoice
  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    if (!createTenantId || !createAmount) return;
    setCreateLoading(true);

    try {
      const res = await fetch("/api/preritrd/billing/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: createTenantId,
          amountInr: Number(createAmount),
          notes: createNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to generate invoice." });
      } else {
        setFeedback({
          type: "success",
          text: `Invoice ${data.invoice.invoiceNumber} generated successfully.`,
        });
        setShowCreateModal(false);
        setCreateTenantId("");
        setCreateAmount("49999");
        setCreateNotes("");
        await fetchBillingData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error generating invoice." });
    } finally {
      setCreateLoading(false);
    }
  }

  // Handle Issue Refund (Q10 & Q20)
  async function handleIssueRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundTarget || !refundReason.trim()) return;
    setRefundLoading(true);

    try {
      const res = await fetch("/api/preritrd/billing/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceId: refundTarget.id,
          amountInr: refundAmount ? Number(refundAmount) : undefined,
          reason: refundReason.trim(),
          subscriptionAction,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to issue refund." });
      } else {
        setFeedback({
          type: "success",
          text: `Refund of ₹${data.result.amountInr.toLocaleString()} processed successfully. Credit Note ${data.result.creditNoteNumber} issued.`,
        });
        setRefundTarget(null);
        setRefundAmount("");
        setRefundReason("");
        setSubscriptionAction("KEEP_ACTIVE");
        await fetchBillingData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error processing refund." });
    } finally {
      setRefundLoading(false);
    }
  }

  // Handle Run Reconciliation (Q18 & Q21)
  async function handleRunReconcile() {
    setReconciling(true);
    try {
      const res = await fetch("/api/preritrd/billing/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sweepType: "15_MIN" }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({
          type: "success",
          text: `Reconciliation complete: ${data.summary.scannedOrders} orders scanned, ${data.summary.reconciledCaptured} reconciled, ${data.summary.discrepanciesFound} discrepancies found.`,
        });
        await fetchBillingData();
      } else {
        setFeedback({ type: "error", text: data.error || "Reconciliation sweep failed." });
      }
    } catch {
      setFeedback({ type: "error", text: "Network error triggering reconciliation." });
    } finally {
      setReconciling(false);
    }
  }

  // Derived KPI metrics
  const totalCollected = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + i.totalInr, 0);

  const totalOutstanding = invoices
    .filter((i) => i.status === "PENDING" || i.status === "OVERDUE")
    .reduce((sum, i) => sum + i.totalInr, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">
            Financial Operations
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Billing &amp; Invoice Records
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Manage institutional invoice statements, track incoming revenue, and verify payment records.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("format", "csv");
              if (statusFilter !== "ALL") params.set("status", statusFilter);
              window.open(`/api/preritrd/billing/export?${params.toString()}`, "_blank");
            }}
            className="border-border text-xs h-9 gap-1.5 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const params = new URLSearchParams();
              params.set("format", "xlsx");
              if (statusFilter !== "ALL") params.set("status", statusFilter);
              window.open(`/api/preritrd/billing/export?${params.toString()}`, "_blank");
            }}
            className="border-border text-xs h-9 gap-1.5 cursor-pointer text-secondary hover:bg-emerald-50"
          >
            <Download className="h-3.5 w-3.5" /> Export Excel (.xlsx)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunReconcile}
            disabled={reconciling}
            className="border-border text-xs h-9 gap-1.5 cursor-pointer"
          >
            <ShieldCheck className={`h-3.5 w-3.5 ${reconciling ? "animate-spin" : ""}`} /> Reconcile
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBillingData}
            disabled={loading}
            className="border-border text-xs h-9 gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 gap-1.5 shadow-xs cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" /> Generate Invoice
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold px-2">
            &times;
          </button>
        </div>
      )}

      {/* Demo Gateway Disclaimer Callout */}
      <div className="p-4 rounded-xl bg-surface border border-border flex items-start gap-3 text-xs text-text-primary">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold">Payment Gateway Integration Status:</span> Standard bank transfer verification is active. Demonstration payment workflows can be executed for sandbox testing and will be clearly flagged with a{" "}
          <Badge variant="outline" className="text-[9px] font-mono border-amber-300 text-amber-800 bg-amber-50">
            DEMO
          </Badge>{" "}
          badge. Live payment provider gateway credentials can be attached without altering the core billing record model.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card border-border shadow-xs rounded-2xl p-5">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
            Total Revenue Collected
          </span>
          <div className="text-3xl font-extrabold font-heading text-emerald-800 mt-2">
            ₹{totalCollected.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-text-secondary mt-1">Confirmed settlement invoices</div>
        </Card>

        <Card className="bg-card border-border shadow-xs rounded-2xl p-5">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
            Outstanding / Pending
          </span>
          <div className="text-3xl font-extrabold font-heading text-amber-800 mt-2">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-text-secondary mt-1">Awaiting institutional remittance</div>
        </Card>

        <Card className="bg-card border-border shadow-xs rounded-2xl p-5">
          <span className="text-[11px] font-mono font-bold text-text-secondary uppercase">
            Total Invoices Issued
          </span>
          <div className="text-3xl font-extrabold font-heading text-text-primary mt-2">
            {invoices.length}
          </div>
          <div className="text-xs text-text-secondary mt-1">Persisted billing statements</div>
        </Card>
      </div>

      {/* Invoices Table Card */}
      <Card className="bg-card border-border shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/60 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold font-heading text-text-primary">
              Billing Invoices
            </CardTitle>
            <CardDescription className="text-xs text-text-secondary/70">
              Institutional invoice history and payment reconciliation
            </CardDescription>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface border border-border text-xs rounded-lg px-3 py-1.5 text-text-primary outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">PAID</option>
              <option value="PENDING">PENDING</option>
              <option value="OVERDUE">OVERDUE</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface text-text-secondary font-mono text-[10px] uppercase border-b border-border/60">
                <tr>
                  <th className="px-5 py-3 font-semibold">Invoice #</th>
                  <th className="px-5 py-3 font-semibold">College / Tenant</th>
                  <th className="px-5 py-3 font-semibold">Amount + Tax</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Issue Date</th>
                  <th className="px-5 py-3 font-semibold">Due Date</th>
                  <th className="px-5 py-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={7} className="px-5 py-4">
                        <Skeleton className="h-5 w-full bg-gray-200" />
                      </td>
                    </tr>
                  ))
                ) : invoices.length > 0 ? (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surface transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-primary">
                        {inv.invoiceNumber}
                        {inv.isDemo && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-[8px] font-mono border-amber-300 text-amber-800 bg-amber-50"
                          >
                            DEMO
                          </Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-text-primary">{inv.tenantName}</div>
                        <div className="text-[10px] text-text-secondary font-mono">{inv.paymentMethod}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-primary">
                        <div>₹{inv.totalInr.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-text-secondary">
                          Base: ₹{inv.amountInr.toLocaleString()} + Tax: ₹{inv.taxInr.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant={inv.status === "PAID" ? "default" : "secondary"}
                          className={
                            inv.status === "PAID"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px]"
                              : inv.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px]"
                              : "bg-red-100 text-red-800 font-mono text-[10px]"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-secondary">
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-text-secondary">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.status !== "PAID" && inv.status !== "REFUNDED" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setPayTarget(inv)}
                              className="h-7 text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                            >
                              Record Payment
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/billing/invoices/${inv.id}/download`, "_blank")}
                            className="h-7 text-xs border-border text-text-primary hover:bg-surface cursor-pointer"
                          >
                            <FileText className="h-3 w-3 mr-1" /> View
                          </Button>
                          {inv.status === "PAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setRefundTarget(inv);
                                setRefundAmount(String(inv.totalInr));
                              }}
                              className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-50 cursor-pointer"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Refund
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-text-secondary">
                      No billing invoices recorded matching filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm">
          <Card className="w-full max-w-md bg-card border-border shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold font-heading text-text-primary">
                Record Payment for {payTarget.invoiceNumber}
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary/70">
                {payTarget.tenantName} &bull; Total: ₹{payTarget.totalInr.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRecordPayment}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-surface border border-border text-xs rounded-lg p-2 text-text-primary outline-none"
                  >
                    <option value="BANK_TRANSFER">Direct Institutional Wire / NEFT</option>
                    <option value="CARD">Credit / Debit Card</option>
                    <option value="UPI">Institutional UPI</option>
                    <option value="DEMO_GATEWAY">Demo Payment Gateway (Sandbox)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isDemo"
                    checked={isDemoPayment}
                    onChange={(e) => setIsDemoPayment(e.target.checked)}
                    className="rounded border-border"
                  />
                  <label htmlFor="isDemo" className="text-xs text-text-primary">
                    Mark as demonstration / sandbox test payment
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Payment Notes / Reference No.
                  </label>
                  <Input
                    placeholder="e.g. UTR #1234567890 or Cheque #456"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="bg-surface border-border text-xs h-9"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPayTarget(null)}
                    disabled={payLoading}
                    className="border-border text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={payLoading}
                    className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9"
                  >
                    {payLoading ? "Processing..." : "Confirm Payment"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Generate Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm">
          <Card className="w-full max-w-md bg-card border-border shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold font-heading text-text-primary">
                Generate Platform Invoice
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateInvoice}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Select College</label>
                  <select
                    required
                    value={createTenantId}
                    onChange={(e) => setCreateTenantId(e.target.value)}
                    className="w-full bg-surface border border-border text-xs rounded-lg p-2 text-text-primary outline-none"
                  >
                    <option value="">Select an institution...</option>
                    {colleges.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Amount (INR)</label>
                  <Input
                    type="number"
                    required
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    className="bg-surface border-border text-xs h-9 font-mono"
                  />
                  <p className="text-[10px] text-text-secondary">
                    18% GST will be calculated automatically upon invoice issuance.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Invoice Description</label>
                  <Input
                    placeholder="e.g. Annual campus subscription fee"
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    className="bg-surface border-border text-xs h-9"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createLoading}
                    className="border-border text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createLoading}
                    className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9"
                  >
                    {createLoading ? "Generating..." : "Generate Invoice"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Issue Refund Modal (Q10 & Q20) */}
      {refundTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm">
          <Card className="w-full max-w-lg bg-card border-border shadow-xl rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-amber-700" />
                <span>Issue Refund &mdash; {refundTarget.invoiceNumber}</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary/70">
                {refundTarget.tenantName} &bull; Total Paid: ₹{refundTarget.totalInr.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleIssueRefund}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Refund Amount (INR)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    max={refundTarget.totalInr}
                    className="bg-surface border-border text-xs h-9 font-mono"
                  />
                  <p className="text-[10px] text-text-secondary">
                    Maximum refundable amount: ₹{refundTarget.totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">
                    Mandatory Refund Reason
                  </label>
                  <Input
                    placeholder="e.g. Approved administrative concession / institutional adjustment"
                    required
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    className="bg-surface border-border text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                    <span>Subscription Action (Q10)</span>
                    <Badge variant="outline" className="text-[9px] font-mono border-amber-300 bg-amber-50 text-amber-800">
                      Decoupled Action
                    </Badge>
                  </label>
                  <select
                    value={subscriptionAction}
                    onChange={(e) => setSubscriptionAction(e.target.value as any)}
                    className="w-full bg-surface border border-border text-xs rounded-lg p-2.5 text-text-primary outline-none font-medium"
                  >
                    <option value="KEEP_ACTIVE">Keep subscription active (Do not cancel)</option>
                    <option value="CANCEL_IMMEDIATELY">Cancel subscription immediately (Immediate lockout)</option>
                    <option value="CANCEL_AT_PERIOD_END">Cancel at end of paid period (Retain access until expiry)</option>
                  </select>
                  <p className="text-[10px] text-text-secondary leading-relaxed">
                    Per UrPlaced financial policy, refunds do not automatically cancel subscriptions. Choose whether this institution retains access.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-border/60">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRefundTarget(null)}
                    disabled={refundLoading}
                    className="border-border text-xs h-9 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={refundLoading}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-9 cursor-pointer"
                  >
                    {refundLoading ? "Processing Refund..." : "Confirm & Process Refund"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
