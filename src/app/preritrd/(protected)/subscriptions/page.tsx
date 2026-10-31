"use client";

import * as React from "react";
import {
  CreditCard,
  Building2,
  RefreshCw,
  PlusCircle,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Users,
  HardDrive,
  Check,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  SubscriptionPlanItem,
  CollegeSubscriptionItem,
} from "@/modules/platform-admin/services/platform-subscription-service";

export default function PlatformSubscriptionsPage() {
  const [activeTab, setActiveTab] = React.useState<"PLANS" | "SUBSCRIPTIONS">("PLANS");

  const [plans, setPlans] = React.useState<SubscriptionPlanItem[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<CollegeSubscriptionItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Edit Plan Modal
  const [editingPlan, setEditingPlan] = React.useState<SubscriptionPlanItem | null>(null);
  const [planForm, setPlanForm] = React.useState({
    name: "",
    priceInr: 0,
    studentLimit: 1000,
    staffLimit: 10,
    storageLimitGb: 20,
    featuresText: "",
  });
  const [savingPlan, setSavingPlan] = React.useState(false);

  // Edit College Subscription Modal
  const [editingSub, setEditingSub] = React.useState<CollegeSubscriptionItem | null>(null);
  const [subForm, setSubForm] = React.useState({
    planId: "",
    status: "ACTIVE" as any,
    studentSeatLimit: 1000,
  });
  const [savingSub, setSavingSub] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const [plansRes, subsRes] = await Promise.all([
        fetch("/api/preritrd/subscriptions/plans"),
        fetch("/api/preritrd/subscriptions"),
      ]);

      const plansData = await plansRes.json();
      const subsData = await subsRes.json();

      if (plansRes.ok) setPlans(plansData.plans || []);
      if (subsRes.ok) setSubscriptions(subsData.subscriptions || []);
    } catch {
      setFeedback({ type: "error", text: "Network error loading subscription data." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Open Edit Plan
  function handleOpenEditPlan(plan: SubscriptionPlanItem) {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      priceInr: plan.priceInr,
      studentLimit: plan.studentLimit,
      staffLimit: plan.staffLimit,
      storageLimitGb: plan.storageLimitGb,
      featuresText: plan.features.join("\n"),
    });
  }

  // Save Plan
  async function handleSavePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    setSavingPlan(true);

    try {
      const features = planForm.featuresText
        .split("\n")
        .map((f) => f.trim())
        .filter(Boolean);

      const res = await fetch("/api/preritrd/subscriptions/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingPlan.id,
          name: planForm.name,
          slug: editingPlan.slug,
          priceInr: planForm.priceInr,
          studentLimit: planForm.studentLimit,
          staffLimit: planForm.staffLimit,
          storageLimitGb: planForm.storageLimitGb,
          features,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update plan." });
      } else {
        setFeedback({ type: "success", text: `Plan '${planForm.name}' updated successfully.` });
        setEditingPlan(null);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error saving plan." });
    } finally {
      setSavingPlan(false);
    }
  }

  // Open Edit Subscription
  function handleOpenEditSub(sub: CollegeSubscriptionItem) {
    setEditingSub(sub);
    setSubForm({
      planId: sub.planId,
      status: sub.status,
      studentSeatLimit: sub.studentSeatLimit,
    });
  }

  // Save Subscription
  async function handleSaveSub(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSub) return;
    setSavingSub(true);

    try {
      const res = await fetch("/api/preritrd/subscriptions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: editingSub.tenantId,
          planId: subForm.planId,
          status: subForm.status,
          studentSeatLimit: Number(subForm.studentSeatLimit),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update subscription." });
      } else {
        setFeedback({
          type: "success",
          text: `Subscription for '${editingSub.tenantName}' updated successfully.`,
        });
        setEditingSub(null);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error saving subscription." });
    } finally {
      setSavingSub(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            Monetization &amp; Entitlements
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Subscription Management
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Configure platform pricing tiers, institutional limits, seat quotas, and renewal lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="border-[#B8B6AC] text-xs h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
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

      {/* Tab Switcher */}
      <div className="flex border-b border-[#B8B6AC]/40 space-x-2">
        <button
          onClick={() => setActiveTab("PLANS")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === "PLANS"
              ? "border-[#5052C9] text-[#5052C9]"
              : "border-transparent text-[#747683] hover:text-[#24283A]"
          }`}
        >
          Subscription Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("SUBSCRIPTIONS")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 ${
            activeTab === "SUBSCRIPTIONS"
              ? "border-[#5052C9] text-[#5052C9]"
              : "border-transparent text-[#747683] hover:text-[#24283A]"
          }`}
        >
          College Subscriptions ({subscriptions.length})
        </button>
      </div>

      {/* TAB 1: Subscription Plans */}
      {activeTab === "PLANS" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-[#F8F7F3] border-[#B8B6AC] p-6 space-y-4">
                <Skeleton className="h-6 w-32 bg-gray-200" />
                <Skeleton className="h-10 w-24 bg-gray-200" />
                <Skeleton className="h-24 w-full bg-gray-200" />
              </Card>
            ))
          ) : (
            plans.map((plan) => (
              <Card
                key={plan.id}
                className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl flex flex-col justify-between overflow-hidden"
              >
                <div>
                  <div className="h-1 bg-gradient-to-r from-[#7779D8] to-[#5052C9]" />
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-bold font-heading text-[#24283A]">
                        {plan.name}
                      </CardTitle>
                      <Badge variant="outline" className="text-[10px] font-mono border-[#5052C9]/30 text-[#5052C9]">
                        {plan.billingCycle}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs text-[#292D40]/75 leading-relaxed mt-1">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    <div>
                      <span className="text-3xl font-extrabold font-heading text-[#24283A]">
                        ₹{plan.priceInr.toLocaleString("en-IN")}
                      </span>
                      <span className="text-xs text-[#747683] font-mono"> / year</span>
                    </div>

                    {/* Limits */}
                    <div className="grid grid-cols-3 gap-2 py-3 px-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 text-center">
                      <div>
                        <div className="text-[10px] text-[#747683] font-mono">Students</div>
                        <div className="font-bold text-xs text-[#24283A] font-mono mt-0.5">
                          {plan.studentLimit.toLocaleString()}
                        </div>
                      </div>
                      <div className="border-x border-[#B8B6AC]/40">
                        <div className="text-[10px] text-[#747683] font-mono">Staff</div>
                        <div className="font-bold text-xs text-[#24283A] font-mono mt-0.5">
                          {plan.staffLimit}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#747683] font-mono">Storage</div>
                        <div className="font-bold text-xs text-[#24283A] font-mono mt-0.5">
                          {plan.storageLimitGb} GB
                        </div>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-bold font-mono text-[#747683] uppercase">
                        Enabled Modules
                      </div>
                      <ul className="space-y-1 text-xs text-[#24283A]">
                        {plan.features.map((feat, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <Check className="h-3.5 w-3.5 text-[#2E8F86] shrink-0" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </div>

                <div className="p-5 pt-0 border-t border-[#B8B6AC]/20 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEditPlan(plan)}
                    className="w-full text-xs h-8 border-[#B8B6AC] gap-1.5"
                  >
                    <Edit className="h-3.5 w-3.5" /> Edit Plan Limits
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* TAB 2: College Subscriptions Table */}
      {activeTab === "SUBSCRIPTIONS" && (
        <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FBFAF7] text-[#747683] font-mono text-[10px] uppercase border-b border-[#B8B6AC]/30">
                  <tr>
                    <th className="px-5 py-3 font-semibold">College</th>
                    <th className="px-5 py-3 font-semibold">Plan Tier</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Student Quota</th>
                    <th className="px-5 py-3 font-semibold">Renewal Date</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#B8B6AC]/20">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="px-5 py-4">
                          <Skeleton className="h-5 w-full bg-gray-200" />
                        </td>
                      </tr>
                    ))
                  ) : subscriptions.length > 0 ? (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-[#FBFAF7] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-[#24283A] font-heading text-sm">
                            {sub.tenantName}
                          </div>
                          <div className="text-[11px] text-[#747683] font-mono">
                            slug: {sub.tenantSlug}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-[#24283A]">{sub.planName}</td>
                        <td className="px-5 py-3.5">
                          <Badge
                            variant={sub.status === "ACTIVE" ? "default" : "danger"}
                            className={
                              sub.status === "ACTIVE"
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px]"
                                : "bg-red-100 text-red-800 border border-red-300 font-mono text-[10px]"
                            }
                          >
                            {sub.status}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[#24283A]">
                          {sub.studentSeatLimit.toLocaleString()} seats
                        </td>
                        <td className="px-5 py-3.5 font-mono text-[#747683]">
                          {new Date(sub.renewalDate).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditSub(sub)}
                            className="h-7 text-xs border-[#B8B6AC]"
                          >
                            Modify Entitlements
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-[#747683]">
                        No active college subscriptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-lg bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                Edit Plan: {editingPlan.name}
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSavePlan}>
              <CardContent className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#24283A]">Plan Name</label>
                    <Input
                      required
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#24283A]">Annual Price (INR)</label>
                    <Input
                      type="number"
                      required
                      value={planForm.priceInr}
                      onChange={(e) => setPlanForm({ ...planForm, priceInr: Number(e.target.value) })}
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#24283A]">Student Limit</label>
                    <Input
                      type="number"
                      required
                      value={planForm.studentLimit}
                      onChange={(e) => setPlanForm({ ...planForm, studentLimit: Number(e.target.value) })}
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#24283A]">Staff Limit</label>
                    <Input
                      type="number"
                      required
                      value={planForm.staffLimit}
                      onChange={(e) => setPlanForm({ ...planForm, staffLimit: Number(e.target.value) })}
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#24283A]">Storage (GB)</label>
                    <Input
                      type="number"
                      required
                      value={planForm.storageLimitGb}
                      onChange={(e) => setPlanForm({ ...planForm, storageLimitGb: Number(e.target.value) })}
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[#24283A]">
                    Enabled Features (One per line)
                  </label>
                  <textarea
                    rows={4}
                    value={planForm.featuresText}
                    onChange={(e) => setPlanForm({ ...planForm, featuresText: e.target.value })}
                    className="w-full bg-[#FBFAF7] border border-[#B8B6AC] rounded-lg p-2.5 text-xs text-[#24283A] outline-none focus:ring-2 focus:ring-[#5052C9]/30 font-sans"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingPlan(null)}
                    disabled={savingPlan}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingPlan}
                    className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9"
                  >
                    {savingPlan ? "Saving..." : "Save Plan Changes"}
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Subscription Modal */}
      {editingSub && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <Card className="w-full max-w-md bg-[#F8F7F3] border-[#B8B6AC] shadow-lg rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A]">
                Modify Subscription: {editingSub.tenantName}
              </CardTitle>
            </CardHeader>
            <form onSubmit={handleSaveSub}>
              <CardContent className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">Subscription Tier</label>
                  <select
                    value={subForm.planId}
                    onChange={(e) => setSubForm({ ...subForm, planId: e.target.value })}
                    className="w-full bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg p-2 text-[#24283A] outline-none focus:ring-2 focus:ring-[#5052C9]/30"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (₹{p.priceInr.toLocaleString()}/yr)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">Subscription Status</label>
                  <select
                    value={subForm.status}
                    onChange={(e) => setSubForm({ ...subForm, status: e.target.value as any })}
                    className="w-full bg-[#FBFAF7] border border-[#B8B6AC] text-xs rounded-lg p-2 text-[#24283A] outline-none focus:ring-2 focus:ring-[#5052C9]/30"
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="TRIALING">TRIALING</option>
                    <option value="PAST_DUE">PAST_DUE</option>
                    <option value="CANCELED">CANCELED</option>
                    <option value="EXPIRED">EXPIRED</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A]">Allocated Student Seat Limit</label>
                  <Input
                    type="number"
                    required
                    min={50}
                    value={subForm.studentSeatLimit}
                    onChange={(e) => setSubForm({ ...subForm, studentSeatLimit: Number(e.target.value) })}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#B8B6AC]/30">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingSub(null)}
                    disabled={savingSub}
                    className="border-[#B8B6AC] text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={savingSub}
                    className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9"
                  >
                    {savingSub ? "Updating..." : "Update Subscription"}
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
