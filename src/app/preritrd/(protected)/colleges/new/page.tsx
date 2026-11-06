"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  Copy,
  Check,
  CreditCard,
  Mail,
  User,
  Phone,
  Globe,
  Hash,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface PublishedPlan {
  id: string;
  name: string;
  priceInr: number;
  billingInterval?: string;
  studentLimit?: number;
  description?: string;
  features?: string[];
  status?: string;
}

const FALLBACK_PLANS: PublishedPlan[] = [
  {
    id: "starter",
    name: "Institutional Starter",
    priceInr: 49999,
    studentLimit: 500,
    features: ["Up to 500 students", "Standard Assessments"],
    description: "Up to 500 students • Standard Assessments",
  },
  {
    id: "growth",
    name: "Campus Growth",
    priceInr: 129999,
    studentLimit: 2500,
    features: ["Up to 2,500 students", "DriveFit", "Mistake Bank"],
    description: "Up to 2,500 students • DriveFit • Mistake Bank",
  },
  {
    id: "enterprise",
    name: "University Enterprise",
    priceInr: 249999,
    studentLimit: 10000,
    features: ["Up to 10,000 students", "Dedicated SLA & Support"],
    description: "Up to 10,000 students • Dedicated SLA & Support",
  },
];

export default function RegisterCollegePage() {
  const router = useRouter();

  // Form State
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [officialEmail, setOfficialEmail] = React.useState("");
  const [contactName, setContactName] = React.useState("");
  const [contactPhone, setContactPhone] = React.useState("");
  const [primaryDomain, setPrimaryDomain] = React.useState("");
  const [initialPlanId, setInitialPlanId] = React.useState("growth");
  const [studentSeatLimit, setStudentSeatLimit] = React.useState("1000");

  const [plans, setPlans] = React.useState<PublishedPlan[]>(FALLBACK_PLANS);
  const [loadingPlans, setLoadingPlans] = React.useState(true);

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [createdCollege, setCreatedCollege] = React.useState<any | null>(null);
  const [copiedToken, setCopiedToken] = React.useState(false);

  // Fetch real-time published subscription plans and current pricing from database
  React.useEffect(() => {
    let isMounted = true;
    async function loadPublishedPlans() {
      try {
        setLoadingPlans(true);
        const res = await fetch("/api/preritrd/subscriptions/plans");
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && data.success && Array.isArray(data.plans) && data.plans.length > 0) {
          const published = data.plans
            .filter(
              (p: any) =>
                p.status === "PUBLISHED" ||
                p.status === undefined ||
                p.isActive !== false
            )
            .map((p: any) => ({
              id: p.id,
              name: p.name,
              priceInr: Number(p.priceInr ?? p.price_inr ?? 0),
              billingInterval: p.billingInterval || p.billing_cycle || "ANNUAL",
              studentLimit: Number(p.studentLimit ?? p.student_limit ?? 1000),
              features: Array.isArray(p.features) ? p.features : [],
              description: p.description || "",
              status: p.status,
            }));

          if (published.length > 0) {
            setPlans(published);
          }
        }
      } catch {
        // Fall back gracefully to standard defaults
      } finally {
        if (isMounted) setLoadingPlans(false);
      }
    }

    loadPublishedPlans();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectPlan = (planId: string) => {
    setInitialPlanId(planId);
    if (planId === "unassigned") return;
    const target = plans.find((p) => p.id === planId);
    if (target?.studentLimit) {
      setStudentSeatLimit(target.studentLimit.toString());
    }
  };

  // Auto-slug generator
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setName(val);
    if (!createdCollege) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, "")
      );
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch("/api/preritrd/colleges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim().toLowerCase(),
          officialEmail: officialEmail.trim().toLowerCase(),
          contactName: contactName.trim(),
          contactPhone: contactPhone.trim() || undefined,
          primaryDomain: primaryDomain.trim().toLowerCase() || undefined,
          initialPlanId,
          studentSeatLimit: Number(studentSeatLimit),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || "Failed to register college platform account.");
      } else {
        setCreatedCollege(data);
      }
    } catch {
      setErrorMsg("Network error connecting to platform registration API.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopyToken() {
    if (createdCollege?.onboardingToken) {
      navigator.clipboard.writeText(createdCollege.onboardingToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div>
          <Link
            href="/preritrd/colleges"
            className="text-xs font-mono text-primary hover:underline inline-flex items-center gap-1 mb-1 font-semibold"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Colleges
          </Link>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-primary">
              Control Plane
            </span>
            <Badge variant="outline" className="font-mono text-[10px] bg-secondary/10 text-secondary border-secondary/30">
              Institutional Provisioning
            </Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-text-primary tracking-tight">
            Register New College Account
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Provision an isolated institutional workspace, configure initial subscription tier, and issue onboarding token.
          </p>
        </div>
      </div>

      {/* Success Banner when registered */}
      {createdCollege && (
        <Card className="bg-secondary/10 border-secondary/30 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-text-primary font-bold font-heading text-lg">
              <CheckCircle2 className="h-6 w-6 text-secondary" />
              <span>Institution Successfully Registered</span>
            </div>

            <p className="text-xs text-text-secondary leading-relaxed">
              The institutional account for{" "}
              <span className="font-bold text-text-primary">{createdCollege.college.name}</span> has been provisioned on the SaaS control plane. An initial subscription and billing record have been generated.
            </p>

            {/* Email Delivery Outcome Banner */}
            {createdCollege.emailDelivery?.success ? (
              <div className="p-3.5 rounded-xl bg-card border border-secondary/30 text-xs text-text-primary flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-secondary shrink-0" />
                <div>
                  <span className="font-bold">Invitation Email Sent:</span> An automated account setup email was dispatched to{" "}
                  <span className="font-mono font-bold text-primary">{createdCollege.college.officialEmail}</span>.
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-900 dark:text-amber-100 space-y-1">
                <div className="flex items-center gap-2 font-bold">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Email Provider Status: Unconfigured or Delivery Notice</span>
                </div>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  The college was provisioned, but automated email delivery was not completed ({createdCollege.emailDelivery?.error || "Credentials unconfigured"}). You may copy the secure invitation link below and share it directly with the Placement Head.
                </p>
              </div>
            )}

            {/* Onboarding Token Box */}
            {createdCollege.onboardingToken && (
              <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2">
                <div className="text-[10px] font-mono font-bold uppercase text-text-secondary">
                  Onboarding Token / Setup Link
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/auth/onboard?token=${createdCollege.onboardingToken}`}
                    className="bg-card border-border text-xs font-mono h-9"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyToken}
                    className="h-9 text-xs border-border gap-1 shrink-0"
                  >
                    {copiedToken ? <Check className="h-3.5 w-3.5 text-secondary" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedToken ? "Copied" : "Copy Link"}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <Button asChild className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-9">
                <Link href="/preritrd/colleges">View All Colleges</Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreatedCollege(null);
                  setName("");
                  setSlug("");
                  setOfficialEmail("");
                  setContactName("");
                  setContactPhone("");
                  setPrimaryDomain("");
                }}
                className="border-border text-xs h-9"
              >
                Register Another College
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <Alert variant="destructive" className="bg-status-danger-subtle border-status-danger/30 text-status-danger py-3 rounded-2xl">
          <AlertCircle className="h-4 w-4 text-status-danger" />
          <AlertTitle className="text-xs font-bold font-heading">Registration Failed</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Registration Form */}
      {!createdCollege && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Institution Details */}
          <Card className="bg-card border-border shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Institution Identity &amp; Identifier</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Official institutional metadata for account registration
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Official Institution Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Sapthagiri NPS University"
                    value={name}
                    onChange={handleNameChange}
                    className="bg-input border-border text-xs h-9 rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Institutional Slug (Unique URL Path) *
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
                    <Input
                      required
                      placeholder="sapthagiri-university"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="pl-8 bg-input border-border text-xs font-mono h-9 rounded-xl"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Placement Head Institutional Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
                    <Input
                      type="email"
                      required
                      placeholder="placements.head@sapthagiri.edu.in"
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                      className="pl-8 bg-input border-border text-xs h-9 rounded-xl font-mono"
                    />
                  </div>
                  <p className="text-[10px] text-text-secondary">
                    The single-use account setup invitation is bound and dispatched to this address.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Primary Domain (Optional)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
                    <Input
                      placeholder="sapthagiri.edu.in"
                      value={primaryDomain}
                      onChange={(e) => setPrimaryDomain(e.target.value)}
                      className="pl-8 bg-input border-border text-xs h-9 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Contact Person */}
          <Card className="bg-card border-border shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                <User className="h-4 w-4 text-secondary" />
                <span>Primary Administrative Contact</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Institutional Placement Head or onboarding coordinator
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Placement Head Full Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Dr. Jack Vance"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="bg-input border-border text-xs h-9 rounded-xl"
                  />
                  <p className="text-[10px] text-text-secondary">
                    Authorized administrator of institutional placement operations.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-text-primary block">
                    Contact Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-text-secondary" />
                    <Input
                      placeholder="+91 98765 43210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="pl-8 bg-input border-border text-xs h-9 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Subscription & Capacity */}
          <Card className="bg-card border-border shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold font-heading text-text-primary flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span>Initial Subscription Plan &amp; Capacity</span>
              </CardTitle>
              <CardDescription className="text-xs text-text-secondary">
                Select initial tier and configure student capacity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {plans.map((plan) => {
                  const isSelected = initialPlanId === plan.id;
                  const interval = plan.billingInterval === "MONTHLY" ? "mo" : "yr";
                  const priceLabel = `₹${plan.priceInr.toLocaleString("en-IN")}/${interval}`;

                  let summary = "";
                  if (plan.id === "starter") {
                    summary = `Up to ${(plan.studentLimit || 500).toLocaleString("en-IN")} students • Standard Assessments`;
                  } else if (plan.id === "growth") {
                    summary = `Up to ${(plan.studentLimit || 2500).toLocaleString("en-IN")} students • DriveFit • Mistake Bank`;
                  } else if (plan.id === "enterprise") {
                    summary = `Up to ${(plan.studentLimit || 10000).toLocaleString("en-IN")} students • Dedicated SLA & Support`;
                  } else if (plan.features && plan.features.length > 0) {
                    summary = `Up to ${(plan.studentLimit || 1000).toLocaleString("en-IN")} students • ${plan.features.slice(0, 2).join(" • ")}`;
                  } else {
                    summary = plan.description || `Up to ${(plan.studentLimit || 1000).toLocaleString("en-IN")} students`;
                  }

                  return (
                    <label
                      key={plan.id}
                      className={`p-4 rounded-xl border text-left cursor-pointer transition-all block ${
                        isSelected
                          ? "bg-primary/10 border-primary ring-2 ring-primary/30"
                          : "bg-surface border-border hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="plan"
                        value={plan.id}
                        checked={isSelected}
                        onChange={() => handleSelectPlan(plan.id)}
                        className="sr-only"
                      />
                      <div className="font-bold text-xs text-text-primary">{plan.name}</div>
                      <div className="text-base font-extrabold font-heading text-primary mt-1">
                        {priceLabel}
                      </div>
                      <div className="text-[11px] text-text-secondary mt-2 leading-relaxed">
                        {summary}
                      </div>
                    </label>
                  );
                })}

                {/* Option C: Unassigned Post-Registration Plan Selection */}
                <label
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all block ${
                    initialPlanId === "unassigned"
                      ? "bg-secondary/10 border-secondary ring-2 ring-secondary/30"
                      : "bg-surface border-border hover:border-secondary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="unassigned"
                    checked={initialPlanId === "unassigned"}
                    onChange={() => handleSelectPlan("unassigned")}
                    className="sr-only"
                  />
                  <div className="font-bold text-xs text-text-primary">Leave Unassigned</div>
                  <div className="text-base font-extrabold font-heading text-secondary mt-1">Option C</div>
                  <div className="text-[11px] text-text-secondary mt-2 leading-relaxed">
                    Placement Head selects approved plan post-registration
                  </div>
                </label>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-text-primary block">
                  Student Seat Limit
                </label>
                <Input
                  type="number"
                  min={50}
                  max={50000}
                  value={studentSeatLimit}
                  onChange={(e) => setStudentSeatLimit(e.target.value)}
                  className="bg-input border-border text-xs h-9 max-w-xs font-mono rounded-xl"
                />
                <p className="text-[11px] text-text-secondary">
                  Enforced server-side. Institutional student registration will be bounded by this capacity.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button asChild variant="outline" className="border-border text-xs h-10 rounded-xl">
              <Link href="/preritrd/colleges">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs h-10 px-6 rounded-xl shadow-xs"
            >
              {loading ? (
                <>
                  <BrandLoader size="button" className="mr-2" /> Provisioning Institution...
                </>
              ) : (
                "Provision College Account"
              )}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
