"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Edit, Archive, RefreshCw, X, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { confirmDialog, toast } from "@/components/ui/dialog-system";

interface CompanyDetailActionsProps {
  company: {
    id: string;
    name: string;
    website?: string | null;
    industry?: string | null;
    contact_person?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    internal_notes?: string | null;
    is_archived?: boolean;
  };
  canManage: boolean;
}

export function CompanyDetailActions({ company, canManage }: CompanyDetailActionsProps) {
  const router = useRouter();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: company.name,
    website: company.website || "",
    industry: company.industry || "",
    contactPerson: company.contact_person || "",
    contactEmail: company.contact_email || "",
    contactPhone: company.contact_phone || "",
    internalNotes: company.internal_notes || "",
  });

  if (!canManage) return null;

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/placement/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update company.");
      }

      setIsEditOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchiveToggle() {
    const actionLabel = company.is_archived ? "reactivate" : "archive";
    const confirmed = await confirmDialog({
      title: `${company.is_archived ? "Reactivate" : "Archive"} Company`,
      description: `Are you sure you want to ${actionLabel} ${company.name}? ${
        company.is_archived
          ? "The company will reappear in active recruitment lists."
          : "The company will be moved to archived records."
      }`,
      confirmText: company.is_archived ? "Reactivate" : "Archive",
      variant: company.is_archived ? "primary" : "destructive",
    });
    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (company.is_archived) {
        // Unarchive
        const res = await fetch(`/api/placement/companies/${company.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isArchived: false }),
        });
        if (!res.ok) throw new Error("Failed to reactivate company.");
        toast.success(`${company.name} reactivated successfully.`);
      } else {
        // Archive
        const res = await fetch(`/api/placement/companies/${company.id}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to archive company.");
        toast.success(`${company.name} archived.`);
      }

      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update company status.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsEditOpen(true)}
          className="h-8 text-xs"
        >
          <Edit className="h-3.5 w-3.5 mr-1" /> Edit Profile
        </Button>

        <Button
          variant={company.is_archived ? "outline" : "outline"}
          size="sm"
          onClick={handleArchiveToggle}
          disabled={isSubmitting}
          className={`h-8 text-xs ${
            company.is_archived
              ? "text-secondary hover:bg-secondary/10"
              : "text-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
          }`}
        >
          {company.is_archived ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Restore Partner
            </>
          ) : (
            <>
              <Archive className="h-3.5 w-3.5 mr-1" /> Archive Partner
            </>
          )}
        </Button>
      </div>

      {/* Edit Modal Backdrop */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(36,40,58,0.50)] backdrop-blur-sm p-3 sm:p-4 flex min-h-full items-start justify-center">
          <Card className="w-full max-w-lg min-h-0 max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden shadow-xl border-border bg-card my-auto">
            <CardHeader className="shrink-0 flex flex-row items-center justify-between pb-3 border-b border-border">
              <div>
                <CardTitle className="text-base font-bold font-heading">Edit Company Profile</CardTitle>
                <CardDescription className="text-xs">
                  Update corporate placement details and recruiter contact information.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditOpen(false)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <form onSubmit={handleUpdate} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3.5 text-xs">
                {error && (
                  <Alert variant="destructive" className="py-2 text-xs">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Company Name *</label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-text-primary">Industry / Sector</label>
                    <Input
                      placeholder="e.g. Technology, Finance"
                      value={formData.industry}
                      onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-text-primary">Website</label>
                    <Input
                      placeholder="https://..."
                      value={formData.website}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="font-semibold text-text-primary">Contact Person</label>
                    <Input
                      placeholder="Recruiter Name"
                      value={formData.contactPerson}
                      onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-text-primary">Contact Email</label>
                    <Input
                      type="email"
                      placeholder="recruiter@company.com"
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Contact Phone</label>
                  <Input
                    placeholder="+91..."
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-text-primary">Internal Notes (Confidential)</label>
                  <textarea
                    rows={3}
                    placeholder="Notes for college placement team..."
                    value={formData.internalNotes}
                    onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                    className="w-full rounded-md border border-border bg-input p-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </div>
              </CardContent>

              <div className="shrink-0 p-3.5 sm:p-4 border-t border-border bg-surface/50 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSubmitting}
                  isLoading={isSubmitting}
                >
                  {!isSubmitting && <Save className="h-3.5 w-3.5 mr-1" />}
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}
