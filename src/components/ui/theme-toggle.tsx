"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-provider";
import { cn } from "@/lib/utils";

export interface ThemeToggleProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "default" | "sm";
}

export function ThemeToggle({
  size = "default",
  className,
  ...props
}: ThemeToggleProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  // Prevent hydration mismatch by defaulting to light mode appearance until mounted
  const currentTheme = mounted ? theme : "light";
  const isDark = currentTheme === "dark";

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  const iconSizeClass = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      data-testid="theme-toggle-btn"
      className={cn(
        // Base layout
        "inline-flex items-center justify-center rounded-lg border transition-all duration-150 select-none cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50",
        // Dimensions
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        // Light Mode styling (Table 4.3)
        "bg-[#F8F7F3] text-[#24283A] border-[#D8D7D0] hover:bg-[#EDECE7] active:text-[#5052C9] focus-visible:ring-[#5052C9]/30",
        // Dark Mode styling (Table 4.3)
        "dark:bg-[#1B1E2A] dark:text-[#F2F1F8] dark:border-[#303548] dark:hover:bg-[#252A3A] dark:active:text-[#9294FF] dark:focus-visible:ring-[#9294FF]/40",
        className
      )}
      {...props}
    >
      {isDark ? (
        <Sun className={cn(iconSizeClass, "transition-transform text-[#F2F1F8]")} />
      ) : (
        <Moon className={cn(iconSizeClass, "transition-transform text-[#24283A]")} />
      )}
    </button>
  );
}
