"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Search,
  Filter,
  DollarSign,
  Download,
  Briefcase,
  Users,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DetailViewSkeleton } from "@/components/ui/page-skeletons";

export default function CollegeOffersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role } = useAuthContext();

  const isStaff = Boolean(role && ["PLACEMENT_HEAD", "PLACEMENT_STAFF"].includes(role));

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role === "STUDENT") {
        router.push("/dashboard/student/offers");
      } else if (!isStaff) {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, isStaff, router]);

  const [offersData, setOffersData] = useState<{
    offers: any[];
    metrics: {
      totalOffers: number;
      acceptedCount: number;
      declinedCount: number;
      pendingCount: number;
      highestCtc: number;
      averageCtc: number;
    };
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const loadOffers = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/placement/offers?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to load placement offers.");
      }
      const data = await res.json();
      setOffersData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isAuthenticated && isStaff) {
      loadOffers();
    }
  }, [loadOffers, isAuthenticated, isStaff]);

  if (isLoading || isLoadingAuth) {
    return <DetailViewSkeleton />;
  }

  const offers = offersData?.offers || [];
  const metrics = offersData?.metrics || {
    totalOffers: 0,
    acceptedCount: 0,
    declinedCount: 0,
    pendingCount: 0,
    highestCtc: 0,
    averageCtc: 0,
  };

  const filteredOffers = offers.filter((o) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      o.student?.full_name?.toLowerCase().includes(term) ||
      o.student?.enrollment_number?.toLowerCase().includes(term) ||
      o.drive?.company?.name?.toLowerCase().includes(term) ||
      o.drive?.role_title?.toLowerCase().includes(term)
    );
  });

  const formatCurrency = (amount: number | null | undefined) => {
    if (!amount) return "—";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const acceptanceRate =
    metrics.totalOffers > 0
      ? Math.round((metrics.acceptedCount / metrics.totalOffers) * 100)
      : 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-secondary/10 text-secondary">
              <Award className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
              Placement Offers &amp; Outcomes
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            Comprehensive college directory of verified hiring offers, compensation packages, and student acceptance decisions.
          </p>
        </div>

        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/drives">
            <Briefcase className="h-3.5 w-3.5 mr-1.5" /> Manage Drives
          </Link>
        </Button>
      </div>

      {/* Institutional Placement Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3">
          <span className="text-[10px] font-mono uppercase text-text-muted">Total Offers</span>
          <div className="text-xl font-bold font-heading text-text-primary">{metrics.totalOffers}</div>
        </Card>
        <Card className="p-3 border-secondary/30 bg-secondary/5">
          <span className="text-[10px] font-mono uppercase text-secondary">Accepted Offers</span>
          <div className="text-xl font-bold font-heading text-secondary">{metrics.acceptedCount}</div>
        </Card>
        <Card className="p-3">
          <span className="text-[10px] font-mono uppercase text-text-muted">Acceptance Rate</span>
          <div className="text-xl font-bold font-heading text-text-primary">{acceptanceRate}%</div>
        </Card>
        <Card className="p-3">
          <span className="text-[10px] font-mono uppercase text-text-muted">Highest Package</span>
          <div className="text-xl font-bold font-mono text-secondary">
            {formatCurrency(metrics.highestCtc)}
          </div>
        </Card>
        <Card className="p-3 border-primary/30 bg-primary/5">
          <span className="text-[10px] font-mono uppercase text-primary">Average CTC</span>
          <div className="text-xl font-bold font-mono text-primary">
            {formatCurrency(metrics.averageCtc)}
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by student name, roll number, or company..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              >
                <option value="ALL">All Statuses</option>
                <option value="OFFERED">Response Pending (Offered)</option>
                <option value="ACCEPTED">Accepted</option>
                <option value="DECLINED">Declined</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offers Data Table */}
      <Card>
        <CardHeader className="py-4 border-b border-border">
          <CardTitle className="text-base">Placement Records ({filteredOffers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredOffers.length === 0 ? (
            <div className="py-12 text-center text-text-muted text-xs">
              No placement offers match your search or filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-input text-text-secondary font-mono border-b border-border uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Student</th>
                    <th className="py-3 px-4">Roll Number</th>
                    <th className="py-3 px-4">Dept</th>
                    <th className="py-3 px-4">Hiring Company</th>
                    <th className="py-3 px-4">Role Title</th>
                    <th className="py-3 px-4">Package (CTC)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Offered Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredOffers.map((offer) => (
                    <tr key={offer.id} className="hover:bg-input/50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-text-primary">
                        {offer.student?.full_name}
                      </td>
                      <td className="py-3 px-4 font-mono text-text-muted">
                        {offer.student?.enrollment_number}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {offer.student?.department?.code || "—"}
                      </td>
                      <td className="py-3 px-4 font-medium text-text-primary">
                        {offer.drive?.company?.name || "Corporate Partner"}
                      </td>
                      <td className="py-3 px-4 text-text-secondary">
                        {offer.drive?.role_title}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-secondary">
                        {formatCurrency(offer.compensation_amount)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            offer.status === "ACCEPTED"
                              ? "success"
                              : offer.status === "DECLINED"
                              ? "danger"
                              : "default"
                          }
                          className="text-[10px]"
                        >
                          {offer.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono text-text-muted text-[11px]">
                        {new Date(offer.offered_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
