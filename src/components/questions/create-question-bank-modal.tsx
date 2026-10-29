"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, FolderPlus, Loader2, AlertCircle, BookOpen } from "lucide-react";
import { BankCategory, BankSharingPolicy } from "@/types/database";
import {
  STANDARD_SUBJECTS,
  getDefaultCategoryForSubject,
  normalizeSubjectName,
} from "@/modules/question-bank/services/subject-constants";

interface CreateQuestionBankModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newBank: any) => void;
}

const CATEGORY_OPTIONS: { value: BankCategory; label: string; desc: string }[] = [
  { value: "CODING", label: "Coding & Algorithms", desc: "Data structures, algorithmic problems & code test cases" },
  { value: "APTITUDE", label: "Quantitative & Logical Aptitude", desc: "Quant, analytical reasoning, and data interpretation" },
  { value: "TECHNICAL_CORE", label: "Technical Core Concepts", desc: "Computer systems, OS, DBMS, networking, and architecture" },
  { value: "BEHAVIORAL", label: "Behavioral & HR Readiness", desc: "Situational judgment, communication, and corporate etiquette" },
  { value: "GENERAL", label: "General Placement Knowledge", desc: "Verbal ability, reading comprehension, and general aptitude" },
  { value: "COMPANY_SPECIFIC", label: "Company-Specific Recruitment", desc: "Past pattern tests aligned with specific hiring partners" },
];

const SHARING_OPTIONS: { value: BankSharingPolicy; label: string; desc: string }[] = [
  { value: "COLLEGE_PRIVATE", label: "Private to College / Cell (Default)", desc: "Accessible only within your institution" },
  { value: "EXPLICITLY_SHARED", label: "Partner Shared", desc: "Shared with verified partnered institutions" },
  { value: "GLOBAL_SHARED", label: "Platform Global", desc: "Available for platform-wide assessment catalog" },
];

