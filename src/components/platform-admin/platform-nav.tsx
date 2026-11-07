"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  PlusCircle,
  CreditCard,
  Receipt,
  BarChart3,
  Sliders,
  Users2,
  FileText,
  Activity,
  ShieldCheck,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
import { PlatformNotificationBell } from "./platform-notification-bell";
import { PlatformUserAccountMenu } from "./platform-user-account-menu";

export interface PlatformNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  exactMatch?: boolean;
}

export const PLATFORM_NAVIGATION: {
  section: string;
  items: PlatformNavItem[];
}[] = [
    {
      section: "Control Plane",
      items: [
        {
          title: "Platform Dashboard",
          href: "/preritrd/dashboard",
          icon: LayoutDashboard,
          exactMatch: true,
        },
        {
          title: "College Management",
          href: "/preritrd/colleges",
          icon: Building2,
        },
        {
          title: "Register College",
          href: "/preritrd/colleges/new",
          icon: PlusCircle,
          badge: "Onboarding",
          exactMatch: true,
        },
      ],
    },
    {
      section: "Subscriptions & Billing",
      items: [
        {
          title: "Subscription Plans",
          href: "/preritrd/subscriptions",
          icon: CreditCard,
        },
        {
          title: "Billing & Invoices",
          href: "/preritrd/billing",
          icon: Receipt,
        },
      ],
    },
    {
      section: "Intelligence & Settings",
      items: [
        {
          title: "Platform Analytics",
          href: "/preritrd/analytics",
          icon: BarChart3,
        },
        {
          title: "Configuration",
          href: "/preritrd/configuration",
          icon: Sliders,
        },
        {
          title: "Super Admins",
          href: "/preritrd/accounts",
          icon: Users2,
        },
      ],
    },
    {
      section: "Operations & Governance",
      items: [
        {
          title: "Platform Audit Logs",
          href: "/preritrd/audit-logs",
          icon: FileText,
        },
        {
          title: "System Health",
          href: "/preritrd/system-health",
          icon: Activity,
          badge: "Live",
        },
      ],
    },
  ];

