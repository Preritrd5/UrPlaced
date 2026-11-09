"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Award,
  Share2,
  Download,
  Eye,
  Lock,
  Globe,
  Building,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  Clock,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  User,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { BrandLoader } from "@/components/common/brand-loader";
import type {
  CareerPassportData,
  ShareLinkResult,
  IncludedSectionsConfig,
} from "@/modules/students/services/career-passport-service";

export default function CareerPassportPage() {
  const [passport, setPassport] = useState<CareerPassportData | null>(null);
  const [shareLinks, setShareLinks] = useState<ShareLinkResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Share Dialog state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLabel, setShareLabel] = useState("");
  const [shareExpiryDays, setShareExpiryDays] = useState<number | null>(30);
  const [newlyCreatedShare, setNewlyCreatedShare] = useState<ShareLinkResult | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Form states
  const [visibility, setVisibility] = useState<"PRIVATE" | "COLLEGE_VISIBLE" | "SHAREABLE">("PRIVATE");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [sections, setSections] = useState<IncludedSectionsConfig>({
    show_cgpa: false,
    show_phone: false,
    show_email: true,
    show_education: true,
    show_skills: true,
    show_projects: true,
    show_experience: true,
    show_certifications: true,
    show_achievements: true,
  });

  useEffect(() => {
    loadPassportData();
  }, []);

  const loadPassportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [passRes, shareRes] = await Promise.all([
        fetch("/api/student/career-passport"),
        fetch("/api/student/career-passport/shares"),
      ]);

      if (!passRes.ok) throw new Error("Failed to load career passport.");

      const passJson = await passRes.json();
      const pData: CareerPassportData = passJson.data;

      setPassport(pData);
      setVisibility(pData.visibility);
      setHeadline(pData.headline || "");
      setSummary(pData.summary || "");
      setSections(pData.includedSections);

      if (shareRes.ok) {
        const shareJson = await shareRes.json();
        setShareLinks(shareJson.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load passport.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await fetch("/api/student/career-passport", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visibility,
          headline: headline.trim(),
          summary: summary.trim(),
          includedSections: sections,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save passport settings.");

      // Also publish snapshot
      await fetch("/api/student/career-passport/publish", { method: "POST" });

      setPassport(json.data);
      setSuccessMessage("Career Passport updated and published successfully!");
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      setError(err.message || "Failed to save passport settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const res = await fetch("/api/student/career-passport/pdf");
      if (!res.ok) throw new Error("Failed to generate PDF.");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${passport?.studentName || "Student"}_Career_Passport.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Could not generate PDF export.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handleCreateShareLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const res = await fetch("/api/student/career-passport/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: shareLabel.trim() || "Public Recruiter Link",
          expiresInDays: shareExpiryDays,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create share link.");

      setNewlyCreatedShare(json.data);
      setVisibility("SHAREABLE");

      // Refresh share links list
      const shareRes = await fetch("/api/student/career-passport/shares");
      if (shareRes.ok) {
        const shareJson = await shareRes.json();
        setShareLinks(shareJson.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create share link.");
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      const res = await fetch(`/api/student/career-passport/shares/${shareId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setShareLinks((prev) => prev.filter((s) => s.id !== shareId));
      }
    } catch {
      // Non-critical
    }
  };

  const copyShareUrl = (rawToken?: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const url = rawToken ? `${origin}/passport/${rawToken}` : "";
    if (url) {
      navigator.clipboard.writeText(url);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-3">
        <BrandLoader size="lg" />
        <p className="text-sm font-medium text-[#292D40]/70">Loading Student Career Passport...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12 font-inter">
      {/* Header Banner */}
      <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-6 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="p-2 rounded-xl bg-[#5052C9]/10 text-[#5052C9]">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-xl md:text-2xl font-bold font-outfit text-[#24283A]">
              Student Career Passport
            </h1>
            <Badge className="bg-[#5052C9] text-white text-[11px]">Phase 02</Badge>
          </div>
          <p className="text-sm text-[#292D40]/75 max-w-2xl">
            A professional, student-controlled digital portfolio suitable for campus placement drives and external recruiters.
            Manage section visibility, generate cryptographically secure expiring share links, or export a certified PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="text-xs border-[#DDDCD5] text-[#24283A] bg-white hover:bg-[#EDECE7]"
          >
            {isDownloadingPdf ? (
              <BrandLoader size="inline" className="mr-1.5" />
            ) : (
              <Download className="w-3.5 h-3.5 mr-1.5 text-[#5052C9]" />
            )}
            Download PDF
          </Button>

          <Button
            size="sm"
            onClick={() => {
              setNewlyCreatedShare(null);
              setShowShareModal(true);
            }}
            className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5 mr-1.5" />
            Share Passport
          </Button>
        </div>
      </div>

      {passport?.isStale && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Your Career Profile data has been updated since your passport was last published. Click &quot;Save &amp; Publish&quot; to refresh your shared passport.
            </span>
          </div>
          <Button
            size="sm"
            onClick={handleSaveSettings}
            disabled={isSaving}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs py-1 h-auto"
          >
            Publish Now
          </Button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <p className="text-xs">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Controls & Privacy Settings */}
        <div className="lg:col-span-1 space-y-6">
          {/* Visibility Mode Selector */}
          <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm space-y-4">
            <h2 className="text-xs font-bold font-outfit text-[#24283A] uppercase tracking-wider flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-[#5052C9]" />
              Audience &amp; Visibility
            </h2>

            <div className="space-y-2">
              <label
                onClick={() => setVisibility("PRIVATE")}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  visibility === "PRIVATE"
                    ? "bg-[#FBFAF7] border-[#5052C9] shadow-xs"
                    : "bg-[#FBFAF7] border-[#DDDCD5] opacity-70 hover:opacity-100"
                }`}
              >
                <Lock className={`w-4 h-4 mt-0.5 ${visibility === "PRIVATE" ? "text-[#5052C9]" : "text-[#747683]"}`} />
                <div>
                  <span className="text-xs font-bold text-[#24283A] block">Private</span>
                  <span className="text-[11px] text-[#747683]">Visible only to you. Sharing links are inactive.</span>
                </div>
              </label>

              <label
                onClick={() => setVisibility("COLLEGE_VISIBLE")}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  visibility === "COLLEGE_VISIBLE"
                    ? "bg-[#FBFAF7] border-[#5052C9] shadow-xs"
                    : "bg-[#FBFAF7] border-[#DDDCD5] opacity-70 hover:opacity-100"
                }`}
              >
                <Building className={`w-4 h-4 mt-0.5 ${visibility === "COLLEGE_VISIBLE" ? "text-[#5052C9]" : "text-[#747683]"}`} />
                <div>
                  <span className="text-xs font-bold text-[#24283A] block">College Visible</span>
                  <span className="text-[11px] text-[#747683]">Visible to Placement Officers &amp; Staff at your college.</span>
                </div>
              </label>

              <label
                onClick={() => setVisibility("SHAREABLE")}
                className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  visibility === "SHAREABLE"
                    ? "bg-[#FBFAF7] border-[#5052C9] shadow-xs"
                    : "bg-[#FBFAF7] border-[#DDDCD5] opacity-70 hover:opacity-100"
                }`}
              >
                <Globe className={`w-4 h-4 mt-0.5 ${visibility === "SHAREABLE" ? "text-[#5052C9]" : "text-[#747683]"}`} />
                <div>
                  <span className="text-xs font-bold text-[#24283A] block">Shareable Link</span>
                  <span className="text-[11px] text-[#747683]">Accessible to external recruiters with a valid share link.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Section Visibility Toggles */}
          <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm space-y-3.5">
            <h2 className="text-xs font-bold font-outfit text-[#24283A] uppercase tracking-wider flex items-center justify-between">
              <span>Section Privacy Toggles</span>
              <span className="text-[10px] text-[#747683] lowercase font-normal">Student controlled</span>
            </h2>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Display Academic CGPA</span>
                <Switch
                  checked={sections.show_cgpa}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_cgpa: c }))}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Display Phone Number</span>
                <Switch
                  checked={sections.show_phone}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_phone: c }))}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Display Email Address</span>
                <Switch
                  checked={sections.show_email}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_email: c }))}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Technical &amp; Soft Skills</span>
                <Switch
                  checked={sections.show_skills}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_skills: c }))}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Portfolio Projects</span>
                <Switch
                  checked={sections.show_projects}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_projects: c }))}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Internships &amp; Experience</span>
                <Switch
                  checked={sections.show_experience}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_experience: c }))}
                />
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-[#FBFAF7] border border-[#DDDCD5]/60">
                <span className="font-medium text-[#24283A]">Certifications</span>
                <Switch
                  checked={sections.show_certifications}
                  onCheckedChange={(c) => setSections((prev) => ({ ...prev, show_certifications: c }))}
                />
              </div>
            </div>

            <Button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold mt-2"
            >
              {isSaving ? "Publishing Changes..." : "Save & Publish Snapshot"}
            </Button>
          </div>

          {/* Active Share Links Table */}
          <div className="bg-[#F8F7F3] border border-[#DDDCD5] p-5 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold font-outfit text-[#24283A] uppercase tracking-wider">
                Active Share Links ({shareLinks.length})
              </h2>
            </div>

            {shareLinks.length === 0 ? (
              <p className="text-xs text-[#747683] italic">No active share links. Click &quot;Share Passport&quot; above to create one.</p>
            ) : (
              <div className="space-y-2">
                {shareLinks.map((link) => (
                  <div
                    key={link.id}
                    className="p-3 rounded-xl bg-[#FBFAF7] border border-[#DDDCD5] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#24283A] block">{link.label}</span>
                      <span className="text-[10px] text-[#747683]">
                        {link.accessCount} view(s) {link.expiresAt ? `• Exp: ${new Date(link.expiresAt).toLocaleDateString()}` : "• Never expires"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeShare(link.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1.5 h-auto"
                        title="Revoke Link"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Passport Preview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-[#747683] uppercase tracking-wider flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-[#5052C9]" />
              Live Passport Recruiter Preview
            </span>
            <Badge variant="outline" className="border-[#DDDCD5] text-[10px]">
              Version {passport?.version || 1}
            </Badge>
          </div>

          {/* Digital Passport Card */}
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-3xl p-6 md:p-8 shadow-sm space-y-6">
            {/* Top Identity Section */}
            <div className="border-b border-[#DDDCD5] pb-6 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-2xl font-bold font-outfit text-[#24283A]">
                    {passport?.studentName}
                  </h3>
                  <p className="text-sm font-semibold text-[#5052C9] font-outfit">
                    {headline || "Engineering Student & Aspiring Software Engineer"}
                  </p>
                </div>

                <Badge className="bg-[#2E8F86] text-white text-[10px] self-start sm:self-center">
                  Verified Candidate
                </Badge>
              </div>

              {/* Contact / Metadata Bar */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#747683] pt-1">
                <span>{passport?.degree}</span>
                <span>•</span>
                <span>{passport?.institutionName}</span>
                <span>•</span>
                <span>Class of {passport?.graduationYear}</span>
                {sections.show_cgpa && passport?.cgpa && (
                  <>
                    <span>•</span>
                    <strong className="text-[#24283A]">CGPA: {passport.cgpa}</strong>
                  </>
                )}
                {sections.show_email && passport?.email && (
                  <>
                    <span>•</span>
                    <span>{passport.email}</span>
                  </>
                )}
                {sections.show_phone && passport?.phone && (
                  <>
                    <span>•</span>
                    <span>{passport.phone}</span>
                  </>
                )}
              </div>
            </div>

            {/* Summary */}
            {summary && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                  Professional Summary
                </h4>
                <p className="text-xs text-[#24283A] leading-relaxed">
                  {summary}
                </p>
              </div>
            )}

            {/* Technical Skills */}
            {sections.show_skills && passport?.technicalSkills && passport.technicalSkills.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                  Technical Proficiencies
                </h4>
                <div className="flex flex-wrap gap-2">
                  {passport.technicalSkills.map((s, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs bg-[#EDECE7] text-[#24283A] border border-[#DDDCD5]"
                    >
                      <span>{s.name}</span>
                      {s.isVerified && <ShieldCheck className="w-3 h-3 text-[#2E8F86]" />}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Projects */}
            {sections.show_projects && passport?.projects && passport.projects.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                  Portfolio Projects ({passport.projects.length})
                </h4>
                <div className="space-y-3">
                  {passport.projects.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-[#F8F7F3] border border-[#DDDCD5] space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{p.title}</span>
                        {p.githubUrl && (
                          <a
                            href={p.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#5052C9] hover:underline flex items-center gap-1"
                          >
                            Repository <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-[#292D40]/80 leading-relaxed">
                        {p.description}
                      </p>
                      {p.technologies && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {p.technologies.map((t: string, tIdx: number) => (
                            <span
                              key={tIdx}
                              className="text-[10px] px-2 py-0.5 rounded bg-[#EDECE7] text-[#292D40]"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Experience */}
            {sections.show_experience && passport?.experience && passport.experience.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                  Internships &amp; Experience
                </h4>
                <div className="space-y-2.5">
                  {passport.experience.map((e, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-[#F8F7F3] border border-[#DDDCD5] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#24283A]">{e.designation} — {e.organization}</span>
                        <span className="text-[11px] text-[#747683]">
                          {e.startDate} {e.isCurrent ? "- Present" : `- ${e.endDate || ""}`}
                        </span>
                      </div>
                      {e.responsibilities && e.responsibilities.length > 0 && (
                        <ul className="list-disc pl-4 text-xs text-[#292D40]/80 space-y-0.5">
                          {e.responsibilities.map((r: string, rIdx: number) => (
                            <li key={rIdx}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {sections.show_certifications && passport?.certifications && passport.certifications.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold font-outfit text-[#5052C9] uppercase tracking-wider">
                  Certifications &amp; Credentials
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {passport.certifications.map((c, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-[#F8F7F3] border border-[#DDDCD5] text-xs">
                      <span className="font-bold text-[#24283A] block">{c.name}</span>
                      <span className="text-[#747683] text-[11px] block">{c.issuingOrganization}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SHARE MODAL DIALOG */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-[#FBFAF7] border border-[#DDDCD5] rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4 font-inter">
            <div className="flex items-center justify-between pb-2 border-b border-[#DDDCD5]">
              <h3 className="text-sm font-bold font-outfit text-[#24283A]">
                Create Secure Share Link
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-[#747683] hover:text-[#24283A] text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {newlyCreatedShare ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Share Link Created Successfully
                  </p>
                  <p className="text-[11px] text-emerald-700">
                    Anyone with this link can view your approved Career Passport. Only hashed tokens are stored.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292D40] mb-1">
                    Your Shareable URL
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/passport/${newlyCreatedShare.rawToken}`}
                      className="w-full text-xs bg-[#EDECE7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] select-all font-mono"
                    />
                    <Button
                      size="sm"
                      onClick={() => copyShareUrl(newlyCreatedShare.rawToken)}
                      className="bg-[#5052C9] hover:bg-[#4345B0] text-white shrink-0"
                    >
                      {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    size="sm"
                    onClick={() => setShowShareModal(false)}
                    className="text-xs bg-[#24283A] text-white"
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateShareLink} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-[#292D40] mb-1">
                    Link Label (e.g. Target Company or Recruiter)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Google Campus Hiring Team"
                    value={shareLabel}
                    onChange={(e) => setShareLabel(e.target.value)}
                    className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#292D40] mb-1">
                    Link Expiration
                  </label>
                  <select
                    value={shareExpiryDays === null ? "never" : String(shareExpiryDays)}
                    onChange={(e) => setShareExpiryDays(e.target.value === "never" ? null : Number(e.target.value))}
                    className="w-full text-xs bg-[#FBFAF7] border border-[#DDDCD5] rounded-xl px-3 py-2 text-[#24283A]"
                  >
                    <option value="7">Expires in 7 days</option>
                    <option value="30">Expires in 30 days (Recommended)</option>
                    <option value="90">Expires in 90 days</option>
                    <option value="never">Never expires (Manual revocation only)</option>
                  </select>
                </div>

                <p className="text-[11px] text-[#747683] leading-relaxed">
                  Creating a share link makes your approved sections viewable to external recipients.
                  Internal IDs and unapproved details remain strictly hidden. You can revoke this link at any time.
                </p>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#DDDCD5]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowShareModal(false)}
                    className="text-xs border-[#DDDCD5]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs font-semibold"
                  >
                    Generate Link
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