export function CreateQuestionBankModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateQuestionBankModalProps) {
  const [subjectMode, setSubjectMode] = useState<string>("");
  const [customSubject, setCustomSubject] = useState("");
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BankCategory>("CODING");
  const [description, setDescription] = useState("");
  const [sharingPolicy, setSharingPolicy] = useState<BankSharingPolicy>("COLLEGE_PRIVATE");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
    setSubjectMode("");
    setCustomSubject("");
    setName("");
    setCategory("CODING");
    setDescription("");
    setSharingPolicy("COLLEGE_PRIVATE");
    setErrorMsg(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleSubjectChange = (newSubjectMode: string) => {
    setSubjectMode(newSubjectMode);
    if (newSubjectMode && newSubjectMode !== "CUSTOM") {
      const standard = STANDARD_SUBJECTS.find((s) => s.canonicalName === newSubjectMode);
      if (standard) {
        setCategory(standard.defaultCategory);
        // If current name matches another standard subject or is empty, suggest the new subject as name
        const isStandardName = STANDARD_SUBJECTS.some((s) => s.canonicalName === name) || !name.trim();
        if (isStandardName) {
          setName(standard.canonicalName);
        }
      }
    } else if (newSubjectMode === "CUSTOM") {
      if (customSubject.trim() && (!name.trim() || STANDARD_SUBJECTS.some((s) => s.canonicalName === name))) {
        setName(customSubject.trim());
      }
    }
  };

  const handleCustomSubjectChange = (val: string) => {
    setCustomSubject(val);
    if (!name.trim() || STANDARD_SUBJECTS.some((s) => s.canonicalName === name)) {
      setName(val);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg("Please enter a valid Question Bank name.");
      return;
    }

    if (cleanName.length > 256) {
      setErrorMsg("Question Bank name cannot exceed 256 characters.");
      return;
    }

    setIsSubmitting(true);

    const payload: Record<string, any> = {
      name: cleanName,
      category,
      description: description.trim() || undefined,
      sharing_policy: sharingPolicy,
    };

    if (subjectMode && subjectMode !== "CUSTOM") {
      payload.subject = subjectMode;
    } else if (subjectMode === "CUSTOM" && customSubject.trim()) {
      payload.subject = normalizeSubjectName(customSubject.trim());
    }

    try {
      const res = await fetch("/api/questions/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create Question Bank.");
      }

      // Success
      resetForm();
      onSuccess(data);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred while creating the Question Bank.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bank-modal-title"
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150 my-4 sm:my-8 max-h-[92dvh]">
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[#5052C9]/10 text-[#5052C9] shrink-0">
              <FolderPlus className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="create-bank-modal-title"
                className="text-lg sm:text-xl font-bold font-heading text-text-primary tracking-tight"
              >
                Create Question Bank
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Establish a subject-organized repository for college questions and assessments.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-input transition-colors disabled:opacity-50"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden min-h-0">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            {errorMsg && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs sm:text-sm flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

          {/* Academic Subject */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="bank-subject-select" required className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#5052C9]" />
                Academic Subject
              </Label>
              <span className="text-[11px] text-text-secondary">Defines syllabus scope</span>
            </div>
            <select
              id="bank-subject-select"
              value={subjectMode}
              onChange={(e) => handleSubjectChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[#5052C9]/20 focus:border-[#5052C9] transition-colors"
            >
              <option value="">Select Academic Subject (e.g. Computer Networks, DBMS, DSA)...</option>
              {STANDARD_SUBJECTS.map((sub) => (
                <option key={sub.canonicalName} value={sub.canonicalName}>
                  {sub.canonicalName} ({sub.code})
                </option>
              ))}
              <option value="CUSTOM">+ Other / Custom Academic Subject...</option>
            </select>
          </div>

          {/* Custom Subject Input if selected */}
          {subjectMode === "CUSTOM" && (
            <div className="space-y-1.5 animate-in fade-in-50">
              <Label htmlFor="bank-custom-subject" required className="text-xs font-bold text-text-primary">
                Custom Subject Name
              </Label>
              <Input
                id="bank-custom-subject"
                type="text"
                placeholder="e.g. Cloud Computing, Computer Architecture, Machine Learning"
                value={customSubject}
                onChange={(e) => handleCustomSubjectChange(e.target.value)}
                disabled={isSubmitting}
                required
                maxLength={128}
                className="bg-input border-border text-sm rounded-xl h-10 focus-visible:ring-[#5052C9]"
                autoFocus
              />
            </div>
          )}

          {/* Question Bank Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-name" required className="text-xs font-bold text-text-primary">
              Question Bank Name
            </Label>
            <Input
              id="bank-name"
              type="text"
              placeholder="e.g. Computer Networks, DSA - Fall 2026, Core DBMS"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
              maxLength={256}
              className="bg-input border-border text-sm rounded-xl h-10 focus-visible:ring-[#5052C9]"
            />
            <p className="text-[11px] text-text-secondary">
              A distinctive name for this Question Bank container.
            </p>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-category" required className="text-xs font-bold text-text-primary">
              Broad Category
            </Label>
            <select
              id="bank-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as BankCategory)}
              disabled={isSubmitting}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[#5052C9]/20 focus:border-[#5052C9] transition-colors"
              required
            >
              {CATEGORY_OPTIONS.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-text-secondary">
              {CATEGORY_OPTIONS.find((c) => c.value === category)?.desc}
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-description" className="text-xs font-bold text-text-primary">
              Description <span className="text-text-secondary font-normal">(Optional)</span>
            </Label>
            <textarea
              id="bank-description"
              rows={2}
              placeholder="e.g. Curated placement questions covering OSI layers, TCP/IP, routing algorithms, and subnetting."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              maxLength={1000}
              className="w-full p-3 rounded-xl bg-input border border-border text-sm text-text-primary placeholder:text-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-[#5052C9]/20 focus:border-[#5052C9] transition-colors resize-none"
            />
          </div>

          {/* Sharing Policy */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-sharing" className="text-xs font-bold text-text-primary">
              Sharing Policy
            </Label>
            <select
              id="bank-sharing"
              value={sharingPolicy}
              onChange={(e) => setSharingPolicy(e.target.value as BankSharingPolicy)}
              disabled={isSubmitting}
              className="w-full h-10 px-3 rounded-xl bg-input border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-[#5052C9]/20 focus:border-[#5052C9] transition-colors"
            >
              {SHARING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-text-secondary">
              {SHARING_OPTIONS.find((s) => s.value === sharingPolicy)?.desc}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 sm:p-5 border-t border-border bg-card shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-xl text-xs sm:text-sm h-10 px-4 w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="bg-primary hover:bg-primary-hover text-white rounded-xl text-xs sm:text-sm h-10 px-5 flex items-center justify-center gap-2 font-semibold shadow-sm w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Creating Bank...</span>
              </>
            ) : (
              <>
                <FolderPlus className="w-4 h-4" />
                <span>Create Question Bank</span>
              </>
            )}
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}
