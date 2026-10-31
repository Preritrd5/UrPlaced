"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Calendar,
  Clock,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Filter,
  Sparkles,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function StudentDrivesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role } = useAuthContext();

  const [drives, setDrives] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ELIGIBLE" | "APPLIED">("ALL");

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role !== "STUDENT") {
        router.push("/dashboard/drives");
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, router]);

  const loadDrives = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter !== "ALL") params.set("filter", filter);

      const res = await fetch(`/api/student/drives?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load recruitment drives.");
      }
      const data = await res.json();
      setDrives(data.drives || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [search, filter]);

  useEffect(() => {
    if (isAuthenticated && role === "STUDENT") {
      loadDrives();
    }
  }, [loadDrives, isAuthenticated, role]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Briefcase className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
              Campus Recruitment Drives
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            Explore verified corporate placement opportunities, verify eligibility, and submit applications.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/student/applications">
            View My Applications <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
          </Link>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by role, company name, or technology sector..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Button
                variant={filter === "ALL" ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilter("ALL")}
                className="h-9 text-xs whitespace-nowrap"
              >
                All Opportunities
              </Button>
              <Button
                variant={filter === "ELIGIBLE" ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilter("ELIGIBLE")}
                className="h-9 text-xs whitespace-nowrap"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Eligible for Me
              </Button>
              <Button
                variant={filter === "APPLIED" ? "primary" : "outline"}
                size="sm"
                onClick={() => setFilter("APPLIED")}
                className="h-9 text-xs whitespace-nowrap"
              >
                Already Applied
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Drives Grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="h-56 animate-pulse bg-card/60" />
          ))}
        </div>
      ) : drives.length === 0 ? (
        <Card className="text-center py-12 text-text-muted space-y-3">
          <Briefcase className="h-10 w-10 mx-auto opacity-30" />
          <div className="space-y-1">
            <p className="font-semibold text-text-primary text-sm">No recruitment drives found</p>
            <p className="text-xs text-text-secondary">
              {filter === "ELIGIBLE"
                ? "No published drives match your current academic criteria."
                : filter === "APPLIED"
                ? "You haven't submitted any drive applications yet."
                : "Check back later when your college placement cell publishes new drives."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {drives.map((drive) => {
            const isEligible = drive.eligibility?.isEligible;
            return (
              <Card
                key={drive.id}
                className="flex flex-col justify-between hover:border-primary/50 transition-all shadow-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                        <Building2 className="h-3.5 w-3.5 text-text-muted shrink-0" />
                        <span className="font-medium truncate">{drive.company?.name}</span>
                      </div>
                      <CardTitle className="text-base font-bold font-heading text-text-primary truncate">
                        <Link
                          href={`/dashboard/student/drives/${drive.id}`}
                          className="hover:text-primary transition-colors hover:underline"
                        >
                          {drive.roleTitle}
                        </Link>
                      </CardTitle>
                    </div>

                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono shrink-0 uppercase tracking-wider"
                    >
                      {drive.recruitmentType === "FULL_TIME"
                        ? "FTE"
                        : drive.recruitmentType === "INTERNSHIP"
                        ? "Intern"
                        : "Intern+FTE"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-0">
                  <div className="space-y-2 text-xs">
                    {/* Compensation & Location */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-secondary font-mono font-bold text-sm">
                        {drive.compensationRange || "Competitive"}
                      </span>
                      <span className="text-text-muted text-[11px] truncate max-w-[140px]">
                        {drive.location || "On-Campus"}
                      </span>
                    </div>

                    {/* Eligibility Status Pill */}
                    <div className="p-2 rounded-lg bg-input border border-border flex items-center justify-between text-xs">
                      <span className="text-[11px] text-text-secondary">Your Eligibility:</span>
                      {drive.hasApplied ? (
                        <Badge variant="default" className="text-[10px]">
                          Applied ({drive.applicationStatus})
                        </Badge>
                      ) : isEligible ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-secondary">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Eligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                          <XCircle className="h-3.5 w-3.5" /> Not Eligible
                        </span>
                      )}
                    </div>

                    {/* Deadline */}
                    {drive.registrationDeadline && (
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted font-mono">
                        <Clock className="h-3 w-3" />
                        <span>
                          {drive.isDeadlinePassed
                            ? "Deadline passed"
                            : `Deadline: ${new Date(drive.registrationDeadline).toLocaleDateString()}`}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-2 border-t border-border flex items-center justify-between">
                    <Button asChild variant="primary" size="sm" className="w-full text-xs">
                      <Link href={`/dashboard/student/drives/${drive.id}`}>
                        {drive.hasApplied
                          ? "Track Application"
                          : drive.isRegistrationOpen && isEligible
                          ? "Apply Now"
                          : "View Details"}
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
