"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Briefcase,
  GraduationCap,
  AlertCircle,
  Users,
  CheckCircle2,
  ExternalLink,
  Search,
  Filter,
  Send,
  Building,
  Info,
  X,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  AnnouncementAudienceType,
  AnnouncementCategory,
  AnnouncementRecord,
  EligibleStudentItem,
} from "@/modules/notifications/types";

interface DepartmentItem {
  id: string;
  name: string;
  code: string;
}

interface AnnouncementComposeProps {
  collegeId: string;
  departments: DepartmentItem[];
  allStudentsCount: number;
  onBroadcastSuccess?: (announcement: AnnouncementRecord) => void;
}

const CATEGORIES: {
  value: AnnouncementCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}[] = [
  {
    value: "GENERAL",
    label: "General Notice",
    icon: Megaphone,
    colorClass: "bg-[rgba(36,40,58,0.08)] text-[#24283A] border-[#DDDCD5]",
  },
  {
    value: "PLACEMENT_DRIVE",
    label: "Placement Drive",
    icon: Briefcase,
    colorClass: "bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30",
  },
  {
    value: "ACADEMIC",
    label: "Academic & Prep",
    icon: GraduationCap,
    colorClass: "bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30",
  },
  {
    value: "URGENT",
    label: "Urgent Alert",
    icon: AlertCircle,
    colorClass: "bg-red-500/10 text-red-600 border-red-300",
  },
];

const QUICK_ACTIONS = [
  { label: "Student Dashboard", url: "/dashboard/student" },
  { label: "Assessments & Tests", url: "/dashboard/student/assessments" },
  { label: "Company Drive Insights", url: "/dashboard/student/memory" },
  { label: "Mistake Bank", url: "/dashboard/student/mistakes" },
  { label: "Targeted Training", url: "/dashboard/student/training" },
];

