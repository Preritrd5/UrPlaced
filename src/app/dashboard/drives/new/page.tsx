"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save, AlertCircle, Briefcase } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

function NewDriveForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCompanyId = searchParams.get("companyId") || "";

  const [companies, setCompanies] = useState<any[]>([]);
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    companyId: preselectedCompanyId,
    academicYearId: "",
    title: "",
    roleTitle: "",
    recruitmentType: "FULL_TIME",
    jobDescription: "",
    location: "On-Campus / Remote",
    compensationRange: "",
    registrationStart: "",
    registrationDeadline: "",
    internalNotes: "",
  });

  useEffect(() => {
    async function loadData() {
      try {
        const [compRes, yearsRes] = await Promise.all([
          fetch("/api/placement/companies?pageSize=100"),
          fetch("/api/placement/academic-years"),
        ]);

        if (compRes.ok) {
          const compData = await compRes.json();
          setCompanies(compData.companies || []);
          if (!preselectedCompanyId && compData.companies?.length > 0) {
            setFormData((prev) => ({ ...prev, companyId: compData.companies[0].id }));
          }
        }

        if (yearsRes.ok) {
          const yearsData = await yearsRes.json();
          setAcademicYears(yearsData || []);
          const activeYear = yearsData.find((y: any) => y.status === "ACTIVE");
          if (activeYear) {
            setFormData((prev) => ({ ...prev, academicYearId: activeYear.id }));
          } else if (yearsData.length > 0) {
            setFormData((prev) => ({ ...prev, academicYearId: yearsData[0].id }));
          }
        }
      } catch {
        // Handle error silently
      }
    }
    loadData();
  }, [preselectedCompanyId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/placement/drives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          registrationStart: formData.registrationStart ? new Date(formData.registrationStart).toISOString() : null,
          registrationDeadline: formData.registrationDeadline ? new Date(formData.registrationDeadline).toISOString() : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create recruitment drive.");
      }

      router.push(`/dashboard/drives/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/drives">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Drives
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-xl">Launch Recruitment Drive</CardTitle>
              <CardDescription>
                Initial drive draft. You will configure eligibility criteria and recruitment stages in the next step.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Validation Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Hiring Company *
                </label>
                <select
                  required
                  value={formData.companyId}
                  onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                >
                  {companies.length === 0 ? (
                    <option value="">No companies registered</option>
                  ) : (
                    companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Academic Year / Cycle *
                </label>
                <select
                  required
                  value={formData.academicYearId}
                  onChange={(e) => setFormData({ ...formData, academicYearId: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                >
                  {academicYears.length === 0 ? (
                    <option value="">No academic years configured</option>
                  ) : (
                    academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name} {y.status === "ACTIVE" ? "(Active)" : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Drive Title *
                </label>
                <Input
                  required
                  placeholder="e.g. Software Engineer - 2026 Campus Drive"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Role / Position Title *
                </label>
                <Input
                  required
                  placeholder="e.g. Graduate Software Development Engineer (SDE)"
                  value={formData.roleTitle}
                  onChange={(e) => setFormData({ ...formData, roleTitle: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Recruitment Category
                </label>
                <select
                  value={formData.recruitmentType}
                  onChange={(e) => setFormData({ ...formData, recruitmentType: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                >
                  <option value="FULL_TIME">Full-Time (FTE)</option>
                  <option value="INTERNSHIP">Internship</option>
                  <option value="INTERN_TO_FTE">Intern to FTE</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Compensation Range / CTC
                </label>
                <Input
                  placeholder="e.g. ₹9,00,000 - ₹14,00,000 CTC"
                  value={formData.compensationRange}
                  onChange={(e) => setFormData({ ...formData, compensationRange: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Work Location / Mode
                </label>
                <Input
                  placeholder="e.g. Bengaluru, India (Hybrid)"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Registration Opening Date &amp; Time
                </label>
                <Input
                  type="datetime-local"
                  value={formData.registrationStart}
                  onChange={(e) => setFormData({ ...formData, registrationStart: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Registration Deadline
                </label>
                <Input
                  type="datetime-local"
                  value={formData.registrationDeadline}
                  onChange={(e) => setFormData({ ...formData, registrationDeadline: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Job Description &amp; Requirements
              </label>
              <textarea
                rows={4}
                placeholder="Key responsibilities, qualification expectations, technical skills required..."
                value={formData.jobDescription}
                onChange={(e) => setFormData({ ...formData, jobDescription: e.target.value })}
                className="w-full rounded-lg border border-border bg-input p-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Restricted Internal Notes
              </label>
              <Input
                placeholder="Targeting top 15% batch, expected to hire 10-15 candidates..."
                value={formData.internalNotes}
                onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                className="text-xs"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/drives">Cancel</Link>
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
                <Save className="h-4 w-4 mr-1.5" />
                {isLoading ? "Creating Draft Drive..." : "Create Draft Drive"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewDrivePage() {
  return (
    <React.Suspense
      fallback={
        <div className="max-w-3xl mx-auto py-12 text-center text-xs text-text-muted">
          Loading drive form...
        </div>
      }
    >
      <NewDriveForm />
    </React.Suspense>
  );
}

