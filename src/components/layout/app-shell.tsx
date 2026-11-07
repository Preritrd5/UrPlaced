"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  ShieldCheck,
  LogOut,
  Building,
  User,
  GraduationCap,
  Lock,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthContext } from "@/lib/auth/auth-context-provider";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
import { FloatingAIChatbot } from "@/components/ai/floating-ai-chatbot";
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
  const [maintenance, setMaintenance] = React.useState<{ enabled: boolean; message: string } | null>(null);
  const [pendingHref, setPendingHref] = React.useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuthContext();

  React.useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  // Lock body scroll and handle Escape key when mobile drawer is open
  React.useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  React.useEffect(() => {
    let mounted = true;
    fetch("/api/platform/maintenance")
      .then((r) => r.json())
      .then((data) => {
        if (mounted && data.enabled) {
          setMaintenance({ enabled: true, message: data.message });
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const role = auth.role || "STUDENT";
  const subStatus = (auth.tenant as any)?.subscriptionStatus;
  const canAccessOperational = (auth.tenant as any)?.canAccessOperational;
  const isGracePeriod = (auth.tenant as any)?.isGracePeriod || false;
  const gracePeriodEndsAt = (auth.tenant as any)?.gracePeriodEndsAt;

  // Resolve authorized navigation sections based on verified session context & subscription entitlement
  const navigationSections: NavigationSection[] = React.useMemo(() => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      return [];
    }
    // Option C: When tenant operational access is denied or subscription is PENDING_PAYMENT, pass "NO_SUBSCRIPTION" to lock nav
    const effectiveSubStatus =
      canAccessOperational === false || subStatus === "PENDING_PAYMENT"
        ? "NO_SUBSCRIPTION"
        : (subStatus || "ACTIVE");
    return getAuthorizedNavigation(role, auth.isPlatformAdmin, auth.permissions, effectiveSubStatus, isGracePeriod);
  }, [role, auth.permissions, auth.isAuthenticated, auth.isLoading, subStatus, canAccessOperational, isGracePeriod, auth.isPlatformAdmin]);

  // Warm-up prefetch navigation routes in idle background to guarantee instant route transitions
  React.useEffect(() => {
    if (!navigationSections.length) return;
    const prefetchRoutes = () => {
      navigationSections.forEach((section) => {
        section.items.forEach((item) => {
          try {
            router.prefetch(item.href);
          } catch {
            // Ignore prefetch errors
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
  }, [navigationSections, router]);

  // Only render Student/College Application Shell on /dashboard routes.
  // The public landing page (/), student/college auth routes (/auth/*),
  // and the Platform Super Admin environment (/preritrd/*) must NEVER
  // inherit the Student or College application shell, headers, sidebars, or account menus.
  if (!pathname || !pathname.startsWith("/dashboard")) {
    return <>{children}</>;
  }

  // Distraction-Free Active Examination Environment:
  // When an active assessment is being taken (/dashboard/student/assessments/[id]/take),
  // strictly hide Student Portal sidebar, top navbar, breadcrumbs, AI tutor, and floating chatbot.
  const isAssessmentTaking = /^\/dashboard\/student\/assessments\/[^/]+\/take/.test(pathname);
  if (isAssessmentTaking) {
    return <div className="min-h-screen bg-background text-text-primary antialiased">{children}</div>;
  }

  // SA-03 / SA-06 / SA-07 Option C: Strict Subscription Entitlement Enforcement:
  // If subscription is not ACTIVE (e.g. NO_SUBSCRIPTION, PENDING_PAYMENT, EXPIRED, CANCELED),
  // operational features are locked unless protected by 7-day grace period (Q1).
  const isPlacementHead = role === "PLACEMENT_HEAD" || auth.isPlatformAdmin;
  const isCollege =
    auth.accountCategory === "COLLEGE" ||
    ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(role);
  const isStudent = role === "STUDENT";

  const isProtectedByGrace = Boolean(isGracePeriod);
  const isLockedSubscription = Boolean(
    !auth.isLoading &&
    auth.isAuthenticated &&
    auth.tenant &&
    !auth.isPlatformAdmin &&
    (
      canAccessOperational === false ||
      subStatus === "PENDING_PAYMENT" ||
      (subStatus && subStatus !== "ACTIVE" && subStatus !== "TRIALING" && !isProtectedByGrace)
    )
  );

  const isPermittedRouteUnderLock = isPlacementHead
    ? pathname?.startsWith("/dashboard/billing") || pathname?.startsWith("/dashboard/profile")
    : pathname?.startsWith("/dashboard/profile");

  const defaultDashboard = getRoleDefaultDashboard(role);

  const roleDisplayNames: Record<string, string> = {
    STUDENT: "Student",
    PLACEMENT_HEAD: "Placement Head",
    PLACEMENT_STAFF: "Placement Officer",
    TRAINER: "Faculty / Trainer",
  };

  return (
    <div className="min-h-screen bg-background text-text-primary flex flex-col md:flex-row relative">
      {/* Instant route transition indicator */}
      {pendingHref && pendingHref !== pathname && (
        <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-[#7779D8] to-primary z-[99999] animate-pulse" />
      )}
      {/* Mobile Header Bar */}
      <header className="md:hidden flex items-center justify-between h-16 px-3.5 sm:px-4 bg-card border-b border-border sticky top-0 z-30">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 mr-2">
          <UrPlacedLogo size="sm" className="h-8 w-8 shrink-0" />
          <span className="font-heading font-bold text-base sm:text-lg text-text-primary shrink-0">
            UrPlaced
          </span>
          <span className="hidden xs:inline-block text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-primary-subtle)] text-primary truncate max-w-[100px]">
            {roleDisplayNames[role] || "Workspace"}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <ThemeToggle size="sm" />
          {auth.isAuthenticated && (
            <NotificationBell size="sm" />
          )}
          {auth.isAuthenticated && (
            <UserAccountMenu size="sm" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            className="h-9 w-9 p-0"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-[rgba(36,40,58,0.55)] z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop persistent, Mobile slide-over) */}
      <aside
        className={cn(
          "isolate fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-10 w-[min(310px,85vw)] sm:w-72 md:w-64 shrink-0 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 h-screen h-[100dvh] max-h-[100dvh] shadow-2xl md:shadow-none",
          mobileMenuOpen
            ? "translate-x-0 pointer-events-auto"
            : "-translate-x-full pointer-events-none md:pointer-events-auto"
        )}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 sm:px-5 border-b border-border shrink-0">
          <Link href={defaultDashboard} className="flex items-center gap-2.5 min-w-0" onClick={() => setMobileMenuOpen(false)}>
            <UrPlacedLogo size="md" className="h-9 w-9 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="font-heading font-bold text-lg tracking-tight text-text-primary block leading-none truncate">
                UrPlaced
              </span>
            </div>
          </Link>
          {mobileMenuOpen && (
            <button
              onClick={() => setMobileMenuOpen(false)}
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
          {auth.isLoading ? (
            /* Loading Skeleton to prevent premature unauthorized flash */
            <div className="space-y-4 px-2">
              <Skeleton className="h-3 w-20 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
              <Skeleton className="h-3 w-24 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full rounded-lg" />
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            </div>
          ) : (
            navigationSections.map((section) => (
              <div key={section.title} className="space-y-1">
                {/* <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
                  {section.title}
                </div> */}

                <div className="px-3 pb-1">
                  <div className="inline-flex items-center rounded-full border border-border-subtle bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-text-secondary shadow-xs font-mono">
                    {section.title}
                  </div>
                </div>

                {section.items.map((item) => {
                  const isOptimisticActive = pendingHref
                    ? (item.exactMatch ? pendingHref === item.href : pendingHref === item.href || pendingHref.startsWith(item.href + "/"))
                    : (item.exactMatch ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/"));

                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.id}
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
                        setMobileMenuOpen(false);
                      }}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none",
                        isOptimisticActive
                          ? "bg-[var(--color-primary-subtle)] text-primary font-semibold"
                          : "text-text-secondary hover:bg-[rgba(36,40,58,0.04)] hover:text-text-primary"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isOptimisticActive ? "text-primary" : "text-text-secondary"
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
        {/* Desktop Application Header */}
        <header className="hidden md:flex items-center justify-between h-16 px-6 lg:px-10 bg-card/85 backdrop-blur-sm border-b border-border sticky top-0 z-30 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {auth.accountCategory === "COLLEGE" ? (
              <div className="flex items-center gap-2 text-sm text-text-secondary truncate">
                <Building className="h-4 w-4 text-primary shrink-0" />
                <span className="font-semibold text-text-primary truncate">
                  {auth.tenant?.name || "College Placement Cell"}
                </span>
                <span className="text-border">&bull;</span>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-secondary border-secondary/60 font-mono">
                  {roleDisplayNames[role] || "Placement Head"}
                </Badge>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <GraduationCap className="h-4 w-4 text-secondary shrink-0" />
                <span className="font-semibold text-text-primary">Student Workspace</span>
                <span className="text-border">&bull;</span>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 text-primary border-primary/60 font-mono">
                  Placement Preparation
                </Badge>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {auth.availableTenants.length > 1 && (
              <Link
                href="/dashboard/select-tenant"
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary hover:bg-surface rounded-lg border border-border transition-colors"
              >
                <Building className="h-3.5 w-3.5" />
                <span>Switch College ({auth.availableTenants.length})</span>
              </Link>
            )}

            <ThemeToggle size="default" />

            {auth.isAuthenticated && (
              <NotificationBell size="default" />
            )}

            {auth.isAuthenticated && (
              <UserAccountMenu size="default" />
            )}
          </div>
        </header>

        <main className="flex-1 py-4 sm:py-8 px-3.5 sm:px-6 lg:px-10 max-w-7xl w-full mx-auto">
          {/* Scheduled Platform Maintenance Broadcast Banner */}
          {maintenance?.enabled && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 flex items-start gap-3 shadow-xs">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <span>Scheduled Platform Maintenance Active</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-amber-400 text-amber-800 dark:text-amber-200">
                    MAINTENANCE
                  </Badge>
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80 leading-relaxed">
                  {maintenance.message || "UrPlaced is performing scheduled maintenance. Some services may experience temporary interruptions."}
                </p>
              </div>
            </div>
          )}

          {/* Q1: 7-Day Renewal Grace Period Warning Banner */}
          {isProtectedByGrace && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-sm">
                    Subscription Renewal Notice — 7-Day Grace Period Active
                  </div>
                  <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">
                    Your subscription renewal is past due. All subscribed placement and preparation features remain fully active during your 7-day grace period
                    {gracePeriodEndsAt ? ` (active through ${new Date(gracePeriodEndsAt).toLocaleDateString()})` : ""}.
                    {isCollege ? " Please settle the outstanding renewal invoice to maintain uninterrupted operational access." : ""}
                  </p>
                </div>
              </div>
              {isPlacementHead && (
                <Button asChild size="sm" className="bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs shrink-0 h-9">
                  <Link href="/dashboard/billing">
                    <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Settle Invoice
                  </Link>
                </Button>
              )}
            </div>
          )}

          {isLockedSubscription && !isPermittedRouteUnderLock ? (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
              <div className="max-w-lg w-full bg-card border border-border p-6 sm:p-8 rounded-2xl shadow-xs space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 border border-amber-300 flex items-center justify-center mx-auto shadow-xs">
                  <Lock className="w-7 h-7" />
                </div>

                {isCollege ? (
                  // College / Placement Cell Lock Screen
                  <>
                    <div className="space-y-1.5">
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-[11px]">
                        {subStatus ? subStatus.replace("_", " ") : "NO ACTIVE SUBSCRIPTION (OPTION C)"}
                      </Badge>
                      <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary">
                        {subStatus === "PENDING_PAYMENT"
                          ? "College Subscription Payment Required"
                          : !subStatus
                          ? "Subscription Plan Selection Required (Option C)"
                          : "Operational Placement Access Suspended"}
                      </h2>
                      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                        The placement operations workspace for{" "}
                        <span className="font-semibold text-text-primary">{auth.tenant?.name || "your college"}</span>{" "}
                        {subStatus === "PENDING_PAYMENT"
                          ? "is locked pending initial subscription payment. Operational modules (student roster, recruitment drives, company directory, assessments, and analytics) become available immediately upon payment verification."
                          : !subStatus
                          ? "was invited without an initial pre-assigned plan (Option C). The Placement Head must select an approved subscription plan and complete payment checkout in the Billing portal before operational features can be activated."
                          : "is currently restricted due to an expired or suspended subscription. Settle your outstanding invoice to restore full operational access."}
                      </p>
                    </div>

                    {isPlacementHead ? (
                      <>
                        <div className="p-4 rounded-xl bg-background border border-border text-left text-xs space-y-2">
                          <div className="font-bold text-text-primary text-xs uppercase tracking-wider font-mono">
                            Permitted Administrative Access:
                          </div>
                          <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                            <li>Subscription &amp; Invoicing Portal</li>
                            <li>Placement Head Profile Management</li>
                            <li>Account &amp; Security Settings</li>
                            <li>Sign Out</li>
                          </ul>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                          <Button asChild className="flex-1 bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-10">
                            <Link href="/dashboard/billing">
                              <CreditCard className="w-4 h-4 mr-1.5" /> {!subStatus ? "Select Subscription Plan" : "View Subscription & Invoices"}
                            </Link>
                          </Button>
                          <Button asChild variant="outline" className="flex-1 text-xs h-10 border-border">
                            <Link href="/dashboard/profile">
                              <User className="w-4 h-4 mr-1.5" /> My Profile
                            </Link>
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-4 rounded-xl bg-background border border-border text-left text-xs space-y-2">
                          <div className="font-bold text-text-primary text-xs uppercase tracking-wider font-mono">
                            Institutional Notice:
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">
                            Subscription plan selection and invoice payments are managed by your institutional Placement Head. Please contact your Placement Head to restore operational access.
                          </p>
                        </div>

                        <div className="pt-2">
                          <Button asChild variant="outline" className="w-full text-xs h-10 border-border">
                            <Link href="/dashboard/profile">
                              <User className="w-4 h-4 mr-1.5" /> My Profile
                            </Link>
                          </Button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  // Student Lock Screen (Clean, non-leaking, supportive)
                  <>
                    <div className="space-y-1.5">
                      <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-mono text-[11px]">
                        INSTITUTIONAL SERVICE NOTICE
                      </Badge>
                      <h2 className="text-xl sm:text-2xl font-bold font-heading text-text-primary">
                        Placement Preparation Services Pending
                      </h2>
                      <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                        Placement preparation and drive services for students of{" "}
                        <span className="font-semibold text-text-primary">{auth.tenant?.name || "your institution"}</span>{" "}
                        are currently awaiting institutional subscription activation or renewal. Please contact your college Placement Cell for status updates.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-background border border-border text-left text-xs space-y-2">
                      <div className="font-bold text-text-primary text-xs uppercase tracking-wider font-mono">
                        Available Student Services:
                      </div>
                      <ul className="text-xs text-text-secondary space-y-1.5 list-disc list-inside">
                        <li>Student Profile &amp; Resume Details</li>
                        <li>Account &amp; Password Settings</li>
                        <li>Session Management &amp; Sign Out</li>
                      </ul>
                    </div>

                    <div className="pt-2">
                      <Button asChild className="w-full bg-primary hover:bg-[var(--color-primary-hover)] text-white text-xs h-10">
                        <Link href="/dashboard/profile">
                          <User className="w-4 h-4 mr-1.5" /> My Student Profile
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            children
          )}
        </main>

      </div>

      {/* Floating Draggable AI Chatbot */}
      {auth.isAuthenticated && <FloatingAIChatbot />}
    </div>
  );
}
