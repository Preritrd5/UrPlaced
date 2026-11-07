"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Calendar,
  Clock,
  Search,
  ArrowRight,
  AlertCircle,
  Trash2,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonCard } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function StudentAnnouncementsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: isLoadingAuth, role, tenant, userId } = useAuthContext();

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [mounted, setMounted] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const storageKey = useMemo(() => {
    return userId ? `urplaced_dismissed_announcements_${userId}` : "urplaced_dismissed_announcements";
  }, [userId]);

  // Client hydration guard & load dismissed IDs
  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr)) {
          setDismissedIds(new Set(arr));
        }
      }
    } catch {
      // Storage exception fallback
    }
  }, [storageKey]);

  useEffect(() => {
    if (!isLoadingAuth) {
      if (!isAuthenticated) {
        router.push("/auth/signin");
      } else if (role !== "STUDENT") {
        router.push("/dashboard/announcements");
      }
    }
  }, [isAuthenticated, isLoadingAuth, role, router]);

  const loadAnnouncements = useCallback(async () => {
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
      setError(err.message || "Unable to load announcements");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && role === "STUDENT") {
      loadAnnouncements();
    }
  }, [loadAnnouncements, isAuthenticated, role]);

  const handleDeleteAnnouncement = (id: string) => {
    setDismissedIds((prev) => {
      const updated = new Set(prev);
      updated.add(id);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
  };

  const handleClearAll = () => {
    const allIds = announcements.map((a) => a.id);
    setDismissedIds((prev) => {
      const updated = new Set([...Array.from(prev), ...allIds]);
      try {
        localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
      } catch {}
      return updated;
    });
    setConfirmClearAll(false);
  };

  const handleRestoreAll = () => {
    setDismissedIds(new Set());
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter((ann) => !dismissedIds.has(ann.id));
  }, [announcements, dismissedIds]);

  const filteredAnnouncements = useMemo(() => {
    return visibleAnnouncements.filter((ann) => {
      const matchesSearch =
        !search ||
        ann.title?.toLowerCase().includes(search.toLowerCase()) ||
        ann.body?.toLowerCase().includes(search.toLowerCase());

      const matchesCategory =
        selectedCategory === "ALL" || ann.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [visibleAnnouncements, search, selectedCategory]);

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

  const formatSafeDate = (iso: string) => {
    if (!mounted || !iso) return "Recent";
    try {
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "Recent";
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
            Important announcements, drive deadlines, and recruitment schedules broadcast by{" "}
            {tenant?.name || "your college"}.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => loadAnnouncements()}
            disabled={isLoading}
            className="text-xs border-border flex items-center gap-1.5"
            suppressHydrationWarning
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {visibleAnnouncements.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmClearAll(true)}
              className="text-xs border-border text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1.5"
              suppressHydrationWarning
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </Button>
          )}

          {dismissedIds.size > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRestoreAll}
              className="text-xs text-primary hover:bg-primary/10 flex items-center gap-1.5"
              title="Restore dismissed announcements"
              suppressHydrationWarning
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restore ({dismissedIds.size})</span>
            </Button>
          )}
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
                suppressHydrationWarning
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-lg border border-border bg-input px-3 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
              suppressHydrationWarning
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
            <p className="font-semibold text-text-primary text-sm">
              {visibleAnnouncements.length === 0 && dismissedIds.size > 0
                ? "All announcements cleared"
                : "No announcements at this time"}
            </p>
            <p className="text-xs text-text-secondary">
              {visibleAnnouncements.length === 0 && dismissedIds.size > 0 ? (
                <span>
                  You have cleared all active notices. Click &quot;Restore&quot; above to review them again.
                </span>
              ) : (
                "When your college placement cell broadcasts a notice or drive update, it will appear here."
              )}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((ann) => (
            <Card
              key={ann.id}
              className="shadow-sm border-border hover:border-primary/40 transition-colors relative group"
            >
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getCategoryBadge(ann.category)}
                      <span
                        className="text-[11px] text-text-muted flex items-center gap-1 font-mono"
                        suppressHydrationWarning
                      >
                        <Clock className="h-3 w-3" />
                        {formatSafeDate(ann.created_at)}
                      </span>
                    </div>

                    <CardTitle className="text-base font-bold font-heading text-text-primary pt-1">
                      {ann.title}
                    </CardTitle>
                  </div>

                  {/* Individual Delete / Dismiss Action */}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="h-8 px-2 text-text-muted hover:text-red-600 hover:bg-red-50 text-xs shrink-0 flex items-center gap-1 self-start"
                    title="Delete notice from your view"
                    aria-label={`Delete announcement: ${ann.title}`}
                    suppressHydrationWarning
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </Button>
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

      {/* Confirmation Modal for Clear All */}
      <Dialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-base font-heading text-text-primary flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Clear All Announcements?
            </DialogTitle>
            <DialogDescription className="text-xs text-text-secondary pt-1 leading-relaxed">
              This will remove all {visibleAnnouncements.length} current notices from your view. You can restore them anytime using the &quot;Restore&quot; button.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClearAll(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleClearAll}
              className="text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              Yes, Clear All
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