export function AnnouncementCompose({
  collegeId,
  departments,
  allStudentsCount,
  onBroadcastSuccess,
}: AnnouncementComposeProps) {
  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<AnnouncementCategory>("GENERAL");
  const [audienceType, setAudienceType] = useState<AnnouncementAudienceType>("ALL_STUDENTS");
  const [selectedDeptId, setSelectedDeptId] = useState<string>(
    departments[0]?.id || ""
  );
  const [actionUrl, setActionUrl] = useState("");

  // Student selection state
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudentItem[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [studentsLoaded, setStudentsLoaded] = useState(false);

  // Submission & UI feedback state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<{
    announcement: AnnouncementRecord;
    recipientCount: number;
  } | null>(null);

  // Fetch eligible students when audienceType is SELECTED_STUDENTS or when needed
  useEffect(() => {
    if (audienceType === "SELECTED_STUDENTS" && !studentsLoaded) {
      fetchStudents();
    }
  }, [audienceType, studentsLoaded]);

  async function fetchStudents(searchQuery = "") {
    setIsLoadingStudents(true);
    try {
      const url = new URL("/api/announcements/recipients", window.location.origin);
      url.searchParams.set("audienceType", "ALL_STUDENTS");
      if (searchQuery) url.searchParams.set("search", searchQuery);

      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        setEligibleStudents(data.students || []);
        setStudentsLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load students", err);
    } finally {
      setIsLoadingStudents(false);
    }
  }

  // Filter students locally for instant typing responsiveness
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return eligibleStudents;
    const q = studentSearch.toLowerCase().trim();
    return eligibleStudents.filter(
      (s) =>
        s.fullName.toLowerCase().includes(q) ||
        s.enrollmentNumber.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.departmentName && s.departmentName.toLowerCase().includes(q))
    );
  }, [eligibleStudents, studentSearch]);

  // Selected department details
  const selectedDept = departments.find((d) => d.id === selectedDeptId);

  // Calculate estimated reach
  const estimatedReach = useMemo(() => {
    if (audienceType === "ALL_STUDENTS") {
      return allStudentsCount || eligibleStudents.length || 0;
    }
    if (audienceType === "DEPARTMENT") {
      if (eligibleStudents.length > 0) {
        return eligibleStudents.filter((s) => s.departmentId === selectedDeptId).length;
      }
      return 0;
    }
    if (audienceType === "SELECTED_STUDENTS") {
      return selectedStudentIds.length;
    }
    return 0;
  }, [audienceType, allStudentsCount, eligibleStudents, selectedDeptId, selectedStudentIds]);

  // Validation
  const isActionUrlValid = useMemo(() => {
    if (!actionUrl.trim()) return true;
    const u = actionUrl.trim();
    return u.startsWith("/") && !u.startsWith("//") && !u.includes("://");
  }, [actionUrl]);

  const canSubmit = useMemo(() => {
    if (!title.trim() || title.length > 255) return false;
    if (!body.trim() || body.length > 2000) return false;
    if (actionUrl.trim() && !isActionUrlValid) return false;
    if (audienceType === "DEPARTMENT" && !selectedDeptId) return false;
    if (audienceType === "SELECTED_STUDENTS" && selectedStudentIds.length === 0) return false;
    return true;
  }, [title, body, actionUrl, isActionUrlValid, audienceType, selectedDeptId, selectedStudentIds]);

  // Student toggle
  const toggleStudent = (id: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredStudents.map((s) => s.id);
    setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const clearSelected = () => {
    setSelectedStudentIds([]);
  };

  // Execution
  const handleBroadcastConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const payload = {
        title: title.trim(),
        body: body.trim(),
        category,
        audienceType,
        departmentId: audienceType === "DEPARTMENT" ? selectedDeptId : undefined,
        departmentName: audienceType === "DEPARTMENT" ? selectedDept?.name : undefined,
        selectedStudentIds: audienceType === "SELECTED_STUDENTS" ? selectedStudentIds : undefined,
        actionUrl: actionUrl.trim() || null,
      };

      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to broadcast announcement.");
      }

      setSuccessResult({
        announcement: data.announcement,
        recipientCount: data.recipientCount,
      });
      setIsConfirmOpen(false);

      // Reset form
      setTitle("");
      setBody("");
      setActionUrl("");
      setSelectedStudentIds([]);

      if (onBroadcastSuccess) {
        onBroadcastSuccess(data.announcement);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Success Notification Banner */}
      {successResult && (
        <div className="p-4 rounded-xl border border-[#2E8F86]/30 bg-[#2E8F86]/10 text-[#24283A] flex items-start justify-between shadow-sm animate-in fade-in">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#2E8F86] mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm font-['Outfit']">
                Announcement Successfully Broadcasted!
              </h4>
              <p className="text-xs text-[#292D40] mt-0.5">
                Delivered in real-time to{" "}
                <strong className="text-[#24283A]">{successResult.recipientCount} students</strong>.
                Students will immediately see this notice in their notification bell.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccessResult(null)}
            className="h-7 w-7 p-0 text-[#292D40] hover:text-[#24283A]"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Compose Form (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm">
            <CardHeader className="pb-4 border-b border-[#DDDCD5]/60">
              <CardTitle className="text-lg font-['Outfit'] text-[#24283A] flex items-center gap-2">
                <Send className="w-5 h-5 text-[#5052C9]" />
                Compose Institutional Announcement
              </CardTitle>
              <CardDescription className="text-xs text-[#292D40]">
                Craft high-visibility announcements delivered instantly to students&apos; notification bells.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              {/* Category Picker */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#24283A] uppercase tracking-wider">
                  Category
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => setCategory(cat.value)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                          isSelected
                            ? "bg-[#5052C9] text-white border-[#5052C9] shadow-sm"
                            : "bg-[#FBFAF7] border-[#DDDCD5] text-[#292D40] hover:bg-white"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isSelected ? "text-white" : "text-[#5052C9]"}`} />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="announcement-title" className="text-xs font-semibold text-[#24283A] uppercase tracking-wider">
                    Headline / Subject <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-[#292D40]/60">
                    {title.length}/255
                  </span>
                </div>
                <Input
                  id="announcement-title"
                  placeholder="e.g. Campus Placement Drive: Amazon Software Development Engineer 2026"
                  value={title}
                  maxLength={255}
                  onChange={(e) => setTitle(e.target.value)}
                  className="bg-[#FBFAF7] border-[#DDDCD5] focus-visible:ring-[#5052C9] text-sm text-[#24283A]"
                />
              </div>

              {/* Message Body */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="announcement-body" className="text-xs font-semibold text-[#24283A] uppercase tracking-wider">
                    Message Body <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[11px] text-[#292D40]/60">
                    {body.length}/2000
                  </span>
                </div>
                <Textarea
                  id="announcement-body"
                  placeholder="Detail the announcement, mandatory criteria, deadlines, preparation guidance, or specific instructions..."
                  rows={5}
                  maxLength={2000}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="bg-[#FBFAF7] border-[#DDDCD5] focus-visible:ring-[#5052C9] text-sm text-[#24283A] resize-y"
                />
              </div>

              {/* Action Destination URL */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="action-url" className="text-xs font-semibold text-[#24283A] uppercase tracking-wider flex items-center gap-1.5">
                    Action Destination Link <span className="text-xs font-normal text-[#292D40]/60">(Optional)</span>
                  </label>
                  {actionUrl.trim() && (
                    <span
                      className={`text-[11px] flex items-center gap-1 font-medium ${
                        isActionUrlValid ? "text-[#2E8F86]" : "text-red-500"
                      }`}
                    >
                      {isActionUrlValid ? (
                        <>
                          <Check className="w-3 h-3" /> Valid internal link
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Must start with &apos;/&apos;
                        </>
                      )}
                    </span>
                  )}
                </div>
                <Input
                  id="action-url"
                  placeholder="/dashboard/student/assessments"
                  value={actionUrl}
                  onChange={(e) => setActionUrl(e.target.value)}
                  className="bg-[#FBFAF7] border-[#DDDCD5] focus-visible:ring-[#5052C9] text-xs font-mono text-[#24283A]"
                />
                {/* Quick Suggestion Chips */}
                <div className="flex flex-wrap gap-1.5 items-center pt-1">
                  <span className="text-[11px] text-[#292D40]/60 mr-1">Quick Links:</span>
                  {QUICK_ACTIONS.map((qa) => (
                    <button
                      key={qa.url}
                      type="button"
                      onClick={() => setActionUrl(qa.url)}
                      className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                        actionUrl === qa.url
                          ? "bg-[#5052C9] text-white border-[#5052C9]"
                          : "bg-white border-[#DDDCD5] text-[#292D40] hover:bg-[#EDECE7]"
                      }`}
                    >
                      {qa.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience Selector */}
              <div className="space-y-3 pt-3 border-t border-[#DDDCD5]/60">
                <label className="text-xs font-semibold text-[#24283A] uppercase tracking-wider">
                  Target Student Audience
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAudienceType("ALL_STUDENTS")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      audienceType === "ALL_STUDENTS"
                        ? "bg-[#5052C9]/10 border-[#5052C9] text-[#24283A]"
                        : "bg-[#FBFAF7] border-[#DDDCD5] text-[#292D40] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Users className={`w-4 h-4 ${audienceType === "ALL_STUDENTS" ? "text-[#5052C9]" : "text-[#292D40]"}`} />
                      <span className="font-semibold text-xs">All Students</span>
                    </div>
                    <p className="text-[11px] text-[#292D40]/70 mt-1">
                      Broadcast to entire college cohort
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudienceType("DEPARTMENT")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      audienceType === "DEPARTMENT"
                        ? "bg-[#5052C9]/10 border-[#5052C9] text-[#24283A]"
                        : "bg-[#FBFAF7] border-[#DDDCD5] text-[#292D40] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building className={`w-4 h-4 ${audienceType === "DEPARTMENT" ? "text-[#5052C9]" : "text-[#292D40]"}`} />
                      <span className="font-semibold text-xs">By Department</span>
                    </div>
                    <p className="text-[11px] text-[#292D40]/70 mt-1">
                      Filter by specific department branch
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAudienceType("SELECTED_STUDENTS")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      audienceType === "SELECTED_STUDENTS"
                        ? "bg-[#5052C9]/10 border-[#5052C9] text-[#24283A]"
                        : "bg-[#FBFAF7] border-[#DDDCD5] text-[#292D40] hover:bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className={`w-4 h-4 ${audienceType === "SELECTED_STUDENTS" ? "text-[#5052C9]" : "text-[#292D40]"}`} />
                      <span className="font-semibold text-xs">Selected Students</span>
                    </div>
                    <p className="text-[11px] text-[#292D40]/70 mt-1">
                      Handpick individual students
                    </p>
                  </button>
                </div>

                {/* Sub-view: Department Selector */}
                {audienceType === "DEPARTMENT" && (
                  <div className="p-3.5 rounded-lg bg-white border border-[#DDDCD5] space-y-2 animate-in fade-in">
                    <label htmlFor="dept-select" className="text-xs font-medium text-[#24283A]">
                      Select College Department:
                    </label>
                    <select
                      id="dept-select"
                      value={selectedDeptId}
                      onChange={(e) => setSelectedDeptId(e.target.value)}
                      className="w-full h-9 rounded-md border border-[#DDDCD5] bg-[#FBFAF7] px-3 py-1 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name} ({dept.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub-view: Selected Students Multi-Picker */}
                {audienceType === "SELECTED_STUDENTS" && (
                  <div className="p-3.5 rounded-lg bg-white border border-[#DDDCD5] space-y-3 animate-in fade-in">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-[#292D40]/50" />
                        <Input
                          placeholder="Search student by name, enrollment no, or email..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="h-8 pl-8 text-xs bg-[#FBFAF7] border-[#DDDCD5]"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={selectAllFiltered}
                          className="h-8 text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7]"
                        >
                          Select All ({filteredStudents.length})
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={clearSelected}
                          disabled={selectedStudentIds.length === 0}
                          className="h-8 text-xs text-[#292D40]"
                        >
                          Clear ({selectedStudentIds.length})
                        </Button>
                      </div>
                    </div>

                    {/* Student List Table */}
                    <div className="border border-[#DDDCD5] rounded-md overflow-hidden max-h-60 overflow-y-auto">
                      {isLoadingStudents ? (
                        <div className="p-6 text-center text-xs text-[#292D40]/70">
                          Loading students directory...
                        </div>
                      ) : filteredStudents.length === 0 ? (
                        <div className="p-6 text-center text-xs text-[#292D40]/70">
                          No students matching search filter.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-[#EDECE7]/60 border-b border-[#DDDCD5] text-[#292D40] sticky top-0">
                            <tr>
                              <th className="p-2 w-8 text-center"></th>
                              <th className="p-2 font-semibold">Student Name</th>
                              <th className="p-2 font-semibold">Enrollment #</th>
                              <th className="p-2 font-semibold">Department</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#DDDCD5]/50">
                            {filteredStudents.map((student) => {
                              const isChecked = selectedStudentIds.includes(student.id);
                              return (
                                <tr
                                  key={student.id}
                                  onClick={() => toggleStudent(student.id)}
                                  className={`cursor-pointer transition-colors ${
                                    isChecked ? "bg-[#5052C9]/5" : "hover:bg-[#EDECE7]/30"
                                  }`}
                                >
                                  <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleStudent(student.id)}
                                      className="rounded border-[#DDDCD5] text-[#5052C9] focus:ring-[#5052C9] cursor-pointer"
                                    />
                                  </td>
                                  <td className="p-2 font-medium text-[#24283A]">
                                    {student.fullName}
                                  </td>
                                  <td className="p-2 font-mono text-[#292D40]">
                                    {student.enrollmentNumber}
                                  </td>
                                  <td className="p-2 text-[#292D40]/80">
                                    {student.departmentName || "—"}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    <div className="flex justify-between items-center text-[11px] text-[#292D40]/70">
                      <span>Showing {filteredStudents.length} students</span>
                      <span className="font-semibold text-[#5052C9]">
                        {selectedStudentIds.length} students selected
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Live Recipient Reach & Preview Card (5 cols) */}
        <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-6">
          {/* Audience Summary Card */}
          <Card className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm">
            <CardHeader className="pb-3 border-b border-[#DDDCD5]/60">
              <CardTitle className="text-sm font-['Outfit'] text-[#24283A] flex items-center justify-between">
                <span>Audience Reach Breakdown</span>
                <Badge variant="outline" className="text-xs bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
                  Target Verified
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              <div className="flex items-baseline justify-between p-3 rounded-lg bg-white border border-[#DDDCD5]">
                <span className="text-xs text-[#292D40] font-medium">Estimated Reach:</span>
                <div className="text-right">
                  <span className="text-2xl font-bold font-['Outfit'] text-[#5052C9]">
                    {estimatedReach}
                  </span>
                  <span className="text-xs text-[#292D40] ml-1">students</span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-[#292D40]">
                <div className="flex justify-between py-1 border-b border-[#DDDCD5]/40">
                  <span className="text-[#292D40]/70">Target Scope:</span>
                  <span className="font-medium text-[#24283A]">
                    {audienceType === "ALL_STUDENTS"
                      ? "College-wide (All Departments)"
                      : audienceType === "DEPARTMENT"
                      ? selectedDept?.name || "Selected Department"
                      : `${selectedStudentIds.length} Targeted Students`}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#DDDCD5]/40">
                  <span className="text-[#292D40]/70">Notification Type:</span>
                  <span className="font-medium text-[#24283A]">
                    {CATEGORIES.find((c) => c.value === category)?.label}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#DDDCD5]/40">
                  <span className="text-[#292D40]/70">Delivery Channel:</span>
                  <span className="font-medium text-[#24283A]">
                    In-App Notification Bell & Realtime Push
                  </span>
                </div>
              </div>

              {/* Action Button to Open Confirm Modal */}
              <Button
                type="button"
                disabled={!canSubmit}
                onClick={() => setIsConfirmOpen(true)}
                className="w-full bg-[#5052C9] hover:bg-[#4345B0] text-white shadow-sm font-semibold flex items-center justify-center gap-2 h-10 mt-2"
              >
                <Send className="w-4 h-4" />
                Review & Broadcast to {estimatedReach} Students
              </Button>

              {!canSubmit && (
                <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  {!title.trim()
                    ? "• Title is required"
                    : !body.trim()
                    ? "• Message body is required"
                    : audienceType === "SELECTED_STUDENTS" && selectedStudentIds.length === 0
                    ? "• Select at least 1 student"
                    : "• Fill required fields correctly"}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Student Notification Center Preview Card */}
          <Card className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm">
            <CardHeader className="pb-3 border-b border-[#DDDCD5]/60">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-[#292D40] flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#5052C9]" />
                Student Bell Dropdown Preview
              </CardTitle>
              <CardDescription className="text-[11px] text-[#292D40]/70">
                This is exactly how students will see the notification in their panel.
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-3">
              <div className="p-3 rounded-lg border border-[#DDDCD5] bg-white shadow-sm space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 ${
                      CATEGORIES.find((c) => c.value === category)?.colorClass
                    }`}
                  >
                    {CATEGORIES.find((c) => c.value === category)?.label}
                  </Badge>
                  <span className="text-[10px] text-[#292D40]/60">Just now</span>
                </div>

                <h4 className="text-xs font-semibold text-[#24283A] line-clamp-2">
                  {title.trim() || "Announcement Headline Here..."}
                </h4>

                <p className="text-[11px] text-[#292D40] line-clamp-3 leading-relaxed">
                  {body.trim() || "Message body preview will appear here as you type..."}
                </p>

                {actionUrl.trim() && isActionUrlValid && (
                  <div className="pt-1 flex justify-end">
                    <span className="text-[10px] text-[#5052C9] font-medium hover:underline flex items-center gap-1">
                      View Details <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation & Dispatch Modal */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="sm:max-w-md bg-[#F8F7F3] border-[#DDDCD5]">
          <DialogHeader>
            <DialogTitle className="text-base font-['Outfit'] text-[#24283A] flex items-center gap-2">
              <Send className="w-5 h-5 text-[#5052C9]" />
              Confirm Announcement Broadcast
            </DialogTitle>
            <DialogDescription className="text-xs text-[#292D40]">
              Please review details before triggering the real-time notification broadcast.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 space-y-3">
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Broadcast Warning:</strong> This announcement will immediately notify{" "}
                <span className="font-bold underline">{estimatedReach} students</span> in your college.
                This action cannot be undone.
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-[#DDDCD5] space-y-2 text-xs">
              <div>
                <span className="text-[#292D40]/60 block text-[10px] uppercase">Title:</span>
                <span className="font-semibold text-[#24283A]">{title}</span>
              </div>
              <div>
                <span className="text-[#292D40]/60 block text-[10px] uppercase">Audience:</span>
                <span className="font-medium text-[#24283A]">
                  {audienceType === "ALL_STUDENTS"
                    ? "All Enrolled Students"
                    : audienceType === "DEPARTMENT"
                    ? `Department: ${selectedDept?.name}`
                    : `${selectedStudentIds.length} Selected Students`}
                </span>
              </div>
              {actionUrl.trim() && (
                <div>
                  <span className="text-[#292D40]/60 block text-[10px] uppercase">Destination:</span>
                  <span className="font-mono text-[#5052C9]">{actionUrl}</span>
                </div>
              )}
            </div>

            {errorMessage && (
              <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {errorMessage}
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setIsConfirmOpen(false)}
              className="border-[#DDDCD5] text-[#24283A]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleBroadcastConfirm}
              className="bg-[#5052C9] hover:bg-[#4345B0] text-white"
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Broadcasting...
                </span>
              ) : (
                "Yes, Broadcast Now"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
