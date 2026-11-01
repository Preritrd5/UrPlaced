
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
  LogOut,
  ShieldCheck,
  Menu,
  X,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";

export interface PlatformNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
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

    window.location.replace("/preritrd/login");
  }

  const navContent = (
    <div className="flex flex-col h-full bg-[#F8F7F3] border-r border-[#B8B6AC] text-[#24283A] w-64 select-none">

      {/* Platform Branding */}
      <div className="p-5 border-b border-[#B8B6AC]/40 flex items-center justify-between">
        <Link
          href="/preritrd/dashboard"
          className="flex items-center gap-2.5"
        >
          <img
            src="/assets/logo.png"
            alt="UrPlaced Logo"
            className="h-9 w-9 rounded-xl object-contain shadow-sm"
          />

          <div>
            <div className="font-heading font-extrabold text-base tracking-tight text-[#24283A]">
              UrPlaced
            </div>
          </div>
        </Link>

        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1.5 rounded-lg text-[#747683] hover:bg-[#EDECE7]"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav Link Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {PLATFORM_NAVIGATION.map((group) => (
          <div key={group.section} className="space-y-1">

            <div className="px-3 text-[10px] font-mono font-bold uppercase tracking-wider text-[#747683]">
              {group.section}
            </div>

            <div className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                      isActive
                        ? "bg-[#5052C9] text-white shadow-xs font-semibold"
                        : "text-[#292D40] hover:bg-[#EDECE7] hover:text-[#24283A]"
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-white" : "text-[#747683]"
                        )}
                      />

                      <span>{item.title}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={cn(
                          "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider",
                          isActive
                            ? "bg-white/20 text-white"
                            : "bg-[#2E8F86]/15 text-[#2E8F86] border border-[#2E8F86]/30"
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  );

  return (
    <>
      {/* Mobile Top Toggle Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#F8F7F3] border-b border-[#B8B6AC] sticky top-0 z-30">
        <div className="flex items-center gap-2">

          <div className="h-7 w-7 rounded-lg bg-[#5052C9] text-white flex items-center justify-center font-heading font-extrabold text-xs">
            UP
          </div>

          <span className="font-heading font-extrabold text-sm text-[#24283A]">
            UrPlaced Super Admin
          </span>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setMobileOpen(true)}
          className="h-8 px-2 border-[#B8B6AC]"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen z-20">
        {navContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">

          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />

          <div className="relative z-50 h-full">
            {navContent}
          </div>

        </div>
      )}
    </>
  );
}

export function PlatformTopNavbar({
  adminName,
  adminEmail,
}: {
  adminName: string;
  adminEmail: string;
}) {
  const pathname = usePathname();

  // ========================================================
  // HYDRATION FIX — THEME TOGGLE
  // Render the same placeholder on the server and first
  // client render. Mount ThemeToggle after hydration.
  // ========================================================

  const [themeToggleMounted, setThemeToggleMounted] =
    React.useState(false);

  React.useEffect(() => {
    setThemeToggleMounted(true);
  }, []);

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

    window.location.replace("/preritrd/login");
  }

  // Derive current page title from pathname
  const currentTitle = React.useMemo(() => {
    for (const group of PLATFORM_NAVIGATION) {
      const match = group.items.find(
        (item) => item.href === pathname
      );

      if (match) return match.title;
    }

    if (pathname.includes("/colleges/new")) {
      return "Register College";
    }

    if (pathname.includes("/colleges/")) {
      return "College Details";
    }

    return "Platform Administration";
  }, [pathname]);

  return (
    <header className="bg-[#F8F7F3] border-b border-[#B8B6AC]/40 px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-10">

      <div className="flex items-center gap-2 text-xs text-[#747683]">
        <span className="font-bold text-[#24283A] font-heading text-sm">
          {currentTitle}
        </span>
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3">

        {/* Theme Control — Hydration Safe */}
        {themeToggleMounted ? (
          <ThemeToggle size="sm" />
        ) : (
          <div
            aria-hidden="true"
            className="h-8 w-8 rounded-full border border-[#B8B6AC] bg-[#F8F7F3]"
          />
        )}

        {/* Administrator Account Context */}
        <div className="hidden sm:block text-right">
          <div className="text-xs font-bold text-[#24283A] font-heading">
            {adminName}
          </div>

          <div className="text-[10px] text-[#747683] font-mono">
            Super Admin
          </div>
        </div>

        {/* Secure Logout Action */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out of Platform Control Plane"
          className="h-8 px-2 sm:px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </Button>

      </div>
    </header>
  );
}
