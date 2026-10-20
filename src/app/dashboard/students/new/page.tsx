"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuthContext } from "@/lib/auth/auth-context-provider";

export default function NewStudentPage() {
  const router = useRouter();
  const { role, isLoading: isLoadingAuth } = useAuthContext();
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageStudents = role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF"].includes(role);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageStudents) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageStudents, isLoadingAuth, router]);

  const [formData, setFormData] = useState({
    enrollmentNumber: "",
    fullName: "",
    email: "",
    phone: "",
    departmentId: "",
    graduationYear: new Date().getFullYear().toString(),
    degree: "B.Tech",
    cgpa: "",
    tenthPercentage: "",
    twelfthPercentage: "",
    activeBacklogs: "0",
    totalBacklogs: "0",
    skills: "",
  });

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const res = await fetch("/api/placement/departments");
        if (res.ok) {
          const data = await res.json();
          setDepartments(data);
          if (data.length > 0) {
            setFormData((prev) => ({ ...prev, departmentId: data[0].id }));
          }
        }
      } catch {
        // Handle error silently
      }
    }
    fetchDepartments();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        graduationYear: parseInt(formData.graduationYear, 10),
        cgpa: parseFloat(formData.cgpa),
        tenthPercentage: formData.tenthPercentage ? parseFloat(formData.tenthPercentage) : null,
        twelfthPercentage: formData.twelfthPercentage ? parseFloat(formData.twelfthPercentage) : null,
        activeBacklogs: parseInt(formData.activeBacklogs, 10) || 0,
        totalBacklogs: parseInt(formData.totalBacklogs, 10) || 0,
        skills: formData.skills
          ? formData.skills.split(";").map((s) => s.trim()).filter(Boolean)
          : [],
      };

      const res = await fetch("/api/placement/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create student record.");
      }

      router.push(`/dashboard/students/${data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoadingAuth || !canManageStudents) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/students">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Directory
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Add New Student</CardTitle>
          <CardDescription>
            Register an individual student profile for placement eligibility evaluation and drive participation.
          </CardDescription>
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
                  Enrollment / Roll ID *
                </label>
                <Input
                  required
                  placeholder="e.g. EN2026042"
                  value={formData.enrollmentNumber}
                  onChange={(e) => setFormData({ ...formData, enrollmentNumber: e.target.value })}
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Full Name *
                </label>
                <Input
                  required
                  placeholder="e.g. Rahul Verma"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Institutional Email *
                </label>
                <Input
                  type="email"
                  required
                  placeholder="e.g. rahul@college.edu"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Contact Phone
                </label>
                <Input
                  placeholder="e.g. +91 9876543210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Department / Branch *
                </label>
                <select
                  required
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                >
                  {departments.length === 0 ? (
                    <option value="">No departments found</option>
                  ) : (
                    departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code} — {d.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Graduation Year *
                </label>
                <Input
                  type="number"
                  required
                  min="2000"
                  max="2050"
                  value={formData.graduationYear}
                  onChange={(e) => setFormData({ ...formData, graduationYear: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Degree Program *
                </label>
                <Input
                  required
                  placeholder="e.g. B.Tech"
                  value={formData.degree}
                  onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Current CGPA (0.00 - 10.00) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  required
                  placeholder="8.50"
                  value={formData.cgpa}
                  onChange={(e) => setFormData({ ...formData, cgpa: e.target.value })}
                  className="text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  10th Percentage (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 91.5"
                  value={formData.tenthPercentage}
                  onChange={(e) => setFormData({ ...formData, tenthPercentage: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  12th Percentage (%)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="e.g. 88.0"
                  value={formData.twelfthPercentage}
                  onChange={(e) => setFormData({ ...formData, twelfthPercentage: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Active Backlogs Count
                </label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={formData.activeBacklogs}
                  onChange={(e) => setFormData({ ...formData, activeBacklogs: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary">
                  Total History Backlogs Count
                </label>
                <Input
                  type="number"
                  min="0"
                  required
                  value={formData.totalBacklogs}
                  onChange={(e) => setFormData({ ...formData, totalBacklogs: e.target.value })}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-primary">
                Skills (Semicolon-separated)
              </label>
              <Input
                placeholder="e.g. Java; Python; React; SQL; AWS"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className="text-xs"
              />
              <p className="text-[10px] text-text-muted">Separate multiple skills with semicolons (;)</p>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/students">Cancel</Link>
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={isLoading}>
                <Save className="h-4 w-4 mr-1.5" />
                {isLoading ? "Saving Student..." : "Create Student Record"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
