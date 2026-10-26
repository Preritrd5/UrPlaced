"use client";

import React, { useState } from "react";
import { Send, History, Megaphone, ShieldAlert } from "lucide-react";
import { AnnouncementCompose } from "./announcement-compose";
import { AnnouncementHistory } from "./announcement-history";
import type { AnnouncementRecord } from "@/modules/notifications/types";

interface DepartmentItem {
  id: string;
  name: string;
  code: string;
}

interface AnnouncementsPageClientProps {
  collegeId: string;
  collegeName: string;
  canCompose: boolean;
  departments: DepartmentItem[];
  allStudentsCount: number;
}

export function AnnouncementsPageClient({
  collegeId,
  collegeName,
  canCompose,
  departments,
  allStudentsCount,
}: AnnouncementsPageClientProps) {
  const [activeTab, setActiveTab] = useState<"compose" | "history">(
    canCompose ? "compose" : "history"
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleBroadcastSuccess = (announcement: AnnouncementRecord) => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header Tabs */}
      <div className="flex border-b border-[#DDDCD5] gap-4">
        {canCompose && (
          <button
            type="button"
            onClick={() => setActiveTab("compose")}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
              activeTab === "compose"
                ? "border-[#5052C9] text-[#5052C9]"
                : "border-transparent text-[#292D40]/70 hover:text-[#24283A]"
            }`}
          >
            <Send className="w-4 h-4" />
            Compose Announcement
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-[#5052C9] text-[#5052C9]"
              : "border-transparent text-[#292D40]/70 hover:text-[#24283A]"
          }`}
        >
          <History className="w-4 h-4" />
          Broadcast History
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "compose" && canCompose ? (
        <AnnouncementCompose
          collegeId={collegeId}
          departments={departments}
          allStudentsCount={allStudentsCount}
          onBroadcastSuccess={handleBroadcastSuccess}
        />
      ) : activeTab === "compose" && !canCompose ? (
        <div className="p-8 text-center bg-[#F8F7F3] border border-[#DDDCD5] rounded-xl space-y-2">
          <ShieldAlert className="w-8 h-8 text-amber-500 mx-auto" />
          <h3 className="font-semibold text-sm text-[#24283A]">
            Restricted Permission
          </h3>
          <p className="text-xs text-[#292D40]/70">
            Only College Placement Heads have permission to broadcast announcements.
          </p>
        </div>
      ) : (
        <AnnouncementHistory
          collegeId={collegeId}
          refreshTrigger={refreshTrigger}
          onComposeClick={canCompose ? () => setActiveTab("compose") : undefined}
        />
      )}
    </div>
  );
}
