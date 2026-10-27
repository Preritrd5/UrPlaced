"use client";

import * as React from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  required?: boolean;
  icon?: React.ElementType;
  helperText?: string;
  containerClassName?: string;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  ({ id, label, required = false, icon: Icon, helperText, containerClassName, className, ...props }, ref) => {
    return (
      <div className={cn("space-y-1", containerClassName)}>
        <Label
          htmlFor={id}
          required={required}
          className="text-xs font-bold text-[#24283A] tracking-wide block"
        >
          {label}
        </Label>
        <div className="relative">
          {Icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747683] pointer-events-none">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          )}
          <input
            id={id}
            ref={ref}
            required={required}
            suppressHydrationWarning
            className={cn(
              "w-full bg-[#FBFAF7] border border-[#DDDCD5] text-[#24283A] placeholder-[#747683]/70 text-xs sm:text-sm rounded-xl h-9 sm:h-10 transition-colors focus:outline-none focus:border-[#5052C9] focus:ring-2 focus:ring-[#5052C9]/20",
              Icon ? "pl-9 pr-3.5" : "px-3.5",
              className
            )}
            {...props}
          />
        </div>
        {helperText && (
          <p className="text-[10px] sm:text-[11px] text-[#747683] leading-tight">{helperText}</p>
        )}
      </div>
    );
  }
);
AuthInput.displayName = "AuthInput";

export interface AuthPasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  required?: boolean;
  containerClassName?: string;
}

export const AuthPasswordInput = React.forwardRef<HTMLInputElement, AuthPasswordInputProps>(
  ({ id, label, required = false, containerClassName, className, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    return (
      <div className={cn("space-y-1", containerClassName)}>
        <Label
          htmlFor={id}
          required={required}
          className="text-xs font-bold text-[#24283A] tracking-wide block"
        >
          {label}
        </Label>
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#747683] pointer-events-none">
            <Lock className="h-4 w-4" aria-hidden="true" />
          </div>
          <input
            id={id}
            ref={ref}
            type={showPassword ? "text" : "password"}
            required={required}
            suppressHydrationWarning
            className={cn(
              "w-full bg-[#FBFAF7] border border-[#DDDCD5] text-[#24283A] placeholder-[#747683]/70 text-xs sm:text-sm rounded-xl h-9 sm:h-10 pl-9 pr-9 transition-colors focus:outline-none focus:border-[#5052C9] focus:ring-2 focus:ring-[#5052C9]/20",
              className
            )}
            {...props}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#747683] hover:text-[#24283A] focus:outline-none focus:text-[#5052C9] transition-colors p-1"
            aria-label={showPassword ? "Hide password" : "Show password"}
            tabIndex={0}
            suppressHydrationWarning
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    );
  }
);
AuthPasswordInput.displayName = "AuthPasswordInput";
