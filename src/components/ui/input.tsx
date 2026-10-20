import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-input px-3 py-2 text-sm text-text-primary file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-primary disabled:cursor-not-allowed disabled:bg-[var(--color-bg-disabled)] disabled:text-text-disabled disabled:border-[var(--color-border-subtle)] transition-colors",
          error
            ? "border-status-danger focus-visible:ring-status-danger focus-visible:border-status-danger"
            : "border-border hover:border-[rgba(80,82,201,0.45)]",
          className
        )}
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        suppressHydrationWarning
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
