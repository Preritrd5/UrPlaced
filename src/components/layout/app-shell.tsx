"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  Compass,
  Palette,
  Layers,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const pathname = usePathname();

  const navigation = [
    {
      name: "Design System Showcase",
      href: "/design-system",
      icon: Palette,
      badge: "Internal Dev",
    },
    {
      name: "Architecture & Blueprint",
      href: "/design-system/architecture",
      icon: Layers,
    },
    {
      name: "Phase Status",
      href: "/design-system/status",
      icon: Compass,
    },
  ];

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
            V1.0
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
        <div className="h-16 flex items-center justify-between px-6 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-primary-gradient flex items-center justify-center text-white font-bold text-base shadow-sm">
              UP
            </div>
            <div>
              <span className="font-heading font-bold text-lg tracking-tight text-text-primary block leading-none">
                UrPlaced
              </span>
              <span className="text-[10px] text-text-secondary font-mono tracking-wider">
                Multi-Tenant SaaS
              </span>
            </div>
          </div>
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

        {/* Navigation Section */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
            Foundation & Theme
          </div>
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors select-none",
                  isActive
                    ? "bg-[var(--color-primary-subtle)] text-primary font-semibold"
                    : "text-text-secondary hover:bg-[rgba(36,40,58,0.04)] hover:text-text-primary"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-text-secondary")} />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="pt-6 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
            Phase 01–10 Modules
          </div>
          <div className="px-3 py-2 text-xs text-text-muted space-y-2">
            <div className="p-2.5 rounded-lg border border-border bg-input">
              <div className="flex items-center gap-1.5 text-secondary font-semibold mb-1">
                <ChevronRight className="h-3.5 w-3.5" />
                <span>Phase 02 Active</span>
              </div>
              <p className="text-[11px] text-text-secondary leading-relaxed">
                Application Foundation, Tokens & Base UI System. Business modules load in Phases 03–10.
              </p>
            </div>
          </div>
        </nav>

        {/* Phase Guard Notice Footer */}
        <div className="p-4 border-t border-border bg-[rgba(36,40,58,0.02)]">
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <ShieldAlert className="h-4 w-4 text-secondary shrink-0" />
            <span className="text-[11px] leading-tight">
              Strict Design System locked. Production auth inactive in Phase 02.
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
            UrPlaced Multi-College Placement Preparation SaaS &bull; Strict Design System &bull; V1.0 Foundation
          </p>
        </footer>
      </div>
    </div>
  );
}
