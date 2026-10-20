"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  School,
  Calendar,
  Building2,
  PlusCircle,
  Save,
  CheckCircle2,
  AlertCircle,
  Check,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuthContext } from "@/lib/auth/auth-context-provider";

export default function AcademicSettingsPage() {
  const router = useRouter();
  const { role, isVerifiedMembership, isLoading: isLoadingAuth } = useAuthContext();
  const [academicYears, setAcademicYears] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canManageAcademic = !!isVerifiedMembership && role === "PLACEMENT_HEAD";

  useEffect(() => {
    if (!isLoadingAuth) {
      if (role === "STUDENT") {
        router.replace("/dashboard/student");
      } else if (!canManageAcademic) {
        router.replace("/auth/access-denied");
      }
    }
  }, [role, canManageAcademic, isLoadingAuth, router]);

  // New Year Form
  const [newYear, setNewYear] = useState({
    name: "",
    startDate: "",
    endDate: "",
    status: "PLANNED",
  });

  // New Dept Form
  const [newDept, setNewDept] = useState({
    name: "",
    code: "",
  });

  async function loadData() {
    setIsLoading(true);
    try {
      const [yearsRes, deptsRes] = await Promise.all([
        fetch("/api/placement/academic-years"),
        fetch("/api/placement/departments"),
      ]);

      if (yearsRes.ok) setAcademicYears(await yearsRes.json());
      if (deptsRes.ok) setDepartments(await deptsRes.json());
    } catch {
      // Handle error silently
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreateYear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/placement/academic-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newYear),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create academic year.");

      setSuccess(`Academic year '${newYear.name}' created.`);
      setNewYear({ name: "", startDate: "", endDate: "", status: "PLANNED" });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCreateDept(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/placement/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newDept),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create department.");

      setSuccess(`Department '${newDept.name}' (${newDept.code}) added.`);
      setNewDept({ name: "", code: "" });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (isLoadingAuth || !canManageAcademic) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight font-heading text-text-primary">
          Academic Structure Configuration
        </h1>
        <p className="text-xs text-text-secondary">
          Configure institutional recruitment cycles, academic batches, and degree departments.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Configuration Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="bg-[rgba(46,143,134,0.08)] border-secondary/30">
          <CheckCircle2 className="h-4 w-4 text-secondary" />
          <AlertTitle className="text-secondary font-semibold">Updated</AlertTitle>
          <AlertDescription className="text-text-primary">{success}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Academic Years Management */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Academic Years ({academicYears.length})
              </CardTitle>
              <CardDescription>Recruitment calendar periods</CardDescription>
            </CardHeader>
            <CardContent>
              {academicYears.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  No academic cycles configured yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {academicYears.map((yr) => (
                    <div
                      key={yr.id}
                      className="p-3 rounded-lg border border-border bg-input flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-text-primary">{yr.name}</div>
                        <span className="text-[10px] text-text-muted font-mono">
                          {yr.start_date} to {yr.end_date}
                        </span>
                      </div>
                      <Badge variant={yr.status === "ACTIVE" ? "success" : "secondary"} className="text-[10px]">
                        {yr.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Academic Year */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Academic Year</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateYear} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-primary">Year Label *</label>
                  <Input
                    required
                    placeholder="e.g. 2026-2027"
                    value={newYear.name}
                    onChange={(e) => setNewYear({ ...newYear, name: e.target.value })}
                    className="text-xs font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">Start Date *</label>
                    <Input
                      type="date"
                      required
                      value={newYear.startDate}
                      onChange={(e) => setNewYear({ ...newYear, startDate: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-text-primary">End Date *</label>
                    <Input
                      type="date"
                      required
                      value={newYear.endDate}
                      onChange={(e) => setNewYear({ ...newYear, endDate: e.target.value })}
                      className="text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="primary" size="sm">
                    <PlusCircle className="h-4 w-4 mr-1" /> Add Year
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Academic Departments Management */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <School className="h-4 w-4 text-secondary" />
                Departments &amp; Branches ({departments.length})
              </CardTitle>
              <CardDescription>Academic units eligible for placement</CardDescription>
            </CardHeader>
            <CardContent>
              {departments.length === 0 ? (
                <div className="text-center py-6 text-text-muted text-xs">
                  No departments created yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {departments.map((d) => (
                    <div
                      key={d.id}
                      className="p-3 rounded-lg border border-border bg-input flex items-center justify-between"
                    >
                      <div>
                        <div className="font-semibold text-xs text-text-primary">{d.name}</div>
                        <span className="text-[10px] text-text-muted font-mono">{d.code}</span>
                      </div>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {d.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Create Department */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Department / Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateDept} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-primary">Department Name *</label>
                  <Input
                    required
                    placeholder="e.g. Information Technology"
                    value={newDept.name}
                    onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-text-primary">Department Code *</label>
                  <Input
                    required
                    placeholder="e.g. IT"
                    value={newDept.code}
                    onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
                    className="text-xs font-mono uppercase"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="secondary" size="sm">
                    <PlusCircle className="h-4 w-4 mr-1" /> Add Department
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
