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
  Search,
  Filter,
  Layers,
  History,
  Lock,
  ArrowRight,
  Info,
  Archive,
  Database,
  UploadCloud,
  FileText,
  Sliders,
  Sparkles,
  Bot,
  BrainCircuit,
  GraduationCap,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  DetailedSubscriptionPlan,
  DetailedCollegeSubscription,
  PlanLimitsMap,
  PlanEntitlementsMap,
  CONTROLLED_FEATURE_CATALOGUE,
  CONTROLLED_LIMIT_KEYS,
  PlanFeatureDefinition,
  FeatureCategory,
  EntitlementsSnapshot,
} from "@/modules/platform-admin/types/subscription-plans";

const CATEGORY_LABELS: Record<FeatureCategory, { title: string; desc: string }> = {
  CORE_PLACEMENT: {
    title: "Core Placement Operations",
    desc: "Foundational recruitment drives, company management, and student directory.",
  },
  ASSESSMENT_TESTING: {
    title: "Assessment & Testing Suite",
    desc: "Question authoring, question banks, and timed assessment engines.",
  },
  INTELLIGENCE_ANALYTICS: {
    title: "Intelligence & Placement Analytics",
    desc: "DriveFit match algorithms, mistake-to-mastery tracking, and cohort intelligence.",
  },
  AI_CAPABILITIES: {
    title: "Generative AI Modules",
    desc: "Gemini-powered question synthesis, conversational AI tutor, and candidate scoring.",
  },
  INSTITUTIONAL_ADMIN: {
    title: "Institutional Governance & SLAs",
    desc: "Granular multi-department scopes, compliance data exports, and dedicated support.",
  },
};

