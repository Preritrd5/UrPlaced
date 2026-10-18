import React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-primary-gradient flex items-center justify-center text-white font-bold text-lg shadow-sm">
            UP
          </div>
          <span className="font-heading font-extrabold text-2xl tracking-tight text-text-primary">
            UrPlaced
          </span>
        </Link>
        <p className="mt-2 text-xs font-mono uppercase tracking-wider text-text-secondary">
          Multi-College Placement Preparation SaaS
        </p>
      </div>

      {/* Main Auth Card Container */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card py-8 px-6 shadow-md rounded-2xl border border-border sm:px-10">
          {children}
        </div>
      </div>

      {/* Security & Invariant Footer */}
      <div className="mt-8 text-center text-xs text-text-muted">
        <p>Secured with Supabase Authentication &amp; PostgreSQL Row-Level Security.</p>
        <p className="mt-1">Tenant isolation enforced at kernel layer.</p>
      </div>
    </div>
  );
}
