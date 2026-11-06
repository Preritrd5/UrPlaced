"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  History,
  Megaphone,
  Briefcase,
  GraduationCap,
  AlertCircle,
  Users,
  Search,
  Filter,
  CheckCircle2,
  ExternalLink,
  Calendar,
  Send,
  Eye,
  RefreshCw,
  Building,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AnnouncementRecord, AnnouncementCategory } from "@/modules/notifications/types";

interface AnnouncementHistoryProps {
  collegeId: string;
  onComposeClick?: () => void;
  refreshTrigger?: number;
}

export function AnnouncementHistory({
  collegeId,
  onComposeClick,
  refreshTrigger,
}: AnnouncementHistoryProps) {
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [activeAnnouncement, setActiveAnnouncement] = useState<AnnouncementRecord | null>(null);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/announcements?limit=50");
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data.announcements || []);
      }
    } catch (err) {
      console.error("Failed to load announcement history", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [collegeId, refreshTrigger]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const matchesSearch =
        !search.trim() ||
        item.title.toLowerCase().includes(search.toLowerCase().trim()) ||
        item.body.toLowerCase().includes(search.toLowerCase().trim());

      const matchesCategory =
        selectedCategory === "ALL" || item.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [announcements, search, selectedCategory]);

  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case "PLACEMENT_DRIVE":
        return (
          <Badge variant="outline" className="text-xs bg-[#5052C9]/10 text-[#5052C9] border-[#5052C9]/30">
            <Briefcase className="w-3 h-3 mr-1" /> Placement Drive
          </Badge>
        );
      case "ACADEMIC":
        return (
          <Badge variant="outline" className="text-xs bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
            <GraduationCap className="w-3 h-3 mr-1" /> Academic & Prep
          </Badge>
        );
      case "URGENT":
        return (
          <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-300">
            <AlertCircle className="w-3 h-3 mr-1" /> Urgent Alert
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs bg-[rgba(36,40,58,0.08)] text-[#24283A] border-[#DDDCD5]">
            <Megaphone className="w-3 h-3 mr-1" /> General Notice
          </Badge>
        );
    }
  };

  const getAudienceLabel = (item: AnnouncementRecord) => {
    if (item.audience_type === "ALL_STUDENTS") {
      return (
        <span className="flex items-center gap-1 text-xs text-[#292D40]">
          <Users className="w-3.5 h-3.5 text-[#5052C9]" /> All Students
        </span>
      );
    }
    if (item.audience_type === "DEPARTMENT") {
      const deptName = item.audience_filter?.department_name || "Department";
      return (
        <span className="flex items-center gap-1 text-xs text-[#292D40]">
          <Building className="w-3.5 h-3.5 text-[#2E8F86]" /> {deptName}
        </span>
      );
    }
    const count = item.audience_filter?.student_ids?.length || item.recipient_count || 0;
    return (
      <span className="flex items-center gap-1 text-xs text-[#292D40]">
        <CheckCircle2 className="w-3.5 h-3.5 text-[#5052C9]" /> {count} Selected Students
      </span>
    );
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "numeric",
        hour12: true,
      }).format(date);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Search & Filter Bar */}
      <Card className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex flex-1 items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#292D40]/50" />
              <Input
                placeholder="Search history by headline or message..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-[#FBFAF7] border-[#DDDCD5]"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-9 rounded-md border border-[#DDDCD5] bg-[#FBFAF7] px-3 py-1 text-xs text-[#24283A] focus:outline-none focus:ring-2 focus:ring-[#5052C9]"
            >
              <option value="ALL">All Categories</option>
              <option value="GENERAL">General Notice</option>
              <option value="PLACEMENT_DRIVE">Placement Drive</option>
              <option value="ACADEMIC">Academic & Prep</option>
              <option value="URGENT">Urgent Alert</option>
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchHistory}
              className="h-9 text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7] flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {onComposeClick && (
              <Button
                size="sm"
                onClick={onComposeClick}
                className="h-9 text-xs bg-[#5052C9] hover:bg-[#4345B0] text-white flex items-center gap-1.5 shadow-sm font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
                Compose New
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Announcements List Table / Cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-[#F8F7F3] border-[#DDDCD5] p-5 animate-pulse">
              <Skeleton className="h-4 w-1/3 mb-2" />
              <Skeleton className="h-3 w-2/3" />
            </Card>
          ))}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <Card className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm text-center py-12 px-4">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EDECE7] flex items-center justify-center mx-auto text-[#292D40]/60">
              <Megaphone className="w-6 h-6 text-[#5052C9]" />
            </div>
            <h3 className="font-semibold text-base font-['Outfit'] text-[#24283A]">
              No Announcements Found
            </h3>
            <p className="text-xs text-[#292D40]/70 max-w-md mx-auto">
              {search || selectedCategory !== "ALL"
                ? "No announcements matched your search or category filter."
                : "You have not broadcasted any announcements yet. Broadcasted messages to students will appear in this history audit log."}
            </p>
            {onComposeClick && (
              <Button
                size="sm"
                onClick={onComposeClick}
                className="mt-2 bg-[#5052C9] hover:bg-[#4345B0] text-white text-xs"
              >
                Broadcast Your First Announcement
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredAnnouncements.map((item) => (
            <Card
              key={item.id}
              className="bg-[#F8F7F3] border-[#DDDCD5] shadow-sm hover:border-[#5052C9]/40 transition-colors"
            >
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {getCategoryBadge(item.category)}
                    <span className="text-[11px] text-[#292D40]/60 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.sent_at || item.created_at)}
                    </span>
                    <Badge variant="outline" className="text-[10px] bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
                      SENT
                    </Badge>
                  </div>

                  <h3 className="text-sm font-semibold text-[#24283A] truncate">
                    {item.title}
                  </h3>

                  <p className="text-xs text-[#292D40] line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-[#292D40]/60">Audience:</span>
                      {getAudienceLabel(item)}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[#292D40]/60">Recipients:</span>
                      <strong className="text-[#24283A]">{item.recipient_count} delivered</strong>
                    </div>
                    {item.action_url && (
                      <div className="flex items-center gap-1">
                        <span className="text-[#292D40]/60">Action Link:</span>
                        <span className="font-mono text-[11px] text-[#5052C9] truncate max-w-[200px]">
                          {item.action_url}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="shrink-0 self-end sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAnnouncement(item)}
                    className="text-xs border-[#DDDCD5] text-[#24283A] hover:bg-[#EDECE7] flex items-center gap-1.5"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#5052C9]" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Details View Modal */}
      <Dialog open={!!activeAnnouncement} onOpenChange={(open) => !open && setActiveAnnouncement(null)}>
        {activeAnnouncement && (
          <DialogContent className="sm:max-w-lg bg-[#F8F7F3] border-[#DDDCD5]">
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                {getCategoryBadge(activeAnnouncement.category)}
                <Badge variant="outline" className="text-[10px] bg-[#2E8F86]/10 text-[#2E8F86] border-[#2E8F86]/30">
                  SENT
                </Badge>
              </div>
              <DialogTitle className="text-base font-['Outfit'] text-[#24283A] leading-snug">
                {activeAnnouncement.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-[#292D40]/70 flex items-center gap-1.5 pt-1">
                <Calendar className="w-3 h-3" />
                Broadcasted on {formatDate(activeAnnouncement.sent_at || activeAnnouncement.created_at)}
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-4 text-xs">
              {/* Delivery Stats Box */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-white border border-[#DDDCD5]">
                <div>
                  <span className="text-[10px] uppercase text-[#292D40]/60 block font-semibold">
                    Audience Target
                  </span>
                  <div className="mt-0.5">{getAudienceLabel(activeAnnouncement)}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-[#292D40]/60 block font-semibold">
                    Delivered Recipients
                  </span>
                  <div className="mt-0.5 font-bold text-sm text-[#5052C9]">
                    {activeAnnouncement.recipient_count} students
                  </div>
                </div>
              </div>

              {/* Message Body */}
              <div>
                <span className="text-[10px] uppercase text-[#292D40]/60 block font-semibold mb-1">
                  Message Content
                </span>
                <div className="p-3.5 rounded-lg bg-white border border-[#DDDCD5] text-[#24283A] whitespace-pre-wrap leading-relaxed">
                  {activeAnnouncement.body}
                </div>
              </div>

              {/* Action Link */}
              {activeAnnouncement.action_url && (
                <div>
                  <span className="text-[10px] uppercase text-[#292D40]/60 block font-semibold mb-1">
                    Action Destination Link
                  </span>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-[#DDDCD5]">
                    <span className="font-mono text-xs text-[#5052C9]">
                      {activeAnnouncement.action_url}
                    </span>
                    <a
                      href={activeAnnouncement.action_url}
                      className="text-xs text-[#5052C9] hover:underline flex items-center gap-1 font-medium"
                    >
                      Visit <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveAnnouncement(null)}
                className="border-[#DDDCD5] text-[#24283A]"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
