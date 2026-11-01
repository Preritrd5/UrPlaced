"use client";

import * as React from "react";
import Link from "next/link";
import {
  CreditCard,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  User,
  ArrowRight,
  Mail,
  FileText,
  Lock,
  Download,
  RotateCcw,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RazorpayCheckoutButton } from "@/components/billing/razorpay-checkout-button";

interface SubscriptionDetails {
  tenantId: string;
  collegeName: string;
  officialEmail: string | null;
  contactName: string | null;
  studentSeatLimit: number;
  subscription: {
    id: string;
    status: string;
    renewalDate: string;
    planId: string;
    planName: string;
    priceAnnual: number | null;
    features: string[];
  } | null;
  invoice?: {
    id: string;
    invoiceNumber: string;
    amountInr: number;
    taxInr: number;
    totalInr: number;
    currency: string;
    status: string;
    dueDate: string;
    razorpayOrderId?: string | null;
  } | null;
}

export default function CollegeBillingPage() {
  const auth = useAuthContext();
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<SubscriptionDetails | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [transactions, setTransactions] = React.useState<any[]>([]);
  const [mandate, setMandate] = React.useState<any>(null);
  const [billingMode, setBillingMode] = React.useState<"MANUAL" | "AUTOMATIC">("MANUAL");
  const [actionFeedback, setActionFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Mandate Consent Modal (Q4, Q30)
  const [showConsentModal, setShowConsentModal] = React.useState(false);
  const [consentAgreed, setConsentAgreed] = React.useState(false);
  const [mandateLoading, setMandateLoading] = React.useState(false);

  // Cancellation Modal (Q15)
  const [showCancelModal, setShowCancelModal] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelLoading, setCancelLoading] = React.useState(false);

  const fetchSubscription = React.useCallback(() => {
    Promise.all([
      fetch("/api/placement/subscription").then((res) => {
        if (!res.ok) throw new Error("Failed to load subscription details");
        return res.json();
      }),
      fetch("/api/placement/billing/transactions").then((res) => (res.ok ? res.json() : { transactions: [], mandate: null })),
    ])
      .then(([subData, txData]) => {
        setData(subData);
        setTransactions(txData.transactions || []);
        setMandate(txData.mandate || null);
        if (txData.mandate?.status === "ACTIVE") {
          setBillingMode("AUTOMATIC");
        } else {
          setBillingMode("MANUAL");
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Handle Billing Mode Toggle (Q8 & Q9)
  async function handleToggleBillingMode(newMode: "MANUAL" | "AUTOMATIC") {
    if (newMode === "AUTOMATIC" && !consentAgreed) {
      setShowConsentModal(true);
      return;
    }

    setMandateLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/placement/subscription/billing-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: newMode,
          consentGiven: newMode === "AUTOMATIC",
          termsVersion: "v1.0",
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: "error", text: resData.error || "Failed to update billing renewal mode." });
      } else {
        setActionFeedback({ type: "success", text: resData.message });
        setBillingMode(newMode);
        setShowConsentModal(false);
        await fetchSubscription();
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error updating billing mode." });
    } finally {
      setMandateLoading(false);
    }
  }

  // Handle Placement Head Cancellation Request (Q15)
  async function handleRequestCancellation(e: React.FormEvent) {
    e.preventDefault();
    setCancelLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/placement/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: "error", text: resData.error || "Failed to submit cancellation request." });
      } else {
        setActionFeedback({ type: "success", text: resData.message });
        setShowCancelModal(false);
        setCancelReason("");
        await fetchSubscription();
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error submitting cancellation." });
    } finally {
      setCancelLoading(false);
    }
  }

  if (loading || auth.isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6 animate-pulse">
        <div className="h-8 bg-card/60 rounded-xl w-1/3" />
        <div className="h-4 bg-card/40 rounded-lg w-1/2" />
        <div className="grid gap-4 sm:grid-cols-2 mt-6">
          <div className="h-48 bg-card rounded-2xl border border-border" />
          <div className="h-48 bg-card rounded-2xl border border-border" />
        </div>
      </div>
    );
  }

  const subStatus = data?.subscription?.status || (auth.tenant as any)?.subscriptionStatus || "PENDING_PAYMENT";
  const isPending = subStatus === "PENDING_PAYMENT";
  const isActive = subStatus === "ACTIVE";

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DDDCD5] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-mono uppercase font-semibold text-[#5052C9] tracking-wider">
              Institutional Entitlements
            </span>
            <Badge
              variant="outline"
              className={
                isActive
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                  : isPending
                  ? "bg-amber-50 text-amber-800 border-amber-300 font-mono text-[10px]"
                  : "bg-red-50 text-red-800 border-red-300 font-mono text-[10px]"
              }
            >
              {subStatus.replace("_", " ")}
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Subscription &amp; Billing
          </h1>
          <p className="text-xs sm:text-sm text-[#747683] mt-1">
            Manage your college institutional placement subscription, entitlements, and commercial status.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 text-xs border-[#DDDCD5]">
            <Link href="/dashboard/profile">
              <User className="h-3.5 w-3.5 mr-1.5" /> My Profile
            </Link>
          </Button>
        </div>
      </div>

      {/* Pending Payment Notice Banner */}
      {isPending && (
        <Card className="bg-amber-50/70 border-amber-300 shadow-xs rounded-2xl">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="h-5 w-5" />
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <h3 className="text-sm font-bold font-heading text-amber-950">
                  Institutional Subscription Pending Activation
                </h3>
                <p className="text-xs text-amber-900/90 leading-relaxed mt-1">
                  Your college account was successfully provisioned by administrative invitation. Full operational placement cell capabilities (student directory, drive creation, company management, and automated assessments) are locked until your subscription payment is completed and verified.
                </p>
              </div>

              {/* Checkout Card if invoice is available */}
              {data?.invoice && data.invoice.status !== "PAID" && (
                <div className="p-4 rounded-xl bg-[#FBFAF7] border border-amber-300/80 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[#DDDCD5]">
                    <div>
                      <div className="text-[11px] font-mono text-[#747683] uppercase">Outstanding Institutional Invoice</div>
                      <div className="text-sm font-bold font-mono text-[#24283A]">{data.invoice.invoiceNumber}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] font-mono text-[#747683] uppercase">Total Amount Due</div>
                      <div className="text-base font-extrabold font-mono text-[#5052C9]">
                        ₹{data.invoice.totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-[#747683]">
                        (₹{data.invoice.amountInr.toLocaleString()} + ₹{data.invoice.taxInr.toLocaleString()} 18% GST)
                      </div>
                    </div>
                  </div>

                  {auth.role === "PLACEMENT_HEAD" || auth.isPlatformAdmin ? (
                    <div className="pt-1">
                      <RazorpayCheckoutButton
                        invoiceId={data.invoice.id}
                        invoiceNumber={data.invoice.invoiceNumber}
                        totalInr={data.invoice.totalInr}
                        contactName={data.contactName || auth.fullName || undefined}
                        officialEmail={data.officialEmail || auth.email || undefined}
                        onPaymentSuccess={fetchSubscription}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-amber-800 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                      Only the institutional Placement Head ({data?.contactName || "registered head"}) can authorize online payment.
                    </div>
                  )}
                </div>
              )}

              <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] font-mono text-amber-800">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                  Account Secured
                </span>
                <span>&bull;</span>
                <span>Permitted: Profile &amp; Billing Access</span>
                <span>&bull;</span>
                <span className="font-semibold">Razorpay Test Mode Active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid: Plan Details & Institutional Profile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left 2 cols: Subscription Plan Details */}
        <Card className="md:col-span-2 bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
          <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-[#5052C9]" />
              <span>Assigned Institutional Plan</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Provisioned by Platform Super Admin during institutional onboarding
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5]">
              <div>
                <div className="text-xs text-[#747683] font-mono uppercase">Current Plan</div>
                <div className="text-lg font-bold font-heading text-[#24283A]">
                  {data?.subscription?.planName || "Campus Growth"}
                </div>
                <div className="text-xs text-[#747683] mt-0.5">
                  Seat Limit:{" "}
                  <span className="font-bold text-[#24283A]">
                    {data?.studentSeatLimit ? `${data.studentSeatLimit.toLocaleString()} Students` : "Standard Tier"}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-[#747683] font-mono uppercase">Billing Status</div>
                <Badge
                  variant="outline"
                  className={
                    isActive
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-xs"
                      : "bg-amber-50 text-amber-800 border-amber-300 font-mono text-xs"
                  }
                >
                  {subStatus.replace("_", " ")}
                </Badge>
              </div>
            </div>

            {/* Included Features */}
            <div className="space-y-2 pt-1">
              <div className="text-xs font-bold text-[#24283A] font-heading">
                Entitlements Included Upon Activation:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-[#24283A]">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                  <span>Student Roster &amp; SRN Claims</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                  <span>Recruitment Drives &amp; Pipelines</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                  <span>AI Mistake Remediation Bank</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]">
                  <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                  <span>Placement Memory &amp; Analytics</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right col: Contact & Activation Info */}
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
          <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#5052C9]" />
              <span>Institutional Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-3.5 text-xs text-[#24283A]">
            <div>
              <span className="text-[#747683] block text-[11px]">Institution</span>
              <span className="font-bold">{data?.collegeName || "Your College"}</span>
            </div>
            <div>
              <span className="text-[#747683] block text-[11px]">Placement Head</span>
              <span className="font-semibold">{data?.contactName || auth.fullName || "Placement Head"}</span>
            </div>
            <div>
              <span className="text-[#747683] block text-[11px]">Bound Email</span>
              <span className="font-mono">{data?.officialEmail || auth.email}</span>
            </div>

            <div className="p-3 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] space-y-2 mt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#24283A] text-[11px] uppercase tracking-wide">Renewal Billing Mode</span>
                <Badge
                  variant="outline"
                  className={
                    billingMode === "AUTOMATIC"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                      : "bg-[#EDECE7] text-[#24283A] border-[#B8B6AC] font-mono text-[10px]"
                  }
                >
                  {billingMode} (Default: Manual)
                </Badge>
              </div>
              <p className="text-[11px] text-[#747683] leading-relaxed">
                {billingMode === "AUTOMATIC"
                  ? "Automatic renewal is active. Your card/mandate will renew at the next annual milestone."
                  : "Manual invoice payment is active. You will receive renewal reminders starting 7 days before expiry."}
              </p>
              {auth.role === "PLACEMENT_HEAD" && (
                <div className="pt-1">
                  {billingMode === "MANUAL" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowConsentModal(true)}
                      className="w-full text-xs h-8 border-[#5052C9] text-[#5052C9] hover:bg-[#5052C9]/5 cursor-pointer"
                    >
                      Enable Automatic Renewal
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleBillingMode("MANUAL")}
                      disabled={mandateLoading}
                      className="w-full text-xs h-8 border-red-300 text-red-700 hover:bg-red-50 cursor-pointer"
                    >
                      Switch to Manual Renewal
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Placement Head Cancellation Request (Q15) */}
            {auth.role === "PLACEMENT_HEAD" && isActive && (
              <div className="pt-2 border-t border-[#DDDCD5]">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCancelModal(true)}
                  className="w-full text-[11px] text-[#747683] hover:text-red-700 hover:bg-red-50/50 h-7"
                >
                  Request Subscription Cancellation
                </Button>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] space-y-1.5 mt-2">
              <div className="font-bold text-[#24283A] flex items-center gap-1.5 text-[11px]">
                <Mail className="h-3.5 w-3.5 text-[#5052C9]" />
                Platform Support Contact
              </div>
              <p className="text-[11px] text-[#747683] leading-relaxed">
                For subscription activation or payment queries, contact platform administration at{" "}
                <span className="font-mono font-semibold text-[#5052C9]">urplaced5@gmail.com</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History & Invoices (Q14) */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#5052C9]" />
              <span>Institutional Transaction History &amp; Invoices</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Complete historical ledger of verified gateway payments, refunds, and issued tax invoices.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSubscription}
            className="border-[#DDDCD5] text-xs h-8 gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" /> Refresh Ledger
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FBFAF7] border-b border-[#DDDCD5] text-[#747683] font-mono uppercase text-[10px]">
                <tr>
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Invoice Number</th>
                  <th className="px-5 py-3 font-semibold">Amount (INR)</th>
                  <th className="px-5 py-3 font-semibold">Method</th>
                  <th className="px-5 py-3 font-semibold">Gateway Ref</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Documents</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#DDDCD5]/40 text-[#24283A]">
                {transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#FBFAF7] transition-colors">
                      <td className="px-5 py-3.5 font-mono text-[#747683]">
                        {new Date(tx.createdAt).toLocaleDateString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-bold text-[#5052C9]">
                        {tx.invoiceNumber}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-semibold">
                        ₹{tx.amountInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        {tx.refundedAmountInr > 0 && (
                          <div className="text-[10px] text-amber-700">
                            (Refunded: ₹{tx.refundedAmountInr.toLocaleString("en-IN")})
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 uppercase font-mono text-[11px] text-[#747683]">
                        {tx.method}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[11px] text-[#747683]">
                        {tx.paymentId || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge
                          variant="outline"
                          className={
                            tx.status === "CAPTURED"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                              : tx.status === "FAILED"
                              ? "bg-red-50 text-red-800 border-red-300 font-mono text-[10px]"
                              : "bg-amber-50 text-amber-800 border-amber-300 font-mono text-[10px]"
                          }
                        >
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/billing/invoices/${tx.invoiceId}/download`, "_blank")}
                          className="h-7 text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#FBFAF7] cursor-pointer"
                        >
                          <Download className="h-3 w-3 mr-1" /> Tax Invoice
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-[#747683]">
                      No previous payment transactions recorded for this college account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Mandate Consent Modal (Q4 & Q30) */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-[#B8B6AC] shadow-xl rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#5052C9]" />
                <span>Authorize Automatic Annual Renewal</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Explicit consent required per UrPlaced financial compliance (Q4)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs text-[#24283A]">
              <p className="leading-relaxed">
                By enabling automatic renewal, you authorize UrPlaced to automatically charge your institutional payment method annually on your renewal date (
                <strong className="font-semibold">{data?.subscription?.renewalDate ? new Date(data.subscription.renewalDate).toLocaleDateString("en-IN") : "next anniversary"}</strong>
                ).
              </p>
              <div className="p-3 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] space-y-2">
                <div className="font-bold text-[#5052C9]">Mandate Terms &amp; Protections:</div>
                <ul className="list-disc pl-4 space-y-1 text-[#747683]">
                  <li><strong>No immediate charge today:</strong> Mode change takes effect at your next renewal milestone.</li>
                  <li><strong>Pre-collection alert:</strong> We will email you 2 days prior to any renewal collection.</li>
                  <li><strong>Cancel anytime:</strong> You may switch back to manual payment or cancel renewal at any time.</li>
                </ul>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="consentCheck"
                  checked={consentAgreed}
                  onChange={(e) => setConsentAgreed(e.target.checked)}
                  className="rounded border-[#B8B6AC] text-[#5052C9] h-4 w-4 cursor-pointer"
                />
                <label htmlFor="consentCheck" className="text-xs font-semibold text-[#24283A] cursor-pointer">
                  I authorize UrPlaced to automatically process annual renewals for this institution.
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-[#B8B6AC]/30">
                <Button
                  variant="outline"
                  onClick={() => setShowConsentModal(false)}
                  className="border-[#B8B6AC] text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleToggleBillingMode("AUTOMATIC")}
                  disabled={!consentAgreed || mandateLoading}
                  className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 cursor-pointer"
                >
                  {mandateLoading ? "Recording Authorization..." : "Confirm & Enable"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Period-End Cancellation Modal (Q15) */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-[#B8B6AC] shadow-xl rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Request Subscription Cancellation</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Placement Head scheduled period-end cancellation (Q15)
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleRequestCancellation}>
              <CardContent className="p-5 space-y-4 text-xs text-[#24283A]">
                <p className="leading-relaxed">
                  Per UrPlaced cancellation policy, institutional access will remain fully active until the end of your paid billing period (
                  <strong className="font-semibold">
                    {data?.subscription?.renewalDate ? new Date(data.subscription.renewalDate).toLocaleDateString("en-IN") : "end of term"}
                  </strong>
                  ). No further renewal invoices or automatic charges will occur.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">
                    Reason for Cancellation (Optional)
                  </label>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Academic year completed / Budget adjustments"
                    className="w-full bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg p-2.5 text-[#24283A] outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCancelModal(false)}
                    disabled={cancelLoading}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    type="submit"
                    disabled={cancelLoading}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 cursor-pointer"
                  >
                    {cancelLoading ? "Submitting..." : "Confirm Cancellation at Period End"}
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
