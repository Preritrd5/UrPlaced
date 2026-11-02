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
  Zap,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Check,
  Info,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandLoader } from "@/components/common/brand-loader";
import { RazorpayCheckoutButton } from "@/components/billing/razorpay-checkout-button";
import { toast } from "@/components/ui/dialog-system";

export interface SubscriptionDetails {
  tenantId: string;
  tenantStatus?: "ACTIVE" | "SUSPENDED" | "DECOMMISSIONED" | "ARCHIVED";
  collegeName: string;
  officialEmail: string | null;
  contactName: string | null;
  contactPhone?: string | null;
  studentSeatLimit: number;
  hasPreassignedPlan?: boolean;
  subscription: {
    id: string;
    status: string;
    startDate?: string;
    expiryDate?: string;
    renewalDate: string;
    gracePeriodDays?: number;
    studentSeatLimit?: number;
    staffSeatLimit?: number;
    planId: string;
    planName: string;
    priceAnnual: number | null;
    features: string[];
    pendingPlanId?: string | null;
    pendingPlanVersion?: number | null;
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
    issueDate?: string;
    paidAt?: string | null;
    paymentMethod?: string;
    notes?: string | null;
    razorpayOrderId?: string | null;
  } | null;
  availablePlans?: Array<{
    id: string;
    name: string;
    description?: string;
    priceInr: number;
    billingInterval?: string;
    studentLimit?: number;
    staffLimit?: number;
    features?: string[];
  }>;
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
  const [selectingPlanId, setSelectingPlanId] = React.useState<string | null>(null);

  // Change Plan Modal State
  const [showPlanModal, setShowPlanModal] = React.useState(false);
  const [planActionLoading, setPlanActionLoading] = React.useState(false);

  // Bank Transfer UTR Submission Modal State
  const [showBankTransferModal, setShowBankTransferModal] = React.useState(false);
  const [selectedInvoiceForUtr, setSelectedInvoiceForUtr] = React.useState<any>(null);
  const [utrInput, setUtrInput] = React.useState("");
  const [remitterBankInput, setRemitterBankInput] = React.useState("");
  const [submittingUtr, setSubmittingUtr] = React.useState(false);

  // Mandate Consent Modal
  const [showConsentModal, setShowConsentModal] = React.useState(false);
  const [consentAgreed, setConsentAgreed] = React.useState(false);
  const [mandateLoading, setMandateLoading] = React.useState(false);

  // Cancellation Modal
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

  const handlePaymentSuccess = React.useCallback(async () => {
    fetchSubscription();
    try {
      await auth.refresh();
    } catch {
      // Ignore refresh error
    }
  }, [fetchSubscription, auth]);

