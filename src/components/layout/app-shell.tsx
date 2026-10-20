"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  ShieldCheck,
  LogOut,
  Building,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import {
  getAuthorizedNavigation,
  getRoleDefaultDashboard,
  type NavigationSection,
} from "@/lib/navigation/navigation-config";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();
  const auth = useAuthContext();

  const role = auth.role || "STUDENT";

  // Resolve authorized navigation sections based on verified session context
  const navigationSections: NavigationSection[] = React.useMemo(() => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      return [];
    }
    return getAuthorizedNavigation(role, false, auth.permissions);
  }, [role, auth.permissions, auth.isAuthenticated, auth.isLoading]);

  // If on public landing page or auth routes, render standalone without navigation sidebar
  if (pathname === "/" || pathname.startsWith("/auth")) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const defaultDashboard = getRoleDefaultDashboard(role);

  const roleDisplayNames: Record<string, string> = {
    STUDENT: "Student",
    PLACEMENT_HEAD: "Placement Head",
    PLACEMENT_STAFF: "Placement Officer",
    TRAINER: "Faculty / Trainer",
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col md:flex-row">
      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between h-16 px-4 bg-card border-b border-border sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary-gradient flex items-center justify-center text-white font-bold text-sm shadow-sm">
            UP
          </div>
          <span className="font-heading font-bold text-lg text-text-primary">
            UrPlaced
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-primary-subtle)] text-primary">
            {roleDisplayNames[role] || "Workspace"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-[rgba(36,40,58,0.40)] backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop persistent, Mobile slide-over) */}
      <aside
        className={cn(
          "fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-10 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 h-screen",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <Link href={defaultDashboard} className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary-gradient flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0">
              UP
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-heading font-bold text-lg tracking-tight text-text-primary block leading-none truncate">
                UrPlaced
              </span>
              <span className="text-[11px] text-text-secondary font-mono tracking-wider block truncate mt-0.5">
                {auth.accountCategory === "COLLEGE"
                  ? (auth.tenant?.name || "Placement Portal")
                  : "Student Workspace"}
              </span>
            </div>
          </Link>
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden text-text-secondary hover:text-text-primary p-1"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation Content */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {auth.isLoading ? (
            /* Loading Skeleton to prevent premature unauthorized flash */
            <div className="space-y-4 px-2 animate-pulse">
              <div className="h-3 w-20 bg-border/60 rounded" />
              <div className="space-y-2">
                <div className="h-8 bg-surface rounded-lg" />
                <div className="h-8 bg-surface rounded-lg" />
                <div className="h-8 bg-surface rounded-lg" />
              </div>
              <div className="h-3 w-24 bg-border/60 rounded pt-2" />
              <div className="space-y-2">
                <div className="h-8 bg-surface rounded-lg" />
                <div className="h-8 bg-surface rounded-lg" />
              </div>
            </div>
          ) : (
            navigationSections.map((section) => (
              <div key={section.title} className="space-y-1">
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
                  {section.title}
                </div>
                {section.items.map((item) => {
                  const isActive = item.exactMatch
                    ? pathname === item.href
                    : pathname === item.href || pathname.startsWith(item.href + "/");

                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none",
                        isActive
                          ? "bg-[var(--color-primary-subtle)] text-primary font-semibold"
                          : "text-text-secondary hover:bg-[rgba(36,40,58,0.04)] hover:text-text-primary"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-primary" : "text-text-secondary"
                          )}
                        />
                        <span className="truncate">{item.name}</span>
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
            ))
          )}
        </nav>

        {/* User Identity & Active College Section */}
        <div className="border-t border-border bg-card p-3 space-y-2">
          {/* Authenticated User Info */}
          {auth.isAuthenticated && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-surface border border-border/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                  {auth.fullName ? auth.fullName.charAt(0).toUpperCase() : <User className="h-3.5 w-3.5" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-text-primary truncate leading-tight">
                    {auth.fullName || auth.email}
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 mt-0.5 text-secondary border-secondary/40 font-mono">
                    {auth.accountCategory === "COLLEGE"
                      ? `College / Cell • ${roleDisplayNames[role] || "Placement Head"}`
                      : "Student"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={auth.signOut}
                title="Sign Out"
                className="h-7 w-7 text-text-secondary hover:text-text-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}

          {/* Multiple College Switcher Link */}
          {auth.availableTenants.length > 1 && (
            <Link
              href="/dashboard/select-tenant"
              className="flex items-center justify-center gap-1.5 py-1 text-[11px] font-medium text-primary hover:underline"
            >
              <Building className="h-3 w-3" />
              <span>Switch College ({auth.availableTenants.length})</span>
            </Link>
          )}

          {/* Tenant Isolation Badge */}
          <div className="flex items-center gap-2 text-[10px] text-text-secondary px-1 pt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-secondary shrink-0" />
            <span className="leading-tight truncate">
              {auth.accountCategory === "STUDENT" ? "Student Privacy Protected" : "Tenant Isolation Active"}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 py-8 px-4 sm:px-6 lg:px-10 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <footer className="py-6 px-4 sm:px-6 lg:px-10 border-t border-border text-center text-xs text-text-secondary bg-card">
          <p>
            UrPlaced Multi-College Placement Preparation &amp; Management Platform &bull; Enterprise V1.0
          </p>
        </footer>
      </div>
    </div>
  );
}
