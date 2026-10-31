"use client";

import * as React from "react";
import {
  Sliders,
  ShieldCheck,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  Lock,
  Power,
  Layers,
  Bell,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlatformSettingItem } from "@/modules/platform-admin/services/platform-config-service";

export default function PlatformConfigurationPage() {
  const [settings, setSettings] = React.useState<Record<string, PlatformSettingItem>>({});
  const [loading, setLoading] = React.useState(true);
  const [savingKey, setSavingKey] = React.useState<string | null>(null);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Editable local copies
  const [branding, setBranding] = React.useState({ platformName: "UrPlaced", supportEmail: "platform@urplaced.com", contactUrl: "https://urplaced.com/support" });
  const [maintenance, setMaintenance] = React.useState({ enabled: false, message: "" });
  const [features, setFeatures] = React.useState({
    enableAiGeneration: true,
    enableMistakeBank: true,
    enableDriveFit: true,
    enableSelfServiceSignup: true,
    enableNotifications: true,
  });
  const [security, setSecurity] = React.useState({
    enforceMfaForAdmins: true,
    sessionTimeoutMinutes: 120,
    maxFailedLogins: 5,
  });

  const fetchSettings = React.useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/preritrd/configuration", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Failed to load platform settings." });
      } else {
        const s = data.settings || {};
        setSettings(s);
        if (s.platform_branding?.value) setBranding(s.platform_branding.value);
        if (s.maintenance_mode?.value) setMaintenance(s.maintenance_mode.value);
        if (s.feature_switches?.value) setFeatures(s.feature_switches.value);
        if (s.security_settings?.value) setSecurity(s.security_settings.value);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error loading configuration." });
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSaveSetting(key: string, value: any, label: string) {
    setSavingKey(key);
    setFeedback(null);
    try {
      const res = await fetch("/api/preritrd/configuration", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || `Failed to update ${label}.` });
      } else {
        setFeedback({ type: "success", text: `${label} configuration saved successfully.` });
        await fetchSettings();
      }
    } catch {
      setFeedback({ type: "error", text: `Network error updating ${label}.` });
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-[#B8B6AC]/40">
        <div>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#5052C9]">
            System Control Plane
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-heading text-[#24283A] tracking-tight">
            Platform Configuration
          </h1>
          <p className="text-xs text-[#292D40]/75 mt-0.5">
            Manage global platform feature flags, maintenance broadcast status, and security policies.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSettings}
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

      {/* Card 1: Maintenance Mode & Announcements */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
              <Power className={`h-4 w-4 ${maintenance.enabled ? "text-red-600" : "text-[#747683]"}`} />
              <span>Maintenance Mode &amp; Global Broadcast</span>
            </CardTitle>
            <CardDescription className="text-xs text-[#292D40]/70">
              Temporarily restrict portal access during scheduled maintenance windows
            </CardDescription>
          </div>
          <Badge
            variant={maintenance.enabled ? "danger" : "outline"}
            className={
              maintenance.enabled
                ? "bg-red-100 text-red-800 border-red-300 font-mono text-[10px]"
                : "bg-emerald-50 text-emerald-800 border-emerald-300 font-mono text-[10px]"
            }
          >
            {maintenance.enabled ? "MAINTENANCE ACTIVE" : "SYSTEM OPERATIONAL"}
          </Badge>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40">
            <div>
              <div className="text-xs font-bold text-[#24283A]">Enable Maintenance Mode</div>
              <div className="text-[11px] text-[#747683]">
                When enabled, student and college sessions will see the maintenance announcement.
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={maintenance.enabled}
                onChange={(e) => setMaintenance({ ...maintenance, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[#24283A] block">
              Maintenance Announcement Message
            </label>
            <Input
              value={maintenance.message}
              onChange={(e) => setMaintenance({ ...maintenance, message: e.target.value })}
              placeholder="e.g. Scheduled database maintenance in progress. Services resume at 04:00 UTC."
              className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={() => handleSaveSetting("maintenance_mode", maintenance, "Maintenance Mode")}
              disabled={savingKey === "maintenance_mode"}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-8 gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {savingKey === "maintenance_mode" ? "Saving..." : "Save Maintenance Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 2: Platform Feature Switches */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
          <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#5052C9]" />
            <span>Global Platform Feature Flags</span>
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]/70">
            Control feature accessibility across institutional tenants
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-3">
          {/* Switch 1: AI Question Generation */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40">
            <div>
              <div className="text-xs font-bold text-[#24283A]">AI Question &amp; Curriculum Generation</div>
              <div className="text-[11px] text-[#747683]">Enables Google Gemini AI integration for question sets and study tutors.</div>
            </div>
            <input
              type="checkbox"
              checked={features.enableAiGeneration}
              onChange={(e) => setFeatures({ ...features, enableAiGeneration: e.target.checked })}
              className="rounded border-[#B8B6AC] text-[#5052C9] h-4 w-4"
            />
          </div>

          {/* Switch 2: Mistake Bank */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40">
            <div>
              <div className="text-xs font-bold text-[#24283A]">Mistake-to-Mastery Engine</div>
              <div className="text-[11px] text-[#747683]">Activates adaptive revision tracking and student defect recording.</div>
            </div>
            <input
              type="checkbox"
              checked={features.enableMistakeBank}
              onChange={(e) => setFeatures({ ...features, enableMistakeBank: e.target.checked })}
              className="rounded border-[#B8B6AC] text-[#5052C9] h-4 w-4"
            />
          </div>

          {/* Switch 3: DriveFit */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40">
            <div>
              <div className="text-xs font-bold text-[#24283A]">DriveFit Recruitment Intelligence</div>
              <div className="text-[11px] text-[#747683]">Allows campus recruiters to evaluate readiness against drive requirements.</div>
            </div>
            <input
              type="checkbox"
              checked={features.enableDriveFit}
              onChange={(e) => setFeatures({ ...features, enableDriveFit: e.target.checked })}
              className="rounded border-[#B8B6AC] text-[#5052C9] h-4 w-4"
            />
          </div>

          {/* Switch 4: Self-service student registration */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40">
            <div>
              <div className="text-xs font-bold text-[#24283A]">Self-Service Student SRN Claiming</div>
              <div className="text-[11px] text-[#747683]">Allows eligible students on official college rosters to claim accounts.</div>
            </div>
            <input
              type="checkbox"
              checked={features.enableSelfServiceSignup}
              onChange={(e) => setFeatures({ ...features, enableSelfServiceSignup: e.target.checked })}
              className="rounded border-[#B8B6AC] text-[#5052C9] h-4 w-4"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button
              size="sm"
              onClick={() => handleSaveSetting("feature_switches", features, "Feature Switches")}
              disabled={savingKey === "feature_switches"}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-8 gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {savingKey === "feature_switches" ? "Saving..." : "Save Feature Switches"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Security & Session Constraints */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
        <CardHeader className="pb-3 border-b border-[#B8B6AC]/30">
          <CardTitle className="text-base font-bold font-heading text-[#24283A] flex items-center gap-2">
            <Lock className="h-4 w-4 text-[#2E8F86]" />
            <span>Platform Security Constraints</span>
          </CardTitle>
          <CardDescription className="text-xs text-[#292D40]/70">
            Administrative authentication, session timeout, and MFA policy
          </CardDescription>
        </CardHeader>
        <CardContent className="p-5 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24283A] block">
                Session Timeout (Minutes)
              </label>
              <Input
                type="number"
                min={15}
                max={480}
                value={security.sessionTimeoutMinutes}
                onChange={(e) => setSecurity({ ...security, sessionTimeoutMinutes: Number(e.target.value) })}
                className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#24283A] block">
                Max Failed Login Attempts Before Lockout
              </label>
              <Input
                type="number"
                min={3}
                max={10}
                value={security.maxFailedLogins}
                onChange={(e) => setSecurity({ ...security, maxFailedLogins: Number(e.target.value) })}
                className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9 font-mono"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40">
            <div>
              <div className="text-xs font-bold text-[#24283A]">Enforce MFA for All Super Admins</div>
              <div className="text-[11px] text-[#747683]">
                Mandates AAL2 verification for all accounts entering the /preritrd/ control plane.
              </div>
            </div>
            <input
              type="checkbox"
              checked={security.enforceMfaForAdmins}
              onChange={(e) => setSecurity({ ...security, enforceMfaForAdmins: e.target.checked })}
              className="rounded border-[#B8B6AC] text-[#5052C9] h-4 w-4"
            />
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="sm"
              onClick={() => handleSaveSetting("security_settings", security, "Security Settings")}
              disabled={savingKey === "security_settings"}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-8 gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              {savingKey === "security_settings" ? "Saving..." : "Save Security Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