export function PlatformSidebar({
  adminEmail,
  adminName,
}: {
  adminEmail: string;
  adminName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);

  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // Lock body scroll and handle Escape key when mobile drawer is open
  React.useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  // Warm up platform admin routes in idle background for instant navigation
  React.useEffect(() => {
    const prefetchRoutes = () => {
      PLATFORM_NAVIGATION.forEach((group) => {
        group.items.forEach((item) => {
          try {
            router.prefetch(item.href);
          } catch {
            // Non-fatal
          }
        });
      });
    };

    if (typeof window !== "undefined") {
      if ("requestIdleCallback" in window) {
        const handle = (window as any).requestIdleCallback(prefetchRoutes, { timeout: 2000 });
        return () => {
          if ("cancelIdleCallback" in window) {
            (window as any).cancelIdleCallback(handle);
          }
        };
      } else {
        const timer = setTimeout(prefetchRoutes, 500);
        return () => clearTimeout(timer);
      }
    }
  }, [router]);

  async function handleLogout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // non-fatal
    }

    try {
      await fetch("/api/preritrd/auth/logout", { method: "POST" });
    } catch {
      // non-fatal
    }

    window.location.href = "/preritrd/login";
  }

  return (
    <>
      {/* Instant route transition indicator */}
      {pendingHref && pendingHref !== pathname && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-[#7779D8] to-primary z-[99999] animate-pulse" />
      )}
      {/* Mobile Top Navigation Header */}
      <header className="md:hidden flex items-center justify-between h-16 px-3.5 sm:px-4 bg-card border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 mr-2">
          <UrPlacedLogo size="sm" className="h-8 w-8 shrink-0" />
          <span className="font-heading font-bold text-base sm:text-lg text-text-primary shrink-0">
            UrPlaced
          </span>
          <span className="hidden xs:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-primary-subtle)] text-primary truncate max-w-[120px] font-mono">
            Super Admin
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle size="sm" />
          <PlatformNotificationBell size="sm" />
          <PlatformUserAccountMenu size="sm" />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            className="h-9 w-9 p-0"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-[rgba(36,40,58,0.50)] backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Desktop persistent sticky, Mobile slide-over drawer */}
      <aside
        className={cn(
          "fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-10 w-[min(310px,85vw)] sm:w-72 md:w-64 shrink-0 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 h-[100dvh] max-h-[100dvh] h-screen shadow-2xl md:shadow-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-5 border-b border-border shrink-0">
          <Link href="/preritrd/dashboard" className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileOpen(false)}>
            <UrPlacedLogo size="md" className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-heading font-bold text-base tracking-tight text-text-primary block leading-none whitespace-nowrap">
                UrPlaced Super Admin
              </span>
            </div>
          </Link>

          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden text-text-secondary hover:text-text-primary p-1.5 rounded-lg hover:bg-[rgba(36,40,58,0.06)] dark:hover:bg-white/10 transition-colors shrink-0 ml-1"
              aria-label="Close menu"
              suppressHydrationWarning
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {PLATFORM_NAVIGATION.map((group) => (
            <div key={group.section} className="space-y-1">
              {/* Section Header Pill */}
              <div className="px-3 pb-1">
                <div className="inline-flex items-center rounded-full border border-gray-800/40 bg-white/50 dark:border-white/20 dark:bg-white/10 dark:text-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-black backdrop-blur-md shadow-xs font-mono">
                  {group.section}
                </div>
              </div>

              {/* Menu Items */}
              {group.items.map((item) => {
                const isOptimisticActive = pendingHref
                  ? (item.exactMatch ? pendingHref === item.href : (pendingHref === item.href || (pendingHref.startsWith(item.href + "/") && item.href !== "/preritrd/dashboard")))
                  : (item.exactMatch ? pathname === item.href : (pathname === item.href || (pathname.startsWith(item.href + "/") && item.href !== "/preritrd/dashboard")));
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onMouseEnter={() => {
                      try {
                        router.prefetch(item.href);
                      } catch {}
                    }}
                    onFocus={() => {
                      try {
                        router.prefetch(item.href);
                      } catch {}
                    }}
                    onClick={() => {
                      setPendingHref(item.href);
                      setMobileOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none",
                      isOptimisticActive
                        ? "bg-[var(--color-primary-subtle)] text-primary font-semibold"
                        : "text-text-secondary hover:bg-[rgba(36,40,58,0.04)] dark:hover:bg-white/5 hover:text-text-primary"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          isOptimisticActive ? "text-primary" : "text-text-secondary"
                        )}
                      />
                      <span className="truncate">{item.title}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-white ml-2">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer — Super Admin Control Plane Indicator & Sign Out */}
        <div className="border-t border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2 text-[10px] text-text-secondary px-1 pt-1 font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-secondary shrink-0" />
            <span className="leading-tight truncate">
              Super Admin Control Plane
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="w-full justify-start text-xs text-text-secondary hover:text-text-primary hover:bg-surface gap-2 h-8"
          >
            <LogOut className="h-3.5 w-3.5 text-text-secondary" />
            <span>Sign Out</span>
          </Button>
        </div>
      </aside>
    </>
  );
}

export function PlatformTopNavbar({
  adminName,
  adminEmail,
}: {
  adminName?: string;
  adminEmail?: string;
}) {
  const pathname = usePathname();

  // Derive current page title from pathname
  const currentTitle = React.useMemo(() => {
    for (const group of PLATFORM_NAVIGATION) {
      const match = group.items.find((item) =>
        item.exactMatch
          ? item.href === pathname
          : pathname === item.href || pathname.startsWith(item.href + "/")
      );
      if (match) return match.title;
    }

    if (pathname.includes("/colleges/new")) {
      return "Register College";
    }

    if (pathname.includes("/colleges/")) {
      return "College Details";
    }

    if (pathname.includes("/profile")) {
      return "Administrator Profile";
    }

    return "Platform Administration";
  }, [pathname]);

  return (
    <header className="hidden md:flex items-center justify-between h-16 px-6 lg:px-10 bg-card/85 backdrop-blur-sm border-b border-border sticky top-0 z-30 shrink-0">
      {/* Left: Control Plane Context Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 text-sm text-text-secondary truncate">
          <Badge
            variant="outline"
            className="text-sm px-2 py-1 text-secondary border-secondary/60 font-mono"
          >
            {currentTitle}
          </Badge>
          <Badge
            variant="outline"
            className="hidden sm:inline-flex text-[10px] px-2 py-0.5 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 bg-emerald-500/10 font-mono"
          >
            Strict Option A Enforced
          </Badge>
        </div>
      </div>

      {/* Right: Theme Toggle, Notifications, Account Menu */}
      <div className="flex items-center gap-3">
        <ThemeToggle size="default" />
        <PlatformNotificationBell size="default" />
        <PlatformUserAccountMenu size="default" />
      </div>
    </header>
  );
}
