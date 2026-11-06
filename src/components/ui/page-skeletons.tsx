import * as React from "react";
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonButton,
  SkeletonCard,
} from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Accessible container wrapper announcing loading status to assistive technology
 */
export function SkeletonContainer({
  children,
  className,
  label = "Loading content, please wait...",
}: {
  children: React.ReactNode;
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-busy="true" className={cn("w-full space-y-6", className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/**
 * Metric Card Skeleton matching UrPlaced dashboard stat cards
 */
export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-28 rounded" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <div className="space-y-1">
        <Skeleton className="h-7 w-20 rounded" />
        <Skeleton className="h-3.5 w-36 rounded" />
      </div>
    </div>
  );
}

/**
 * DashboardSkeleton: Header + 4 Metric Cards + Drives & Activity split view
 */
export function DashboardSkeleton() {
  return (
    <SkeletonContainer label="Loading dashboard workspace...">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-64 rounded-lg" />
            <SkeletonBadge width="w-24" />
          </div>
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonButton size="sm" width="w-28" />
          <SkeletonButton size="sm" width="w-32" />
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Two Column Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Main Content Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-44 rounded" />
                <Skeleton className="h-3.5 w-60 rounded" />
              </div>
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
            {/* List items */}
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3.5 rounded-lg border border-border/70 bg-surface/50"
                >
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-40 rounded" />
                      <Skeleton className="h-3 w-28 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <SkeletonBadge width="w-16" />
                    <Skeleton className="h-8 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 col: Quick Actions & Operations */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="space-y-1.5 pb-2 border-b border-border">
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-3.5 w-48 rounded" />
            </div>
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-border/70 bg-surface/40 flex items-center justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-md" />
                    <Skeleton className="h-4 w-32 rounded" />
                  </div>
                  <Skeleton className="h-4 w-4 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * TableSkeleton: Table Header, Filter Bar, 5-6 Rows matching column structures, and Pagination Footer
 */
export function TableSkeleton({
  columns = 5,
  rows = 6,
  title,
  subtitle,
}: {
  columns?: number;
  rows?: number;
  title?: string;
  subtitle?: string;
}) {
  return (
    <SkeletonContainer label={title ? `Loading ${title}...` : "Loading table data..."}>
      {/* Optional Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div className="space-y-1.5">
          {title ? (
            <h1 className="text-2xl font-bold font-heading text-text-primary">{title}</h1>
          ) : (
            <Skeleton className="h-7 w-48 rounded-lg" />
          )}
          {subtitle ? (
            <p className="text-xs text-text-secondary">{subtitle}</p>
          ) : (
            <Skeleton className="h-3.5 w-72 rounded" />
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <SkeletonButton size="sm" width="w-24" />
          <SkeletonButton size="sm" width="w-28" />
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <Skeleton className="h-10 w-full sm:w-72 rounded-lg" />
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      {/* Table Shell */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Table Head */}
        <div className="bg-surface/80 border-b border-border px-4 py-3 flex items-center justify-between">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-28 rounded hidden md:block" />
          <Skeleton className="h-4 w-20 rounded hidden lg:block" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, idx) => (
            <div
              key={idx}
              className="px-4 py-3.5 flex items-center justify-between gap-4 hover:bg-[rgba(36,40,58,0.01)] transition-colors"
            >
              {/* Col 1: Identity / Avatar + Name */}
              <div className="flex items-center gap-3 min-w-[160px] flex-1">
                <SkeletonAvatar size="sm" />
                <div className="space-y-1.5 flex-1 max-w-[200px]">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/2 rounded" />
                </div>
              </div>

              {/* Col 2: Badge / Role */}
              <div className="hidden sm:block min-w-[100px]">
                <SkeletonBadge width="w-20" />
              </div>

              {/* Col 3: Details / Date */}
              <div className="hidden md:block min-w-[120px]">
                <Skeleton className="h-3.5 w-24 rounded" />
              </div>

              {/* Col 4: Status Indicator */}
              <div className="hidden lg:block min-w-[90px]">
                <SkeletonBadge width="w-16" />
              </div>

              {/* Col 5: Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-16 rounded-md" />
              </div>
            </div>
          ))}
        </div>

        {/* Table Pagination Footer */}
        <div className="p-4 border-t border-border flex items-center justify-between bg-card text-xs">
          <Skeleton className="h-4 w-40 rounded" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * ProfileSkeleton: User Avatar, Identity Header, Tab Bar, Form Input Fields, and Action Buttons
 */
export function ProfileSkeleton() {
  return (
    <SkeletonContainer label="Loading profile and account settings...">
      {/* Header */}
      <div className="space-y-2 pb-6 border-b border-border">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      {/* Profile Overview Banner */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <SkeletonAvatar size="xl" className="h-20 w-20 sm:h-24 sm:w-24" />
        <div className="space-y-3 flex-1 text-center sm:text-left">
          <div className="space-y-1.5">
            <Skeleton className="h-6 w-48 rounded mx-auto sm:mx-0" />
            <Skeleton className="h-4 w-64 rounded mx-auto sm:mx-0" />
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
            <SkeletonBadge width="w-24" />
            <SkeletonBadge width="w-32" />
          </div>
        </div>
        <SkeletonButton size="sm" width="w-28" />
      </div>

      {/* Tabs Placeholder */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      {/* Form Fields Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="space-y-1 pb-3 border-b border-border">
          <Skeleton className="h-5 w-36 rounded" />
          <Skeleton className="h-3.5 w-56 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <SkeletonButton variant="pulse" width="w-24" />
          <SkeletonButton variant="pulse" width="w-32" />
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * AnalyticsSkeleton: Metric Summary Cards + 2 Large Chart Skeletons + Data Breakdown
 */
export function AnalyticsSkeleton() {
  return (
    <SkeletonContainer label="Loading analytics and performance metrics...">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-36 rounded-lg" />
          <SkeletonButton size="sm" width="w-28" />
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* 2 Chart Skeletons */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-3.5 w-56 rounded" />
            </div>
            <SkeletonBadge width="w-20" />
          </div>
          {/* Chart Graphic Placeholder */}
          <div className="h-64 flex items-end justify-between gap-3 p-4 bg-surface/80 border border-border/60 rounded-lg">
            {[40, 65, 55, 80, 70, 90, 85].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton
                  className="w-full rounded-t"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-44 rounded" />
              <Skeleton className="h-3.5 w-60 rounded" />
            </div>
            <SkeletonBadge width="w-20" />
          </div>
          {/* Chart Graphic Placeholder */}
          <div className="h-64 flex items-end justify-between gap-3 p-4 bg-surface/80 border border-border/60 rounded-lg">
            {[60, 45, 75, 50, 85, 65, 95].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <Skeleton
                  className="w-full rounded-t"
                  style={{ height: `${h}%` }}
                />
                <Skeleton className="h-3 w-6 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * DetailViewSkeleton: Header with back button, 2-column detail grid
 */
export function DetailViewSkeleton() {
  return (
    <SkeletonContainer label="Loading record details...">
      {/* Back button & Title */}
      <div className="space-y-3 pb-6 border-b border-border">
        <Skeleton className="h-4 w-28 rounded" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-64 rounded-lg" />
              <SkeletonBadge width="w-20" />
            </div>
            <Skeleton className="h-4 w-80 rounded" />
          </div>
          <div className="flex items-center gap-2.5">
            <SkeletonButton size="sm" width="w-24" />
            <SkeletonButton size="sm" width="w-28" />
          </div>
        </div>
      </div>

      {/* 2-Column Detail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SkeletonCard className="p-6">
            <SkeletonText lines={4} />
          </SkeletonCard>
          <SkeletonCard className="p-6">
            <SkeletonText lines={3} />
          </SkeletonCard>
        </div>
        <div className="space-y-6">
          <SkeletonCard className="p-6">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-3 w-full rounded" />
              <Skeleton className="h-3 w-5/6 rounded" />
              <Skeleton className="h-3 w-3/4 rounded" />
            </div>
          </SkeletonCard>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * AssessmentTakeSkeleton: Header with timer placeholder, question text, 4 choices, bottom buttons
 */
export function AssessmentTakeSkeleton() {
  return (
    <SkeletonContainer label="Initializing assessment workspace...">
      {/* Top Banner */}
      <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl shadow-sm">
        <div className="space-y-1">
          <Skeleton className="h-5 w-48 rounded" />
          <Skeleton className="h-3.5 w-32 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      {/* Main Question Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <SkeletonBadge width="w-24" />
            <SkeletonBadge width="w-16" />
          </div>
          <Skeleton className="h-4 w-20 rounded" />
        </div>

        {/* Question Text */}
        <div className="space-y-2.5 py-2">
          <Skeleton className="h-5 w-full rounded" />
          <Skeleton className="h-5 w-5/6 rounded" />
          <Skeleton className="h-5 w-3/4 rounded" />
        </div>

        {/* 4 Option Radio Cards */}
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4].map((opt) => (
            <div
              key={opt}
              className="p-4 rounded-xl border border-border bg-surface/40 flex items-center gap-3.5"
            >
              <Skeleton className="h-5 w-5 rounded-full shrink-0" />
              <Skeleton className="h-4 w-4/5 rounded" />
            </div>
          ))}
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <SkeletonButton width="w-28" />
          <div className="flex items-center gap-3">
            <SkeletonButton width="w-32" />
            <SkeletonButton width="w-28" />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * SuperAdminDashboardSkeleton: 4 SaaS KPIs, Activation Feed, Revenue Distribution
 */
export function SuperAdminDashboardSkeleton() {
  return (
    <SkeletonContainer label="Loading platform command center...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-72 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonButton size="sm" width="w-32" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <Skeleton className="h-5 w-48 rounded" />
              <SkeletonBadge width="w-20" />
            </div>
            <div className="divide-y divide-border/60">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-44 rounded" />
                      <Skeleton className="h-3 w-28 rounded" />
                    </div>
                  </div>
                  <SkeletonBadge width="w-20" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="pb-3 border-b border-border">
              <Skeleton className="h-5 w-36 rounded" />
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * BillingSkeleton: Subscription Overview, Pricing Summary, Invoice Table
 */
export function BillingSkeleton() {
  return (
    <SkeletonContainer label="Loading billing and subscription workspace...">
      <div className="space-y-2 pb-6 border-b border-border">
        <Skeleton className="h-8 w-60 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="space-y-1">
              <Skeleton className="h-5 w-40 rounded" />
              <Skeleton className="h-3.5 w-60 rounded" />
            </div>
            <SkeletonBadge width="w-24" />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-6 w-32 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-6 w-32 rounded" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
          <Skeleton className="h-5 w-32 rounded" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-4 w-5/6 rounded" />
            <SkeletonButton width="w-full" className="mt-2" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <Skeleton className="h-5 w-40 rounded" />
          <SkeletonBadge width="w-20" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-24 rounded" />
              </div>
              <Skeleton className="h-4 w-20 rounded" />
              <SkeletonBadge width="w-16" />
              <SkeletonButton size="sm" width="w-20" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * KanbanPipelineSkeleton: Recruitment live applicant stages
 */
export function KanbanPipelineSkeleton() {
  return (
    <SkeletonContainer label="Loading recruitment candidate pipeline...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="flex items-center gap-3">
          <SkeletonButton size="sm" width="w-28" />
          <SkeletonButton size="sm" width="w-28" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4">
        {["Applied", "Shortlisted", "Technical Interview", "Offered"].map((stage) => (
          <div
            key={stage}
            className="rounded-xl border border-border bg-card/60 p-4 space-y-3 min-w-[260px] shadow-sm flex flex-col"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <Skeleton className="h-4 w-28 rounded" />
              <SkeletonBadge width="w-8" />
            </div>
            <div className="space-y-3 flex-1">
              {[1, 2, 3].map((cardIdx) => (
                <div
                  key={cardIdx}
                  className="rounded-lg border border-border bg-card p-3.5 space-y-2.5 shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <SkeletonAvatar size="sm" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-3.5 w-24 rounded" />
                      <Skeleton className="h-3 w-16 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <SkeletonBadge width="w-16" />
                    <Skeleton className="h-3 w-12 rounded" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * DriveListSkeleton: Recruitment drive cards with status tabs
 */
export function DriveListSkeleton() {
  return (
    <SkeletonContainer label="Loading recruitment drives...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <SkeletonButton size="sm" width="w-36" />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-full sm:w-64 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                  </div>
                </div>
                <SkeletonBadge width="w-16" />
              </div>
              <div className="space-y-1.5 pt-1">
                <Skeleton className="h-3.5 w-full rounded" />
                <Skeleton className="h-3.5 w-4/5 rounded" />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-3 w-16 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
              <SkeletonButton size="sm" width="w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * FormSkeleton: Multi-group form layout for create/edit workflows
 */
export function FormSkeleton({ title }: { title?: string }) {
  return (
    <SkeletonContainer label={title ? `Loading ${title}...` : "Loading form..."}>
      <div className="space-y-2 pb-6 border-b border-border">
        {title ? (
          <h1 className="text-2xl font-bold font-heading text-text-primary">{title}</h1>
        ) : (
          <Skeleton className="h-8 w-60 rounded-lg" />
        )}
        <Skeleton className="h-4 w-80 rounded" />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6 max-w-4xl">
        <div className="space-y-1.5 pb-3 border-b border-border">
          <Skeleton className="h-5 w-40 rounded" />
          <Skeleton className="h-3.5 w-64 rounded" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Skeleton className="h-3.5 w-32 rounded" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3.5 w-24 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <SkeletonButton width="w-24" />
          <SkeletonButton width="w-32" />
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * QuestionBankSkeleton: Question cards with prompt, difficulty, options
 */
export function QuestionBankSkeleton() {
  return (
    <SkeletonContainer label="Loading question repository...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="flex items-center gap-2.5">
          <SkeletonButton size="sm" width="w-28" />
          <SkeletonButton size="sm" width="w-32" />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Skeleton className="h-10 w-full sm:w-72 rounded-lg" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3.5 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SkeletonBadge width="w-20" />
                <SkeletonBadge width="w-16" />
              </div>
              <Skeleton className="h-3.5 w-20 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * AssessmentListSkeleton: Assessment catalog cards
 */
export function AssessmentListSkeleton() {
  return (
    <SkeletonContainer label="Loading assessments...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <SkeletonButton size="sm" width="w-36" />
      </div>

      <div className="flex items-center gap-2 pb-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 flex-1">
                  <Skeleton className="h-5 w-40 rounded" />
                  <Skeleton className="h-3.5 w-28 rounded" />
                </div>
                <SkeletonBadge width="w-16" />
              </div>
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-xs">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-3 w-16 rounded" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <Skeleton className="h-3 w-24 rounded" />
                  <Skeleton className="h-3 w-14 rounded" />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <Skeleton className="h-4 w-20 rounded" />
              <SkeletonButton size="sm" width="w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * MistakeAnalyticsSkeleton: Cohort and student mistake mastery
 */
export function MistakeAnalyticsSkeleton() {
  return (
    <SkeletonContainer label="Loading mistake and mastery analytics...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <SkeletonButton size="sm" width="w-32" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="pb-3 border-b border-border">
            <Skeleton className="h-5 w-48 rounded" />
          </div>
          <div className="space-y-3 pt-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-3.5 rounded-lg border border-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-40 rounded" />
                  <SkeletonBadge width="w-16" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
          <div className="pb-3 border-b border-border">
            <Skeleton className="h-5 w-36 rounded" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg border border-border/70 space-y-1.5">
                <Skeleton className="h-3.5 w-32 rounded" />
                <Skeleton className="h-3 w-48 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * AnnouncementListSkeleton: Announcement broadcast feed
 */
export function AnnouncementListSkeleton() {
  return (
    <SkeletonContainer label="Loading announcements...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <SkeletonButton size="sm" width="w-36" />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48 rounded" />
                  <SkeletonBadge width="w-16" />
                </div>
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              <Skeleton className="h-3.5 w-20 rounded" />
            </div>
            <div className="space-y-1.5 pt-1">
              <Skeleton className="h-3.5 w-full rounded" />
              <Skeleton className="h-3.5 w-5/6 rounded" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * ApplicationListSkeleton: Student campus drive application cards
 */
export function ApplicationListSkeleton() {
  return (
    <SkeletonContainer label="Loading applications...">
      <div className="space-y-2 pb-6 border-b border-border">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>

      <div className="flex items-center gap-2 pb-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>

      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-44 rounded" />
                  <Skeleton className="h-3.5 w-28 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs pt-1">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-3 w-28 rounded" />
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <SkeletonBadge width="w-24" />
              <SkeletonButton size="sm" width="w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * OfferListSkeleton: Placement offers list
 */
export function OfferListSkeleton() {
  return (
    <SkeletonContainer label="Loading placement offers...">
      <div className="space-y-2 pb-6 border-b border-border">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      <div className="space-y-4 pt-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3.5 w-32 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs pt-1">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-3.5 w-28 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <SkeletonButton size="sm" width="w-24" />
              <SkeletonButton size="sm" width="w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * TrainingSkeleton: Training sessions and workshops
 */
export function TrainingSkeleton() {
  return (
    <SkeletonContainer label="Loading training programs...">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <SkeletonButton size="sm" width="w-36" />
      </div>

      <div className="flex items-center gap-2 pb-2">
        <Skeleton className="h-9 w-28 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm flex flex-col justify-between"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <SkeletonBadge width="w-20" />
                <Skeleton className="h-3.5 w-16 rounded" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-5 w-full rounded" />
                <Skeleton className="h-3.5 w-4/5 rounded" />
              </div>
              <div className="flex items-center gap-2.5 pt-1">
                <SkeletonAvatar size="sm" />
                <Skeleton className="h-3.5 w-28 rounded" />
              </div>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <Skeleton className="h-3.5 w-24 rounded" />
              <SkeletonButton size="sm" width="w-24" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonContainer>
  );
}

/**
 * AuditLogsSkeleton: Platform cryptographic security logs
 */
export function AuditLogsSkeleton() {
  return (
    <SkeletonContainer label="Loading security audit records...">
      <div className="space-y-2 pb-6 border-b border-border">
        <Skeleton className="h-8 w-60 rounded-lg" />
        <Skeleton className="h-4 w-96 rounded" />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Skeleton className="h-10 w-full sm:w-72 rounded-lg" />
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Skeleton className="h-10 w-28 rounded-lg" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="bg-surface/80 border-b border-border px-4 py-3 flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="px-4 py-3.5 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <SkeletonBadge width="w-24" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              <Skeleton className="h-3.5 w-40 rounded" />
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * SystemHealthSkeleton: Infrastructure telemetry and health checks
 */
export function SystemHealthSkeleton() {
  return (
    <SkeletonContainer label="Loading infrastructure telemetry...">
      <div className="space-y-2 pb-6 border-b border-border">
        <Skeleton className="h-8 w-60 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4">
        <div className="pb-3 border-b border-border">
          <Skeleton className="h-5 w-44 rounded" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3.5 rounded-lg border border-border/70 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <Skeleton className="h-4 w-36 rounded" />
                <Skeleton className="h-3 w-56 rounded" />
              </div>
              <SkeletonBadge width="w-20" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * StudentDirectorySkeleton: Student roster with SRN, batch, department
 */
export function StudentDirectorySkeleton() {
  return (
    <TableSkeleton
      title="Student Directory"
      subtitle="Institutional student roster and placement eligibility tracking"
      columns={6}
      rows={8}
    />
  );
}

/**
 * AuthSplitSkeleton: Split screen authentication loading state matching AuthSplitLayout
 */
export function AuthSplitSkeleton({ label = "Loading authentication portal..." }: { label?: string }) {
  return (
    <SkeletonContainer label={label} className="space-y-0">
      <main className="min-h-screen min-h-[100dvh] h-auto lg:h-[100dvh] w-full overflow-y-auto lg:overflow-hidden bg-[#EDECE7] dark:bg-background flex flex-col lg:flex-row relative select-none">
        {/* Left Form Area */}
        <section className="w-full lg:w-[53%] xl:w-[54%] min-h-full h-auto lg:h-full flex flex-col justify-between px-4 sm:px-10 lg:px-14 xl:px-20 py-4 sm:py-6 lg:py-8">
          <div className="w-full max-w-[460px] mx-auto min-h-full h-auto lg:h-full flex flex-col justify-between">
            {/* Top Navigation */}
            <div className="shrink-0 flex items-center justify-between">
              <Skeleton className="h-4 w-28 rounded" />
              <Skeleton className="h-8 w-8 rounded-lg" />
            </div>

            {/* Form Placeholder */}
            <div className="flex-1 flex flex-col justify-center py-6 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-7 w-32 rounded-lg" />
                </div>
                <Skeleton className="h-4 w-56 rounded" />
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-20 rounded" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
                <SkeletonButton className="w-full h-11 rounded-lg" />
              </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 pt-4 flex justify-center">
              <Skeleton className="h-4 w-52 rounded" />
            </div>
          </div>
        </section>

        {/* Right Promo Panel */}
        <aside
          aria-hidden="true"
          className="hidden lg:flex lg:w-[47%] xl:w-[46%] h-full relative bg-[#5052C9] items-center justify-center p-8 lg:p-12 xl:p-16 overflow-hidden"
        >
          <div className="space-y-4 max-w-md w-full">
            <Skeleton className="h-9 w-3/4 rounded-lg bg-white/20" />
            <Skeleton className="h-4 w-full rounded bg-white/10" />
            <Skeleton className="h-4 w-5/6 rounded bg-white/10" />
          </div>
        </aside>
      </main>
    </SkeletonContainer>
  );
}

/**
 * AuthCardSkeleton: Standalone auth card loading state matching SimpleAuthCard
 */
export function AuthCardSkeleton({ label = "Loading authorization session..." }: { label?: string }) {
  return (
    <SkeletonContainer label={label} className="space-y-0">
      <div className="w-full h-full min-h-[100dvh] flex flex-col justify-center items-center py-6 px-4 overflow-y-auto bg-[#EDECE7] dark:bg-background">
        <div className="w-full max-w-lg mx-auto space-y-6">
          {/* Brand Header */}
          <div className="text-center space-y-2 flex flex-col items-center">
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <Skeleton className="h-7 w-32 rounded-lg" />
            </div>
            <Skeleton className="h-3.5 w-60 rounded" />
          </div>

          {/* Main Card */}
          <div className="bg-card py-8 px-6 shadow-md rounded-2xl border border-border sm:px-10 space-y-5">
            <div className="space-y-2">
              <Skeleton className="h-6 w-52 rounded-lg" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24 rounded" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20 rounded" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
              <SkeletonButton className="w-full h-11 rounded-lg" />
            </div>
          </div>

          {/* Security Footer */}
          <div className="text-center space-y-1.5 flex flex-col items-center">
            <Skeleton className="h-3 w-64 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </div>
      </div>
    </SkeletonContainer>
  );
}

/**
 * LandingPageSkeleton: Public landing page loading state
 */
export function LandingPageSkeleton() {
  return (
    <SkeletonContainer label="Loading UrPlaced platform..." className="space-y-0">
      <div className="min-h-screen bg-[#EDECE7] dark:bg-background flex flex-col">
        {/* Header navigation bar */}
        <header className="border-b border-border/60 bg-card/80 backdrop-blur-sm px-6 sm:px-12 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-6 w-28 rounded-md" />
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Skeleton className="h-4 w-20 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-4 w-20 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg" />
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-12 sm:py-20 flex flex-col items-center text-center space-y-6">
          <SkeletonBadge width="w-48" />
          <Skeleton className="h-12 sm:h-16 w-3/4 max-w-2xl rounded-xl" />
          <Skeleton className="h-5 sm:h-6 w-full max-w-xl rounded-md" />
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <SkeletonButton className="h-12 w-44 rounded-xl" />
            <SkeletonButton className="h-12 w-44 rounded-xl" />
          </div>

          {/* 3 Highlights Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border bg-card p-6 space-y-4 text-left shadow-sm">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-6 w-40 rounded" />
                <SkeletonText lines={3} />
              </div>
            ))}
          </div>
        </main>
      </div>
    </SkeletonContainer>
  );
}
