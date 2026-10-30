"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";

export interface AuthSplitLayoutProps {
  children: React.ReactNode;
  headlineLines: string[];
  supportingText: string;
  backHref?: string;
  backLabel?: string;
  accentStroke?: boolean;
}

/**
 * Official UrPlaced Brand Monogram & Wordmark Logo with teal curved accent
 */
export function UrPlacedBrandLogo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 group select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 rounded-lg py-0.5",
        className
      )}
    >
      <div className="relative h-8 w-8 sm:h-9 sm:w-9 shrink-0">
        <Image
          src="/assets/logo.png"
          alt="UrPlaced"
          width={36}
          height={36}
          priority
          className="w-full h-full object-contain pointer-events-none group-hover:scale-105 transition-transform"
        />
      </div>
      <div className="relative flex flex-col justify-center">
        <span className="font-heading font-extrabold text-xl sm:text-2xl text-[#24283A] tracking-tight leading-none">
          UrPlaced
        </span>
        {/* Teal curved accent stroke under "Placed" matching brand geometry */}
        <svg
          viewBox="0 0 60 8"
          className="w-11 sm:w-12 h-1.5 text-[#2E8F86] self-end -mt-0.5"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M 2 6 C 20 1, 40 1, 58 6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </Link>
  );
}

/**
 * Shared split-screen authentication layout enforcing:
 * - Full viewport composition without outer card/box
 * - Strictly ZERO page or container scrollbars (height locked to 100dvh)
 * - Large convex indigo-purple promotional panel on right with teal curved accent
 * - Clean, compact, accessible form on left
 */
export function AuthSplitLayout({
  children,
  headlineLines,
  supportingText,
  backHref = "/",
  backLabel = "Back to Home",
  accentStroke = true,
}: AuthSplitLayoutProps) {
  return (
    <main className="min-h-screen min-h-[100dvh] h-auto lg:h-[100dvh] w-full overflow-y-auto lg:overflow-hidden bg-[#EDECE7] flex flex-col lg:flex-row relative select-none">
      {/* =========================================================================
          LEFT SIDE: Form Area (52%–54% width on desktop)
          ========================================================================= */}
      <section className="w-full lg:w-[53%] xl:w-[54%] min-h-full h-auto lg:h-full flex flex-col justify-between px-4 sm:px-10 lg:px-14 xl:px-20 py-4 sm:py-6 lg:py-8 overflow-y-auto lg:overflow-hidden z-20">
        <div className="w-full max-w-[460px] mx-auto min-h-full h-auto lg:h-full flex flex-col justify-between min-h-0">
          {/* Top navigation row */}
          <div className="shrink-0 flex items-center justify-between">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#5052C9] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5052C9]/50 rounded"
            >
              <ArrowLeft className="h-4 w-4 stroke-[2.5]" /> {backLabel}
            </Link>
            <ThemeToggle size="sm" />
          </div>

          {/* Form Content */}
          <div className="flex-1 flex flex-col justify-center min-h-0 py-1 sm:py-2">
            {children}
          </div>
        </div>
      </section>

      {/* =========================================================================
          RIGHT SIDE: Curved Indigo-Purple Promotional Panel (46%–47% width)
          Matches media_1793107791965_28e899bc.png & media_1793108047269_3c5c7008.png
          ========================================================================= */}
      <aside
        className="hidden lg:flex lg:w-[47%] xl:w-[46%] h-full relative bg-[#5052C9] items-center justify-center p-8 lg:p-12 xl:p-16 overflow-hidden select-none shrink-0"
        aria-hidden="true"
      >
        {/* Vector SVG Convex Arc protruding seamlessly into left column */}
        <svg
          className="absolute top-0 -left-28 sm:-left-36 xl:-left-44 2xl:-left-52 h-full w-28 sm:w-36 xl:w-44 2xl:w-52 fill-[#5052C9] pointer-events-none z-10"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M 100 0 C 10 25, 10 75, 100 100 L 100 0 Z" />
        </svg>

        {/* Decorative subtle translucent waves in bottom right corner */}
        <svg
          viewBox="0 0 600 400"
          preserveAspectRatio="none"
          className="absolute -bottom-6 -right-6 w-[85%] h-[48%] pointer-events-none z-10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M 0 400 C 180 300, 380 350, 600 240 L 600 400 Z"
            fill="white"
            fillOpacity="0.07"
          />
          <path
            d="M 120 400 C 280 320, 440 370, 600 300 L 600 400 Z"
            fill="white"
            fillOpacity="0.05"
          />
        </svg>

        {/* Promotional Content with White Brand Logo */}
        <div className="relative z-20 max-w-[360px] xl:max-w-[420px] text-white space-y-6">
          {/* White UrPlaced Logo */}
          <div className="flex items-center gap-3">
            {/* <div className="relative h-11 w-11 xl:h-12 xl:w-12 shrink-0">
              <Image
                src="/assets/logo.png"
                alt="UrPlaced"
                width={48}
                height={48}
                priority
                className="w-full h-full object-contain brightness-0 invert pointer-events-none"
              />
            </div> */}

            <div className="relative h-11 w-11 xl:h-12 xl:w-12 shrink-0">
              <Image
                src="/assets/logo.png"
                alt="UrPlaced"
                width={48}
                height={48}
                priority
                className="h-full w-full object-contain pointer-events-none !filter-none"
                style={{ filter: "none", opacity: 1, mixBlendMode: "normal" }}
              />
            </div>

            <div className="relative flex flex-col justify-center">
              <span className="font-heading font-extrabold text-2xl xl:text-3xl text-white tracking-tight leading-none">
                UrPlaced
              </span>
              {/* Teal curved accent stroke under "Placed" */}
              <svg
                viewBox="0 0 60 8"
                className="w-12 xl:w-14 h-2 text-[#2E8F86] self-end -mt-0.5"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M 2 6 C 20 1, 40 1, 58 6"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Headline */}
          <div>
            <h2 className="font-heading font-extrabold text-4xl sm:text-5xl xl:text-6xl text-white tracking-tight leading-[1.08]">
              {headlineLines.map((line, i) => (
                <span key={i} className="block">
                  {line}
                </span>
              ))}
            </h2>

            {/* Teal curved accent stroke under key phrase */}
            {accentStroke && (
              <svg
                viewBox="0 0 160 14"
                className="w-36 sm:w-44 xl:w-52 h-3.5 sm:h-4 text-[#2E8F86] mt-2 mb-2"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M 3 10 C 50 2, 110 2, 157 10"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>

          <p className="text-white/90 text-sm sm:text-base xl:text-lg font-normal leading-relaxed">
            {supportingText}
          </p>
        </div>
      </aside>
    </main>
  );
}