  React.useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Handle Option C Post-Registration Plan Selection
  async function handleSelectPlan(planId: string) {
    setSelectingPlanId(planId);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/placement/subscription/select-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: "error", text: resData.error || "Failed to select subscription plan." });
        toast.error(resData.error || "Failed to select subscription plan.");
      } else {
        setActionFeedback({ type: "success", text: resData.message });
        toast.success(resData.message || "Subscription plan initialized.");
        await fetchSubscription();
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error selecting subscription plan." });
      toast.error("Network error selecting subscription plan.");
    } finally {
      setSelectingPlanId(null);
    }
  }

  // Handle Plan Upgrade
  async function handleUpgradePlan(targetPlanId: string) {
    setPlanActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/placement/subscription/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: "error", text: resData.error || "Failed to initiate plan upgrade." });
        toast.error(resData.error || "Failed to initiate plan upgrade.");
      } else {
        toast.success(resData.message || "Upgrade invoice initialized.");
        setShowPlanModal(false);
        await fetchSubscription();
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error initiating plan upgrade." });
      toast.error("Network error initiating plan upgrade.");
    } finally {
      setPlanActionLoading(false);
    }
  }

  // Handle Plan Downgrade
  async function handleDowngradePlan(targetPlanId: string) {
    setPlanActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch("/api/placement/subscription/downgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPlanId }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionFeedback({ type: "error", text: resData.error || "Failed to schedule plan downgrade." });
        toast.error(resData.error || "Failed to schedule plan downgrade.");
      } else {
        toast.success(resData.message || "Plan downgrade scheduled for your next renewal.");
        setShowPlanModal(false);
        await fetchSubscription();
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error scheduling plan downgrade." });
      toast.error("Network error scheduling plan downgrade.");
    } finally {
      setPlanActionLoading(false);
    }
  }

  // Handle Bank Transfer Reference Submission
  async function handleSubmitUtr(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedInvoiceForUtr || !utrInput.trim()) return;
    setSubmittingUtr(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`/api/placement/billing/invoices/${selectedInvoiceForUtr.id}/reference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utrReference: utrInput.trim(),
          bankName: remitterBankInput.trim() || undefined,
        }),
      });
      const resData = await res.json();
      if (!res.ok || !resData.success) {
        setActionFeedback({ type: "error", text: resData.error || "Failed to submit bank transfer reference." });
        toast.error(resData.error || "Failed to submit bank transfer reference.");
      } else {
        toast.success(resData.message || "Bank transfer reference submitted for administrative review.");
        setShowBankTransferModal(false);
        setUtrInput("");
        setRemitterBankInput("");
        setSelectedInvoiceForUtr(null);
        await fetchSubscription();
      }
    } catch {
      setActionFeedback({ type: "error", text: "Network error submitting reference." });
      toast.error("Network error submitting reference.");
    } finally {
      setSubmittingUtr(false);
    }
  }

  // Handle Billing Mode Toggle
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

  // Handle Cancellation Request
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

  // Reconciled Billing RBAC: Only PLACEMENT_HEAD or platform super admin may manage institutional billing
  if (auth.role !== "PLACEMENT_HEAD" && !auth.isPlatformAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-8 mt-12 text-center bg-[#F8F7F3] border border-[#B8B6AC] rounded-2xl shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 border border-amber-300 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-heading font-bold text-[#24283A]">Restricted Billing Access</h2>
        <p className="text-sm text-[#747683] leading-relaxed max-w-md mx-auto">
          Institutional subscription plans, invoicing records, and commercial renewal settings are restricted to the institutional Placement Head.
        </p>
        <div className="pt-2">
          <Button asChild variant="outline" className="text-xs h-9">
            <Link href="/dashboard/profile">Return to My Profile</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Authoritative State Machine Resolution
  const rawSubStatus = data?.subscription?.status || (auth.tenant as any)?.subscriptionStatus || null;
  const tenantStatus = data?.tenantStatus || (auth.tenant as any)?.status || "ACTIVE";

  const isDecommissioned = tenantStatus === "DECOMMISSIONED" || tenantStatus === "ARCHIVED";
  const isSuspended = !isDecommissioned && (tenantStatus === "SUSPENDED" || rawSubStatus === "SUSPENDED");
  const isNoSubscription = !isDecommissioned && !isSuspended && (!data?.subscription || !data.subscription.planId);
  const isPendingInitialPayment = !isDecommissioned && !isSuspended && !isNoSubscription && rawSubStatus === "PENDING_PAYMENT";
  const hasOutstandingInvoice = Boolean(data?.invoice && data.invoice.status === "PENDING");
  const isUpgradeInvoice = Boolean(
    data?.invoice?.invoiceNumber?.startsWith("INV-UPG-") ||
    data?.invoice?.notes?.includes("[UPGRADE:")
  );
  const isActiveWithPendingInvoice = !isDecommissioned && !isSuspended && rawSubStatus === "ACTIVE" && hasOutstandingInvoice;
  const isActiveNoOutstandingInvoice = !isDecommissioned && !isSuspended && rawSubStatus === "ACTIVE" && !hasOutstandingInvoice;

  // Header Status Badge
  const headerBadgeLabel = isDecommissioned
    ? "DECOMMISSIONED"
    : isSuspended
    ? "SUSPENDED"
    : isNoSubscription
    ? "PLAN SELECTION REQUIRED"
    : isPendingInitialPayment
    ? "PENDING PAYMENT"
    : "ACTIVE";

  const headerBadgeVariant = isDecommissioned || isSuspended
    ? "bg-red-50 text-red-800 border-red-300"
    : isNoSubscription || isPendingInitialPayment || isActiveWithPendingInvoice
    ? "bg-amber-50 text-amber-800 border-amber-300"
    : "bg-emerald-50 text-emerald-800 border-emerald-300";

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DDDCD5] pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono uppercase font-semibold text-[#5052C9] tracking-wider">
              Institutional Entitlements
            </span>
            <Badge variant="outline" className={`font-mono text-[10px] ${headerBadgeVariant}`}>
              {headerBadgeLabel}
            </Badge>
            {isActiveWithPendingInvoice && (
              <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-[9px]">
                {isUpgradeInvoice ? "Upgrade Invoice Pending" : "Renewal Invoice Pending"}
              </Badge>
            )}
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

      {/* Action Feedback Notification */}
      {actionFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 border-emerald-300 text-emerald-900"
              : "bg-red-50 border-red-300 text-red-900"
          }`}
        >
          <span>{actionFeedback.text}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-xs font-semibold underline ml-3 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE F — DECOMMISSIONED INSTITUTION */}
      {/* ========================================================================= */}
      {isDecommissioned && (
        <Card className="bg-red-50/80 border-red-300 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-800 border border-red-300 flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="h-5 w-5" />
            </div>
            <div className="space-y-2 flex-1">
              <h3 className="text-sm font-bold font-heading text-red-950">
                Institutional Account Decommissioned
              </h3>
              <p className="text-xs text-red-900/90 leading-relaxed">
                This college institutional account has been retired by platform administration. Operational placement workspaces and active subscriptions are permanently revoked.
              </p>
              <div className="text-[11px] font-mono text-red-800">
                Regulatory financial tax invoices remain permanently accessible in the transaction ledger below.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STATE E — SUSPENDED SUBSCRIPTION */}
      {/* ========================================================================= */}
      {isSuspended && (
        <Card className="bg-red-50/70 border-red-300 shadow-sm rounded-2xl">
          <CardContent className="p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-800 border border-red-300 flex items-center justify-center shrink-0 mt-0.5">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <h3 className="text-sm font-bold font-heading text-red-950">
                  Operational Placement Access Suspended
                </h3>
                <p className="text-xs text-red-900/90 leading-relaxed mt-1">
                  Institutional operations (student roster, recruitment drives, assessments, and AI services) are temporarily suspended. Settle your outstanding invoice or contact administration to restore full workspace capabilities.
                </p>
              </div>

              {/* Outstanding Invoice settlement box during suspension */}
              {data?.invoice && data.invoice.status === "PENDING" && (
                <div className="p-4 rounded-xl bg-[#FBFAF7] border border-red-300 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[#DDDCD5]">
                    <div>
                      <div className="text-[11px] font-mono text-[#747683] uppercase">Outstanding Invoice</div>
                      <div className="text-sm font-bold font-mono text-[#24283A]">{data.invoice.invoiceNumber}</div>
                      <div className="text-[10px] text-[#747683] mt-0.5">
                        Due Date: {new Date(data.invoice.dueDate).toLocaleDateString("en-IN")} &bull; Method: {data.invoice.paymentMethod || "GATEWAY"}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] font-mono text-[#747683] uppercase">Amount Due</div>
                      <div className="text-base font-extrabold font-mono text-[#5052C9]">
                        ₹{data.invoice.totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <RazorpayCheckoutButton
                      invoiceId={data.invoice.id}
                      invoiceNumber={data.invoice.invoiceNumber}
                      totalInr={data.invoice.totalInr}
                      contactName={data.contactName || auth.fullName || undefined}
                      officialEmail={data.officialEmail || auth.email || undefined}
                      onPaymentSuccess={handlePaymentSuccess}
                    />
                    {data.invoice.paymentMethod === "BANK_TRANSFER" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedInvoiceForUtr(data.invoice);
                          setShowBankTransferModal(true);
                        }}
                        className="text-xs h-9 border-[#5052C9]/40 text-[#5052C9] hover:bg-[#5052C9]/5"
                      >
                        Bank Transfer Details &amp; UTR Submission
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STATE A — NO SUBSCRIPTION (OPTION C WORKFLOW 2) */}
      {/* ========================================================================= */}
      {isNoSubscription && (
        <div className="space-y-6">
          <Card className="bg-amber-50/70 border-amber-300 shadow-xs rounded-2xl">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="space-y-1.5 flex-1">
                <h3 className="text-base font-bold font-heading text-amber-950">
                  Plan Selection Required (Option C Workflow)
                </h3>
                <p className="text-xs text-amber-900/90 leading-relaxed">
                  Your college account was provisioned without a pre-assigned subscription plan. Select an approved institutional plan below to initialize your commercial invoice and proceed to secure checkout.
                </p>
                <div className="pt-1 flex items-center gap-2 text-[11px] font-mono text-amber-800">
                  <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
                  <span>Placement cell operations remain locked until an approved plan is selected and payment is verified.</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Published Plans Comparison Grid */}
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold font-heading text-[#24283A]">
                Approved Institutional Plans
              </h2>
              <p className="text-xs text-[#747683]">
                Select the annual capacity that best matches your institution&apos;s graduating cohort size.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {(data?.availablePlans || []).map((plan) => {
                const basePrice = plan.priceInr || 0;
                const gstAmount = Math.round(basePrice * 0.18);
                const totalAmount = basePrice + gstAmount;

                return (
                  <Card
                    key={plan.id}
                    className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl flex flex-col justify-between hover:border-[#5052C9] transition-all"
                  >
                    <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
                      <div className="text-[10px] font-mono uppercase tracking-wider text-[#5052C9] font-semibold">
                        Annual Plan
                      </div>
                      <CardTitle className="text-lg font-bold font-heading text-[#24283A]">
                        {plan.name}
                      </CardTitle>
                      <CardDescription className="text-xs text-[#292D40]/70 line-clamp-2">
                        {plan.description || `Comprehensive placement infrastructure for up to ${plan.studentLimit} students.`}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-3">
                        {/* Price breakdown */}
                        <div className="p-3.5 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] space-y-1">
                          <div className="text-[11px] font-mono text-[#747683] uppercase">Annual Fee</div>
                          <div className="text-2xl font-extrabold font-heading text-[#5052C9]">
                            ₹{basePrice.toLocaleString("en-IN")}
                            <span className="text-xs font-normal text-[#747683]"> /year</span>
                          </div>
                          <div className="text-[11px] text-[#747683] font-mono pt-1 border-t border-[#DDDCD5]/60 flex justify-between">
                            <span>+ 18% GST:</span>
                            <span>₹{gstAmount.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="text-xs font-bold text-[#24283A] font-mono flex justify-between pt-0.5">
                            <span>Total Payable:</span>
                            <span>₹{totalAmount.toLocaleString("en-IN")}</span>
                          </div>
                        </div>

                        {/* Limits */}
                        <div className="space-y-1.5 text-xs text-[#24283A]">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                            <span>Up to <strong>{plan.studentLimit?.toLocaleString("en-IN")}</strong> registered students</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                            <span>Up to <strong>{plan.staffLimit}</strong> placement officers &amp; staff</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                            <span>Unlimited recruitment drives &amp; rounds</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                            <span>AI question banks &amp; mistake remediation</span>
                          </div>
                        </div>
                      </div>

                      {/* Select Action */}
                      <div className="pt-4 border-t border-[#B8B6AC]/20">
                        {auth.role === "PLACEMENT_HEAD" || auth.isPlatformAdmin ? (
                          <Button
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={selectingPlanId === plan.id}
                            className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 font-medium rounded-xl shadow-xs cursor-pointer"
                          >
                            {selectingPlanId === plan.id ? (
                              <span className="flex items-center gap-1.5">
                                <BrandLoader size="button" /> Initializing Invoice...
                              </span>
                            ) : (
                              <span>Select {plan.name} &amp; Proceed</span>
                            )}
                          </Button>
                        ) : (
                          <div className="text-[11px] text-amber-800 text-center bg-amber-50 p-2 rounded-lg border border-amber-200">
                            Only Placement Head can authorize plan selection.
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATE B — PREASSIGNED / SELECTED PLAN WITH PENDING INITIAL PAYMENT */}
      {/* ========================================================================= */}
      {isPendingInitialPayment && data?.subscription && (
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
                  Your college account is enrolled in the <strong className="font-semibold">{data.subscription.planName}</strong> plan. Operational placement capabilities (student roster, recruitment drives, automated assessments, and institutional memory) are locked until your initial subscription payment is completed and verified.
                </p>
              </div>

              {/* Commercial Invoice & Checkout Box */}
              {data.invoice && data.invoice.status !== "PAID" && (
                <div className="p-4 rounded-xl bg-[#FBFAF7] border border-amber-300/80 shadow-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[#DDDCD5]">
                    <div>
                      <div className="text-[11px] font-mono text-[#747683] uppercase">Initial Subscription Invoice</div>
                      <div className="text-sm font-bold font-mono text-[#24283A]">{data.invoice.invoiceNumber}</div>
                      <div className="text-[10px] text-[#747683] mt-0.5">
                        Due Date: {new Date(data.invoice.dueDate).toLocaleDateString("en-IN")} &bull; Plan: {data.subscription.planName} &bull; Method: {data.invoice.paymentMethod || "GATEWAY"}
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[11px] font-mono text-[#747683] uppercase">Total Payable Amount</div>
                      <div className="text-base font-extrabold font-mono text-[#5052C9]">
                        ₹{data.invoice.totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[10px] text-[#747683]">
                        (Base: ₹{data.invoice.amountInr.toLocaleString("en-IN")} + 18% GST: ₹{data.invoice.taxInr.toLocaleString("en-IN")})
                      </div>
                    </div>
                  </div>

                  {auth.role === "PLACEMENT_HEAD" || auth.isPlatformAdmin ? (
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <RazorpayCheckoutButton
                          invoiceId={data.invoice.id}
                          invoiceNumber={data.invoice.invoiceNumber}
                          totalInr={data.invoice.totalInr}
                          contactName={data.contactName || auth.fullName || undefined}
                          officialEmail={data.officialEmail || auth.email || undefined}
                          onPaymentSuccess={handlePaymentSuccess}
                        />

                        {data.invoice.paymentMethod === "BANK_TRANSFER" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoiceForUtr(data.invoice);
                              setShowBankTransferModal(true);
                            }}
                            className="text-xs h-9 border-[#5052C9]/40 text-[#5052C9] hover:bg-[#5052C9]/5 cursor-pointer"
                          >
                            Bank Transfer Instructions &amp; UTR Submission
                          </Button>
                        )}
                      </div>
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
                <span className="font-semibold">Razorpay Gateway Test Mode Active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STATE D — ACTIVE SUBSCRIPTION WITH PENDING RENEWAL INVOICE */}
      {/* ========================================================================= */}
      {isActiveWithPendingInvoice && data?.invoice && (
        <Card className="bg-amber-50/70 border-amber-300 shadow-sm rounded-2xl">
          <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-3 flex-1">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold font-heading text-amber-950">
                    {isUpgradeInvoice
                      ? "Outstanding Prorated Plan Upgrade Invoice"
                      : "Outstanding Institutional Renewal Invoice"}
                  </h3>
                  <Badge variant="outline" className="bg-amber-100 text-amber-900 border-amber-300 font-mono text-[9px]">
                    {isUpgradeInvoice ? "Upgrade Pending" : "Action Required"}
                  </Badge>
                </div>
                <p className="text-xs text-amber-900/90 leading-relaxed mt-1">
                  {isUpgradeInvoice ? (
                    <>
                      Your college requested a prorated subscription upgrade. Settle invoice{" "}
                      <strong className="font-mono">{data.invoice.invoiceNumber}</strong> via secure checkout to
                      immediately activate your higher tier entitlements and expanded seat limits.
                    </>
                  ) : (
                    <>
                      Your college retains active access according to your current paid term (with 7-day grace). Settle invoice{" "}
                      <strong className="font-mono">{data.invoice.invoiceNumber}</strong> prior to due date to ensure
                      continuous operational access.
                    </>
                  )}
                </p>
              </div>

              {/* Commercial Invoice & Settlement Card */}
              <div className="p-4 rounded-xl bg-[#FBFAF7] border border-amber-300/80 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-[#DDDCD5]">
                  <div>
                    <div className="text-[11px] font-mono text-[#747683] uppercase">Invoice Number</div>
                    <div className="text-sm font-bold font-mono text-[#24283A]">{data.invoice.invoiceNumber}</div>
                    <div className="text-[10px] text-[#747683] mt-0.5">
                      Due Date: {new Date(data.invoice.dueDate).toLocaleDateString("en-IN")} &bull; Method: {data.invoice.paymentMethod || "GATEWAY"}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <div className="text-[11px] font-mono text-[#747683] uppercase">Total Amount Due</div>
                    <div className="text-base font-extrabold font-mono text-[#5052C9]">
                      ₹{data.invoice.totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[10px] text-[#747683]">
                      (Base: ₹{data.invoice.amountInr.toLocaleString("en-IN")} + 18% GST: ₹{data.invoice.taxInr.toLocaleString("en-IN")})
                    </div>
                  </div>
                </div>

                {auth.role === "PLACEMENT_HEAD" || auth.isPlatformAdmin ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* Razorpay Online Checkout */}
                    <RazorpayCheckoutButton
                      invoiceId={data.invoice.id}
                      invoiceNumber={data.invoice.invoiceNumber}
                      totalInr={data.invoice.totalInr}
                      contactName={data.contactName || auth.fullName || undefined}
                      officialEmail={data.officialEmail || auth.email || undefined}
                      onPaymentSuccess={handlePaymentSuccess}
                    />

                    {/* Bank Transfer Instructions / UTR Submission */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedInvoiceForUtr(data.invoice);
                        setShowBankTransferModal(true);
                      }}
                      className="text-xs h-9 border-[#5052C9]/40 text-[#5052C9] hover:bg-[#5052C9]/5 cursor-pointer"
                    >
                      Bank Transfer Instructions &amp; Submit UTR
                    </Button>
                  </div>
                ) : (
                  <div className="text-xs text-amber-800 bg-amber-100/60 p-2.5 rounded-lg border border-amber-200">
                    Only institutional Placement Head can authorize invoice settlement.
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* STATES C & D & B: MAIN PLAN DETAILS & CONTROLS GRID */}
      {/* ========================================================================= */}
      {data?.subscription && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Left 2 cols: Subscription Plan Details & Controls */}
          <Card className="md:col-span-2 bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-[#5052C9]" />
                  <span>Assigned Institutional Plan</span>
                </CardTitle>
                <CardDescription className="text-xs text-[#292D40]/70">
                  Provisioned institutional subscription tier and active capacity limits
                </CardDescription>
              </div>

              {/* Change Plan Action for Active Subscriptions */}
              {auth.role === "PLACEMENT_HEAD" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowPlanModal(true)}
                  className="text-xs h-8 gap-1.5 border-[#5052C9] text-[#5052C9] hover:bg-[#5052C9]/5 cursor-pointer"
                >
                  <Zap className="h-3 w-3" /> Change Plan
                </Button>
              )}
            </CardHeader>

            <CardContent className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5]">
                <div>
                  <div className="text-xs text-[#747683] font-mono uppercase">Current Plan</div>
                  <div className="text-lg font-bold font-heading text-[#24283A]">
                    {data.subscription.planName}
                  </div>
                  <div className="text-xs text-[#747683] mt-0.5">
                    Seat Limit:{" "}
                    <span className="font-bold text-[#24283A]">
                      {data.studentSeatLimit ? `${data.studentSeatLimit.toLocaleString()} Students` : "Standard Tier"}
                    </span>
                  </div>
                </div>

                <div className="text-left sm:text-right space-y-1">
                  <div className="text-xs text-[#747683] font-mono uppercase">Billing Status</div>
                  <Badge
                    variant="outline"
                    className={
                      data.subscription.status === "ACTIVE"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                        : "bg-amber-50 text-amber-800 border-amber-300 font-mono text-[10px]"
                    }
                  >
                    {data.subscription.status}
                  </Badge>
                </div>
              </div>

              {/* Subscription Period & Renewal Milestones */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-white border border-[#DDDCD5] space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#747683]">Subscription Period</div>
                  <div className="font-semibold text-[#24283A]">
                    {data.subscription.startDate
                      ? new Date(data.subscription.startDate).toLocaleDateString("en-IN")
                      : "July 30, 2026"}{" "}
                    &rarr;{" "}
                    {data.subscription.expiryDate
                      ? new Date(data.subscription.expiryDate).toLocaleDateString("en-IN")
                      : "July 30, 2027"}
                  </div>
                  <div className="text-[10px] text-[#747683]">Annual commercial billing cycle</div>
                </div>

                <div className="p-3 rounded-xl bg-white border border-[#DDDCD5] space-y-1">
                  <div className="text-[10px] font-mono uppercase text-[#747683]">Next Renewal Milestone</div>
                  <div className="font-semibold text-[#5052C9]">
                    {data.subscription.renewalDate
                      ? new Date(data.subscription.renewalDate).toLocaleDateString("en-IN")
                      : "July 30, 2027"}
                  </div>
                  <div className="text-[10px] text-[#747683]">
                    7-day grace period included upon expiry
                  </div>
                </div>
              </div>

              {/* Entitlements Checklist */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-semibold text-[#24283A]">
                  Entitlements Included:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DDDCD5] bg-white">
                    <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                    <span>Student Roster &amp; SRN Claims</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DDDCD5] bg-white">
                    <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                    <span>Recruitment Drives &amp; Pipelines</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DDDCD5] bg-white">
                    <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                    <span>AI Mistake Remediation Bank</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-[#DDDCD5] bg-white">
                    <CheckCircle2 className="h-4 w-4 text-[#2E8F86] shrink-0" />
                    <span>Placement Memory &amp; Analytics</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right 1 col: Institutional Profile & Renewal Mode */}
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
                <span className="font-bold">{data.collegeName || "Your College"}</span>
              </div>
              <div>
                <span className="text-[#747683] block text-[11px]">Placement Head</span>
                <span className="font-semibold">{data.contactName || auth.fullName || "Placement Head"}</span>
              </div>
              <div>
                <span className="text-[#747683] block text-[11px]">Bound Email</span>
                <span className="font-mono">{data.officialEmail || auth.email}</span>
              </div>

              {/* Renewal Mode Toggle */}
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
                    ? "Automatic renewal is active. Your payment method will renew at the next annual milestone."
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

              {/* Placement Head Cancellation Request */}
              {auth.role === "PLACEMENT_HEAD" && data.subscription.status === "ACTIVE" && (
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
                  For subscription activation, custom limits, or payment queries, contact platform administration at{" "}
                  <span className="font-mono font-semibold text-[#5052C9]">urplaced5@gmail.com</span>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TRANSACTION HISTORY & INVOICES (ALL HISTORICAL LEDGERS) */}
      {/* ========================================================================= */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#5052C9]" />
              <span>Institutional Transaction History &amp; Invoices</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Complete historical ledger of verified gateway payments, bank credits, refunds, and issued tax invoices.
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
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
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
                            tx.status === "CAPTURED" || tx.invoiceStatus === "PAID"
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
                              : tx.status === "FAILED"
                              ? "bg-red-50 text-red-800 border-red-300 font-mono text-[10px]"
                              : "bg-amber-50 text-amber-800 border-amber-300 font-mono text-[10px]"
                          }
                        >
                          {tx.invoiceStatus || tx.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                        {/* If invoice is pending, allow quick settlement */}
                        {tx.invoiceStatus === "PENDING" && (auth.role === "PLACEMENT_HEAD" || auth.isPlatformAdmin) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedInvoiceForUtr({
                                id: tx.invoiceId,
                                invoiceNumber: tx.invoiceNumber,
                                totalInr: tx.amountInr,
                                paymentMethod: tx.method,
                              });
                              setShowBankTransferModal(true);
                            }}
                            className="h-7 text-xs border-amber-300 text-amber-800 hover:bg-amber-50 cursor-pointer"
                          >
                            Submit UTR
                          </Button>
                        )}
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

      {/* ========================================================================= */}
      {/* MODAL 1: CHANGE / UPGRADE / DOWNGRADE PLAN MODAL */}
      {/* ========================================================================= */}
      {showPlanModal && data?.subscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-3xl max-h-[90dvh] flex flex-col bg-[#F8F7F3] border-[#B8B6AC] shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                  <Zap className="h-5 w-5 text-[#5052C9]" />
                  <span>Institutional Subscription Plan Management</span>
                </CardTitle>
                <button
                  onClick={() => setShowPlanModal(false)}
                  className="text-xs text-[#747683] hover:text-[#24283A] font-bold p-1 cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <CardDescription className="text-xs text-[#292D40]/70">
                Upgrade capacity immediately via prorated difference or schedule a downgrade for your next renewal milestone.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(data?.availablePlans || []).map((plan) => {
                  const currentPrice = data.subscription?.priceAnnual || 0;
                  const isCurrent = plan.id === data.subscription?.planId;
                  const isUpgrade = plan.priceInr > currentPrice;
                  const isDowngrade = plan.priceInr < currentPrice;

                  return (
                    <div
                      key={plan.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between ${
                        isCurrent
                          ? "border-[#5052C9] bg-white ring-2 ring-[#5052C9]/20 shadow-xs"
                          : "border-[#DDDCD5] bg-white hover:border-[#B8B6AC]"
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-[#24283A]">{plan.name}</span>
                          {isCurrent ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[9px] font-mono">
                              Current
                            </Badge>
                          ) : isUpgrade ? (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-[9px] font-mono">
                              Upgrade
                            </Badge>
                          ) : (
                            <Badge className="bg-stone-100 text-stone-800 border-stone-300 text-[9px] font-mono">
                              Downgrade
                            </Badge>
                          )}
                        </div>

                        <div>
                          <div className="text-xl font-extrabold font-heading text-[#5052C9]">
                            ₹{plan.priceInr.toLocaleString("en-IN")}
                            <span className="text-[10px] font-normal text-[#747683]">/yr</span>
                          </div>
                          <div className="text-[10px] text-[#747683] font-mono">
                            + 18% GST: ₹{Math.round(plan.priceInr * 0.18).toLocaleString("en-IN")}
                          </div>
                        </div>

                        <div className="space-y-1 text-xs text-[#24283A] pt-2 border-t border-[#DDDCD5]/60">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#2E8F86] shrink-0" />
                            <span>Up to <strong>{plan.studentLimit?.toLocaleString()}</strong> students</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#2E8F86] shrink-0" />
                            <span>Up to <strong>{plan.staffLimit}</strong> staff members</span>
                          </div>
                        </div>

                        <p className="text-[11px] text-[#747683] leading-relaxed">
                          {isCurrent
                            ? "Your currently active institutional tier."
                            : isUpgrade
                            ? "Immediate capacity increase. You will only pay the prorated difference for remaining days."
                            : "Scheduled for next renewal. Current higher capacity remains active until this billing cycle ends."}
                        </p>
                      </div>

                      <div className="pt-3 mt-3 border-t border-[#DDDCD5]/60">
                        {isCurrent ? (
                          <Button size="sm" disabled className="w-full text-xs h-8 opacity-60">
                            Current Plan
                          </Button>
                        ) : isUpgrade ? (
                          <Button
                            size="sm"
                            disabled={planActionLoading}
                            onClick={() => handleUpgradePlan(plan.id)}
                            className="w-full text-xs h-8 bg-[#5052C9] hover:bg-[#4345B0] text-white cursor-pointer"
                          >
                            <TrendingUp className="h-3.5 w-3.5 mr-1" /> Upgrade (Prorated)
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={planActionLoading}
                            onClick={() => handleDowngradePlan(plan.id)}
                            className="w-full text-xs h-8 border-stone-300 text-stone-700 hover:bg-stone-50 cursor-pointer"
                          >
                            <TrendingDown className="h-3.5 w-3.5 mr-1" /> Schedule Downgrade
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-950 space-y-1">
                <strong>Statutory Compliance &amp; Entitlement Snapshot:</strong>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Upgrades immediately recalculate prorated base price and statutory GST. Downgrades take effect on your next annual anniversary ({data.subscription.renewalDate ? new Date(data.subscription.renewalDate).toLocaleDateString("en-IN") : "anniversary"}) to preserve already settled capacity.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: BANK TRANSFER DETAILS & UTR SUBMISSION MODAL */}
      {/* ========================================================================= */}
      {showBankTransferModal && selectedInvoiceForUtr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-[#B8B6AC] shadow-2xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#5052C9]" />
                  <span>Bank Transfer Beneficiary Details</span>
                </CardTitle>
                <button
                  onClick={() => setShowBankTransferModal(false)}
                  className="text-xs text-[#747683] hover:text-[#24283A] font-bold p-1 cursor-pointer"
                >
                  &times;
                </button>
              </div>
              <CardDescription className="text-xs text-[#292D40]/70">
                Official institutional banking coordinates for NEFT / RTGS / IMPS wire transfers
              </CardDescription>
            </CardHeader>

            <CardContent className="p-5 space-y-4 text-xs">
              {/* Beneficiary Details Box */}
              <div className="p-3.5 rounded-xl bg-white border border-[#DDDCD5] space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-[#747683]">
                  Authoritative UrPlaced Beneficiary Coordinates
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[#747683]">Beneficiary Name:</span>
                    <div className="font-bold text-[#24283A]">UrPlaced Technologies Private Limited</div>
                  </div>
                  <div>
                    <span className="text-[#747683]">Bank Name:</span>
                    <div className="font-bold text-[#24283A]">HDFC Bank</div>
                  </div>
                  <div>
                    <span className="text-[#747683]">Account Number:</span>
                    <div className="font-mono font-bold text-[#5052C9]">50200084920194</div>
                  </div>
                  <div>
                    <span className="text-[#747683]">IFSC Code:</span>
                    <div className="font-mono font-bold text-[#5052C9]">HDFC0000240</div>
                  </div>
                  <div>
                    <span className="text-[#747683]">Account Type:</span>
                    <div className="text-[#24283A]">Current Account</div>
                  </div>
                  <div>
                    <span className="text-[#747683]">Branch:</span>
                    <div className="text-[#24283A]">Koramangala 4th Block, Bengaluru</div>
                  </div>
                </div>
              </div>

              {/* Invoice Summary */}
              <div className="p-3 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono text-[#747683] uppercase">Invoice Number</span>
                  <div className="font-mono font-bold text-[#24283A]">{selectedInvoiceForUtr.invoiceNumber}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-[#747683] uppercase">Total Payable Amount</span>
                  <div className="font-mono font-bold text-[#5052C9] text-sm">
                    ₹{selectedInvoiceForUtr.totalInr ? selectedInvoiceForUtr.totalInr.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "5,90,000.00"}
                  </div>
                </div>
              </div>

              {/* UTR Submission Form */}
              <form onSubmit={handleSubmitUtr} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#24283A]">
                    Transaction UTR / Reference Number *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. UTR123456789 or 2610283749"
                    value={utrInput}
                    onChange={(e) => setUtrInput(e.target.value)}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#24283A]">
                    Remitting Bank Name (Optional)
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. State Bank of India, ICICI Bank"
                    value={remitterBankInput}
                    onChange={(e) => setRemitterBankInput(e.target.value)}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBankTransferModal(false)}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingUtr || !utrInput.trim()}
                    className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9 cursor-pointer"
                  >
                    {submittingUtr ? (
                      <span className="flex items-center gap-1.5">
                        <BrandLoader size="button" /> Submitting...
                      </span>
                    ) : (
                      "Submit Reference for Verification"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: MANDATE CONSENT MODAL */}
      {/* ========================================================================= */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg max-h-[90dvh] flex flex-col bg-[#F8F7F3] border-[#B8B6AC] shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 shrink-0">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#5052C9]" />
                <span>Authorize Automatic Annual Renewal</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Explicit consent required per UrPlaced financial compliance (Q4)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs text-[#24283A] overflow-y-auto flex-1">
              <p className="leading-relaxed">
                By enabling automatic renewal, you authorize UrPlaced to automatically charge your institutional payment method annually on your renewal date (
                <strong className="font-semibold">{data?.subscription?.renewalDate ? new Date(data.subscription.renewalDate).toLocaleDateString("en-IN") : "next anniversary"}</strong>
                ).
              </p>
              <div className="p-3 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] space-y-2">
                <div className="font-bold text-[#5052C9]">Mandate Terms &amp; Protections:</div>
                <ul className="list-disc pl-4 space-y-1 text-[#747683]">
                  <li><strong>No immediate charge today:</strong> Mode change takes effect at your next renewal milestone.</li>
                  <li><strong>Decoupled Initial Payment:</strong> Initial invoice settlement does not require automatic recurring debit.</li>
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
                  {mandateLoading ? (
                    <span className="flex items-center gap-1.5">
                      <BrandLoader size="button" /> Recording Authorization...
                    </span>
                  ) : (
                    "Confirm & Enable"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PERIOD-END CANCELLATION REQUEST MODAL */}
      {/* ========================================================================= */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span>Request Subscription Cancellation</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Notice: Cancellations take effect at the end of your current paid term (Q15).
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 text-xs text-[#24283A]">
              <p className="leading-relaxed">
                Under the UrPlaced Institutional Agreement, cancellation requests initiated by the Placement Head take effect at the end of your active billing period (
                <strong className="font-semibold">{data?.subscription?.renewalDate ? new Date(data.subscription.renewalDate).toLocaleDateString("en-IN") : "renewal date"}</strong>
                ). You retain full access to all placement features until that date.
              </p>
              <form onSubmit={handleRequestCancellation} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#24283A]">
                    Reason for Cancellation (Feedback) *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Please tell us why you are cancelling..."
                    className="w-full p-2.5 rounded-xl border border-[#B8B6AC] bg-[#FBFAF7] text-xs outline-none focus:ring-2 focus:ring-[#5052C9]/20"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCancelModal(false)}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Keep Subscription
                  </Button>
                  <Button
                    type="submit"
                    disabled={cancelLoading}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs h-9 cursor-pointer"
                  >
                    {cancelLoading ? (
                      <span className="flex items-center gap-1.5">
                        <BrandLoader size="button" /> Submitting...
                      </span>
                    ) : (
                      "Confirm Cancellation"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
