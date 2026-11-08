"use client";

import * as React from "react";
import { Info, HelpCircle, RefreshCw, AlertTriangle, Calendar } from "lucide-react";
import type {
  StudentActivityHeatmapPayload,
  HeatmapCell,
  MonthBlock,
} from "@/modules/students/services/student-activity-heatmap-service";

interface StudentActivityHeatmapProps {
  className?: string;
  initialData?: StudentActivityHeatmapPayload | null;
}

export function StudentActivityHeatmap({
  className = "",
  initialData,
}: StudentActivityHeatmapProps) {
  const [data, setData] = React.useState<StudentActivityHeatmapPayload | null>(
    initialData || null
  );
  const [loading, setLoading] = React.useState(!initialData);
  const [error, setError] = React.useState<string | null>(null);

  // Active hover/focus tooltip state
  const [hoveredCell, setHoveredCell] = React.useState<{
    cell: HeatmapCell;
    x: number;
    y: number;
  } | null>(null);

  // Info tooltip toggle
  const [showInfo, setShowInfo] = React.useState(false);

  const fetchHeatmap = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Pass browser timezone
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
      const res = await fetch("/api/student/activity/heatmap", {
        headers: {
          "x-timezone": tz,
        },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }

      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data);
      } else {
        throw new Error("Invalid response from heatmap API");
      }
    } catch (err: any) {
      console.error("[StudentActivityHeatmap] Failed to fetch:", err);
      setError(err.message || "Failed to load activity heatmap");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialData) {
      fetchHeatmap();
    }
  }, [initialData, fetchHeatmap]);

  // Color classes for intensity levels
  const getCellClasses = (level: number) => {
    switch (level) {
      case 1:
        return "bg-teal-700/40 dark:bg-teal-900/60 border border-teal-600/30 dark:border-teal-700/40";
      case 2:
        return "bg-teal-600/70 dark:bg-[#1f736a] border border-teal-500/40 dark:border-teal-600/50";
      case 3:
        return "bg-[#2E8F86] dark:bg-[#2E8F86] border border-teal-400/50 shadow-sm";
      case 4:
        return "bg-[#22c55e] dark:bg-[#22c55e] border border-emerald-400 shadow-sm ring-1 ring-emerald-500/40";
      case 0:
      default:
        return "bg-[#DDDCD5] dark:bg-[#282B37] border border-black/5 dark:border-white/5";
    }
  };

  const formatDateLabel = (dateStr: string) => {
    try {
      const [y, m, d] = dateStr.split("-").map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      return date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div
        className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 animate-pulse ${className}`}
        aria-label="Loading student activity heatmap"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="h-6 w-64 bg-skeleton-base/30 rounded-lg" />
          <div className="flex items-center gap-6">
            <div className="h-4 w-32 bg-skeleton-base/30 rounded" />
            <div className="h-4 w-28 bg-skeleton-base/30 rounded" />
          </div>
        </div>
        <div className="h-32 w-full bg-skeleton-base/20 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-danger">
            <AlertTriangle className="h-5 w-5" />
            <span className="text-sm font-semibold">Activity Heatmap Unavailable</span>
          </div>
          <button
            onClick={fetchHeatmap}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border hover:bg-surface text-text-primary transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
        <p className="text-xs text-text-secondary">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div
      className={`rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-4 relative ${className}`}
      aria-label="Student Activity Contribution Heatmap"
    >
      {/* Top Header Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-border/40">
        <div className="flex items-center gap-2 relative">
          <h3 className="text-base sm:text-lg font-bold font-heading text-text-primary tracking-tight">
            {data.totalSubmissions}{" "}
            {data.totalSubmissions === 1 ? "submission" : "submissions"} in the past one year
          </h3>

          {/* Info Tooltip Button */}
          <button
            type="button"
            onClick={() => setShowInfo(!showInfo)}
            onMouseEnter={() => setShowInfo(true)}
            onMouseLeave={() => setShowInfo(false)}
            aria-label="About activity submissions"
            className="text-text-muted hover:text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-full p-0.5"
          >
            <Info className="h-4 w-4" />
          </button>

          {/* Info Popup Box */}
          {showInfo && (
            <div
              role="tooltip"
              className="absolute left-0 top-8 z-50 w-72 sm:w-80 p-3 rounded-xl border border-border bg-card-elevated shadow-lg text-xs text-text-primary space-y-2 pointer-events-none"
            >
              <div className="font-semibold text-text-primary flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>Qualifying Submissions</span>
              </div>
              <p className="text-text-secondary leading-relaxed">
                Calculated from verified student actions over the trailing 365 calendar days:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-text-secondary text-[11px]">
                <li>Completed &amp; scored assessment attempts</li>
                <li>Campus placement drive registrations &amp; applications</li>
                <li>Mistake remediation practice &amp; reflections</li>
              </ul>
              <p className="text-[10px] text-text-muted italic border-t border-border/40 pt-1.5">
                Passive logins, page views, and unsubmitted test drafts are strictly excluded.
              </p>
            </div>
          )}
        </div>

        {/* Stats on the right */}
        <div className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-body text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Total active days:</span>
            <span className="font-bold text-text-primary font-mono">{data.totalActiveDays}</span>
          </div>
          <div className="h-3 w-px bg-border/60" />
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted">Max streak:</span>
            <span className="font-bold text-text-primary font-mono">{data.maxStreak}</span>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container (Horizontal scroll on mobile, perfect fit on desktop) */}
      <div className="relative overflow-x-auto pb-2 pt-1 -mx-2 px-2 scrollbar-none">
        <div
          role="grid"
          aria-label="365-day contribution calendar"
          className="flex items-start gap-2 sm:gap-3 min-w-max mx-auto justify-between"
        >
          {data.months.map((month: MonthBlock) => (
            <div
              key={month.monthKey}
              className="flex flex-col items-center gap-1.5 shrink-0"
            >
              {/* Columns for this month */}
              <div className="flex gap-[3px] sm:gap-1">
                {month.columns.map((col, colIdx) => (
                  <div key={colIdx} className="flex flex-col gap-[3px] sm:gap-1">
                    {col.map((cell, rowIdx) => {
                      if (!cell) {
                        return (
                          <div
                            key={`empty-${rowIdx}`}
                            className="w-3 h-3 sm:w-3.5 sm:h-3.5 invisible pointer-events-none"
                            aria-hidden="true"
                          />
                        );
                      }

                      const count = cell.activity?.count || 0;
                      const level = cell.activity?.level || 0;

                      return (
                        <div
                          key={cell.date}
                          role="gridcell"
                          tabIndex={0}
                          aria-label={`${cell.date}: ${count} submissions`}
                          onMouseEnter={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              cell,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onMouseLeave={() => setHoveredCell(null)}
                          onFocus={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setHoveredCell({
                              cell,
                              x: rect.left + rect.width / 2,
                              y: rect.top,
                            });
                          }}
                          onBlur={() => setHoveredCell(null)}
                          className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-[2px] sm:rounded-[3px] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary ${getCellClasses(
                            level
                          )}`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Month Label below */}
              <span className="text-[11px] sm:text-xs font-mono font-medium text-text-secondary tracking-tight">
                {month.monthLabel}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Day Detail Tooltip */}
      {hoveredCell && (
        <div
          role="tooltip"
          style={{
            position: "fixed",
            left: `${hoveredCell.x}px`,
            top: `${hoveredCell.y - 8}px`,
            transform: "translate(-50%, -100%)",
          }}
          className="z-50 pointer-events-none p-2.5 rounded-xl border border-border bg-card-elevated shadow-lg text-xs space-y-1.5 min-w-[200px]"
        >
          <div className="font-semibold text-text-primary text-[11px]">
            {formatDateLabel(hoveredCell.cell.date)}
          </div>
          <div className="text-xs font-bold text-secondary font-mono flex items-center justify-between border-b border-border/40 pb-1">
            <span>
              {hoveredCell.cell.activity.count}{" "}
              {hoveredCell.cell.activity.count === 1 ? "submission" : "submissions"}
            </span>
            <span className="text-[10px] text-text-muted font-normal">
              Level {hoveredCell.cell.activity.level}
            </span>
          </div>
          <div className="text-[10px] space-y-0.5 text-text-secondary">
            <div className="flex justify-between">
              <span>Assessments:</span>
              <span className="font-mono font-medium text-text-primary">
                {hoveredCell.cell.activity.breakdown.assessments}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Drive Applications:</span>
              <span className="font-mono font-medium text-text-primary">
                {hoveredCell.cell.activity.breakdown.applications}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Mistake Reviews:</span>
              <span className="font-mono font-medium text-text-primary">
                {hoveredCell.cell.activity.breakdown.mistakeRemediations}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Empty State Banner if student has 0 submissions */}
      {data.totalSubmissions === 0 && (
        <div className="pt-2 border-t border-border/40 text-center">
          <p className="text-xs text-text-secondary">
            No submissions recorded in the past year. Complete mock assessments or submit placement
            applications to build your activity streak!
          </p>
        </div>
      )}
    </div>
  );
}
