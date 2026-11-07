"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  GraduationCap,
  Building2,
  Target,
  Edit3,
  Camera,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Key,
  Download,
  LogOut,
  ChevronRight,
  TrendingUp,
  Award,
  Compass,
  Sparkles,
  Users,
  Briefcase,
  BarChart3,
  BookOpen,
  Lock,
  Save,
  X,
  Plus,
  Check,
  Loader2,
} from "lucide-react";
import { BrandLoader } from "@/components/common/brand-loader";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { UserAvatar } from "@/components/ui/user-avatar";
import { ProfileSkeleton } from "@/components/ui/page-skeletons";

interface ProfileData {
  id: string;
  email: string;
  fullName: string;
  role: string;
  accountCategory: "STUDENT" | "COLLEGE";
  institutionName: string | null;
  tenantId: string | null;
  avatarUrl: string | null;
  phone: string | null;
  location: string | null;
  bio: string | null;
  preferences: Record<string, any> | null;
  isVerifiedMembership: boolean;
  membershipStatus: string;
}

interface StudentMetrics {
  testsAttempted: number;
  questionsAttempted: number;
  averageAccuracy: number;
  savedMistakes: number;
  masteredMistakes: number;
}

interface CollegeMetrics {
  activeStudents: number;
  activeDrives: number;
  partnerCompanies: number;
  staffMembers: number;
}

interface AcademicRecord {
  enrollmentNumber: string;
  degree: string;
  departmentName: string;
  graduationYear: number;
  cgpa: number;
}

