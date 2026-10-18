import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-white",
        secondary:
          "border-transparent bg-secondary text-white",
        outline:
          "border-border text-text-primary bg-card",
        success:
          "border-transparent bg-[var(--color-success-subtle)] text-status-success",
        info:
          "border-transparent bg-[var(--color-info-subtle)] text-status-info",
        warning:
          "border-transparent bg-[var(--color-warning-subtle)] text-status-warning",
        danger:
          "border-transparent bg-[var(--color-danger-subtle)] text-status-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
