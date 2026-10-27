import React from "react";
import Link from "next/link";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";

interface SimpleAuthCardProps {
  children: React.ReactNode;
}

/**
 * Standard single-column card wrapper for utility authentication pages
 * (Password recovery, token verification, access-denied notices, etc.)
 */
export function SimpleAuthCard({ children }: SimpleAuthCardProps) {
  return (
    <div className="w-full h-full min-h-[100dvh] flex flex-col justify-center items-center py-6 px-4 overflow-y-auto">
      <div className="w-full max-w-lg mx-auto">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5 group">
          <UrPlacedLogo size="lg" priority className="h-10 w-10 group-hover:scale-105 transition-transform" />
          <span className="font-heading font-extrabold text-2xl tracking-tight text-text-primary">
            UrPlaced
          </span>
        </Link>
        <p className="mt-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          Multi-College Placement Preparation SaaS
        </p>
      </div>

      {/* Main Card Container */}
      <div className="bg-card py-8 px-6 shadow-md rounded-2xl border border-border sm:px-10">
        {children}
      </div>

      {/* Security & Invariant Footer */}
      <div className="mt-8 text-center text-xs text-text-muted space-y-1">
        <p>Secured with Supabase Authentication &amp; PostgreSQL Row-Level Security.</p>
        <p>Tenant isolation enforced at kernel layer.</p>
      </div>
      </div>
    </div>
  );
}
