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
  ShieldCheck,
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

  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [createdCollege, setCreatedCollege] = React.useState<any | null>(null);
  const [copiedToken, setCopiedToken] = React.useState(false);

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
      <div className="flex items-center justify-between pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <Link
            href="/preritrd/colleges"
            className="text-xs font-mono text-[#5052C9] hover:underline inline-flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Colleges
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Register New College Account
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Provision an isolated institutional workspace, configure initial subscription tier, and issue onboarding token.
          </p>
        </div>
      </div>

      {/* Success Banner when registered */}
      {createdCollege && (
        <Card className="bg-emerald-50 border-emerald-300 shadow-xs rounded-2xl overflow-hidden">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-emerald-900 font-bold font-heading text-lg">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              <span>Institution Successfully Registered</span>
            </div>

            <p className="text-xs text-emerald-800 leading-relaxed">
              The institutional account for{" "}
              <span className="font-bold">{createdCollege.college.name}</span> has been provisioned on the SaaS control plane. An initial subscription and billing record have been generated.
            </p>

            {/* Email Delivery Outcome Banner */}
            {createdCollege.emailDelivery?.success ? (
              <div className="p-3.5 rounded-xl bg-white border border-emerald-300 text-xs text-emerald-900 flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold">Invitation Email Sent:</span> An automated account setup email was dispatched to{" "}
                  <span className="font-mono font-bold text-emerald-950">{createdCollege.college.officialEmail}</span>.
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-950">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>Email Provider Status: Unconfigured or Delivery Notice</span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  The college was provisioned, but automated email delivery was not completed ({createdCollege.emailDelivery?.error || "Credentials unconfigured"}). You may copy the secure invitation link below and share it directly with the Placement Head.
                </p>
              </div>
            )}

            <div className="flex gap-2.5 pt-2">
              <Button asChild className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-9">
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
                className="border-emerald-300 text-xs h-9"
              >
                Register Another College
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {errorMsg && (
        <Alert variant="destructive" className="bg-red-50 border-red-200 text-red-900 py-3">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertTitle className="text-xs font-bold font-heading">Registration Failed</AlertTitle>
          <AlertDescription className="text-xs leading-relaxed">{errorMsg}</AlertDescription>
        </Alert>
      )}

      {/* Registration Form */}
      {!createdCollege && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Institution Details */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#5052C9]" />
                <span>Institution Identity &amp; Identifier</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Official institutional metadata for account registration
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] block">
                    Official Institution Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Sapthagiri NPS University"
                    value={name}
                    onChange={handleNameChange}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] block">
                    Institutional Slug (Unique URL Path) *
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-2.5 h-4 w-4 text-[#747683]" />
                    <Input
                      required
                      placeholder="sapthagiri-university"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      className="pl-8 bg-[#FBFAF7] border-[#B8B6AC] text-xs font-mono h-9"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] block">
                    Placement Head Institutional Email *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-[#747683]" />
                    <Input
                      type="email"
                      required
                      placeholder="placements.head@sapthagiri.edu.in"
                      value={officialEmail}
                      onChange={(e) => setOfficialEmail(e.target.value)}
                      className="pl-8 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>
                  <p className="text-[10px] text-[#747683]">
                    The single-use account setup invitation is bound and dispatched to this address.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] block">
                    Primary Domain (Optional)
                  </label>
                  <div className="relative">
                    <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-[#747683]" />
                    <Input
                      placeholder="sapthagiri.edu.in"
                      value={primaryDomain}
                      onChange={(e) => setPrimaryDomain(e.target.value)}
                      className="pl-8 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Contact Person */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <User className="h-4 w-4 text-[#2E8F86]" />
                <span>Primary Administrative Contact</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Institutional Placement Head or onboarding coordinator
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] block">
                    Placement Head Full Name *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Dr. Jack Vance"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                  />
                  <p className="text-[10px] text-[#747683]">
                    Authorized administrator of institutional placement operations.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] block">
                    Contact Phone (Optional)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-[#747683]" />
                    <Input
                      placeholder="+91 98765 43210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="pl-8 bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Subscription & Capacity */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
              <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#5052C9]" />
                <span>Initial Subscription Plan &amp; Capacity</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]/70">
                Select initial tier and configure student capacity
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Plan 1 */}
                <label
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all block ${
                    initialPlanId === "starter"
                      ? "bg-[#5052C9]/10 border-[#5052C9] ring-2 ring-[#5052C9]/30"
                      : "bg-[#FBFAF7] border-[#B8B6AC]/50 hover:border-[#5052C9]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="starter"
                    checked={initialPlanId === "starter"}
                    onChange={(e) => setInitialPlanId(e.target.value)}
                    className="sr-only"
                  />
                  <div className="font-bold text-xs text-[#24283A]">Institutional Starter</div>
                  <div className="text-base font-extrabold font-heading text-[#5052C9] mt-1">₹49,999/yr</div>
                  <div className="text-[11px] text-[#747683] mt-2 leading-relaxed">
                    Up to 500 students &bull; Standard Assessments
                  </div>
                </label>

                {/* Plan 2 */}
                <label
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all block ${
                    initialPlanId === "growth"
                      ? "bg-[#5052C9]/10 border-[#5052C9] ring-2 ring-[#5052C9]/30"
                      : "bg-[#FBFAF7] border-[#B8B6AC]/50 hover:border-[#5052C9]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="growth"
                    checked={initialPlanId === "growth"}
                    onChange={(e) => setInitialPlanId(e.target.value)}
                    className="sr-only"
                  />
                  <div className="font-bold text-xs text-[#24283A]">Campus Growth</div>
                  <div className="text-base font-extrabold font-heading text-[#5052C9] mt-1">₹1,29,999/yr</div>
                  <div className="text-[11px] text-[#747683] mt-2 leading-relaxed">
                    Up to 2,500 students &bull; DriveFit &bull; Mistake Bank
                  </div>
                </label>

                {/* Plan 3 */}
                <label
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all block ${
                    initialPlanId === "enterprise"
                      ? "bg-[#5052C9]/10 border-[#5052C9] ring-2 ring-[#5052C9]/30"
                      : "bg-[#FBFAF7] border-[#B8B6AC]/50 hover:border-[#5052C9]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="enterprise"
                    checked={initialPlanId === "enterprise"}
                    onChange={(e) => setInitialPlanId(e.target.value)}
                    className="sr-only"
                  />
                  <div className="font-bold text-xs text-[#24283A]">University Enterprise</div>
                  <div className="text-base font-extrabold font-heading text-[#5052C9] mt-1">₹2,49,999/yr</div>
                  <div className="text-[11px] text-[#747683] mt-2 leading-relaxed">
                    Up to 10,000 students &bull; Dedicated SLA &amp; Support
                  </div>
                </label>

                {/* Option C: Unassigned Post-Registration Plan Selection */}
                <label
                  className={`p-4 rounded-xl border text-left cursor-pointer transition-all block ${
                    initialPlanId === "unassigned"
                      ? "bg-[#2E8F86]/10 border-[#2E8F86] ring-2 ring-[#2E8F86]/30"
                      : "bg-[#FBFAF7] border-[#B8B6AC]/50 hover:border-[#2E8F86]/40"
                  }`}
                >
                  <input
                    type="radio"
                    name="plan"
                    value="unassigned"
                    checked={initialPlanId === "unassigned"}
                    onChange={(e) => setInitialPlanId(e.target.value)}
                    className="sr-only"
                  />
                  <div className="font-bold text-xs text-[#24283A]">Leave Unassigned</div>
                  <div className="text-base font-extrabold font-heading text-[#2E8F86] mt-1">Option C</div>
                  <div className="text-[11px] text-[#747683] mt-2 leading-relaxed">
                    Placement Head selects approved plan post-registration
                  </div>
                </label>
              </div>

              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-[#24283A] block">
                  Student Seat Limit
                </label>
                <Input
                  type="number"
                  min={50}
                  max={50000}
                  value={studentSeatLimit}
                  onChange={(e) => setStudentSeatLimit(e.target.value)}
                  className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 max-w-xs font-mono"
                />
                <p className="text-[11px] text-[#747683]">
                  Enforced server-side. Institutional student registration will be bounded by this capacity.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end gap-3 pt-2">
            <Button asChild variant="outline" className="border-[#B8B6AC] text-xs h-10">
              <Link href="/preritrd/colleges">Cancel</Link>
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white font-medium text-xs h-10 px-6 shadow-sm"
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
