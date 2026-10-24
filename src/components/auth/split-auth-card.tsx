import React from "react";
import Link from "next/link";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
import { cn } from "@/lib/utils";

export interface FeatureHighlight {
  icon: React.ElementType;
  title: string;
  description: string;
  tint?: "rose" | "cyan" | "amber" | "indigo" | "teal";
}

export interface SplitAuthCardProps {
  badgeText: string;
  subtitle: string;
  headline: string;
  description: string;
  features: FeatureHighlight[];
  footerLeft?: string;
  footerRight?: string;
  children: React.ReactNode;
}

const tintStyles = {
  rose: "bg-rose-950/40 text-rose-300 border-rose-800/40",
  cyan: "bg-cyan-950/40 text-cyan-300 border-cyan-800/40",
  amber: "bg-amber-950/40 text-amber-300 border-amber-800/40",
  indigo: "bg-indigo-950/40 text-indigo-300 border-indigo-800/40",
  teal: "bg-teal-950/40 text-teal-300 border-teal-800/40",
};

/**
 * Reusable split-screen authentication card matching the UrPlaced design system
 * and visual reference layout (dark promotional left panel, clean light form right panel).
 */
export function SplitAuthCard({
  badgeText,
  subtitle,
  headline,
  description,
  features,
  footerLeft = "UrPlaced 2026 Academic Session",
  footerRight = "UrPlaced",
  children,
}: SplitAuthCardProps) {
  return (
    <div className="w-full max-w-5xl xl:max-w-6xl mx-auto rounded-3xl lg:rounded-[2rem] bg-card border border-border shadow-2xl overflow-hidden my-4 sm:my-8">
      <div className="flex flex-col lg:flex-row min-h-[640px]">
        {/* Left Brand & Feature Information Panel */}
        <aside className="w-full lg:w-[44%] xl:w-[42%] bg-gradient-to-b from-[#13192B] via-[#0F1524] to-[#0A0D18] p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-white border-b lg:border-b-0 lg:border-r border-slate-800/80">
          <div className="space-y-6">
            {/* Top Brand Identity */}
            <Link href="/" className="inline-flex items-center gap-3 group">
              <UrPlacedLogo size="md" priority className="h-10 w-10 shrink-0 group-hover:scale-105 transition-transform" />
              <div>
                <span className="font-heading font-extrabold text-xl text-white tracking-tight leading-none block">
                  UrPlaced
                </span>
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#2E8F86] uppercase block mt-0.5">
                  {subtitle}
                </span>
              </div>
            </Link>

            {/* Account Category Pill Badge */}
            <div className="pt-2">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs font-medium text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden="true" />
                {badgeText}
              </span>
            </div>

            {/* Promotional Headline & Description */}
            <div className="space-y-2">
              <h1 className="font-heading font-extrabold text-2xl lg:text-3xl text-white tracking-tight leading-snug">
                {headline}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300/90 leading-relaxed">
                {description}
              </p>
            </div>

            {/* Feature Highlights List */}
            <div className="space-y-4 pt-2">
              {features.map((feat, idx) => {
                const Icon = feat.icon;
                const tint = feat.tint || "indigo";
                const tintClass = tintStyles[tint] || tintStyles.indigo;

                return (
                  <div key={idx} className="flex items-start gap-3.5 group">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border transition-transform group-hover:scale-105",
                        tintClass
                      )}
                      aria-hidden="true"
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white leading-snug">
                        {feat.title}
                      </div>
                      <div className="text-xs text-slate-400 leading-relaxed mt-0.5">
                        {feat.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Left Panel Footer */}
          <div className="border-t border-slate-800/80 pt-4 mt-8 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>{footerLeft}</span>
            <span className="font-semibold text-secondary">{footerRight}</span>
          </div>
        </aside>

        {/* Right Form Panel */}
        <main className="w-full lg:w-[56%] xl:w-[58%] bg-white p-6 sm:p-8 lg:p-12 flex flex-col justify-center">
          {children}
        </main>
      </div>
    </div>
  );
}
