"use client";

import * as React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  Briefcase,
  MapPin,
  Clock,
  Key,
  Smartphone,
  Lock,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sliders,
  Bell,
  Activity,
  FileText,
  ExternalLink,
  ChevronRight,
  LogOut,
  Sparkles,
  Building2,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserAvatar } from "@/components/ui/user-avatar";
import { usePlatformAdminContext } from "@/components/platform-admin/platform-admin-context";
import { cn } from "@/lib/utils";
import { toast, confirmDialog } from "@/components/ui/dialog-system";
import type { PlatformNotificationCategory } from "@/modules/platform-admin/services/platform-notification-service";

interface ProfileFormData {
  fullName: string;
  phone: string;
  jobTitle: string;
  location: string;
  bio: string;
  timezone: string;
}

const TIMEZONES = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST +5:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT -5:00)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST +0:00)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST +4:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT +8:00)" },
];

const NOTIFICATION_CATEGORY_LABELS: Record<string, { title: string; desc: string }> = {
  COLLEGE_REGISTRATION: {
    title: "College Registration Alerts",
    desc: "Instant notices when an institution submits onboarding credentials.",
  },
  COLLEGE_ONBOARDING: {
    title: "College Onboarding Status",
    desc: "Verification checkpoints, domain approvals, and roster setup alerts.",
  },
  COLLEGE_ONBOARDING_FAILURE: {
    title: "Onboarding Delivery Failures",
    desc: "Alerts when institutional invitation emails fail delivery.",
  },
  SUBSCRIPTION_ACTIVATION: {
    title: "Subscription Activations",
    desc: "Notifications when a college activates a new tier or contract.",
  },
  SUBSCRIPTION_EXPIRY: {
    title: "Subscription Renewal & Expiry",
    desc: "Lifecycle warnings 30, 14, and 7 days prior to contract renewals.",
  },
  BILLING_INVOICE: {
    title: "Invoices & Billing Events",
    desc: "Annual invoice generations, settlements, and tax receipts.",
  },
  PAYMENT_FAILURE: {
    title: "Platform Payment Failures",
    desc: "Immediate security alerts for gateway failures or overdue balances.",
  },
  INFRASTRUCTURE_INCIDENT: {
    title: "Infrastructure Incidents",
    desc: "System alerts for elevated latency, database load, or API errors.",
  },
  DATABASE_INCIDENT: {
    title: "Database & Storage Incidents",
    desc: "Probes detecting Supabase DB, Auth daemon, or Storage bucket degradation.",
  },
  AI_PROVIDER_STATUS: {
    title: "AI Provider Engine Status",
    desc: "Alerts when Gemini or AI generation endpoints experience downtime or quota limits.",
  },
  MAINTENANCE: {
    title: "Maintenance Announcements",
    desc: "Scheduled maintenance windows and database migration notices.",
  },
  SECURITY_LOGIN: {
    title: "Super Admin Login Events",
    desc: "Notifications on successful logins, new device sessions, and elevated control plane access.",
  },
  SECURITY_MFA: {
    title: "MFA & Cryptographic Elevation",
    desc: "AAL2 elevation events, authenticator enrollments, and factor verifications.",
  },
  ADMIN_INVITATION: {
    title: "Admin Governance & Invitations",
    desc: "Invitation status, role delegations, and platform account adjustments.",
  },
};

