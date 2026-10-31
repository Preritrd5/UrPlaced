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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Financial Operations
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Billing &amp; Invoice Records
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Manage institutional invoice statements, track incoming revenue, and verify payment records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchBillingData}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 gap-1.5 shadow-sm"
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
      <div className="p-4 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/50 flex items-start gap-3 text-xs text-[#24283A]">
        <Info className="h-4 w-4 text-[#5052C9] shrink-0 mt-0.5" />
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
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl p-5">
          <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
            Total Revenue Collected
          </span>
          <div className="text-3xl font-extrabold font-heading text-emerald-800 mt-2">
            ₹{totalCollected.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-[#747683] mt-1">Confirmed settlement invoices</div>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl p-5">
          <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
            Outstanding / Pending
          </span>
          <div className="text-3xl font-extrabold font-heading text-amber-800 mt-2">
            ₹{totalOutstanding.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-[#747683] mt-1">Awaiting institutional remittance</div>
        </Card>

        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl p-5">
          <span className="text-[11px] font-mono font-bold text-[#747683] uppercase">
            Total Invoices Issued
          </span>
          <div className="text-3xl font-extrabold font-heading text-[#24283A] mt-2">
            {invoices.length}
          </div>
          <div className="text-xs text-[#747683] mt-1">Persisted billing statements</div>
        </Card>
      </div>

      {/* Invoices Table Card */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold font-heading text-[#24283A]">
              Billing Invoices
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Institutional invoice history and payment reconciliation
            </CardDescription>
          </div>
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg px-3 py-1.5 text-[#24283A] outline-none"
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
              <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
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
              <tbody className="divide-y divide-[#B8B6AC]/20">
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
                    <tr key={inv.id} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="px-5 py-3.5 font-mono font-bold text-[#5052C9]">
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
                        <div className="font-bold text-[#24283A]">{inv.tenantName}</div>
                        <div className="text-[10px] text-[#747683] font-mono">{inv.paymentMethod}</div>
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[#24283A]">
                        <div>₹{inv.totalInr.toLocaleString("en-IN")}</div>
                        <div className="text-[10px] text-[#747683]">
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
                      <td className="px-5 py-3.5 font-mono text-[#747683]">
                        {new Date(inv.issueDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[#747683]">
                        {new Date(inv.dueDate).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {inv.status !== "PAID" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPayTarget(inv)}
                            className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                          >
                            Record Payment
                          </Button>
                        )}
                        {inv.status === "PAID" && (
                          <span className="text-[11px] text-emerald-700 font-medium">
                            Paid {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString() : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-[#747683]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                Record Payment for {payTarget.invoiceNumber}
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                {payTarget.tenantName} &bull; Total: ₹{payTarget.totalInr.toLocaleString()}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRecordPayment}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg p-2 text-[#24283A] outline-none"
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
                    className="rounded border-[#B8B6AC]"
                  />
                  <label htmlFor="isDemo" className="text-xs text-[#24283A]">
                    Mark as demonstration / sandbox test payment
                  </label>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">
                    Payment Notes / Reference No.
                  </label>
                  <Input
                    placeholder="e.g. UTR #1234567890 or Cheque #456"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPayTarget(null)}
                    disabled={payLoading}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={payLoading}
                    className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                Generate Platform Invoice
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleCreateInvoice}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">Select College</label>
                  <select
                    required
                    value={createTenantId}
                    onChange={(e) => setCreateTenantId(e.target.value)}
                    className="w-full bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg p-2 text-[#24283A] outline-none"
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
                  <label className="text-xs font-semibold text-[#24283A]">Amount (INR)</label>
                  <Input
                    type="number"
                    required
                    value={createAmount}
                    onChange={(e) => setCreateAmount(e.target.value)}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                  />
                  <p className="text-[10px] text-[#747683]">
                    18% GST will be calculated automatically upon invoice issuance.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">Invoice Description</label>
                  <Input
                    placeholder="e.g. Annual campus subscription fee"
                    value={createNotes}
                    onChange={(e) => setCreateNotes(e.target.value)}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={createLoading}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createLoading}
                    className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9"
                  >
                    {createLoading ? "Generating..." : "Generate Invoice"}
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
