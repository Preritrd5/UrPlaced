import * as React from "react";
import { cn } from "@/lib/utils";

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "pulse" | "shimmer";
}

function Skeleton({
  className,
  variant = "pulse",
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-md bg-[rgba(36,40,58,0.14)] dark:bg-white/12",
        variant === "shimmer" ? "animate-shimmer" : "animate-pulse",
        className
      )}
      {...props}
    />
  );
}

export interface SkeletonTextProps extends React.HTMLAttributes<HTMLDivElement> {
  lines?: number;
  lastLineWidth?: string;
}

function SkeletonText({
  lines = 2,
  lastLineWidth = "w-2/3",
  className,
  ...props
}: SkeletonTextProps) {
  return (
    <div aria-hidden="true" className={cn("space-y-2", className)} {...props}>
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={cn(
            "h-4 rounded",
            idx === lines - 1 && lines > 1 ? lastLineWidth : "w-full"
          )}
        />
      ))}
    </div>
  );
}

export interface SkeletonAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "rounded";
  variant?: "pulse" | "shimmer";
}

function SkeletonAvatar({
  size = "md",
  shape = "circle",
  variant = "pulse",
  className,
  ...props
}: SkeletonAvatarProps) {
  const sizeMap = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  return (
    <Skeleton
      aria-hidden="true"
      variant={variant}
      className={cn(
        sizeMap[size],
        shape === "circle" ? "rounded-full" : "rounded-lg",
        className
      )}
      {...props}
    />
  );
}

export interface SkeletonBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string;
  variant?: "pulse" | "shimmer";
}

function SkeletonBadge({
  width = "w-16",
  variant = "pulse",
  className,
  ...props
}: SkeletonBadgeProps) {
  return (
    <Skeleton
      aria-hidden="true"
      variant={variant}
      className={cn("h-5 rounded-full", width, className)}
      {...props}
    />
  );
}

export interface SkeletonButtonProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg" | "icon";
  width?: string;
  variant?: "pulse" | "shimmer";
}

function SkeletonButton({
  size = "default",
  width = "w-24",
  variant = "pulse",
  className,
  ...props
}: SkeletonButtonProps) {
  const heightMap = {
    sm: "h-8",
    default: "h-10",
    lg: "h-11",
    icon: "h-10 w-10",
  };

  return (
    <Skeleton
      aria-hidden="true"
      variant={variant}
      className={cn(
        "rounded-lg",
        heightMap[size],
        size === "icon" ? "" : width,
        className
      )}
      {...props}
    />
  );
}

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  hasHeader?: boolean;
}

function SkeletonCard({
  hasHeader = true,
  children,
  className,
  ...props
}: SkeletonCardProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm",
        className
      )}
      {...props}
    >
      {hasHeader && (
        <div className="space-y-2">
          <Skeleton className="h-5 w-1/3 rounded" />
          <Skeleton className="h-3.5 w-1/2 rounded" />
        </div>
      )}
      {children || (
        <div className="space-y-2.5 pt-2">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-5/6 rounded" />
          <Skeleton className="h-4 w-3/4 rounded" />
        </div>
      )}
    </div>
  );
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonButton,
  SkeletonCard,
};