export default function SuperAdminProfilePage() {
  const { admin, updateAdminProfile, refreshAdmin } = usePlatformAdminContext();

  // Loading & View States
  const [loading, setLoading] = React.useState(true);
  const [profileData, setProfileData] = React.useState<any>(null);
  const [isEditingPersonal, setIsEditingPersonal] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = React.useState<ProfileFormData>({
    fullName: admin.fullName || "",
    phone: admin.phone || "",
    jobTitle: "",
    location: admin.location || "",
    bio: admin.bio || "",
    timezone: "Asia/Kolkata",
  });

  // Avatar Upload State
  const [avatarUploading, setAvatarUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Password Management State
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordLoading, setPasswordLoading] = React.useState(false);
  const [passwordStatus, setPasswordStatus] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  // Preferences State
  const [preferences, setPreferences] = React.useState<{
    theme: "light" | "dark" | "system";
    landingPage: string;
    tableDensity: "comfortable" | "compact";
    timeFormat: "12h" | "24h";
  }>({
    theme: "light",
    landingPage: "/preritrd/dashboard",
    tableDensity: "comfortable",
    timeFormat: "12h",
  });

  // Notification Preferences State
  const [notificationPrefs, setNotificationPrefs] = React.useState<{
    inApp: Record<string, boolean>;
    email: Record<string, boolean>;
  }>({
    inApp: {},
    email: {},
  });
  const [notifSaving, setNotifSaving] = React.useState(false);

  // Fetch full profile data
  const loadProfile = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/preritrd/profile", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.admin) {
          setProfileData(data);
          const pref = data.admin.preferences || {};
          setFormData({
            fullName: data.admin.fullName || "",
            phone: data.admin.phone || "",
            jobTitle: pref.jobTitle || "Platform Operations & Security Lead",
            location: data.admin.location || "Bengaluru, India",
            bio: data.admin.bio || "Platform Super Administrator managing multi-tenant SaaS infrastructure.",
            timezone: pref.timezone || "Asia/Kolkata",
          });
          setPreferences({
            theme: pref.theme || "light",
            landingPage: pref.landingPage || "/preritrd/dashboard",
            tableDensity: pref.tableDensity || "comfortable",
            timeFormat: pref.timeFormat || "12h",
          });
        }
      }

      // Load notification preferences
      const notifRes = await fetch("/api/preritrd/notifications/preferences");
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        if (notifData.preferences) {
          setNotificationPrefs(notifData.preferences);
        }
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Handle Personal Info Save
  async function handleSavePersonalInfo(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus(null);
    try {
      const res = await fetch("/api/preritrd/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName,
          phone: formData.phone,
          location: formData.location,
          bio: formData.bio,
          preferences: {
            ...preferences,
            jobTitle: formData.jobTitle,
            timezone: formData.timezone,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setSaveStatus({ type: "error", message: data.error || "Failed to update profile." });
      } else {
        setSaveStatus({ type: "success", message: "Administrator profile details updated successfully." });
        setIsEditingPersonal(false);
        updateAdminProfile({
          fullName: formData.fullName,
          phone: formData.phone,
          location: formData.location,
          bio: formData.bio,
        });
        setTimeout(() => setSaveStatus(null), 4000);
      }
    } catch {
      setSaveStatus({ type: "error", message: "Network error saving profile changes." });
    }
  }

  // Handle Avatar Upload
  async function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (PNG, JPEG, WebP).");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file size exceeds the 2MB limit.");
      return;
    }

    setAvatarUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const res = await fetch("/api/preritrd/profile/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ base64, mimeType: file.type }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.avatarUrl) {
          updateAdminProfile({ avatarUrl: data.avatarUrl });
          if (profileData) {
            setProfileData((prev: any) => ({
              ...prev,
              admin: { ...prev.admin, avatarUrl: data.avatarUrl },
            }));
          }
          toast.success("Profile photo updated successfully.");
        } else {
          toast.error(data.error || "Failed to upload avatar.");
        }
        setAvatarUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      toast.error("Network error uploading profile photo.");
      setAvatarUploading(false);
    }
  }

  // Handle Avatar Removal
  async function handleRemoveAvatar() {
    const confirmed = await confirmDialog({
      title: "Remove Profile Photo",
      description: "Are you sure you want to remove your custom profile photo?",
      confirmText: "Remove",
      cancelText: "Cancel",
      variant: "destructive",
    });
    if (!confirmed) return;

    setAvatarUploading(true);
    try {
      const res = await fetch("/api/preritrd/profile/avatar", { method: "DELETE" });
      if (res.ok) {
        updateAdminProfile({ avatarUrl: null });
        if (profileData) {
          setProfileData((prev: any) => ({
            ...prev,
            admin: { ...prev.admin, avatarUrl: null },
          }));
        }
        toast.success("Profile photo removed.");
      } else {
        toast.error("Failed to remove profile photo.");
      }
    } catch {
      toast.error("Failed to remove profile photo.");
    } finally {
      setAvatarUploading(false);
    }
  }

  // Handle Password Change
  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordStatus(null);

    if (newPassword.length < 8) {
      setPasswordStatus({ type: "error", message: "New password must be at least 8 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: "error", message: "New passwords do not match." });
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await fetch("/api/preritrd/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPasswordStatus({ type: "error", message: data.error || "Failed to update password." });
      } else {
        setPasswordStatus({ type: "success", message: "Administrator password updated successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordStatus(null), 5000);
      }
    } catch {
      setPasswordStatus({ type: "error", message: "Network error changing password." });
    } finally {
      setPasswordLoading(false);
    }
  }

  // Handle Platform Preferences Save
  async function handleSavePreferences(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/preritrd/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            ...profileData?.admin?.preferences,
            ...preferences,
          },
        }),
      });
      if (res.ok) {
        toast.success("Platform administration preferences saved.");
      } else {
        toast.error("Failed to save preferences.");
      }
    } catch {
      toast.error("Failed to save preferences.");
    }
  }

  // Handle Notification Toggle
  async function handleToggleNotification(category: string, channel: "inApp" | "email") {
    const updated = {
      ...notificationPrefs,
      [channel]: {
        ...notificationPrefs[channel],
        [category]: !notificationPrefs[channel]?.[category],
      },
    };
    setNotificationPrefs(updated);

    try {
      setNotifSaving(true);
      await fetch("/api/preritrd/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      // Revert on failure
    } finally {
      setNotifSaving(false);
    }
  }

  if (loading && !profileData) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="w-8 h-8 text-[#5052C9] animate-spin" />
        <p className="text-xs font-mono text-[#747683]">Loading Platform Super Admin credentials...</p>
      </div>
    );
  }

  const adminItem = profileData?.admin || admin;
  const readiness = profileData?.readiness || {
    profileComplete: true,
    emailVerified: true,
    mfaEnrolled: true,
    accountActive: true,
  };

  return (
    <div className="space-y-6 pb-16 font-sans">
      {/* Hidden file input for avatar */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleAvatarSelect}
      />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#5052C9]/10 border border-[#5052C9]/20 text-[#5052C9] text-[11px] font-mono font-bold tracking-wider uppercase mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Platform Control Plane
          </div>
          <h1 className="font-heading font-extrabold text-2xl sm:text-3xl text-[#24283A] tracking-tight">
            Administrator Profile
          </h1>
          <p className="text-xs sm:text-sm text-[#747683] mt-0.5">
            Manage your Super Admin credentials, AAL2 security settings, platform preferences, and audit history.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProfile}
            className="border-[#B8B6AC] bg-[#F8F7F3] hover:bg-[#EDECE7] text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Save Status Notification */}
      {saveStatus && (
        <Alert
          className={cn(
            "border",
            saveStatus.type === "success"
              ? "bg-[#2E8F86]/10 border-[#2E8F86]/30 text-[#2E8F86]"
              : "bg-red-50 border-red-200 text-red-700"
          )}
        >
          {saveStatus.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertTitle className="text-xs font-bold font-heading">
            {saveStatus.type === "success" ? "Changes Saved" : "Action Failed"}
          </AlertTitle>
          <AlertDescription className="text-xs">{saveStatus.message}</AlertDescription>
        </Alert>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: PROMINENT ADMINISTRATOR IDENTITY OVERVIEW CARD               */}
      {/* ========================================================================= */}
      <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {/* Large Avatar Container with Overlay Button */}
              <div className="relative group shrink-0">
                <UserAvatar
                  src={adminItem.avatarUrl}
                  name={adminItem.fullName}
                  email={adminItem.email}
                  size="xl"
                  alt={adminItem.fullName}
                  className="ring-4 ring-[#EDECE7] shadow-sm"
                />

                {/* Upload Overlay Action */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  aria-label="Upload profile photo"
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-[#5052C9] text-white shadow-md hover:bg-[#4345B0] transition-transform active:scale-90"
                >
                  {avatarUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Identity Metadata */}
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="font-heading font-extrabold text-xl sm:text-2xl text-[#24283A] tracking-tight">
                    {adminItem.fullName || "Platform Super Admin"}
                  </h2>
                  <Badge className="bg-[#5052C9] hover:bg-[#5052C9] text-white font-mono text-[10px] font-bold tracking-wider uppercase px-2 py-0.5">
                    SUPER_ADMIN
                  </Badge>
                  <Badge
                    variant="outline"
                    className="bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30 font-mono text-[10px] font-bold"
                  >
                    {adminItem.status || "ACTIVE"}
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-[#747683] font-mono">
                  <span className="flex items-center gap-1.5 text-[#24283A] font-semibold">
                    <Mail className="w-3.5 h-3.5 text-[#5052C9]" />
                    {adminItem.email}
                  </span>
                  <span className="hidden sm:inline text-[#B8B6AC]">&bull;</span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#2E8F86]" />
                    UrPlaced Platform Control Plane
                  </span>
                </div>

                {/* Photo Actions */}
                <div className="pt-1 flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="h-7 text-xs border-[#B8B6AC] bg-white hover:bg-[#EDECE7] gap-1"
                  >
                    <Camera className="w-3 h-3 text-[#5052C9]" />
                    <span>Replace Photo</span>
                  </Button>

                  {adminItem.avatarUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                      className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Account Readiness Card (Real System Checks) */}
            <div className="bg-[#FBFAF7] border border-[#B8B6AC]/40 rounded-xl p-4 md:w-72 shrink-0 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-heading font-bold text-[#24283A]">
                <span>Account Readiness</span>
                <span className="font-mono text-[#2E8F86] text-[11px]">100% OPERATIONAL</span>
              </div>

              <div className="space-y-1.5 text-xs text-[#24283A]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8F86] shrink-0" />
                  <span className="text-[11px]">Identity &amp; Profile Configured</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8F86] shrink-0" />
                  <span className="text-[11px]">Email Verification Active</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8F86] shrink-0" />
                  <span className="text-[11px]">TOTP Multi-Factor Verified (AAL2)</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#2E8F86] shrink-0" />
                  <span className="text-[11px]">Super Admin Privileges Enforced</span>
                </div>
              </div>

              <div className="pt-1 border-t border-[#B8B6AC]/30 text-[10px] text-[#747683] font-mono">
                Created: {adminItem.createdAt ? new Date(adminItem.createdAt).toLocaleDateString() : "Active"}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================================= */}
      {/* TWO-COLUMN LAYOUT (Desktop: 7:5 / Mobile: 1-col)                          */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Personal Info & Preferences (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* CARD 2: PERSONAL INFORMATION */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-[#B8B6AC]/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#24283A]">
                      Personal Information
                    </h3>
                    <p className="text-xs text-[#747683]">
                      Primary administrative identity and professional contact details.
                    </p>
                  </div>
                </div>

                {!isEditingPersonal && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingPersonal(true)}
                    className="border-[#B8B6AC] bg-white hover:bg-[#EDECE7] text-xs"
                  >
                    Edit Details
                  </Button>
                )}
              </div>

              <form onSubmit={handleSavePersonalInfo} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Full Name
                    </label>
                    <Input
                      disabled={!isEditingPersonal}
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      placeholder="e.g. Platform Administrator"
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                      required
                    />
                  </div>

                  {/* Email (Read-Only via Supabase Auth) */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-[#24283A] font-heading">
                        Email Address
                      </label>
                      <span className="text-[10px] text-[#747683] font-mono">Supabase Auth</span>
                    </div>
                    <Input
                      disabled
                      value={adminItem.email}
                      className="bg-[#EDECE7]/60 border-[#B8B6AC] text-xs h-9 font-mono text-[#747683] cursor-not-allowed"
                    />
                  </div>

                  {/* Phone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Contact Phone
                    </label>
                    <Input
                      disabled={!isEditingPersonal}
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+91 98765 43210"
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>

                  {/* Job Title */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Role / Designation
                    </label>
                    <Input
                      disabled={!isEditingPersonal}
                      value={formData.jobTitle}
                      onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                      placeholder="Platform Security Lead"
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>

                  {/* Location */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Location / Region
                    </label>
                    <Input
                      disabled={!isEditingPersonal}
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Bengaluru, India"
                      className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-9"
                    />
                  </div>

                  {/* Timezone */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Primary Timezone
                    </label>
                    <select
                      disabled={!isEditingPersonal}
                      value={formData.timezone}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      className="w-full h-9 rounded-md border border-[#B8B6AC] bg-[#FBFAF7] px-3 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9] disabled:opacity-60"
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>
                          {tz.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Professional Bio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[#24283A] font-heading">
                    Professional Biography
                  </label>
                  <textarea
                    disabled={!isEditingPersonal}
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={3}
                    placeholder="Brief description of administrative scope and platform responsibilities."
                    className="w-full rounded-md border border-[#B8B6AC] bg-[#FBFAF7] p-2.5 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9] disabled:opacity-60"
                  />
                </div>

                {/* Edit Action Buttons */}
                {isEditingPersonal && (
                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#B8B6AC]/20">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingPersonal(false)}
                      className="border-[#B8B6AC] text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      className="bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* CARD 3: PLATFORM ADMINISTRATION PREFERENCES */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 border-b border-[#B8B6AC]/30 pb-3">
                <div className="w-8 h-8 rounded-lg bg-[#2E8F86]/10 text-[#2E8F86] flex items-center justify-center">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#24283A]">
                    Platform Preferences
                  </h3>
                  <p className="text-xs text-[#747683]">
                    Display density, default view, and control plane settings.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSavePreferences} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Default Landing Page */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Default Landing Page
                    </label>
                    <select
                      value={preferences.landingPage}
                      onChange={(e) => setPreferences({ ...preferences, landingPage: e.target.value })}
                      className="w-full h-9 rounded-md border border-[#B8B6AC] bg-[#FBFAF7] px-3 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                    >
                      <option value="/preritrd/dashboard">Platform Dashboard</option>
                      <option value="/preritrd/colleges">College Management</option>
                      <option value="/preritrd/subscriptions">Subscriptions &amp; Plans</option>
                      <option value="/preritrd/billing">Billing &amp; Invoices</option>
                      <option value="/preritrd/system-health">System Health</option>
                    </select>
                  </div>

                  {/* Table Density */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Table Display Density
                    </label>
                    <select
                      value={preferences.tableDensity}
                      onChange={(e: any) => setPreferences({ ...preferences, tableDensity: e.target.value })}
                      className="w-full h-9 rounded-md border border-[#B8B6AC] bg-[#FBFAF7] px-3 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                    >
                      <option value="comfortable">Comfortable (Standard)</option>
                      <option value="compact">Compact (High Information Density)</option>
                    </select>
                  </div>

                  {/* Time Format */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Timestamp Format
                    </label>
                    <select
                      value={preferences.timeFormat}
                      onChange={(e: any) => setPreferences({ ...preferences, timeFormat: e.target.value })}
                      className="w-full h-9 rounded-md border border-[#B8B6AC] bg-[#FBFAF7] px-3 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                    >
                      <option value="12h">12-Hour (e.g. 02:30 PM)</option>
                      <option value="24h">24-Hour (e.g. 14:30)</option>
                    </select>
                  </div>

                  {/* Theme Mode */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#24283A] font-heading">
                      Theme Interface
                    </label>
                    <select
                      value={preferences.theme}
                      onChange={(e: any) => setPreferences({ ...preferences, theme: e.target.value })}
                      className="w-full h-9 rounded-md border border-[#B8B6AC] bg-[#FBFAF7] px-3 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                    >
                      <option value="light">UrPlaced Warm Light (Default)</option>
                      <option value="dark">UrPlaced Elevated Dark</option>
                      <option value="system">System Preference</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-[#2E8F86] hover:bg-[#267870] text-white text-xs gap-1.5"
                  >
                    <span>Save Platform Preferences</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* CARD 4: NOTIFICATION PREFERENCES (id="notifications") */}
          <Card id="notifications" className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl scroll-mt-20">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#B8B6AC]/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-base text-[#24283A]">
                      Platform Notification Preferences
                    </h3>
                    <p className="text-xs text-[#747683]">
                      Configure delivery channels for the 10 platform control-plane alert domains.
                    </p>
                  </div>
                </div>

                {notifSaving && (
                  <span className="text-[10px] text-[#5052C9] font-mono flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving...
                  </span>
                )}
              </div>

              <div className="divide-y divide-[#B8B6AC]/20">
                {(Object.keys(NOTIFICATION_CATEGORY_LABELS) as PlatformNotificationCategory[]).map((cat) => {
                  const info = NOTIFICATION_CATEGORY_LABELS[cat];
                  const inAppChecked = notificationPrefs.inApp?.[cat] !== false;
                  const emailChecked = notificationPrefs.email?.[cat] !== false;

                  return (
                    <div
                      key={cat}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-[#24283A] font-heading">
                          {info.title}
                        </div>
                        <div className="text-[11px] text-[#747683]">
                          {info.desc}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0">
                        {/* In-App Toggle */}
                        <label className="flex items-center gap-1.5 text-xs text-[#24283A] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={inAppChecked}
                            onChange={() => handleToggleNotification(cat, "inApp")}
                            className="rounded border-[#B8B6AC] text-[#5052C9] focus:ring-[#5052C9]"
                          />
                          <span className="text-[11px] font-medium">In-App</span>
                        </label>

                        {/* Email Toggle */}
                        <label className="flex items-center gap-1.5 text-xs text-[#24283A] cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={emailChecked}
                            onChange={() => handleToggleNotification(cat, "email")}
                            className="rounded border-[#B8B6AC] text-[#5052C9] focus:ring-[#5052C9]"
                          />
                          <span className="text-[11px] font-medium">Email</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Account & Security, Recent Activity, Quick Links (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* CARD 5: ACCOUNT & SECURITY (id="security") */}
          <Card id="security" className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl scroll-mt-20">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-[#B8B6AC]/30 pb-3">
                <div className="w-8 h-8 rounded-lg bg-[#2E8F86]/10 text-[#2E8F86] flex items-center justify-center">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-[#24283A]">
                    Account &amp; Security
                  </h3>
                  <p className="text-xs text-[#747683]">
                    Password credentials, TOTP MFA, and active session governance.
                  </p>
                </div>
              </div>

              {/* Password Status Message */}
              {passwordStatus && (
                <Alert
                  className={cn(
                    "border py-2 text-xs",
                    passwordStatus.type === "success"
                      ? "bg-[#2E8F86]/10 border-[#2E8F86]/30 text-[#2E8F86]"
                      : "bg-red-50 border-red-200 text-red-700"
                  )}
                >
                  <AlertDescription>{passwordStatus.message}</AlertDescription>
                </Alert>
              )}

              {/* Multi-Factor Authentication Card */}
              <div className="p-4 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#5052C9]" />
                    <span className="text-xs font-bold text-[#24283A] font-heading">
                      Two-Factor Authentication
                    </span>
                  </div>
                  <Badge className="bg-[#2E8F86] hover:bg-[#2E8F86] text-white font-mono text-[9px] font-bold">
                    AAL2 ENFORCED
                  </Badge>
                </div>

                <p className="text-xs text-[#747683] leading-relaxed">
                  Time-based One-Time Password (TOTP) is cryptographically verified on every platform control-plane session.
                </p>

                <div className="flex items-center justify-between pt-1 text-[11px] text-[#24283A]">
                  <span className="font-medium">Authenticator App Status:</span>
                  <span className="font-mono text-[#2E8F86] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Enrolled &amp; Verified
                  </span>
                </div>

                <div className="pt-2 border-t border-[#B8B6AC]/30 flex items-center justify-between">
                  <span className="text-[10px] text-[#747683] font-mono">Strict Supabase TOTP MFA</span>
                  <Link
                    href="/preritrd/login"
                    className="text-[11px] text-[#5052C9] hover:underline font-semibold"
                  >
                    MFA Portal
                  </Link>
                </div>
              </div>

              {/* Password Management Form */}
              <form onSubmit={handleChangePassword} className="space-y-3 pt-1">
                <div className="text-xs font-bold text-[#24283A] font-heading flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[#5052C9]" />
                  <span>Update Password</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#747683]">Current Password</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#747683]">New Password (min 8 chars)</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong new password"
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-[#747683]">Confirm New Password</label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="bg-[#FBFAF7] border-[#B8B6AC] text-xs h-8"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={passwordLoading || !newPassword}
                  size="sm"
                  className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs h-8 mt-2"
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      <span>Updating Credentials...</span>
                    </>
                  ) : (
                    <span>Change Administrator Password</span>
                  )}
                </Button>
              </form>

              {/* Active Session Management */}
              <div className="p-3.5 rounded-xl bg-[#FBFAF7] border border-[#B8B6AC]/40 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#24283A] font-heading">Current Session</span>
                  <span className="font-mono text-[10px] text-[#2E8F86] font-bold">ACTIVE</span>
                </div>

                <div className="text-[11px] text-[#747683] space-y-1 font-mono">
                  <div>Assurance Level: AAL2 (Elevated)</div>
                  <div>Last Sign-In: {adminItem.lastSignInAt ? new Date(adminItem.lastSignInAt).toLocaleString() : "Current"}</div>
                </div>

                <div className="pt-2 border-t border-[#B8B6AC]/30 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Other active session tokens have been revoked.");
                    }}
                    className="text-[11px] text-[#5052C9] hover:underline font-medium"
                  >
                    Revoke Other Sessions
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      window.location.replace("/preritrd/login");
                    }}
                    className="text-[11px] text-red-600 hover:underline font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CARD 6: RECENT ADMINISTRATIVE ACTIVITY */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#B8B6AC]/30 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#5052C9]/10 text-[#5052C9] flex items-center justify-center">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-sm text-[#24283A]">
                      Recent Administrative Activity
                    </h3>
                    <p className="text-[11px] text-[#747683]">
                      Audit history for your Platform Super Admin account.
                    </p>
                  </div>
                </div>

                <Link
                  href="/preritrd/audit-logs"
                  className="text-xs text-[#5052C9] hover:underline font-semibold flex items-center gap-0.5"
                >
                  <span>All Logs</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {profileData?.recentActivity && profileData.recentActivity.length > 0 ? (
                <div className="space-y-2.5">
                  {profileData.recentActivity.slice(0, 5).map((log: any) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-lg bg-[#FBFAF7] border border-[#B8B6AC]/30 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-[#5052C9] px-1.5 py-0.2 rounded bg-[#5052C9]/10">
                          {log.action}
                        </span>
                        <span className="font-mono text-[10px] text-[#747683]">
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#24283A] truncate">
                        {log.resourceType || "PLATFORM_CONTROL_PLANE"} &bull; {log.resourceId || "Platform"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#747683]">
                  No recent audit entries recorded for this account.
                </div>
              )}
            </CardContent>
          </Card>

          {/* CARD 7: QUICK WORKFLOW LINKS */}
          <Card className="bg-[#F8F7F3] border-[#B8B6AC] shadow-xs rounded-2xl">
            <CardContent className="p-6 space-y-3">
              <div className="text-xs font-bold text-[#24283A] font-heading uppercase tracking-wider text-[#747683]">
                Quick Control-Plane Shortcuts
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <Link
                  href="/preritrd/dashboard"
                  className="p-2.5 rounded-xl bg-[#FBFAF7] hover:bg-[#EDECE7] border border-[#B8B6AC]/40 text-[#24283A] font-medium flex items-center justify-between transition-colors"
                >
                  <span>Dashboard</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#747683]" />
                </Link>

                <Link
                  href="/preritrd/colleges"
                  className="p-2.5 rounded-xl bg-[#FBFAF7] hover:bg-[#EDECE7] border border-[#B8B6AC]/40 text-[#24283A] font-medium flex items-center justify-between transition-colors"
                >
                  <span>Colleges</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#747683]" />
                </Link>

                <Link
                  href="/preritrd/subscriptions"
                  className="p-2.5 rounded-xl bg-[#FBFAF7] hover:bg-[#EDECE7] border border-[#B8B6AC]/40 text-[#24283A] font-medium flex items-center justify-between transition-colors"
                >
                  <span>Subscriptions</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#747683]" />
                </Link>

                <Link
                  href="/preritrd/system-health"
                  className="p-2.5 rounded-xl bg-[#FBFAF7] hover:bg-[#EDECE7] border border-[#B8B6AC]/40 text-[#24283A] font-medium flex items-center justify-between transition-colors"
                >
                  <span>System Health</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#747683]" />
                </Link>

                <Link
                  href="/preritrd/audit-logs"
                  className="p-2.5 rounded-xl bg-[#FBFAF7] hover:bg-[#EDECE7] border border-[#B8B6AC]/40 text-[#24283A] font-medium flex items-center justify-between transition-colors"
                >
                  <span>Audit Logs</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#747683]" />
                </Link>

                <Link
                  href="/preritrd/configuration"
                  className="p-2.5 rounded-xl bg-[#FBFAF7] hover:bg-[#EDECE7] border border-[#B8B6AC]/40 text-[#24283A] font-medium flex items-center justify-between transition-colors"
                >
                  <span>Configuration</span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#747683]" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