export default function PlatformSubscriptionsPage() {
  const [activeTab, setActiveTab] = React.useState<"PLANS" | "COLLEGE_SUBSCRIPTIONS">("PLANS");

  const [plans, setPlans] = React.useState<DetailedSubscriptionPlan[]>([]);
  const [subscriptions, setSubscriptions] = React.useState<DetailedCollegeSubscription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Filters
  const [planSearch, setPlanSearch] = React.useState("");
  const [planStatusFilter, setPlanStatusFilter] = React.useState<string>("ALL");
  const [planIntervalFilter, setPlanIntervalFilter] = React.useState<string>("ALL");

  const [subSearch, setSubSearch] = React.useState("");
  const [subStatusFilter, setSubStatusFilter] = React.useState<string>("ALL");
  const [subOutdatedFilter, setSubOutdatedFilter] = React.useState<string>("ALL");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<DetailedSubscriptionPlan | null>(null);
  const [viewingPlan, setViewingPlan] = React.useState<DetailedSubscriptionPlan | null>(null);
  const [changePlanSub, setChangePlanSub] = React.useState<DetailedCollegeSubscription | null>(null);
  const [viewingSnapshot, setViewingSnapshot] = React.useState<EntitlementsSnapshot | null>(null);
  const [archiveConflict, setArchiveConflict] = React.useState<{ planName: string; affectedColleges: string[] } | null>(null);
  const [planToArchive, setPlanToArchive] = React.useState<DetailedSubscriptionPlan | null>(null);
  const [subToSync, setSubToSync] = React.useState<DetailedCollegeSubscription | null>(null);

  // Create / Edit Plan Form State
  const [planForm, setPlanForm] = React.useState({
    name: "",
    slug: "",
    description: "",
    displayOrder: 0,
    status: "PUBLISHED" as "DRAFT" | "PUBLISHED",
    priceInr: 150000,
    currency: "INR",
    billingInterval: "ANNUAL" as "ANNUAL" | "MONTHLY" | "QUARTERLY",
    discountPercentage: 0,
    limits: {
      max_students: 1000 as number | null,
      max_staff: 15 as number | null,
      max_drives: 25 as number | null,
      max_storage_gb: 50,
      max_assessments: 100 as number | null,
      ai_tokens_monthly: 250000 as number | null,
    } as PlanLimitsMap,
    entitlements: {} as PlanEntitlementsMap,
  });

  // Change Plan Modal Form State
  const [targetPlanId, setTargetPlanId] = React.useState("");
  const [preserveLimits, setPreserveLimits] = React.useState(false);
  const [immediateOverride, setImmediateOverride] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");

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
      setFeedback({ type: "error", text: "Network error loading subscription management data." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Lock body scroll and handle Escape key while any modal dialog is active
  React.useEffect(() => {
    const hasOpenModal = Boolean(
      editingPlan ||
        isCreateModalOpen ||
        viewingPlan ||
        changePlanSub ||
        planToArchive ||
        archiveConflict ||
        subToSync ||
        viewingSnapshot
    );
    if (hasOpenModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          if (editingPlan) setEditingPlan(null);
          else if (isCreateModalOpen) setIsCreateModalOpen(false);
          else if (viewingPlan) setViewingPlan(null);
          else if (changePlanSub) setChangePlanSub(null);
          else if (planToArchive) setPlanToArchive(null);
          else if (archiveConflict) setArchiveConflict(null);
          else if (subToSync) setSubToSync(null);
          else if (viewingSnapshot) setViewingSnapshot(null);
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = originalOverflow;
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [
    editingPlan,
    isCreateModalOpen,
    viewingPlan,
    changePlanSub,
    planToArchive,
    archiveConflict,
    subToSync,
    viewingSnapshot,
  ]);

  // Top Metrics Calculation
  const metrics = React.useMemo(() => {
    const totalPlans = plans.length;
    const publishedPlans = plans.filter((p) => p.status === "PUBLISHED").length;
    const draftPlans = plans.filter((p) => p.status === "DRAFT").length;
    const archivedPlans = plans.filter((p) => p.status === "ARCHIVED").length;

    const totalSubscribedColleges = subscriptions.length;
    const activeSubs = subscriptions.filter((s) => s.status === "ACTIVE").length;
    const pendingPaymentSubs = subscriptions.filter((s) => s.status === "PENDING_PAYMENT").length;
    const outdatedVersionSubs = subscriptions.filter((s) => s.isPlanVersionOutdated).length;

    // Estimated Run-Rate from active subscriptions
    const annualRunRate = subscriptions
      .filter((s) => s.status === "ACTIVE")
      .reduce((acc, sub) => {
        const p = plans.find((plan) => plan.id === sub.planId);
        return acc + (p?.priceInr || 0);
      }, 0);

    return {
      totalPlans,
      publishedPlans,
      draftPlans,
      archivedPlans,
      totalSubscribedColleges,
      activeSubs,
      pendingPaymentSubs,
      outdatedVersionSubs,
      annualRunRate,
    };
  }, [plans, subscriptions]);

  // Filtered Plans
  const filteredPlans = React.useMemo(() => {
    return plans.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(planSearch.toLowerCase()) ||
        p.slug.toLowerCase().includes(planSearch.toLowerCase());
      const matchStatus = planStatusFilter === "ALL" || p.status === planStatusFilter;
      const matchInterval = planIntervalFilter === "ALL" || p.billingInterval === planIntervalFilter;
      return matchSearch && matchStatus && matchInterval;
    });
  }, [plans, planSearch, planStatusFilter, planIntervalFilter]);

  // Filtered Subscriptions
  const filteredSubscriptions = React.useMemo(() => {
    return subscriptions.filter((s) => {
      const matchSearch =
        s.tenantName.toLowerCase().includes(subSearch.toLowerCase()) ||
        s.tenantSlug.toLowerCase().includes(subSearch.toLowerCase());
      const matchStatus = subStatusFilter === "ALL" || s.status === subStatusFilter;
      const matchOutdated =
        subOutdatedFilter === "ALL" ||
        (subOutdatedFilter === "OUTDATED" && s.isPlanVersionOutdated) ||
        (subOutdatedFilter === "CURRENT" && !s.isPlanVersionOutdated);
      return matchSearch && matchStatus && matchOutdated;
    });
  }, [subscriptions, subSearch, subStatusFilter, subOutdatedFilter]);

  // Open Create Plan Modal
  function handleOpenCreateModal() {
    const initialEntitlements: PlanEntitlementsMap = {};
    CONTROLLED_FEATURE_CATALOGUE.forEach((f) => {
      initialEntitlements[f.key] = f.defaultTiers.includes("growth");
    });

    setPlanForm({
      name: "",
      slug: "",
      description: "",
      displayOrder: plans.length + 1,
      status: "PUBLISHED",
      priceInr: 150000,
      currency: "INR",
      billingInterval: "ANNUAL",
      discountPercentage: 0,
      limits: {
        max_students: 1000,
        max_staff: 15,
        max_drives: 25,
        max_storage_gb: 50,
        max_assessments: 100,
        ai_tokens_monthly: 250000,
      },
      entitlements: initialEntitlements,
    });
    setIsCreateModalOpen(true);
  }

  // Open Edit Plan Modal
  function handleOpenEditModal(plan: DetailedSubscriptionPlan) {
    setEditingPlan(plan);
    const populatedLimits: PlanLimitsMap = {
      max_students: plan.limits?.max_students !== undefined ? plan.limits.max_students : 1000,
      max_staff: plan.limits?.max_staff !== undefined ? plan.limits.max_staff : 15,
      max_drives: plan.limits?.max_drives !== undefined ? plan.limits.max_drives : 25,
      max_storage_gb: plan.limits?.max_storage_gb !== undefined ? plan.limits.max_storage_gb : 50,
      max_assessments: plan.limits?.max_assessments !== undefined ? plan.limits.max_assessments : 100,
      ai_tokens_monthly: plan.limits?.ai_tokens_monthly !== undefined ? plan.limits.ai_tokens_monthly : 250000,
    };
    const populatedEntitlements: PlanEntitlementsMap = {};
    CONTROLLED_FEATURE_CATALOGUE.forEach((f) => {
      populatedEntitlements[f.key] =
        plan.entitlements && plan.entitlements[f.key] !== undefined
          ? Boolean(plan.entitlements[f.key])
          : f.defaultTiers.includes(
              (plan.slug || plan.id).toLowerCase().includes("enterprise")
                ? "enterprise"
                : (plan.slug || plan.id).toLowerCase().includes("growth")
                ? "growth"
                : "starter"
            );
    });

    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || "",
      displayOrder: plan.displayOrder,
      status: plan.status as "DRAFT" | "PUBLISHED",
      priceInr: plan.priceInr,
      currency: plan.currency || "INR",
      billingInterval: plan.billingInterval || "ANNUAL",
      discountPercentage: plan.discountPercentage || 0,
      limits: populatedLimits,
      entitlements: populatedEntitlements,
    });
  }

  // Submit Create Plan
  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setActionLoading(true);
    setFeedback(null);

    try {
      const generatedSlug = planForm.slug.trim()
        ? planForm.slug.trim().toLowerCase()
        : planForm.name
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

      const res = await fetch("/api/preritrd/subscriptions/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name.trim(),
          slug: generatedSlug,
          description: planForm.description.trim(),
          displayOrder: Number(planForm.displayOrder),
          status: planForm.status,
          priceInr: Number(planForm.priceInr),
          currency: planForm.currency,
          billingInterval: planForm.billingInterval,
          discountPercentage: Number(planForm.discountPercentage),
          limits: planForm.limits,
          entitlements: planForm.entitlements,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to create plan." });
      } else {
        setFeedback({ type: "success", text: `Plan '${planForm.name}' created successfully (v1).` });
        setIsCreateModalOpen(false);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error creating plan." });
    } finally {
      setActionLoading(false);
    }
  }

  // Submit Edit Plan
  async function handleSaveEditedPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPlan) return;
    setActionLoading(true);
    setFeedback(null);

    try {
      const res = await fetch(`/api/preritrd/subscriptions/plans/${editingPlan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: planForm.name.trim(),
          description: planForm.description.trim(),
          displayOrder: Number(planForm.displayOrder),
          priceInr: Number(planForm.priceInr),
          currency: planForm.currency,
          billingInterval: planForm.billingInterval,
          discountPercentage: Number(planForm.discountPercentage),
          limits: planForm.limits,
          entitlements: planForm.entitlements,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to update plan." });
      } else {
        setFeedback({
          type: "success",
          text: `Plan '${planForm.name}' updated successfully to Version v${data.plan.version}. Existing subscribers retain their frozen snapshot.`,
        });
        setEditingPlan(null);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error updating plan." });
    } finally {
      setActionLoading(false);
    }
  }

  // Publish Plan Action
  async function handlePublishPlan(plan: DetailedSubscriptionPlan) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/preritrd/subscriptions/plans/${plan.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to publish plan." });
      } else {
        setFeedback({ type: "success", text: `Plan '${plan.name}' is now PUBLISHED and available for colleges.` });
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error publishing plan." });
    } finally {
      setActionLoading(false);
    }
  }

  // Archive Plan Action
  async function executeArchivePlan(plan: DetailedSubscriptionPlan) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/preritrd/subscriptions/plans/${plan.id}/archive`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.affectedColleges) {
          setArchiveConflict({ planName: plan.name, affectedColleges: data.affectedColleges });
        } else {
          setFeedback({ type: "error", text: data.error || "Failed to archive plan." });
        }
      } else {
        setFeedback({ type: "success", text: `Plan '${plan.name}' has been archived.` });
        setPlanToArchive(null);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error archiving plan." });
    } finally {
      setActionLoading(false);
    }
  }

  // Change College Plan
  async function handleChangeCollegePlan(e: React.FormEvent) {
    e.preventDefault();
    if (!changePlanSub || !targetPlanId) return;

    if (changePlanSub.status === "ACTIVE" && immediateOverride && overrideReason.trim().length < 10) {
      setFeedback({
        type: "error",
        text: "Emergency immediate plan change for an ACTIVE subscription requires a valid override justification of at least 10 characters.",
      });
      return;
    }

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/preritrd/subscriptions/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: changePlanSub.tenantId,
          newPlanId: targetPlanId,
          preserveCustomLimits: preserveLimits,
          immediateOverride: changePlanSub.status === "ACTIVE" ? immediateOverride : false,
          overrideReason: changePlanSub.status === "ACTIVE" && immediateOverride ? overrideReason.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to change college plan." });
      } else {
        setFeedback({
          type: "success",
          text: data.message || `Plan updated for ${changePlanSub.tenantName}.`,
        });
        setChangePlanSub(null);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error changing plan." });
    } finally {
      setActionLoading(false);
    }
  }

  // Backfill Missing Snapshots
  async function handleBackfillSnapshots() {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/preritrd/subscriptions/backfill-snapshots", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to backfill snapshots." });
      } else {
        setFeedback({
          type: "success",
          text: data.message || "Snapshot backfill completed successfully.",
        });
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error triggering snapshot backfill." });
    } finally {
      setActionLoading(false);
    }
  }

  // Sync College Subscription to Latest Plan Version
  async function executeSyncVersion(sub: DetailedCollegeSubscription) {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/preritrd/subscriptions/sync-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: sub.tenantId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to sync subscription version." });
      } else {
        setFeedback({
          type: "success",
          text: `Successfully synced ${sub.tenantName} to plan version v${data.subscription.planVersion}.`,
        });
        setSubToSync(null);
        await fetchData();
      }
    } catch {
      setFeedback({ type: "error", text: "Network error synchronizing version." });
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-3 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
              Platform Control Plane
            </span>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-secondary bg-secondary/10 px-2 py-0.5 rounded">
              SA-04 Monetization
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight mt-1">
            Subscription Plans &amp; Entitlements
          </h1>
          <p className="text-xs text-text-secondary/75 mt-0.5">
            Define institutional commercial tiers, configure controlled feature matrices, manage immutable plan versions, and govern college quotas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading || actionLoading}
            className="border-border text-xs h-9 gap-1.5 bg-card text-text-primary hover:bg-surface/80"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            disabled={loading || actionLoading}
            className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 gap-1.5 shadow-xs"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Create New Plan
          </Button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : feedback.type === "info"
              ? "bg-blue-50 border-blue-200 text-blue-900"
              : "bg-red-50 border-red-200 text-red-900"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : feedback.type === "info" ? (
              <Info className="h-4 w-4 text-blue-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-bold px-2 hover:opacity-75"
          >
            &times;
          </button>
        </div>
      )}

      {/* Top Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <Card className="bg-card border-border shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-text-secondary uppercase tracking-wide">
                Defined Plans
              </span>
              <div className="text-2xl font-extrabold font-heading text-text-primary">
                {metrics.totalPlans}
              </div>
              <div className="text-[11px] text-text-secondary font-mono">
                {metrics.publishedPlans} published · {metrics.draftPlans} draft · {metrics.archivedPlans} archived
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Layers className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 2 */}
        <Card className="bg-card border-border shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-text-secondary uppercase tracking-wide">
                Subscribed Colleges
              </span>
              <div className="text-2xl font-extrabold font-heading text-text-primary">
                {metrics.totalSubscribedColleges}
              </div>
              <div className="text-[11px] text-text-secondary font-mono">
                {metrics.activeSubs} Active · {metrics.pendingPaymentSubs} Pending Payment
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary">
              <Building2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 3 */}
        <Card className="bg-card border-border shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-text-secondary uppercase tracking-wide">
                Version Synchronization
              </span>
              <div className="text-2xl font-extrabold font-heading text-text-primary">
                {metrics.outdatedVersionSubs === 0 ? "100%" : `${metrics.outdatedVersionSubs} Outdated`}
              </div>
              <div className="text-[11px] text-text-secondary font-mono">
                {metrics.outdatedVersionSubs === 0 ? "All subscribers on latest versions" : "Colleges with available plan updates"}
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <History className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* Metric 4 */}
        <Card className="bg-card border-border shadow-xs rounded-xl">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-mono text-text-secondary uppercase tracking-wide">
                Configured Annualized Value
              </span>
              <div className="text-2xl font-extrabold font-heading text-text-primary">
                ₹{metrics.annualRunRate.toLocaleString("en-IN")}
              </div>
              <div className="text-[10px] text-text-secondary font-mono leading-tight">
                Annualized projection across active institutional college subscriptions.
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Commercial Baseline Notice */}
      <div className="p-3.5 rounded-xl border border-border/40 bg-surface text-xs flex items-start gap-2.5">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-text-primary">Commercial Baseline Notice:</span>
          <p className="text-[11px] text-text-secondary/75 leading-relaxed">
            Starter, Growth, and Enterprise tiers serve as configurable draft templates awaiting official institutional commercial approval. All prices, quotas, limits, AI token allocations, and billing intervals remain fully customizable by the Super Admin to reflect finalized commercial contracts.
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border/40 space-x-2">
        <button
          onClick={() => setActiveTab("PLANS")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "PLANS"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Layers className="h-3.5 w-3.5" />
          Subscription Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab("COLLEGE_SUBSCRIPTIONS")}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === "COLLEGE_SUBSCRIPTIONS"
              ? "border-primary text-primary"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          College Subscriptions &amp; Quotas ({subscriptions.length})
          {metrics.outdatedVersionSubs > 0 && (
            <span className="bg-amber-100 text-amber-800 text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold">
              {metrics.outdatedVersionSubs} update
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: SUBSCRIPTION PLANS */}
      {activeTab === "PLANS" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/40">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-secondary" />
              <Input
                placeholder="Search plans by name or slug..."
                value={planSearch}
                onChange={(e) => setPlanSearch(e.target.value)}
                className="pl-8 bg-surface border-border text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto" suppressHydrationWarning>
              <select
                value={planStatusFilter}
                onChange={(e) => setPlanStatusFilter(e.target.value)}
                className="bg-surface border border-border text-xs rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
                suppressHydrationWarning
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published Only</option>
                <option value="DRAFT">Draft Only</option>
                <option value="ARCHIVED">Archived Only</option>
              </select>

              <select
                value={planIntervalFilter}
                onChange={(e) => setPlanIntervalFilter(e.target.value)}
                className="bg-surface border border-border text-xs rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
                suppressHydrationWarning
              >
                <option value="ALL">All Intervals</option>
                <option value="ANNUAL">Annual</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="bg-card border-border p-6 space-y-4 rounded-2xl">
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-10 w-24" />
                  <Skeleton className="h-28 w-full" />
                </Card>
              ))
            ) : filteredPlans.length > 0 ? (
              filteredPlans.map((plan) => {
                const enabledCount = Object.values(plan.entitlements || {}).filter(Boolean).length;
                const totalFeatures = CONTROLLED_FEATURE_CATALOGUE.length;

                return (
                  <Card
                    key={plan.id}
                    className={`bg-card border-border shadow-xs rounded-2xl flex flex-col justify-between overflow-hidden transition-all ${
                      plan.status === "ARCHIVED" ? "opacity-75" : ""
                    }`}
                  >
                    <div>
                      {/* Top Accent Stripe */}
                      <div
                        className={`h-1.5 ${
                          plan.status === "PUBLISHED"
                            ? "bg-primary-gradient"
                            : plan.status === "DRAFT"
                            ? "bg-amber-400"
                            : "bg-gray-400"
                        }`}
                      />

                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-lg font-bold font-heading text-text-primary truncate">
                            {plan.name}
                          </CardTitle>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-mono px-2 py-0.5 ${
                                plan.status === "PUBLISHED"
                                  ? "border-emerald-300 text-emerald-800 bg-emerald-50"
                                  : plan.status === "DRAFT"
                                  ? "border-amber-300 text-amber-800 bg-amber-50"
                                  : "border-gray-300 text-gray-700 bg-gray-100"
                              }`}
                            >
                              {plan.status}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-primary/30 text-primary bg-primary/5"
                            >
                              v{plan.version}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-[11px] font-mono text-text-secondary">slug: {plan.slug}</div>

                        <CardDescription className="text-xs text-text-secondary/75 leading-relaxed mt-1 line-clamp-2">
                          {plan.description || "Comprehensive placement suite and evaluation capabilities."}
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="space-y-4 pt-0">
                        {/* Pricing */}
                        <div>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-3xl font-extrabold font-heading text-text-primary">
                              ₹{plan.priceInr.toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs text-text-secondary font-mono">
                              / {plan.billingInterval.toLowerCase()}
                            </span>
                            {plan.discountPercentage > 0 && (
                              <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-mono">
                                {plan.discountPercentage}% OFF
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-text-secondary font-mono mt-0.5">
                            Active subscribers: {plan.subscribersCount ?? 0} colleges
                          </div>
                        </div>

                        {/* Limits Matrix Grid */}
                        <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-surface border border-border/40 text-center">
                          <div>
                            <div className="text-[10px] text-text-secondary font-mono">Students</div>
                            <div className="font-bold text-xs text-text-primary font-mono mt-0.5">
                              {plan.limits?.max_students !== null
                                ? plan.limits?.max_students?.toLocaleString()
                                : "Unlimited"}
                            </div>
                          </div>
                          <div className="border-x border-border/40">
                            <div className="text-[10px] text-text-secondary font-mono">Staff Seats</div>
                            <div className="font-bold text-xs text-text-primary font-mono mt-0.5">
                              {plan.limits?.max_staff !== null ? plan.limits?.max_staff : "Unlimited"}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-text-secondary font-mono">Storage</div>
                            <div className="font-bold text-xs text-text-primary font-mono mt-0.5">
                              {plan.limits?.max_storage_gb || 20} GB
                            </div>
                          </div>
                        </div>

                        {/* Entitlements Count & Feature Badges */}
                        <div className="space-y-2 pt-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold font-mono text-text-secondary uppercase">
                              Entitlements
                            </span>
                            <span className="font-mono text-secondary font-semibold">
                              {enabledCount} of {totalFeatures} enabled
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {plan.entitlements?.["ai_question_generator"] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                                <Sparkles className="h-3 w-3" /> AI Engine
                              </span>
                            )}
                            {plan.entitlements?.["ai_tutor_assistant"] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-secondary/10 text-secondary px-2 py-0.5 rounded-md">
                                <Bot className="h-3 w-3" /> AI Tutor
                              </span>
                            )}
                            {plan.entitlements?.["drivefit_evaluator"] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-500/10 text-amber-800 px-2 py-0.5 rounded-md">
                                <BrainCircuit className="h-3 w-3" /> DriveFit
                              </span>
                            )}
                            {plan.entitlements?.["dedicated_sla_liaison"] && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-purple-500/10 text-purple-800 px-2 py-0.5 rounded-md">
                                Priority SLA
                              </span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </div>

                    {/* Actions Bar */}
                    <div className="p-4 pt-3 border-t border-border/30 bg-surface/50 flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingPlan(plan)}
                        className="text-xs h-8 border-border text-text-primary hover:bg-surface/80"
                      >
                        Inspect Details
                      </Button>

                      <div className="flex items-center gap-1.5">
                        {plan.status === "DRAFT" && (
                          <Button
                            size="sm"
                            onClick={() => handlePublishPlan(plan)}
                            disabled={actionLoading}
                            className="bg-secondary hover:bg-[var(--color-secondary-hover)] text-white text-xs h-8 gap-1"
                          >
                            <UploadCloud className="h-3.5 w-3.5" /> Publish
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEditModal(plan)}
                          disabled={actionLoading}
                          className="text-xs h-8 border-border gap-1 text-text-primary hover:bg-surface/80"
                        >
                          <Edit className="h-3.5 w-3.5" /> Edit
                        </Button>

                        {plan.status !== "ARCHIVED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPlanToArchive(plan)}
                            disabled={actionLoading}
                            title="Archive Plan"
                            className="text-xs h-8 text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center bg-card border border-border rounded-2xl">
                <Layers className="h-8 w-8 text-text-secondary mx-auto mb-2 opacity-50" />
                <h3 className="text-sm font-bold text-text-primary">No subscription plans matched</h3>
                <p className="text-xs text-text-secondary mt-1">
                  Try adjusting your search query or status filter.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: COLLEGE SUBSCRIPTIONS & QUOTAS */}
      {activeTab === "COLLEGE_SUBSCRIPTIONS" && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/40">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-text-secondary" />
              <Input
                placeholder="Search college by name or slug..."
                value={subSearch}
                onChange={(e) => setSubSearch(e.target.value)}
                className="pl-8 bg-surface border-border text-xs h-9"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <select
                value={subStatusFilter}
                onChange={(e) => setSubStatusFilter(e.target.value)}
                className="bg-surface border border-border text-xs rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PENDING_PAYMENT">PENDING_PAYMENT (Unpaid)</option>
                <option value="TRIALING">TRIALING</option>
                <option value="PAST_DUE">PAST_DUE</option>
                <option value="CANCELED">CANCELED</option>
                <option value="EXPIRED">EXPIRED</option>
              </select>

              <select
                value={subOutdatedFilter}
                onChange={(e) => setSubOutdatedFilter(e.target.value)}
                className="bg-surface border border-border text-xs rounded-lg px-2.5 py-1.5 text-text-primary outline-none"
              >
                <option value="ALL">All Versions</option>
                <option value="OUTDATED">Outdated Snapshots (Update Available)</option>
                <option value="CURRENT">Up To Date</option>
              </select>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBackfillSnapshots}
                disabled={loading || actionLoading}
                className="border-border text-xs h-9 gap-1.5 bg-surface text-text-primary hover:bg-surface/80"
                title="Scan and create immutable snapshots for any subscriptions missing snapshots"
              >
                <Database className="h-3.5 w-3.5 text-primary" />
                <span className="hidden md:inline">Backfill Snapshots</span>
              </Button>
            </div>
          </div>

          {/* Subscriptions Table */}
          <Card className="bg-card border-border shadow-xs rounded-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-surface text-text-secondary font-mono text-[10px] uppercase border-b border-border/30">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold">College Institution</th>
                      <th className="px-5 py-3.5 font-semibold">Assigned Plan &amp; Version</th>
                      <th className="px-5 py-3.5 font-semibold">Access Status</th>
                      <th className="px-5 py-3.5 font-semibold">Capacity &amp; Quotas</th>
                      <th className="px-5 py-3.5 font-semibold">Renewal Date</th>
                      <th className="px-5 py-3.5 font-semibold text-right">Administrative Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {loading ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i}>
                          <td colSpan={6} className="px-5 py-4">
                            <Skeleton className="h-5 w-full" />
                          </td>
                        </tr>
                      ))
                    ) : filteredSubscriptions.length > 0 ? (
                      filteredSubscriptions.map((sub) => (
                        <tr key={sub.id} className="hover:bg-surface transition-colors">
                          {/* College */}
                          <td className="px-5 py-3.5">
                            <div className="font-bold text-text-primary font-heading text-sm">
                              {sub.tenantName}
                            </div>
                            <div className="text-[11px] text-text-secondary font-mono">
                              slug: {sub.tenantSlug}
                            </div>
                          </td>

                          {/* Plan & Version */}
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-text-primary flex items-center gap-1.5">
                              <span>{sub.planName}</span>
                              <Badge
                                variant="outline"
                                className="text-[10px] font-mono border-primary/30 text-primary"
                              >
                                v{sub.planVersion}
                              </Badge>
                            </div>

                            {/* Pending Plan Change Notice */}
                            {sub.pendingPlanId && (
                              <div className="mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 border border-primary/30 px-1.5 py-0.5 rounded">
                                  Scheduled: {sub.pendingPlanName || sub.pendingPlanId} (at renewal)
                                </span>
                              </div>
                            )}

                            {/* Version Status */}
                            {!sub.entitlementsSnapshot ? (
                              <div className="flex items-center gap-1 text-[10px] text-red-600 font-mono mt-0.5">
                                <AlertTriangle className="h-3 w-3 shrink-0" /> Missing Snapshot (Access Blocked)
                              </div>
                            ) : sub.isPlanVersionOutdated ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  <AlertTriangle className="h-3 w-3 text-amber-600" /> v{sub.currentPlanVersion} available
                                </span>
                                <button
                                  onClick={() => setSubToSync(sub)}
                                  disabled={actionLoading}
                                  className="text-[10px] text-primary hover:underline font-bold font-mono"
                                >
                                  Sync Now
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-mono flex items-center gap-1 mt-0.5">
                                <Check className="h-3 w-3" /> Snapshot up-to-date
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-5 py-3.5">
                            {sub.status === "ACTIVE" ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono text-[10px] gap-1">
                                <CheckCircle2 className="h-3 w-3" /> ACTIVE
                              </Badge>
                            ) : sub.status === "PENDING_PAYMENT" ? (
                              <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-mono text-[10px] gap-1">
                                <Lock className="h-3 w-3" /> PENDING PAYMENT
                              </Badge>
                            ) : sub.status === "TRIALING" ? (
                              <Badge className="bg-blue-100 text-blue-800 border border-blue-300 font-mono text-[10px]">
                                TRIALING
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 border border-red-300 font-mono text-[10px]">
                                {sub.status}
                              </Badge>
                            )}
                          </td>

                          {/* Quotas */}
                          <td className="px-5 py-3.5 font-mono text-text-primary">
                            <div>{sub.studentSeatLimit.toLocaleString()} students</div>
                            <div className="text-[11px] text-text-secondary">{sub.staffSeatLimit} staff seats</div>
                          </td>

                          {/* Renewal Date */}
                          <td className="px-5 py-3.5 font-mono text-text-secondary">
                            <div>{new Date(sub.renewalDate).toLocaleDateString()}</div>
                            <div className="text-[10px] text-text-secondary">
                              Grace: {sub.gracePeriodDays} days
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-3.5 text-right space-x-1.5">
                            {sub.entitlementsSnapshot && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setViewingSnapshot(sub.entitlementsSnapshot)}
                                className="h-7 text-xs border-border text-text-primary hover:bg-surface/80"
                              >
                                View Snapshot
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setChangePlanSub(sub);
                                setTargetPlanId(sub.planId);
                                setPreserveLimits(false);
                                setImmediateOverride(false);
                                setOverrideReason("");
                              }}
                              className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/5 font-semibold"
                            >
                              Change Plan
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-text-secondary">
                          No college subscriptions found matching criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* MODAL 1: CREATE PLAN MODAL */}
      {isCreateModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-4xl min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl my-auto">
            <CardHeader className="pb-3 border-b border-border/30 shrink-0 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold font-heading text-text-primary">
                  Create Subscription Plan
                </CardTitle>
                <CardDescription className="text-xs text-text-secondary/75">
                  Define pricing, usage quotas, and the controlled feature entitlement matrix.
                </CardDescription>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <form onSubmit={handleCreatePlan} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 pb-8">
              {/* Section 1: Basic Identity */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                  1. Plan Identity &amp; Commercials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Plan Name *</label>
                    <Input
                      required
                      placeholder="e.g. Enterprise Tier"
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      className="bg-surface border-border text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Slug (Unique Identifier)</label>
                    <Input
                      placeholder="e.g. enterprise-tier"
                      value={planForm.slug}
                      onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Display Order</label>
                    <Input
                      type="number"
                      min={0}
                      value={planForm.displayOrder}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, displayOrder: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-primary">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Short description of this tier..."
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    className="w-full bg-surface border border-border rounded-lg p-2 text-xs text-text-primary outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Price (INR) *</label>
                    <Input
                      type="number"
                      required
                      min={0}
                      value={planForm.priceInr}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, priceInr: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Billing Interval</label>
                    <select
                      value={planForm.billingInterval}
                      onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value as any })}
                      className="w-full bg-surface border border-border text-xs rounded-lg p-2 h-9 text-text-primary outline-none"
                    >
                      <option value="ANNUAL">Annual</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Discount (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={planForm.discountPercentage}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          discountPercentage: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Initial Status</label>
                    <select
                      value={planForm.status}
                      onChange={(e) => setPlanForm({ ...planForm, status: e.target.value as any })}
                      className="w-full bg-surface border border-border text-xs rounded-lg p-2 h-9 text-text-primary outline-none"
                    >
                      <option value="PUBLISHED">PUBLISHED (Available)</option>
                      <option value="DRAFT">DRAFT (Unpublished)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Quota Limits */}
              <div className="space-y-3 pt-3 border-t border-border/30">
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                  2. Institutional Limits &amp; Quotas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {CONTROLLED_LIMIT_KEYS.map((lim) => (
                    <div
                      key={lim.key}
                      className="flex flex-col justify-between p-3 rounded-xl bg-surface border border-border/50 hover:border-primary/40 transition-colors shadow-xs space-y-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2 min-h-[2rem]">
                          <label className="text-xs font-semibold text-text-primary leading-tight break-words flex-1 min-w-0" title={lim.name}>
                            {lim.name}
                          </label>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono font-medium px-1.5 py-0 h-4 border-border/60 text-text-secondary shrink-0 bg-white mt-0.5"
                          >
                            {lim.unit}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-text-secondary line-clamp-1 leading-normal" title={lim.description}>
                          {lim.description}
                        </p>
                      </div>

                      <div className="space-y-1 pt-1">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Leave empty for Unlimited"
                          value={planForm.limits[lim.key] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                            setPlanForm({
                              ...planForm,
                              limits: { ...planForm.limits, [lim.key]: val },
                            });
                          }}
                          className="bg-white border-border text-xs h-9 font-mono focus:border-primary"
                        />
                        <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary pt-0.5 px-0.5">
                          <span>Status:</span>
                          <span className={`font-semibold ${planForm.limits[lim.key] === null ? "text-primary" : "text-text-primary"}`}>
                            {planForm.limits[lim.key] === null
                              ? "Unlimited"
                              : `${planForm.limits[lim.key]?.toLocaleString()} ${lim.unit}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Controlled Feature Matrix */}
              <div className="space-y-4 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                    3. Controlled Entitlement Feature Matrix
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue: PlanEntitlementsMap = {};
                        CONTROLLED_FEATURE_CATALOGUE.forEach((f) => (allTrue[f.key] = true));
                        setPlanForm({ ...planForm, entitlements: allTrue });
                      }}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Enable All
                    </button>
                    <span className="text-border">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allFalse: PlanEntitlementsMap = {};
                        CONTROLLED_FEATURE_CATALOGUE.forEach((f) => (allFalse[f.key] = false));
                        setPlanForm({ ...planForm, entitlements: allFalse });
                      }}
                      className="text-[11px] font-bold text-text-secondary hover:underline"
                    >
                      Disable All
                    </button>
                  </div>
                </div>

                {/* Grouped by category */}
                {(
                  [
                    "CORE_PLACEMENT",
                    "ASSESSMENT_TESTING",
                    "INTELLIGENCE_ANALYTICS",
                    "AI_CAPABILITIES",
                    "INSTITUTIONAL_ADMIN",
                  ] as FeatureCategory[]
                ).map((cat) => {
                  const catMeta = CATEGORY_LABELS[cat];
                  const features = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === cat);

                  return (
                    <div key={cat} className="space-y-2">
                      <div className="bg-surface/80/60 px-3 py-1.5 rounded-lg border border-border/30">
                        <span className="text-xs font-bold text-text-primary">{catMeta.title}</span>
                        <span className="text-[10px] text-text-secondary ml-2">({catMeta.desc})</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {features.map((feat) => {
                          const isChecked = Boolean(planForm.entitlements[feat.key]);
                          return (
                            <label
                              key={feat.key}
                              className={`flex items-start justify-between gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-white border-primary/40 shadow-xs"
                                  : "bg-surface/60 border-border/40 opacity-75"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <div className="font-semibold text-text-primary">{feat.name}</div>
                                <div className="text-[10px] text-text-secondary leading-snug">
                                  {feat.description}
                                </div>
                              </div>
                              <Switch
                                checked={isChecked}
                                onCheckedChange={(val) =>
                                  setPlanForm({
                                    ...planForm,
                                    entitlements: { ...planForm.entitlements, [feat.key]: val },
                                  })
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={actionLoading}
                  className="border-border text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 px-5"
                >
                  {actionLoading ? "Creating..." : "Save & Create Plan"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 2: EDIT PLAN MODAL */}
      {editingPlan && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingPlan(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-4xl min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl my-auto">
            <CardHeader className="pb-3 border-b border-border/30 shrink-0 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-lg font-bold font-heading text-text-primary">
                    Edit Plan: {editingPlan.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    Current: v{editingPlan.version}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-text-secondary/75">
                  Update plan definition, commercial parameters, limits, and feature toggles.
                </CardDescription>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <form onSubmit={handleSaveEditedPlan} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-6 pb-8">
              {/* Version Bump Warning */}
              {editingPlan.status === "PUBLISHED" && (
                <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-bold">Plan Versioning Notice (v{editingPlan.version} &rarr; v{editingPlan.version + 1}):</span>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Editing this published plan will increment its version to <strong>v{editingPlan.version + 1}</strong>.
                      Existing college subscriptions will safely retain their current <strong>v{editingPlan.version}</strong> snapshot and will not experience silent changes until explicitly synchronized by an administrator.
                    </p>
                  </div>
                </div>
              )}

              {/* Basic Fields */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                  1. Plan Identity &amp; Commercials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Plan Name</label>
                    <Input
                      required
                      value={planForm.name}
                      onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      className="bg-surface border-border text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Display Order</label>
                    <Input
                      type="number"
                      min={0}
                      value={planForm.displayOrder}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, displayOrder: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-primary">Description</label>
                  <textarea
                    rows={2}
                    value={planForm.description}
                    onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                    className="w-full bg-surface border border-border rounded-lg p-2 text-xs text-text-primary outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Price (INR)</label>
                    <Input
                      type="number"
                      required
                      min={0}
                      value={planForm.priceInr}
                      onChange={(e) =>
                        setPlanForm({ ...planForm, priceInr: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Billing Interval</label>
                    <select
                      value={planForm.billingInterval}
                      onChange={(e) => setPlanForm({ ...planForm, billingInterval: e.target.value as any })}
                      className="w-full bg-surface border border-border text-xs rounded-lg p-2 h-9 text-text-primary outline-none"
                    >
                      <option value="ANNUAL">Annual</option>
                      <option value="MONTHLY">Monthly</option>
                      <option value="QUARTERLY">Quarterly</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Discount (%)</label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={planForm.discountPercentage}
                      onChange={(e) =>
                        setPlanForm({
                          ...planForm,
                          discountPercentage: Math.min(100, Math.max(0, Number(e.target.value) || 0)),
                        })
                      }
                      className="bg-surface border-border text-xs h-9 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="space-y-3 pt-3 border-t border-border/30">
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                  2. Institutional Limits &amp; Quotas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {CONTROLLED_LIMIT_KEYS.map((lim) => (
                    <div
                      key={lim.key}
                      className="flex flex-col justify-between p-3 rounded-xl bg-surface border border-border/50 hover:border-primary/40 transition-colors shadow-xs space-y-2.5"
                    >
                      <div className="space-y-1">
                        <div className="flex items-start justify-between gap-2 min-h-[2rem]">
                          <label className="text-xs font-semibold text-text-primary leading-tight break-words flex-1 min-w-0" title={lim.name}>
                            {lim.name}
                          </label>
                          <Badge
                            variant="outline"
                            className="text-[9px] font-mono font-medium px-1.5 py-0 h-4 border-border/60 text-text-secondary shrink-0 bg-white mt-0.5"
                          >
                            {lim.unit}
                          </Badge>
                        </div>
                        <p className="text-[10px] text-text-secondary line-clamp-1 leading-normal" title={lim.description}>
                          {lim.description}
                        </p>
                      </div>

                      <div className="space-y-1 pt-1">
                        <Input
                          type="number"
                          min={0}
                          placeholder="Leave empty for Unlimited"
                          value={planForm.limits[lim.key] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0);
                            setPlanForm({
                              ...planForm,
                              limits: { ...planForm.limits, [lim.key]: val },
                            });
                          }}
                          className="bg-white border-border text-xs h-9 font-mono focus:border-primary"
                        />
                        <div className="flex items-center justify-between text-[10px] font-mono text-text-secondary pt-0.5 px-0.5">
                          <span>Status:</span>
                          <span className={`font-semibold ${planForm.limits[lim.key] === null ? "text-primary" : "text-text-primary"}`}>
                            {planForm.limits[lim.key] === null
                              ? "Unlimited"
                              : `${planForm.limits[lim.key]?.toLocaleString()} ${lim.unit}`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature Matrix */}
              <div className="space-y-4 pt-3 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                    3. Entitlements Feature Matrix
                  </h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allTrue: PlanEntitlementsMap = {};
                        CONTROLLED_FEATURE_CATALOGUE.forEach((f) => (allTrue[f.key] = true));
                        setPlanForm({ ...planForm, entitlements: allTrue });
                      }}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Enable All
                    </button>
                    <span className="text-border">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const allFalse: PlanEntitlementsMap = {};
                        CONTROLLED_FEATURE_CATALOGUE.forEach((f) => (allFalse[f.key] = false));
                        setPlanForm({ ...planForm, entitlements: allFalse });
                      }}
                      className="text-[11px] font-bold text-text-secondary hover:underline"
                    >
                      Disable All
                    </button>
                  </div>
                </div>

                {(
                  [
                    "CORE_PLACEMENT",
                    "ASSESSMENT_TESTING",
                    "INTELLIGENCE_ANALYTICS",
                    "AI_CAPABILITIES",
                    "INSTITUTIONAL_ADMIN",
                  ] as FeatureCategory[]
                ).map((cat) => {
                  const catMeta = CATEGORY_LABELS[cat];
                  const features = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === cat);

                  return (
                    <div key={cat} className="space-y-2">
                      <div className="bg-surface/80/60 px-3 py-1.5 rounded-lg border border-border/30">
                        <span className="text-xs font-bold text-text-primary">{catMeta.title}</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {features.map((feat) => {
                          const isChecked = Boolean(planForm.entitlements[feat.key]);
                          return (
                            <label
                              key={feat.key}
                              className={`flex items-start justify-between gap-3 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                isChecked
                                  ? "bg-white border-primary/40 shadow-xs"
                                  : "bg-surface/60 border-border/40 opacity-75"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <div className="font-semibold text-text-primary">{feat.name}</div>
                                <div className="text-[10px] text-text-secondary leading-snug">
                                  {feat.description}
                                </div>
                              </div>
                              <Switch
                                checked={isChecked}
                                onCheckedChange={(val) =>
                                  setPlanForm({
                                    ...planForm,
                                    entitlements: { ...planForm.entitlements, [feat.key]: val },
                                  })
                                }
                              />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              </div>

              {/* Action Buttons */}
              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingPlan(null)}
                  disabled={actionLoading}
                  className="border-border text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9 px-5"
                >
                  {actionLoading
                    ? "Updating..."
                    : editingPlan.status === "PUBLISHED"
                    ? "Save Changes & Increment Version"
                    : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 3: VIEW PLAN DETAILS & ENTITLEMENTS MODAL */}
      {viewingPlan && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingPlan(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-4xl min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl my-auto">
            <CardHeader className="pb-3 border-b border-border/30 shrink-0 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold font-heading text-text-primary">
                    {viewingPlan.name}
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    v{viewingPlan.version}
                  </Badge>
                  <Badge className="text-[10px] font-mono">{viewingPlan.status}</Badge>
                </div>
                <CardDescription className="text-xs text-text-secondary/75">
                  ₹{viewingPlan.priceInr.toLocaleString("en-IN")} / {viewingPlan.billingInterval.toLowerCase()} · {viewingPlan.subscribersCount ?? 0} active subscribers
                </CardDescription>
              </div>
              <button
                onClick={() => setViewingPlan(null)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5 pb-8">
              {/* Quotas & Limits */}
              <div>
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider mb-2">
                  Institutional Resource Limits
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CONTROLLED_LIMIT_KEYS.map((lim) => (
                    <div key={lim.key} className="bg-surface p-3 rounded-xl border border-border/40 space-y-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="text-[11px] text-text-secondary font-mono line-clamp-1" title={lim.name}>
                          {lim.name}
                        </span>
                        <Badge variant="outline" className="text-[9px] font-mono px-1 py-0 h-3.5 border-border/60 text-text-secondary bg-white shrink-0">
                          {lim.unit}
                        </Badge>
                      </div>
                      <div className="font-bold text-xs text-text-primary font-mono">
                        {viewingPlan.limits[lim.key] !== null
                          ? `${viewingPlan.limits[lim.key]?.toLocaleString()} ${lim.unit}`
                          : "Unlimited"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Controlled Entitlements Breakdown */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider">
                  Feature Entitlements Status
                </h4>

                {(
                  [
                    "CORE_PLACEMENT",
                    "ASSESSMENT_TESTING",
                    "INTELLIGENCE_ANALYTICS",
                    "AI_CAPABILITIES",
                    "INSTITUTIONAL_ADMIN",
                  ] as FeatureCategory[]
                ).map((cat) => {
                  const catMeta = CATEGORY_LABELS[cat];
                  const features = CONTROLLED_FEATURE_CATALOGUE.filter((f) => f.category === cat);

                  return (
                    <div key={cat} className="space-y-1.5">
                      <div className="text-xs font-bold text-text-primary flex items-center gap-2">
                        <span>{catMeta.title}</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {features.map((feat) => {
                          const isEnabled = Boolean(viewingPlan.entitlements[feat.key]);
                          return (
                            <div
                              key={feat.key}
                              className={`p-2 rounded-lg border text-xs flex items-center justify-between ${
                                isEnabled
                                  ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                                  : "bg-gray-50 border-gray-200 text-gray-500"
                              }`}
                            >
                              <span className="font-medium">{feat.name}</span>
                              {isEnabled ? (
                                <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-mono">
                                  ENABLED
                                </Badge>
                              ) : (
                                <span className="text-[10px] font-mono text-gray-400">DISABLED</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingPlan(null)}
                className="border-border text-xs h-8"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 4: CHANGE COLLEGE PLAN MODAL */}
      {changePlanSub && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setChangePlanSub(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-2xl my-auto">
            <CardHeader className="shrink-0 pb-3 border-b border-border/60 bg-card">
              <CardTitle className="text-base font-bold font-heading text-text-primary">
                Change Subscription Plan
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary/75">
                Assign a published plan to <strong>{changePlanSub.tenantName}</strong>.
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleChangeCollegePlan} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
                {/* Security Invariant Notice */}
                {changePlanSub.status === "PENDING_PAYMENT" && (
                  <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2">
                    <Lock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Strict Payment Invariant:</span>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        Changing the plan for this college will update the assigned tier and snapshot, but will <strong>NOT</strong> activate operational features. The college status remains strictly <strong>PENDING_PAYMENT</strong> until payment verification.
                      </p>
                    </div>
                  </div>
                )}

                {/* ACTIVE Subscription Contract Transition Policy */}
                {changePlanSub.status === "ACTIVE" && (
                  <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 text-xs space-y-3">
                    <div className="flex items-start gap-2 text-text-primary">
                      <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Active Contract Transition Policy:</span>
                        <p className="text-[11px] text-text-secondary/75 mt-0.5 leading-relaxed">
                          By default, plan changes for active subscribers are scheduled for the next renewal date ({changePlanSub.renewalDate ? new Date(changePlanSub.renewalDate).toLocaleDateString() : "next cycle"}). Current active features and quotas remain intact until the transition.
                        </p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                      <label htmlFor="immediateOverride" className="text-xs font-semibold text-text-primary cursor-pointer">
                        Emergency Immediate Override (Contractual Exception)
                      </label>
                      <Switch
                        id="immediateOverride"
                        checked={immediateOverride}
                        onCheckedChange={setImmediateOverride}
                      />
                    </div>

                    {immediateOverride && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-bold text-red-700 uppercase tracking-wide">
                          Override Justification (Required, min 10 chars)
                        </label>
                        <textarea
                          rows={2}
                          required
                          value={overrideReason}
                          onChange={(e) => setOverrideReason(e.target.value)}
                          placeholder="State operational or contractual justification for immediate change..."
                          className="w-full bg-surface border border-red-300 rounded-lg p-2 text-xs text-text-primary outline-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary">Target Subscription Plan</label>
                  <select
                    value={targetPlanId}
                    onChange={(e) => setTargetPlanId(e.target.value)}
                    className="w-full bg-surface border border-border text-xs rounded-lg p-2.5 text-text-primary outline-none"
                  >
                    {plans
                      .filter((p) => p.status === "PUBLISHED")
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (v{p.version}) — ₹{p.priceInr.toLocaleString("en-IN")}/{p.billingInterval.toLowerCase()}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="p-3 bg-surface rounded-xl border border-border/40 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Current Plan:</span>
                    <span className="font-bold text-text-primary">{changePlanSub.planName} (v{changePlanSub.planVersion})</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">Current Status:</span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {changePlanSub.status}
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border/40">
                  <label htmlFor="preserveLimits" className="text-xs font-semibold text-text-primary cursor-pointer select-none">
                    Preserve custom seat limits if configured
                  </label>
                  <Switch
                    id="preserveLimits"
                    checked={preserveLimits}
                    onCheckedChange={setPreserveLimits}
                  />
                </div>

                </CardContent>
              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setChangePlanSub(null)}
                    disabled={actionLoading}
                    className="border-border text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      actionLoading ||
                      (changePlanSub.status === "ACTIVE" && immediateOverride && overrideReason.trim().length < 10)
                    }
                    className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9"
                  >
                    {actionLoading
                      ? "Applying..."
                      : changePlanSub.status === "ACTIVE" && !immediateOverride
                      ? "Schedule for Renewal"
                      : "Confirm Plan Change"}
                  </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL 5: VIEW SNAPSHOT ENTITLEMENTS MODAL */}
      {viewingSnapshot && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setViewingSnapshot(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-2xl my-auto">
            <CardHeader className="pb-3 border-b border-border/30 shrink-0 flex flex-row items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold font-heading text-text-primary">
                    Frozen Entitlements Snapshot
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary">
                    v{viewingSnapshot.planVersion}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-text-secondary/75">
                  Captured at: {new Date(viewingSnapshot.snapshotAt).toLocaleString()}
                </CardDescription>
              </div>
              <button
                onClick={() => setViewingSnapshot(null)}
                className="text-text-secondary hover:text-text-primary p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>

            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div className="p-3 bg-surface rounded-xl border border-border/40 text-xs space-y-1">
                <div><strong>Plan:</strong> {viewingSnapshot.planName} (Version {viewingSnapshot.planVersion})</div>
                <div><strong>Base Commercials:</strong> ₹{viewingSnapshot.priceInr.toLocaleString("en-IN")} / {viewingSnapshot.billingCycle.toLowerCase()}</div>
              </div>

              <div>
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider mb-2">
                  Snapshot Resource Quotas
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {Object.entries(viewingSnapshot.limits || {}).map(([k, v]) => (
                    <div key={k} className="bg-surface p-2 rounded-lg border border-border/30">
                      <div className="text-[10px] text-text-secondary font-mono">{k}</div>
                      <div className="font-bold text-text-primary">{v !== null ? v.toLocaleString() : "Unlimited"}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold font-mono text-primary uppercase tracking-wider mb-2">
                  Active Features in Snapshot
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(viewingSnapshot.entitlements || {})
                    .filter(([_, enabled]) => enabled)
                    .map(([k]) => {
                      const feat = CONTROLLED_FEATURE_CATALOGUE.find((f) => f.key === k);
                      return (
                        <span
                          key={k}
                          className="text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md"
                        >
                          {feat?.name || k}
                        </span>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingSnapshot(null)}
                className="border-border text-xs h-8"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 6: ARCHIVE CONFLICT MODAL */}
      {archiveConflict && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setArchiveConflict(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-red-300 shadow-xl rounded-2xl my-auto">
            <CardHeader className="shrink-0 pb-3 border-b border-red-200 bg-card">
              <div className="flex items-center gap-2 text-red-700">
                <ShieldAlert className="h-5 w-5" />
                <CardTitle className="text-base font-bold font-heading">
                  Cannot Archive Plan
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-red-900/80">
                Plan <strong>&apos;{archiveConflict.planName}&apos;</strong> is actively assigned to colleges.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
              <p className="text-xs text-text-primary leading-relaxed">
                By platform safety rule, subscription plans with active or pending subscribers cannot be archived. Reassign these colleges to another published plan before archiving this tier.
              </p>

              <div className="bg-red-50 p-3 rounded-xl border border-red-200 text-xs">
                <div className="font-bold text-red-800 mb-1.5 font-mono text-[11px] uppercase">
                  Affected College Subscribers ({archiveConflict.affectedColleges.length}):
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-red-900 font-mono text-[11px]">
                  {archiveConflict.affectedColleges.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-red-200 bg-surface/50 flex justify-end gap-2">
              <Button
                onClick={() => setArchiveConflict(null)}
                  className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-8"
                >
                  Understood
                </Button>
            </div>
          </Card>
        </div>
      )}
      {/* MODAL 7: ARCHIVE CONFIRMATION MODAL */}
      {planToArchive && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setPlanToArchive(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-2xl my-auto">
            <CardHeader className="shrink-0 pb-3 border-b border-border/60 bg-card">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="h-5 w-5" />
                <CardTitle className="text-base font-bold font-heading">
                  Archive Subscription Plan?
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-text-secondary/75">
                Archiving <strong>{planToArchive.name}</strong> will hide it from future college assignments.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              <p className="text-xs text-text-primary leading-relaxed">
                Are you sure you want to archive <strong>{planToArchive.name}</strong>? If any colleges are actively subscribed to this plan, platform safety checks will prevent this action.
              </p>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setPlanToArchive(null)}
                  disabled={actionLoading}
                  className="border-border text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => executeArchivePlan(planToArchive)}
                  disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white text-xs h-9"
                >
                  {actionLoading ? "Archiving..." : "Confirm Archive"}
                </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODAL 8: SYNC VERSION CONFIRMATION MODAL */}
      {subToSync && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubToSync(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-y-auto"
        >
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-xl rounded-2xl my-auto">
            <CardHeader className="shrink-0 pb-3 border-b border-border/60 bg-card">
              <div className="flex items-center gap-2 text-primary">
                <History className="h-5 w-5" />
                <CardTitle className="text-base font-bold font-heading">
                  Sync Subscription Version?
                </CardTitle>
              </div>
              <CardDescription className="text-xs text-text-secondary/75">
                Update <strong>{subToSync.tenantName}</strong> to Plan Version <strong>v{subToSync.currentPlanVersion}</strong>.
              </CardDescription>
            </CardHeader>

            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              <p className="text-xs text-text-primary leading-relaxed">
                This college is currently on <strong>v{subToSync.planVersion}</strong> snapshot. Synchronizing will apply the latest limits, quotas, and feature entitlements defined in <strong>v{subToSync.currentPlanVersion}</strong>.
              </p>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSubToSync(null)}
                  disabled={actionLoading}
                  className="border-border text-xs h-9"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => executeSyncVersion(subToSync)}
                  disabled={actionLoading}
                  className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9"
                >
                  {actionLoading ? "Synchronizing..." : "Confirm & Sync Version"}
                </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