export default function MyProfilePage() {
  const auth = useAuthContext();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<"UNAUTHORIZED" | "FORBIDDEN" | "ERROR" | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [studentMetrics, setStudentMetrics] = useState<StudentMetrics | null>(null);
  const [collegeMetrics, setCollegeMetrics] = useState<CollegeMetrics | null>(null);
  const [academicRecord, setAcademicRecord] = useState<AcademicRecord | null>(null);

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form fields
  const [formData, setFormData] = useState({
    fullName: "",
    phone: "",
    location: "",
    bio: "",
    weeklyGoalHours: 10,
    dailyStudyTime: "1-2 hours",
    practiceMode: "Adaptive (Recommended)",
    difficulty: "Adaptive",
    studyReminders: true,
    driveAlerts: true,
    testUpdates: true,
    aiMistakeTips: true,
  });

  // Target Hiring Roles & Custom Roles State
  const [targetRoles, setTargetRoles] = useState<string[]>([
    "Software Development Engineer (SDE)",
    "Frontend Engineer",
    "Full Stack Developer",
    "Data Analyst",
    "Cloud & DevOps Engineer",
  ]);
  const [customRoles, setCustomRoles] = useState<string[]>([]);
  const [showAddRoleInput, setShowAddRoleInput] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [roleError, setRoleError] = useState<string | null>(null);

  // Preference Async Saving feedback & states
  const [preferenceSavingKey, setPreferenceSavingKey] = useState<string | null>(null);
  const [preferenceSavedMsg, setPreferenceSavedMsg] = useState<string | null>(null);

  // Password change modal
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Data Privacy Modal
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Avatar upload
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    fetchProfileData();
  }, []);

  async function fetchProfileData() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setStudentMetrics(data.studentMetrics);
        setCollegeMetrics(data.collegeMetrics);
        setAcademicRecord(data.academicRecord);

        // Prepopulate form fields
        const pref = data.profile?.preferences || {};
        setFormData({
          fullName: data.profile?.fullName || "",
          phone: data.profile?.phone || "",
          location: data.profile?.location || "",
          bio: data.profile?.bio || "",
          weeklyGoalHours:
            typeof pref.weeklyGoalHours === "number" && pref.weeklyGoalHours >= 1 && pref.weeklyGoalHours <= 40
              ? pref.weeklyGoalHours
              : 10,
          dailyStudyTime: pref.dailyStudyTime || "1–2 hours",
          practiceMode: pref.practiceMode || "Adaptive (Recommended)",
          difficulty: pref.difficulty || "Adaptive",
          studyReminders: pref.studyReminders !== false,
          driveAlerts: pref.driveAlerts !== false,
          testUpdates: pref.testUpdates !== false,
          aiMistakeTips: pref.aiMistakeTips !== false,
        });

        if (Array.isArray(pref.targetRoles) && pref.targetRoles.length > 0) {
          setTargetRoles(pref.targetRoles);
        } else {
          setTargetRoles([
            "Software Development Engineer (SDE)",
            "Frontend Engineer",
            "Full Stack Developer",
            "Data Analyst",
            "Cloud & DevOps Engineer",
          ]);
        }

        if (Array.isArray(pref.customRoles)) {
          setCustomRoles(pref.customRoles);
        }
      } else if (res.status === 401) {
        setLoadError("UNAUTHORIZED");
      } else if (res.status === 403) {
        setLoadError("FORBIDDEN");
      } else {
        setLoadError("ERROR");
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      setLoadError("ERROR");
    } finally {
      setLoading(false);
    }
  }

  // Calculate profile completion percentage
  const calculateCompletion = () => {
    if (!profile) return 0;
    let score = 0;
    const maxScore = 5;
    if (profile.fullName?.trim()) score++;
    if (profile.email?.trim()) score++;
    if (profile.phone?.trim()) score++;
    if (profile.location?.trim()) score++;
    if (profile.bio?.trim()) score++;
    return Math.round((score / maxScore) * 100);
  };

  // Handle Profile Save
  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setFeedbackMsg(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim() || null,
          location: formData.location.trim() || null,
          bio: formData.bio.trim() || null,
          preferences: {
            weeklyGoalHours: Number(formData.weeklyGoalHours),
            dailyStudyTime: formData.dailyStudyTime,
            practiceMode: formData.practiceMode,
            difficulty: formData.difficulty,
            studyReminders: formData.studyReminders,
            driveAlerts: formData.driveAlerts,
            testUpdates: formData.testUpdates,
            aiMistakeTips: formData.aiMistakeTips,
            targetRoles,
            customRoles,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to update profile." });
      } else {
        setFeedbackMsg({ type: "success", text: "Profile details updated successfully." });
        setIsEditing(false);
        await fetchProfileData();
        await auth.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Failed to save profile.";
      setFeedbackMsg({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  }

  // Dedicated atomic preference persistence with optimistic UI and rollback
  async function persistPreferenceUpdate(
    updates: Record<string, unknown>,
    keyName: string
  ) {
    setPreferenceSavingKey(keyName);
    setPreferenceSavedMsg(null);

    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update preference.");
      }

      const data = await res.json();
      if (data.preferences) {
        setProfile((prev) => (prev ? { ...prev, preferences: data.preferences } : prev));
      }
      setPreferenceSavedMsg("Saved");
      setTimeout(() => setPreferenceSavedMsg(null), 2500);
      return data;
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err?.message || "Failed to save preference.",
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      throw err;
    } finally {
      setPreferenceSavingKey(null);
    }
  }

  // 1. Notification Toggle Handler
  async function handleToggleNotification(
    key: "studyReminders" | "driveAlerts" | "testUpdates" | "aiMistakeTips",
    checked: boolean
  ) {
    const prev = Boolean(formData[key]);
    // Optimistic update
    setFormData((curr) => ({ ...curr, [key]: checked }));

    try {
      await persistPreferenceUpdate({ [key]: checked }, key);
    } catch {
      // Rollback on failure
      setFormData((curr) => ({ ...curr, [key]: prev }));
    }
  }

  // 2. Weekly Practice Goal Handler
  async function handleGoalChange(hours: number) {
    const validHours = Math.max(1, Math.min(40, Math.round(hours)));
    const prev = formData.weeklyGoalHours;
    if (validHours === prev) return;

    // Optimistic update
    setFormData((curr) => ({ ...curr, weeklyGoalHours: validHours }));

    try {
      await persistPreferenceUpdate({ weeklyGoalHours: validHours }, "weeklyGoalHours");
    } catch {
      setFormData((curr) => ({ ...curr, weeklyGoalHours: prev }));
    }
  }

  // 3. Daily Study Cadence Handler
  async function handleCadenceChange(cadence: string) {
    const prev = formData.dailyStudyTime;
    if (cadence === prev) return;

    setFormData((curr) => ({ ...curr, dailyStudyTime: cadence }));

    try {
      await persistPreferenceUpdate({ dailyStudyTime: cadence }, "dailyStudyTime");
    } catch {
      setFormData((curr) => ({ ...curr, dailyStudyTime: prev }));
    }
  }

  // 4. Target Hiring Roles Handlers
  async function handleToggleRole(role: string) {
    const prev = [...targetRoles];
    const isSelected = prev.includes(role);
    const updated = isSelected ? prev.filter((r) => r !== role) : [...prev, role];

    // Optimistic update
    setTargetRoles(updated);

    try {
      await persistPreferenceUpdate({ targetRoles: updated }, "toggleRole");
    } catch {
      setTargetRoles(prev);
    }
  }

  async function handleAddCustomRole(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newRoleName.trim();
    if (!trimmed) return;

    if (trimmed.length < 2) {
      setRoleError("Role title must be at least 2 characters.");
      return;
    }
    if (trimmed.length > 60) {
      setRoleError("Role title cannot exceed 60 characters.");
      return;
    }

    const defaultPresetRoles = [
      "Software Development Engineer (SDE)",
      "Frontend Engineer",
      "Full Stack Developer",
      "Data Analyst",
      "Cloud & DevOps Engineer",
    ];
    const allRoles = Array.from(new Set([...defaultPresetRoles, ...customRoles]));
    if (allRoles.some((r) => r.toLowerCase() === trimmed.toLowerCase())) {
      setRoleError("This role already exists.");
      return;
    }

    setRoleError(null);
    const prevCustom = [...customRoles];
    const prevTarget = [...targetRoles];

    const updatedCustom = [...prevCustom, trimmed];
    const updatedTarget = prevTarget.includes(trimmed) ? prevTarget : [...prevTarget, trimmed];

    setCustomRoles(updatedCustom);
    setTargetRoles(updatedTarget);
    setNewRoleName("");
    setShowAddRoleInput(false);

    try {
      await persistPreferenceUpdate(
        { customRoles: updatedCustom, targetRoles: updatedTarget },
        "addRole"
      );
    } catch {
      setCustomRoles(prevCustom);
      setTargetRoles(prevTarget);
    }
  }

  async function handleRemoveCustomRole(role: string, e: React.MouseEvent) {
    e.stopPropagation();
    const prevCustom = [...customRoles];
    const prevTarget = [...targetRoles];

    const updatedCustom = prevCustom.filter((r) => r !== role);
    const updatedTarget = prevTarget.filter((r) => r !== role);

    setCustomRoles(updatedCustom);
    setTargetRoles(updatedTarget);

    try {
      await persistPreferenceUpdate(
        { customRoles: updatedCustom, targetRoles: updatedTarget },
        "removeRole"
      );
    } catch {
      setCustomRoles(prevCustom);
      setTargetRoles(prevTarget);
    }
  }

  // Handle Avatar Change
  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setFeedbackMsg({ type: "error", text: "Profile photo must be smaller than 2MB." });
      return;
    }

    setAvatarUploading(true);
    setFeedbackMsg(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/profile/avatar", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (res.ok && json.avatarUrl) {
        setProfile((prev) => (prev ? { ...prev, avatarUrl: json.avatarUrl } : prev));
        auth.updateAvatar?.(json.avatarUrl);
        setFeedbackMsg({ type: "success", text: "Profile photo saved and persisted to storage." });
        await auth.refresh();
      } else {
        setFeedbackMsg({ type: "error", text: json.error || "Failed to upload photo." });
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Network error. Failed to upload photo." });
    } finally {
      setAvatarUploading(false);
      if (e.target) e.target.value = "";
    }
  }

  // Handle Remove Avatar
  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, avatarUrl: null } : prev));
        auth.updateAvatar?.(null);
        setFeedbackMsg({ type: "success", text: "Profile photo removed." });
        await auth.refresh();
      }
    } catch {
      setFeedbackMsg({ type: "error", text: "Failed to remove avatar." });
    } finally {
      setAvatarUploading(false);
    }
  }

  // Handle Password Change
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "Password must be at least 8 characters long." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPasswordSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setPasswordMsg({ type: "error", text: error.message });
      } else {
        setPasswordMsg({ type: "success", text: "Password updated successfully!" });
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setShowPasswordModal(false), 2000);
      }
    } catch {
      setPasswordMsg({ type: "error", text: "An unexpected error occurred while changing password." });
    } finally {
      setPasswordSaving(false);
    }
  }

  // Handle Data Download
  function handleDownloadData() {
    if (!profile) return;
    const exportPayload = {
      urplaced_profile_export: {
        exported_at: new Date().toISOString(),
        profile: {
          id: profile.id,
          fullName: profile.fullName,
          email: profile.email,
          role: profile.role,
          accountCategory: profile.accountCategory,
          institution: profile.institutionName,
          phone: profile.phone,
          location: profile.location,
          bio: profile.bio,
          preferences: profile.preferences,
        },
        studentMetrics: studentMetrics || undefined,
        collegeMetrics: collegeMetrics || undefined,
        academicRecord: academicRecord || undefined,
      },
    };

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `urplaced-profile-${profile.fullName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    if (loadError === "UNAUTHORIZED" && !auth.isAuthenticated) {
      return (
        <div className="text-center py-16">
          <AlertCircle className="h-10 w-10 text-status-danger mx-auto mb-3" />
          <h2 className="text-xl font-bold font-heading text-text-primary">Profile Unavailable</h2>
          <p className="text-xs text-text-secondary mt-1">Please sign in to view your profile.</p>
          <Button asChild className="mt-4" variant="primary">
            <Link href="/auth/signin">Sign In</Link>
          </Button>
        </div>
      );
    }

    if (loadError === "FORBIDDEN") {
      return (
        <div className="text-center py-16">
          <AlertCircle className="h-10 w-10 text-status-danger mx-auto mb-3" />
          <h2 className="text-xl font-bold font-heading text-text-primary">Access Restricted</h2>
          <p className="text-xs text-text-secondary mt-1">You do not have authorization to view this profile record.</p>
        </div>
      );
    }

    return (
      <div className="text-center py-16 space-y-4">
        <AlertCircle className="h-10 w-10 text-status-warning mx-auto text-amber-500" />
        <div>
          <h2 className="text-xl font-bold font-heading text-text-primary">Unable to load profile data</h2>
          <p className="text-xs text-text-secondary mt-1">
            There was a temporary issue loading your profile details. Your session is active.
          </p>
        </div>
        <Button onClick={() => fetchProfileData()} variant="outline" className="mt-2">
          Retry Loading Profile
        </Button>
      </div>
    );
  }

  const isStudent = profile.accountCategory === "STUDENT";
  const roleTitle = isStudent
    ? "Student"
    : profile.role === "PLACEMENT_HEAD"
    ? "Placement Head"
    : profile.role === "PLACEMENT_STAFF"
    ? "Placement Officer"
    : "Faculty / Trainer";

  const completionPercent = calculateCompletion();

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-secondary font-mono">
            Your Profile
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight font-heading text-text-primary mt-0.5">
            My Profile
          </h1>
          <p className="text-xs text-text-secondary mt-1">
            {isStudent
              ? "Manage your personal details, placement preparation targets, and learning preferences."
              : profile.role === "PLACEMENT_HEAD"
              ? "Manage your institutional profile, placement operations, and team coordination."
              : profile.role === "PLACEMENT_STAFF"
              ? "Manage your operational profile, student liaisons, and recruitment drives."
              : "Manage your trainer profile, assigned cohort curricula, and targeted interventions."}
          </p>
        </div>

        <div>
          <Badge
            variant={isStudent ? "secondary" : "default"}
            className={
              isStudent
                ? "bg-[rgba(46,143,134,0.12)] text-secondary border border-secondary/30 px-3 py-1 text-xs"
                : "bg-primary text-white px-3 py-1 text-xs shadow-sm"
            }
          >
            {isStudent ? (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <GraduationCap className="h-3.5 w-3.5" /> Student
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium">
                <Building2 className="h-3.5 w-3.5" /> Placement Cell &bull; {roleTitle}
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* Feedback Messages */}
      {feedbackMsg && (
        <Alert variant={feedbackMsg.type === "success" ? "success" : "destructive"}>
          <AlertTitle className="flex items-center gap-1.5">
            {feedbackMsg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            {feedbackMsg.type === "success" ? "Success" : "Error"}
          </AlertTitle>
          <AlertDescription>{feedbackMsg.text}</AlertDescription>
        </Alert>
      )}

      {/* 2. Profile Summary Card */}
      <Card className="bg-card border-border shadow-sm overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
            {/* Avatar & Info */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
              {/* Avatar with Camera Overlay */}
              <div className="relative group shrink-0">
                <UserAvatar
                  src={profile.avatarUrl}
                  name={profile.fullName}
                  email={profile.email}
                  size="xl"
                  alt={profile.fullName || "User profile photo"}
                  className="border-2 border-primary/20 shadow-inner"
                />

                {/* Upload Button Overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-primary text-white shadow-md hover:bg-[var(--color-primary-hover)] transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
                  aria-label="Upload profile photo"
                  title="Upload profile photo"
                >
                  {avatarUploading ? (
                    <BrandLoader size="button" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                  <span className="sr-only">Upload profile photo</span>
                </button>
                <input
                  id="avatar-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  aria-label="Select profile photo file"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              {/* Identity & Metadata */}
              <div className="space-y-2">
                <div>
                  <h2 className="text-2xl font-bold font-heading text-text-primary">
                    {profile.fullName || "User Name"}
                  </h2>
                  <p className="text-xs text-text-secondary max-w-md mt-0.5 leading-relaxed">
                    {profile.bio || (isStudent
                      ? "Aspiring software professional dedicated to placement readiness and technical problem solving."
                      : `${roleTitle} coordinating institutional placement drives and student success initiatives.`)}
                  </p>
                </div>

                {/* Info Chips */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border/80 font-mono text-[11px]">
                    <Mail className="h-3 w-3 text-secondary" />
                    {profile.email}
                  </span>

                  {profile.phone && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border/80 text-[11px]">
                      <Phone className="h-3 w-3 text-secondary" />
                      {profile.phone}
                    </span>
                  )}

                  {profile.location && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface border border-border/80 text-[11px]">
                      <MapPin className="h-3 w-3 text-secondary" />
                      {profile.location}
                    </span>
                  )}

                  {profile.institutionName && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[rgba(46,143,134,0.08)] border border-secondary/20 text-secondary text-[11px] font-semibold">
                      <Building className="h-3 w-3" />
                      {profile.institutionName}
                    </span>
                  )}
                </div>

                {/* Remove photo link if custom avatar */}
                {profile.avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="text-[11px] text-status-danger hover:underline inline-flex items-center gap-1 pt-1"
                  >
                    <Trash2 className="h-3 w-3" /> Remove custom photo
                  </button>
                )}
              </div>
            </div>

            {/* Actions & Completion */}
            <div className="flex flex-col items-center sm:items-end gap-3 shrink-0">
              {/* <Button
                variant={isEditing ? "outline" : "primary"}
                size="sm"
                onClick={() => {
                  setIsEditing(!isEditing);
                  setFeedbackMsg(null);
                }}
                className="gap-1.5 text-xs font-semibold"
              >
                {isEditing ? (
                  <>
                    <X className="h-3.5 w-3.5" /> Cancel Editing
                  </>
                ) : (
                  <>
                    <Edit3 className="h-3.5 w-3.5" /> Edit Profile
                  </>
                )}
              </Button> */}

              {/* Profile Completion Indicator */}
              <div className="text-right">
                <div className="text-[11px] text-text-secondary font-mono">
                  Profile Completion: <strong className="text-primary font-bold">{completionPercent}%</strong>
                </div>
                <div className="w-32 bg-border h-1.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ========================================================= */}
        {/* LEFT COLUMN: Personal Info & Preparation / Institutional Scope */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-8">
          {/* Section A: Personal Information */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2 font-heading">
                    <User className="h-4 w-4 text-primary" /> Personal Information
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Your contact details, verified account credentials, and professional bio.
                  </CardDescription>
                </div>
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                    className="text-xs text-primary hover:text-[var(--color-primary-hover)] gap-1 h-8"
                  >
                    <Edit3 className="h-3 w-3" /> Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6">
              {isEditing ? (
                /* Edit Form */
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fullName" required className="text-xs font-semibold">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        required
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="email" className="text-xs font-semibold">
                          Email Address
                        </Label>
                        <span className="text-[10px] text-text-muted flex items-center gap-1">
                          <Lock className="h-2.5 w-2.5" /> Immutable
                        </span>
                      </div>
                      <Input
                        id="email"
                        value={profile.email}
                        disabled
                        className="bg-surface opacity-80 cursor-not-allowed font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-semibold">
                        Phone Number (Optional)
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+91 98765 43210"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="location" className="text-xs font-semibold">
                        Location (Optional)
                      </Label>
                      <Input
                        id="location"
                        placeholder="Bengaluru, Karnataka"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bio" className="text-xs font-semibold">
                        About Me / Professional Bio (Optional)
                      </Label>
                      <span className="text-[11px] font-mono text-text-muted">
                        {formData.bio.length} / 300
                      </span>
                    </div>
                    <textarea
                      id="bio"
                      rows={3}
                      maxLength={300}
                      placeholder="Brief overview of your academic focus or professional placement responsibilities..."
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      disabled={saving}
                      className="w-full rounded-lg border border-border bg-input px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <Button type="submit" variant="primary" size="sm" isLoading={saving} className="gap-1.5">
                      <Save className="h-3.5 w-3.5" /> Save Changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                /* Read-Only Display */
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-xs">
                  <div>
                    <span className="text-text-secondary text-[11px] font-semibold uppercase font-mono">
                      Full Name
                    </span>
                    <p className="text-text-primary font-medium mt-0.5">{profile.fullName || "—"}</p>
                  </div>

                  <div>
                    <span className="text-text-secondary text-[11px] font-semibold uppercase font-mono">
                      Email Address
                    </span>
                    <p className="text-text-primary font-mono mt-0.5">{profile.email}</p>
                  </div>

                  <div>
                    <span className="text-text-secondary text-[11px] font-semibold uppercase font-mono">
                      Phone Number
                    </span>
                    <p className="text-text-primary mt-0.5">{profile.phone || "Not specified"}</p>
                  </div>

                  <div>
                    <span className="text-text-secondary text-[11px] font-semibold uppercase font-mono">
                      Location
                    </span>
                    <p className="text-text-primary mt-0.5">{profile.location || "Not specified"}</p>
                  </div>

                  <div className="sm:col-span-2 pt-2 border-t border-border">
                    <span className="text-text-secondary text-[11px] font-semibold uppercase font-mono">
                      About Me
                    </span>
                    <p className="text-text-primary mt-0.5 leading-relaxed">
                      {profile.bio || "No biography provided yet. Click Edit to add details."}
                    </p>
                  </div>

                  {academicRecord && (
                    <div className="sm:col-span-2 pt-2 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface p-3 rounded-lg">
                      <div>
                        <span className="text-[10px] text-text-muted font-mono uppercase">Enrollment No.</span>
                        <p className="font-mono font-bold text-text-primary">{academicRecord.enrollmentNumber}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted font-mono uppercase">Degree</span>
                        <p className="font-semibold text-text-primary">{academicRecord.degree}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted font-mono uppercase">Department</span>
                        <p className="font-semibold text-text-primary">{academicRecord.departmentName}</p>
                      </div>
                      <div>
                        <span className="text-[10px] text-text-muted font-mono uppercase">Graduation</span>
                        <p className="font-mono font-bold text-text-primary">{academicRecord.graduationYear}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B: Role-Specific Preparation or Institutional Scope */}
          {isStudent ? (
            /* Student Placement Preparation & Study Preferences */
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-base flex items-center gap-2 font-heading">
                  <Compass className="h-4 w-4 text-primary" /> Placement Preparation &amp; Preferences
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Customize your learning schedule, practice mode, and targeted recruitment focus.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                {/* Target Focus */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono">
                      Target Hiring Roles
                    </h4>
                    {preferenceSavingKey?.includes("Role") ? (
                      <span className="text-[10px] text-primary font-mono animate-pulse flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                      </span>
                    ) : preferenceSavedMsg && preferenceSavingKey === null ? (
                      <span className="text-[10px] text-secondary font-mono flex items-center gap-0.5">
                        <Check className="h-2.5 w-2.5" /> Saved
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Combine default preset roles and custom user roles without duplicates */}
                    {Array.from(new Set([
                      "Software Development Engineer (SDE)",
                      "Frontend Engineer",
                      "Full Stack Developer",
                      "Data Analyst",
                      "Cloud & DevOps Engineer",
                      ...customRoles,
                    ])).map((roleChip) => {
                      const isSelected = targetRoles.includes(roleChip);
                      const isCustom = customRoles.includes(roleChip);

                      return (
                        <button
                          type="button"
                          key={roleChip}
                          onClick={() => handleToggleRole(roleChip)}
                          className={cn(
                            "inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-xs transition-all border font-medium select-none cursor-pointer",
                            isSelected
                              ? "bg-primary text-white border-primary shadow-xs hover:bg-primary/90"
                              : "bg-surface text-text-secondary border-border hover:border-primary/60 hover:text-text-primary"
                          )}
                          title={isSelected ? "Click to deselect role" : "Click to select role"}
                        >
                          {isSelected ? (
                            <Check className="h-3 w-3 stroke-[2.5]" />
                          ) : (
                            <Plus className="h-3 w-3 text-text-muted" />
                          )}
                          <span>{roleChip}</span>
                          {isCustom && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleRemoveCustomRole(roleChip, e)}
                              className="ml-1 -mr-1 p-0.5 rounded-full hover:bg-black/20 text-current transition-colors"
                              title="Delete custom role"
                            >
                              <X className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Add Custom Role Control */}
                    {showAddRoleInput ? (
                      <form onSubmit={handleAddCustomRole} className="inline-flex items-center gap-1.5">
                        <Input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => {
                            setNewRoleName(e.target.value);
                            if (roleError) setRoleError(null);
                          }}
                          placeholder="e.g. AI Engineer"
                          className="h-7 w-44 text-xs bg-input border-border px-2"
                          autoFocus
                          maxLength={60}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          className="h-7 px-2.5 text-xs bg-primary text-white hover:bg-primary/90"
                        >
                          Add
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setShowAddRoleInput(false);
                            setNewRoleName("");
                            setRoleError(null);
                          }}
                          className="h-7 px-1.5 text-xs text-text-muted hover:text-text-primary"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowAddRoleInput(true)}
                        className="inline-flex items-center gap-1 text-xs py-1 px-2.5 rounded-full border border-dashed border-primary/50 text-primary hover:bg-primary/10 transition-colors font-medium cursor-pointer"
                      >
                        <Plus className="h-3 w-3" /> Add Role
                      </button>
                    )}
                  </div>
                  {roleError && (
                    <p className="text-[11px] text-red-500 font-mono mt-1.5">{roleError}</p>
                  )}
                </div>

                {/* Target Companies */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono mb-2">
                    Industry Hiring Partners
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {["TCS", "Infosys", "Wipro", "Amazon", "Microsoft", "Accenture", "Cognizant"].map((c) => (
                      <span
                        key={c}
                        className="px-2 py-0.5 rounded bg-surface border border-border text-[11px] font-semibold text-text-secondary"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Study Preferences & Goals Grid */}
                <div className="pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border border-border bg-input space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-secondary uppercase font-mono">
                        Weekly Practice Goal
                      </span>
                      {preferenceSavingKey === "weeklyGoalHours" ? (
                        <span className="text-[10px] text-primary font-mono animate-pulse">Saving...</span>
                      ) : preferenceSavedMsg && preferenceSavingKey === null ? (
                        <span className="text-[10px] text-secondary font-mono flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" /> Saved
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-baseline justify-between">
                      <p className="text-sm font-bold text-text-primary font-heading">
                        {formData.weeklyGoalHours} Hours / Week
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={formData.weeklyGoalHours <= 1 || preferenceSavingKey === "weeklyGoalHours"}
                          onClick={() => handleGoalChange(Math.max(1, formData.weeklyGoalHours - 1))}
                          className="h-5 w-5 rounded bg-surface border border-border flex items-center justify-center text-xs font-bold text-text-secondary hover:text-primary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Decrease goal"
                        >
                          -
                        </button>
                        <button
                          type="button"
                          disabled={formData.weeklyGoalHours >= 40 || preferenceSavingKey === "weeklyGoalHours"}
                          onClick={() => handleGoalChange(Math.min(40, formData.weeklyGoalHours + 1))}
                          className="h-5 w-5 rounded bg-surface border border-border flex items-center justify-center text-xs font-bold text-text-secondary hover:text-primary hover:border-primary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Increase goal"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Range Slider */}
                    <div className="space-y-1 pt-0.5">
                      <input
                        type="range"
                        min={1}
                        max={40}
                        step={1}
                        value={formData.weeklyGoalHours}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData((prev) => ({ ...prev, weeklyGoalHours: val }));
                        }}
                        onMouseUp={(e) => handleGoalChange(Number((e.target as HTMLInputElement).value))}
                        onTouchEnd={(e) => handleGoalChange(Number((e.target as HTMLInputElement).value))}
                        className="w-full accent-[#5052C9] h-1.5 bg-border rounded-lg cursor-pointer transition-all"
                        aria-label="Weekly Practice Goal Hours"
                      />
                      <div className="flex justify-between text-[10px] text-text-muted font-mono">
                        <span>1 hr</span>
                        <span>20 hrs</span>
                        <span>40 hrs</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-text-muted leading-tight">
                      Recommended for consistent problem-solving readiness.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-input space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-text-secondary uppercase font-mono">
                        Daily Study Cadence
                      </span>
                      {preferenceSavingKey === "dailyStudyTime" ? (
                        <span className="text-[10px] text-primary font-mono animate-pulse">Saving...</span>
                      ) : preferenceSavedMsg && preferenceSavingKey === null ? (
                        <span className="text-[10px] text-secondary font-mono flex items-center gap-0.5">
                          <Check className="h-2.5 w-2.5" /> Saved
                        </span>
                      ) : null}
                    </div>

                    <div>
                      <select
                        value={formData.dailyStudyTime}
                        onChange={(e) => handleCadenceChange(e.target.value)}
                        disabled={preferenceSavingKey === "dailyStudyTime"}
                        className="w-full h-8 text-xs rounded-lg bg-surface border border-border text-text-primary font-semibold px-2.5 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer transition-colors"
                        aria-label="Daily Study Cadence"
                      >
                        <option value="30 minutes">30 minutes</option>
                        <option value="1–2 hours">1–2 hours</option>
                        <option value="2–3 hours">2–3 hours</option>
                        <option value="3–4 hours">3–4 hours</option>
                        <option value="5+ hours">5+ hours</option>
                      </select>
                    </div>

                    <p className="text-[11px] text-text-muted leading-tight">
                      Optimal duration to balance coursework and placement prep.
                    </p>
                  </div>
                </div>

                {/* Notification Toggles */}
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary font-mono">
                      Study Reminders &amp; Notification Toggles
                    </h4>
                    {preferenceSavingKey && [
                      "studyReminders",
                      "driveAlerts",
                      "testUpdates",
                      "aiMistakeTips",
                    ].includes(preferenceSavingKey) ? (
                      <span className="text-[10px] text-primary font-mono animate-pulse flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Saving...
                      </span>
                    ) : preferenceSavedMsg && preferenceSavingKey === null ? (
                      <span className="text-[10px] text-secondary font-mono flex items-center gap-0.5">
                        <Check className="h-2.5 w-2.5" /> Saved
                      </span>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {[
                      { key: "studyReminders", title: "Practice Reminders", desc: "Daily reminders for scheduled questions" },
                      { key: "driveAlerts", title: "Recruitment Alerts", desc: "Instant notice when matching drives launch" },
                      { key: "testUpdates", title: "Assessment Notifications", desc: "Alerts when new test papers are assigned" },
                      { key: "aiMistakeTips", title: "AI Remediation Tips", desc: "Automated analysis for recurrent mistakes" },
                    ].map((item) => {
                      const isEnabled = Boolean(formData[item.key as keyof typeof formData]);
                      const isSavingThis = preferenceSavingKey === item.key;

                      return (
                        <div
                          key={item.key}
                          className="flex items-start justify-between p-3 rounded-lg border border-border bg-surface transition-colors"
                        >
                          <div className="space-y-0.5 pr-2">
                            <span className="font-semibold text-text-primary block">{item.title}</span>
                            <span className="text-[11px] text-text-muted leading-tight block">{item.desc}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 pt-0.5">
                            <span
                              className={cn(
                                "text-[10px] font-bold font-mono uppercase transition-colors",
                                isEnabled ? "text-secondary" : "text-text-muted"
                              )}
                            >
                              {isEnabled ? "ON" : "OFF"}
                            </span>
                            <Switch
                              checked={isEnabled}
                              onCheckedChange={(checked) =>
                                handleToggleNotification(
                                  item.key as "studyReminders" | "driveAlerts" | "testUpdates" | "aiMistakeTips",
                                  checked
                                )
                              }
                              disabled={isSavingThis}
                              aria-label={item.title}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* College Institutional Scope Card */
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="pb-4 border-b border-border">
                <CardTitle className="text-base flex items-center gap-2 font-heading">
                  <Building2 className="h-4 w-4 text-primary" /> Institutional Scope &amp; Authority
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Verified college workspace configuration and assigned administrative boundaries.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl border border-border bg-input space-y-1">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase font-mono">
                      Institutional Workspace
                    </span>
                    <p className="text-sm font-bold text-text-primary font-heading">
                      {profile.institutionName || "Sapthagiri NPS University"}
                    </p>
                    <p className="text-[11px] text-text-muted font-mono">
                      Tenant ID: {profile.tenantId || `tenant-${profile.id.substring(0, 8)}`}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-border bg-input space-y-1">
                    <span className="text-[11px] font-semibold text-text-secondary uppercase font-mono">
                      Assigned Institutional Role
                    </span>
                    <p className="text-sm font-bold text-primary font-heading">
                      {roleTitle}
                    </p>
                    <p className="text-[11px] text-text-muted">
                      Status: <span className="text-secondary font-bold font-mono">ACTIVE (VERIFIED)</span>
                    </p>
                  </div>
                </div>

                {/* Role-Specific Responsibilities Summary */}
                <div className="p-4 rounded-xl border border-border bg-surface text-xs space-y-2">
                  <span className="font-bold text-text-primary block font-heading">
                    Operational Responsibilities:
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-text-secondary">
                    {profile.role === "PLACEMENT_HEAD" && (
                      <>
                        <li>Overall management of campus recruitment drives, company relationships, and offer records.</li>
                        <li>Administration of placement coordinators, staff members, and authorized trainers.</li>
                        <li>Academic structure configuration and comprehensive institutional analytics reports.</li>
                      </>
                    )}
                    {profile.role === "PLACEMENT_STAFF" && (
                      <>
                        <li>Student directory administration, eligibility verification, and resume approvals.</li>
                        <li>Company relations, job description imports, and drive application processing.</li>
                        <li>Permitted institutional analytics and candidate assessment overviews.</li>
                      </>
                    )}
                    {profile.role === "TRAINER" && (
                      <>
                        <li>Execution of targeted training sessions and cohort practice intervention plans.</li>
                        <li>Creation and review of mock assessment papers in the Question Bank Sentinel.</li>
                        <li>Cohort mistake tracking and skill remediation monitoring.</li>
                      </>
                    )}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: Overview, Quick Links & Security Settings */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-6">
          {/* Card 1: Contextual Overview */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-heading flex items-center gap-2">
                  {isStudent ? (
                    <>
                      <Award className="h-4 w-4 text-primary" /> Learning Overview
                    </>
                  ) : (
                    <>
                      <BarChart3 className="h-4 w-4 text-primary" /> Institutional Overview
                    </>
                  )}
                </CardTitle>
                <span className="text-[10px] text-text-muted font-mono">All-Time</span>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              {isStudent ? (
                /* Student 2x2 Stats */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Tests</span>
                      <span className="text-lg font-bold font-heading text-text-primary">
                        {studentMetrics?.testsAttempted || 0}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Attempted</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Questions</span>
                      <span className="text-lg font-bold font-heading text-text-primary">
                        {studentMetrics?.questionsAttempted || 0}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Practised</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Accuracy</span>
                      <span className="text-lg font-bold font-heading text-secondary font-mono">
                        {studentMetrics?.averageAccuracy || 0}%
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Overall</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Mistakes</span>
                      <span className="text-lg font-bold font-heading text-primary">
                        {studentMetrics?.savedMistakes || 0}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Logged</span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard/student/analytics"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
                  >
                    View Detailed Analytics <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ) : (
                /* College 2x2 Stats */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Students</span>
                      <span className="text-lg font-bold font-heading text-text-primary">
                        {collegeMetrics?.activeStudents || 0}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">In Roster</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Drives</span>
                      <span className="text-lg font-bold font-heading text-text-primary">
                        {collegeMetrics?.activeDrives || 0}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Recruiting</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Companies</span>
                      <span className="text-lg font-bold font-heading text-secondary">
                        {collegeMetrics?.partnerCompanies || 0}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Partners</span>
                    </div>

                    <div className="p-3 rounded-lg border border-border bg-surface">
                      <span className="text-[10px] text-text-secondary font-mono uppercase block">Staff</span>
                      <span className="text-lg font-bold font-heading text-primary">
                        {collegeMetrics?.staffMembers || 1}
                      </span>
                      <span className="text-[10px] text-text-muted block mt-0.5">Active</span>
                    </div>
                  </div>

                  <Link
                    href="/dashboard/analytics"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline pt-1"
                  >
                    View Institutional Analytics <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card 2: Quick Links */}
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Compass className="h-4 w-4 text-primary" /> Quick Links
              </CardTitle>
              <CardDescription className="text-xs">
                Access your core workflows quickly.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 divide-y divide-border/60">
              {isStudent ? (
                <>
                  <Link
                    href="/dashboard/student/assessments"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Compass className="h-3.5 w-3.5 text-primary" /> Assessments &amp; Practice
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard/student/mistakes"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-secondary" /> Mistake Bank &amp; Remediation
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard/student/mastery"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Mastery Tracker
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard/student/memory"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-secondary" /> Target Drive Insights
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/dashboard"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Building className="h-3.5 w-3.5 text-primary" /> Placement Command Center
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard/drives"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Briefcase className="h-3.5 w-3.5 text-secondary" /> Recruitment Drives
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>

                  <Link
                    href="/dashboard/students"
                    className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                  >
                    <span className="flex items-center gap-2">
                      <Users className="h-3.5 w-3.5 text-primary" /> Student Directory
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                  </Link>

                  {profile.role === "PLACEMENT_HEAD" && (
                    <Link
                      href="/dashboard/members"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-secondary" /> Staff &amp; Coordinators
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                    </Link>
                  )}

                  {profile.role === "TRAINER" && (
                    <Link
                      href="/dashboard/training"
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary transition-colors group"
                    >
                      <span className="flex items-center gap-2">
                        <Target className="h-3.5 w-3.5 text-secondary" /> Targeted Interventions
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
                    </Link>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Card 3: Account, Privacy & Security */}
          <Card id="account-security" className="bg-card border-border shadow-sm scroll-mt-20">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-secondary" /> Account &amp; Security
              </CardTitle>
              <CardDescription className="text-xs">
                Manage your credentials, privacy settings, and data.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2 divide-y divide-border/60">
              <button
                type="button"
                onClick={() => {
                  setShowPasswordModal(true);
                  setPasswordMsg(null);
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary text-left transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-primary" /> Change Password
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
              </button>

              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary text-left transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-secondary" /> Privacy &amp; Data Isolation
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
              </button>

              <button
                type="button"
                onClick={handleDownloadData}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-surface text-xs text-text-primary text-left transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <Download className="h-3.5 w-3.5 text-primary" /> Download My Data (JSON)
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-text-muted group-hover:text-primary transition-colors" />
              </button>

              <button
                type="button"
                onClick={auth.signOut}
                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--color-danger-subtle)] text-xs text-status-danger text-left transition-colors group"
              >
                <span className="flex items-center gap-2">
                  <LogOut className="h-3.5 w-3.5 text-status-danger" /> Sign Out
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-status-danger" />
              </button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PASSWORD CHANGE MODAL */}
      {/* ========================================================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-md min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <Key className="h-4 w-4 text-primary" /> Change Password
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 rounded text-text-secondary hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CardDescription className="text-xs">
                Enter your new secure password (minimum 8 characters).
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5">
              {passwordMsg && (
                <Alert
                  variant={passwordMsg.type === "success" ? "success" : "destructive"}
                  className="mb-4"
                >
                  <AlertDescription>{passwordMsg.text}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" required className="text-xs font-semibold">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={passwordSaving}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" required className="text-xs font-semibold">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                    disabled={passwordSaving}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPasswordModal(false)}
                    disabled={passwordSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" size="sm" isLoading={passwordSaving}>
                    Update Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* PRIVACY & DATA ISOLATION MODAL */}
      {/* ========================================================= */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm overflow-hidden">
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden bg-card border-border shadow-2xl rounded-2xl">
            <CardHeader className="shrink-0 pb-3 border-b border-border bg-card">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-secondary" /> Privacy &amp; Tenant Isolation
                </CardTitle>
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(false)}
                  className="p-1 rounded text-text-secondary hover:text-text-primary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <CardDescription className="text-xs">
                How UrPlaced guarantees data protection and multi-tenant security.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 pr-3 sm:pr-5 space-y-4 text-xs leading-relaxed text-text-secondary">
              <div className="p-3 bg-surface rounded-lg border border-border">
                <h4 className="font-bold text-text-primary mb-1 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-primary" /> Row-Level Security (RLS)
                </h4>
                <p>
                  Every database record is locked by PostgreSQL Row-Level Security. Your records can only be queried through server-verified authentication tokens.
                </p>
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <h4 className="font-bold text-text-primary mb-1 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-secondary" /> Multi-Tenant Isolation
                </h4>
                <p>
                  Institutional records belong strictly to your college workspace tenant ID. Cross-tenant access is blocked at the database kernel layer.
                </p>
              </div>

              <div className="p-3 bg-surface rounded-lg border border-border">
                <h4 className="font-bold text-text-primary mb-1 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-primary" /> Student Privacy
                </h4>
                <p>
                  Student assessment attempts and personal mistake notebooks are completely private to the student account and cannot be modified by other users.
                </p>
              </div>

              </CardContent>
            <div className="shrink-0 p-3.5 sm:p-4 border-t border-border/60 bg-surface/50 flex justify-end gap-2">
              <Button variant="primary" size="sm" onClick={() => setShowPrivacyModal(false)}>
                  Close
                </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
