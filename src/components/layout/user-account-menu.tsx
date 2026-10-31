"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Key,
  LogOut,
  ChevronDown,
  Building2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface UserAccountMenuProps {
  className?: string;
  size?: "sm" | "default";
}

/**
 * Returns formatted role display title matching UrPlaced security and portal specification:
 * - Student
 * - College · Placement Head
 * - College · Placement Staff
 * - College · Trainer
 */
export function formatUserRoleTitle(
  accountCategory: string | null | undefined,
  role: string | null | undefined
): string {
  if (accountCategory === "STUDENT" || role === "STUDENT") {
    return "Student";
  }
  switch (role) {
    case "PLACEMENT_HEAD":
      return "College · Placement Head";
    case "PLACEMENT_STAFF":
      return "College · Placement Staff";
    case "TRAINER":
      return "College · Trainer";
    default:
      return "College · Placement Head";
  }
}

/**
 * Derives 1-2 character initials from full name or email address
 */
export function getUserInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name && name.trim().length > 0) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email && email.trim().length > 0) {
    return email.slice(0, 2).toUpperCase();
  }
  return "UP";
}

export function UserAccountMenu({ className, size = "default" }: UserAccountMenuProps) {
  const auth = useAuthContext();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  // If unauthenticated or loading context, render nothing or skeleton
  if (!auth.isAuthenticated && !auth.isLoading) {
    return null;
  }

  if (auth.isLoading) {
    return (
      <div
        className={cn(
          "rounded-full bg-surface border border-border animate-pulse shrink-0",
          size === "sm" ? "h-8 w-8" : "h-9 w-9",
          className
        )}
        aria-hidden="true"
      />
    );
  }

  const roleTitle = formatUserRoleTitle(auth.accountCategory, auth.role);
  const initials = getUserInitials(auth.fullName, auth.email);
  const isStudent = auth.accountCategory === "STUDENT" || auth.role === "STUDENT";

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      setOpen(false);
      await auth.signOut();
    } catch {
      setIsSigningOut(false);
    }
  };

  const handleNavigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const avatarDimensions = size === "sm" ? "h-8 w-8 text-xs" : "h-9 w-9 text-sm";

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="header-avatar-button"
          aria-label="User account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          suppressHydrationWarning
          className={cn(
            "group relative flex items-center justify-center rounded-full p-0.5 transition-all outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "hover:ring-2 hover:ring-primary/40",
            open && "ring-2 ring-primary shadow-sm",
            className
          )}
        >
          <UserAvatar
            src={auth.avatarUrl}
            name={auth.fullName}
            email={auth.email}
            size={size === "sm" ? "sm" : "md"}
            alt={auth.fullName || "User profile photo"}
          />

          {/* Active Status Indicator Dot */}
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-card",
              isStudent ? "bg-secondary" : "bg-primary",
              size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
            )}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 max-w-[calc(100vw-1.5rem)] p-2 bg-card border-border shadow-lg rounded-2xl"
      >
        {/* User Identity Header */}
        <div className="p-2.5 bg-surface/80 rounded-xl border border-border mb-1 space-y-2">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={auth.avatarUrl}
              name={auth.fullName}
              email={auth.email}
              size="lg"
              alt={auth.fullName || "User profile photo"}
            />
            <div className="min-w-0 flex-1">
              <div className="font-heading font-semibold text-sm text-text-primary truncate">
                {auth.fullName || auth.email?.split("@")[0] || "User"}
              </div>
              <div className="text-xs text-text-secondary truncate font-mono">
                {auth.email}
              </div>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-mono px-2 py-0.5 tracking-tight border",
                isStudent
                  ? "bg-[rgba(46,143,134,0.10)] text-secondary border-secondary/50"
                  : "bg-primary/10 text-primary border-primary/50"
              )}
            >
              {isStudent ? (
                <GraduationCap className="h-3 w-3 mr-1 inline" />
              ) : (
                <Building2 className="h-3 w-3 mr-1 inline" />
              )}
              {roleTitle}
            </Badge>

            {auth.tenant?.name && (
              <span className="text-[10px] text-text-muted truncate max-w-[140px]" title={auth.tenant.name}>
                &bull; {auth.tenant.name}
              </span>
            )}
          </div>
        </div>

        {/* Menu Navigation Items */}
        <DropdownMenuItem
          data-testid="menu-item-profile"
          onClick={() => handleNavigate("/dashboard/profile")}
          className="cursor-pointer gap-2.5 py-2.5 rounded-lg hover:bg-surface focus:bg-[var(--color-primary-subtle)] focus:text-primary transition-colors"
        >
          <div className="h-7 w-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-xs text-text-primary leading-tight">My Profile</div>
            <div className="text-[11px] text-text-muted leading-tight">
              Personal info, goals &amp; metrics
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          data-testid="menu-item-settings"
          onClick={() => handleNavigate("/dashboard/profile#account-security")}
          className="cursor-pointer gap-2.5 py-2.5 rounded-lg hover:bg-surface focus:bg-[var(--color-primary-subtle)] focus:text-primary transition-colors"
        >
          <div className="h-7 w-7 rounded-md bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Key className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-xs text-text-primary leading-tight">Account &amp; Security</div>
            <div className="text-[11px] text-text-muted leading-tight">
              Password, MFA &amp; tenant security
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5" />

        <DropdownMenuItem
          data-testid="menu-item-signout"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="cursor-pointer gap-2.5 py-2.5 rounded-lg text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-700 transition-colors"
        >
          <div className="h-7 w-7 rounded-md bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <LogOut className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-xs leading-tight">
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
