"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Bell,
  Calendar,
  Clock,
  Search,
  ArrowRight,
  ExternalLink,
  Building2,
  CheckCircle2,
  AlertCircle,
  Briefcase,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonCard } from "@/components/ui/skeleton";

export default function StudentAnnouncementsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role, tenant } = useAuthContext();

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role !== "STUDENT") {
        router.push("/dashboard/announcements");
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, router]);

  const loadAnnouncements = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/student/announcements");
      if (!res.ok) {
        throw new Error("Failed to load college announcements.");
      }
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && role === "STUDENT") {
      loadAnnouncements();
    }
  }, [loadAnnouncements, isAuthenticated, role]);

  const filteredAnnouncements = announcements.filter((ann) => {
    const matchesSearch =
      !search ||
      ann.title?.toLowerCase().includes(search.toLowerCase()) ||
      ann.body?.toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      selectedCategory === "ALL" || ann.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "PLACEMENT_UPDATE":
        return <Badge variant="secondary">Placement Update</Badge>;
      case "DRIVE_ALERT":
        return <Badge variant="default">New Drive Alert</Badge>;
      case "INTERVIEW_SCHEDULE":
        return <Badge variant="default">Interview Schedule</Badge>;
      case "OFFER_UPDATE":
        return <Badge variant="success">Offer Update</Badge>;
      default:
        return <Badge variant="outline">{category || "General"}</Badge>;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Megaphone className="w-5 h-5" />
            </span>
            <h1 className="text-2xl font-bold font-heading text-text-primary tracking-tight">
              Institutional Notices &amp; Alerts
            </h1>
          </div>
          <p className="text-xs text-text-secondary">
            Important announcements, drive deadlines, and recruitment schedules broadcast by {tenant?.name || "your college"}.
          </p>
        </div>
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
                placeholder="Search announcements by title or content..."
                className="pl-9 h-9 text-xs"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <option value="ALL">All Categories</option>
              <option value="PLACEMENT_UPDATE">Placement Updates</option>
              <option value="DRIVE_ALERT">Drive Alerts</option>
              <option value="INTERVIEW_SCHEDULE">Interview Schedules</option>
              <option value="GENERAL">General Notices</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Announcements Stream */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} className="h-32" />
          ))}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <Card className="text-center py-12 text-text-muted space-y-3">
          <Megaphone className="h-10 w-10 mx-auto opacity-30" />
          <div className="space-y-1">
            <p className="font-semibold text-text-primary text-sm">No announcements at this time</p>
            <p className="text-xs text-text-secondary">
              When your college placement cell broadcasts a notice or drive update, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => (
            <Card key={ann.id} className="shadow-sm border-border hover:border-primary/40 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {getCategoryBadge(ann.category)}
                      <span className="text-[11px] text-text-muted flex items-center gap-1 font-mono">
                        <Clock className="h-3 w-3" />
                        {new Date(ann.created_at).toLocaleString()}
                      </span>
                    </div>

                    <CardTitle className="text-base font-bold font-heading text-text-primary pt-1">
                      {ann.title}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <p className="text-xs text-text-primary whitespace-pre-line leading-relaxed bg-input p-3 rounded-lg border border-border">
                  {ann.body}
                </p>

                {ann.action_url && (
                  <div className="pt-1 flex justify-end">
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs">
                      <Link href={ann.action_url}>
                        View Details <ArrowRight className="h-3 w-3 ml-1" />
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
