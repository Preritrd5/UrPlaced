"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface PasswordFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  containerClassName?: string;
}

export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ id, label, required = false, error, containerClassName, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className={cn("space-y-1.5", containerClassName)}>
        <Label htmlFor={id} required={required} className="text-xs font-bold uppercase tracking-wider text-slate-700 font-mono">
          {label}
        </Label>
        <div className="relative">
          <Input
            id={id}
            ref={ref}
            type={showPassword ? "text" : "password"}
            className={cn("pr-10 bg-input border-border/80 rounded-xl h-11 text-sm focus:border-primary focus:ring-2 focus:ring-primary/20", className)}
            required={required}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none focus:text-primary transition-colors p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
        {error && (
          <p className="text-xs text-status-danger font-medium mt-1">{error}</p>
        )}
      </div>
    );
  }
);

PasswordField.displayName = "PasswordField";
