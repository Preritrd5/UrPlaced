"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, FolderPlus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { BankCategory, BankSharingPolicy } from "@/types/database";

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
  const [name, setName] = useState("");
  const [category, setCategory] = useState<BankCategory>("CODING");
  const [description, setDescription] = useState("");
  const [sharingPolicy, setSharingPolicy] = useState<BankSharingPolicy>("COLLEGE_PRIVATE");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetForm = () => {
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

    try {
      const res = await fetch("/api/questions/banks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          category,
          description: description.trim() || undefined,
          sharing_policy: sharingPolicy,
        }),
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-bank-modal-title"
    >
      <div className="bg-card w-full max-w-lg rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 border-b border-border bg-card">
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
                Establish a repository container for college questions and assessments.
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
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 text-xs sm:text-sm flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-name" required className="text-xs font-bold text-text-primary">
              Question Bank Name
            </Label>
            <Input
              id="bank-name"
              type="text"
              placeholder="e.g. Data Structures & Algorithms, Core Java, Quantitative Aptitude"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              required
              maxLength={256}
              className="bg-input border-border text-sm rounded-xl h-10 focus-visible:ring-[#5052C9]"
              autoFocus
            />
            <p className="text-[11px] text-text-secondary">
              A distinctive title identifying the topic or syllabus scope.
            </p>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="bank-category" required className="text-xs font-bold text-text-primary">
              Subject Category
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
              rows={3}
              placeholder="e.g. Curated campus placement questions covering binary trees, heaps, dynamic programming, and graphs."
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

          {/* Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-xl text-xs sm:text-sm h-10 px-4"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary-hover text-white rounded-xl text-xs sm:text-sm h-10 px-5 flex items-center gap-2 font-semibold shadow-sm"
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
