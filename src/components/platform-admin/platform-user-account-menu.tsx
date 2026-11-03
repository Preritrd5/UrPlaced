"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Key,
  Bell,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { usePlatformAdminContext } from "./platform-admin-context";
import { cn } from "@/lib/utils";

export interface PlatformUserAccountMenuProps {
  className?: string;
  size?: "sm" | "default";
}

export function PlatformUserAccountMenu({
  className,
  size = "default",
}: PlatformUserAccountMenuProps) {
  const { admin } = usePlatformAdminContext();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      setOpen(false);

      // 1. Revoke client Supabase Auth session
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // non-fatal
      }

      // 2. Call server-side logout route to clear HTTP cookies
      try {
        await fetch("/api/preritrd/auth/logout", { method: "POST" });
      } catch {
        // non-fatal
      }

      // 3. Document navigation to login page
      window.location.replace("/preritrd/login");
    } catch {
      setIsSigningOut(false);
    }
  };

  const handleNavigate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="platform-admin-avatar-button"
          aria-label="Platform Super Admin account menu"
          aria-haspopup="menu"
          aria-expanded={open}
          suppressHydrationWarning
          className={cn(
            "group relative flex items-center justify-center rounded-full p-0.5 transition-all outline-none",
            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "hover:ring-2 hover:ring-primary/40",
            open && "ring-2 ring-primary shadow-xs",
            className
          )}
        >
          <UserAvatar
            src={admin.avatarUrl}
            name={admin.fullName}
            email={admin.email}
            size={size === "sm" ? "sm" : "md"}
            alt={admin.fullName || "Super Admin Profile"}
          />

          {/* Active Status Indicator Dot */}
          <span
            className={cn(
              "absolute bottom-0 right-0 block rounded-full ring-2 ring-card bg-secondary",
              size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5"
            )}
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 max-w-[calc(100vw-1.5rem)] p-2 bg-card border-border shadow-lg rounded-2xl font-sans"
      >
        {/* Administrator Identity Header */}
        <div className="p-2.5 bg-surface/80 rounded-xl border border-border mb-1 space-y-2">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={admin.avatarUrl}
              name={admin.fullName}
              email={admin.email}
              size="lg"
              alt={admin.fullName || "Super Admin Profile"}
            />
            <div className="min-w-0 flex-1">
              <div className="font-heading font-bold text-sm text-text-primary truncate">
                {admin.fullName || "Platform Super Admin"}
              </div>
              <div className="text-xs text-text-secondary truncate font-mono">
                {admin.email}
              </div>
            </div>
          </div>

          <div className="pt-0.5 flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className="text-[10px] font-mono font-bold px-2 py-0.5 tracking-tight border bg-primary/10 text-primary border-primary/30"
            >
              <ShieldCheck className="h-3 w-3 mr-1 inline" />
              SUPER ADMIN
            </Badge>

            <span className="text-[10px] text-text-secondary font-medium flex items-center gap-1 font-mono">
              &bull; <span>UrPlaced Platform</span>
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <DropdownMenuItem
          data-testid="platform-menu-item-profile"
          onClick={() => handleNavigate("/preritrd/profile")}
          className="cursor-pointer gap-2.5 py-2 rounded-xl text-text-primary hover:bg-surface focus:bg-surface transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <User className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs text-text-primary leading-tight font-heading">
              My Profile
            </div>
            <div className="text-[11px] text-text-secondary leading-tight">
              Personal information, profile photo &amp; account details
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          data-testid="platform-menu-item-security"
          onClick={() => handleNavigate("/preritrd/profile#security")}
          className="cursor-pointer gap-2.5 py-2 rounded-xl text-text-primary hover:bg-surface focus:bg-surface transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
            <Key className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs text-text-primary leading-tight font-heading">
              Account &amp; Security
            </div>
            <div className="text-[11px] text-text-secondary leading-tight">
              Password, MFA &amp; platform security
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          data-testid="platform-menu-item-notifications"
          onClick={() => handleNavigate("/preritrd/profile#notifications")}
          className="cursor-pointer gap-2.5 py-2 rounded-xl text-text-primary hover:bg-surface focus:bg-surface transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bell className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs text-text-primary leading-tight font-heading">
              Notification Preferences
            </div>
            <div className="text-[11px] text-text-secondary leading-tight">
              Platform alerts &amp; communication settings
            </div>
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 bg-border/60" />

        <DropdownMenuItem
          data-testid="platform-menu-item-signout"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="cursor-pointer gap-2.5 py-2 rounded-xl text-status-danger hover:bg-status-danger-subtle focus:bg-status-danger-subtle focus:text-status-danger transition-colors"
        >
          <div className="h-7 w-7 rounded-lg bg-status-danger-subtle text-status-danger flex items-center justify-center shrink-0">
            <LogOut className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-xs leading-tight font-heading">
              {isSigningOut ? "Signing out..." : "Sign Out"}
            </div>
            <div className="text-[11px] text-text-secondary leading-tight">
              Revoke session &amp; return to login
            </div>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
