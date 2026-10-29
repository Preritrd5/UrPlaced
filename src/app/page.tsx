"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Building2,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Target,
  BarChart3,
  Sparkles,
  ChevronRight,
  Award,
  Lock,
  Menu,
  X,
  UserPlus,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#E0EAFE_0%,#D9DDF9_45%,#C5CEDB_100%)] dark:bg-[linear-gradient(135deg,#111318_0%,#181B27_50%,#111318_100%)] text-text-primary flex flex-col selection:bg-primary/20">

      {/* 1. Global Public Navigation Header */}
      <header className="sticky top-4 z-50 mx-4 sm:mx-6 lg:mx-10 rounded-[2rem] md:rounded-full border-2 border-slate-400/70 dark:border-border bg-gradient-to-r from-orange-50/95 via-white/95 to-sky-50/95 dark:from-[#1B1E2A]/95 dark:via-[#1B1E2A]/95 dark:to-[#1B1E2A]/95 shadow-[0_10px_35px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all">
        <div className="relative w-full px-5 sm:px-8 lg:px-10 h-20 flex items-center justify-between">

          {/* Brand - Left Corner */}
          <Link href="/" className="flex items-center gap-2.5 sm:gap-3 group shrink-0">
            <UrPlacedLogo
              size="lg"
              priority
              className="h-9 w-9 sm:h-11 sm:w-11 group-hover:scale-105 transition-transform"
            />
            <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-text-primary leading-none">
              UrPlaced
            </span>
          </Link>

          {/* Center Navigation */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 lg:gap-3">
            <a
              href="#solutions"
              className="px-3 lg:px-4 py-2 rounded-lg text-[15px] font-semibold text-slate-700 hover:text-primary hover:bg-slate-900/5 transition-colors whitespace-nowrap"
            >
              Platform
            </a>
            <a
              href="#students"
              className="px-3 lg:px-4 py-2 rounded-lg text-[15px] font-semibold text-slate-700 hover:text-primary hover:bg-slate-900/5 transition-colors whitespace-nowrap"
            >
              For Students & Colleges
            </a>
            <a
              href="#how-it-works"
              className="px-3 lg:px-4 py-2 rounded-lg text-[15px] font-semibold text-slate-700 hover:text-primary hover:bg-slate-900/5 transition-colors whitespace-nowrap"
            >
              How It Works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-lg text-base font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Features
            </a>
          </nav>

          {/* Student Login & Theme Toggle - Right Corner */}
          <div className="hidden sm:flex items-center gap-3 shrink-0">
            <ThemeToggle size="default" />
            <Button
              asChild
              variant="outline"
              className="h-11 px-5 rounded-xl text-sm font-semibold border-slate-300 dark:border-border bg-white/60 dark:bg-[#1B1E2A] hover:border-primary hover:bg-orange-50 dark:hover:bg-[#252A3A] text-slate-800 dark:text-text-primary transition-colors"
            >
              <Link href="/auth/signin">
                <GraduationCap className="h-4 w-4 mr-1.5 text-primary" />
                Student Login
              </Link>
            </Button>
          </div>

          {/* Mobile Menu Controls */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle size="sm" />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
              className="h-9 w-9 text-slate-800 dark:text-text-primary"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 dark:border-border px-4 pt-3 pb-6 space-y-3 bg-white/95 dark:bg-[#1B1E2A]/95 rounded-b-[2rem]">
            <div className="flex flex-col space-y-1">
              <a
                href="#solutions"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-base font-semibold text-slate-700 dark:text-text-secondary hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Platform
              </a>
              <a
                href="#students"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-base font-semibold text-slate-700 dark:text-text-secondary hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                For Students and Colleges
              </a>

              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-base font-semibold text-slate-700 dark:text-text-secondary hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                How It Works
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-base font-semibold text-slate-700 dark:text-text-secondary hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                Features
              </a>

            </div>

            <div className="pt-3 border-t border-slate-200/80 dark:border-border">
              <Button
                asChild
                variant="outline"
                className="w-full justify-center h-10 text-xs font-semibold border-slate-300 dark:border-border text-slate-800 dark:text-text-primary bg-white dark:bg-[#151821]"
              >
                <Link href="/auth/signin">Student Sign In</Link>
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* 2. Expanded Hero Section (Fills Viewport Naturally) */}
      <section className="relative min-h-[calc(100vh-5rem)] flex flex-col justify-between py-10 md:py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full my-auto">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            {/* Top Enterprise Badge */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl sm:rounded-full bg-card border border-border text-xs sm:text-sm font-medium text-text-secondary shadow-sm max-w-full text-center">
              <Badge variant="secondary" className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-secondary text-white shrink-0">
                Multi-College Placement SaaS
              </Badge>
              <span className="text-center">Student Preparation &amp; Institutional Placement Management</span>
            </div>

            {/* Core Hero Headline */}
            <h1 className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-text-primary font-heading leading-[1.12]">
              Your Career Starts Here.
            </h1>

            {/* Value Proposition Subtitle */}
            <p className="text-lg sm:text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
              The intelligent placement ecosystem connecting students and higher-education institutions with industry hiring standards. Turn campus recruitment into verifiable student mastery and streamlined, high-trust institutional operations.
            </p>

            {/* Action Buttons */}
            {/* <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">

              <Button
                asChild
                variant="outline"
                size="lg"
                className="w-full sm:w-auto h-14 px-8 text-base font-semibold border-2 border-border bg-card hover:bg-surface hover:border-primary text-text-primary rounded-xl shadow-sm transition-all"
              >
                <Link href="/auth/signin" className="inline-flex items-center justify-center gap-2.5">
                  <GraduationCap className="h-5 w-5 text-primary" />
                  <span>Student Practice Portal</span>
                </Link>
              </Button>
            </div> */}
          </div>

          {/* Viewport Anchor: 4 Pillar Proof Card */}
          <div className="max-w-6xl mx-auto w-full mt-12 md:mt-16">
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">Multi-Tenant Isolation</h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      PostgreSQL RLS security guarantees complete data segregation per institution.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">QuestionBank Sentinel</h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      Curated, peer-reviewed question repository mapped to recruitment patterns.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">Mistake-to-Mastery</h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      Algorithmic revision cycles converting incorrect answers into proven mastery.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">Placement Memory</h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      Audited historical records and defensible cohort before/after analytics.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* 3. Two Core Pillars: Students & Colleges (Clean 2-Column Balanced Grid) */}
      <section id="solutions" className="py-20 md:py-28 bg-surface border-y border-border scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary font-mono">
              Designed For the Entire Placement Lifecycle
            </h2>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary font-heading">
              One Unified System. Two Purpose Built Experiences.
            </h3>
            <p className="text-base sm:text-lg text-text-secondary">
              UrPlaced bridges the gap between individual student preparation and institutional placement cell management.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto items-stretch">
            {/* Track 1: For Students */}
            <div id="students" className="scroll-mt-28 flex">
              <Card className="w-full flex flex-col justify-between border-border bg-card shadow-sm hover:shadow-lg transition-all rounded-2xl p-2">
                <CardHeader className="space-y-3 p-6 sm:p-8">
                  <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                    <GraduationCap className="h-7 w-7" />
                  </div>
                  <Badge variant="outline" className="w-fit text-xs font-semibold text-primary border-primary/30 py-1 px-2.5">
                    For Students
                  </Badge>
                  <CardTitle className="text-2xl sm:text-3xl font-heading font-bold text-text-primary">
                    Targeted Mastery for Every Drive
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-text-secondary leading-relaxed pt-1">
                    Eliminate guesswork. Prepare with precision for upcoming campus drives using company-aligned question banks, timed mock assessments, and intelligent error remediation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-1 flex flex-col justify-between p-6 sm:p-8 pt-0">
                  <ul className="space-y-3.5 text-xs sm:text-sm text-text-secondary">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span><strong>DriveFit Assessments:</strong> Practice tests mapped to actual company recruitment rounds, topics, and syllabus cutoffs.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span><strong>Mistake Bank:</strong> Automated capture of missed concepts with step-by-step explanations and scheduled revision retries.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span><strong>Readiness Tracking:</strong> Objective mastery metrics indicating your real preparation readiness against drive benchmarks.</span>
                    </li>
                  </ul>

                </CardContent>
              </Card>
            </div>

            {/* Track 2: For Placement Cells & Colleges */}
            <div id="colleges" className="scroll-mt-28 flex">
              <Card className="w-full flex flex-col justify-between border-border bg-card shadow-sm hover:shadow-lg transition-all rounded-2xl p-2">
                <CardHeader className="space-y-3 p-6 sm:p-8">
                  <div className="h-14 w-14 rounded-2xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center">
                    <Building2 className="h-7 w-7" />
                  </div>
                  <Badge variant="outline" className="w-fit text-xs font-semibold text-secondary border-secondary/30 py-1 px-2.5">
                    For Colleges &amp; Placement Cells
                  </Badge>
                  <CardTitle className="text-2xl sm:text-3xl font-heading font-bold text-text-primary">
                    Institutional Command &amp; Efficiency
                  </CardTitle>
                  <CardDescription className="text-sm sm:text-base text-text-secondary leading-relaxed pt-1">
                    Manage multi-company campus placement seasons seamlessly with automated student eligibility gating, company directory management, multi-round tracking, and verifiable reporting.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 flex-1 flex flex-col justify-between p-6 sm:p-8 pt-0">
                  <ul className="space-y-3.5 text-xs sm:text-sm text-text-secondary">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span><strong>Roster Ingestion:</strong> Bulk student onboarding with academic branch, batch, and CGPA validation.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span><strong>Automated Eligibility Gating:</strong> Real-time filtering against backlogs, minimum marks, and department cutoffs.</span>
                    </li>
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span><strong>Placement Memory:</strong> Sourced institutional memory and defensible cohort before/after analytics.</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* 4. How It Works: Step-by-Step Flow */}
      <section id="how-it-works" className="py-20 md:py-28 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary font-mono">
              Simple &amp; Repeatable
            </h2>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary font-heading">
              How UrPlaced Powers Campus Recruitment
            </h3>
            <p className="text-base sm:text-lg text-text-secondary">
              A transparent, four-step process connecting college institutional preparation to verified corporate hiring outcomes.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-4">
            {/* Step 1 */}
            <div className="p-7 rounded-2xl bg-card border border-border space-y-3.5 relative shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-heading font-extrabold text-primary/30">
                01
              </div>
              <h4 className="text-lg font-bold font-heading text-text-primary">
                Onboard Campus &amp; Roster
              </h4>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Colleges configure departments, academic years, and ingest verified student records under isolated tenant boundaries.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-7 rounded-2xl bg-card border border-border space-y-3.5 relative shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-heading font-extrabold text-secondary/40">
                02
              </div>
              <h4 className="text-lg font-bold font-heading text-text-primary">
                Manage Companies &amp; Drives
              </h4>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Placement officers configure hiring companies, drive criteria cutoffs, eligibility rules, and required assessment skill targets.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-7 rounded-2xl bg-card border border-border space-y-3.5 relative shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-heading font-extrabold text-primary/30">
                03
              </div>
              <h4 className="text-lg font-bold font-heading text-text-primary">
                Targeted Prep &amp; Mastery
              </h4>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Students practice role-specific questions, take timed assessments, and remediate errors via the Mistake-to-Mastery engine.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-7 rounded-2xl bg-card border border-border space-y-3.5 relative shadow-sm hover:shadow-md transition-shadow">
              <div className="text-4xl font-heading font-extrabold text-secondary/40">
                04
              </div>
              <h4 className="text-lg font-bold font-heading text-text-primary">
                Placement &amp; Institutional Memory
              </h4>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed">
                Recruitment drives execute with verified offer logging, cohort before/after analytics, and historical placement memory.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Platform Core Pillars & Real Benefits */}
      <section id="features" className="py-20 md:py-28 bg-surface border-t border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary font-mono">
              Engineered For Institutional Rigor
            </h2>
            <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary font-heading">
              Built on Evidence, Not Guesses
            </h3>
            <p className="text-base sm:text-lg text-text-secondary">
              Every feature in UrPlaced is engineered to produce defensible data, ensure tenant isolation, and deliver measurable placement growth.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-3">
                  <BookOpen className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg font-heading">QuestionBank Sentinel</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Peer-reviewed question bank with multi-tier tags, cognitive complexity levels, and versioned answer keys.
              </CardContent>
            </Card>

            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-3">
                  <Target className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg font-heading">DriveFit Matching</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Transparent student readiness indicators calculating match percentages against specific hiring requirements.
              </CardContent>
            </Card>

            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg font-heading">Mistake-to-Mastery</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Algorithmic error capture that turns incorrect answers into scheduled revisions and evidence-backed skill mastery.
              </CardContent>
            </Card>

            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-3">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <CardTitle className="text-lg font-heading">Placement Memory</CardTitle>
              </CardHeader>
              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Audited historical records and paired before/after cohort measurements that demonstrate actual institutional impact.
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 7. Professional SaaS Footer */}


      <footer className="mt-auto border-t border-slate-800/80 bg-gradient-to-b from-[#0a0f1d] via-[#060913] to-[#03050a] py-16 text-slate-300 text-xs sm:text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 sm:gap-10 pb-12 border-b border-slate-800/80">

            {/* Brand Column */}
            <div className="col-span-1 sm:col-span-2 md:col-span-1 space-y-4">
              <div className="flex items-center gap-2.5">
                <UrPlacedLogo size="md" className="h-9 w-9" />
                <span className="font-heading font-bold text-xl text-slate-100">
                  UrPlaced
                </span>
              </div>

              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Enterprise Multi-College Placement Preparation &amp; Management SaaS platform.
              </p>

              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <Lock className="h-4 w-4 text-cyan-400" />
                <span>Strict Tenant Data Isolation</span>
              </div>
            </div>

            {/* Platform Column */}
            <div className="space-y-3">
              <div className="font-bold text-slate-100 uppercase tracking-wider text-xs font-mono">
                College Platform
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Placement Command Center</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Student Roster Management</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Company Directory</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Recruitment Drives</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">QuestionBank Sentinel</Link></li>
              </ul>
            </div>

            {/* Preparation Column */}
            <div className="space-y-3">
              <div className="font-bold text-slate-100 uppercase tracking-wider text-xs font-mono">
                Student Preparation
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Assessment Engine</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Mistake Bank</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Targeted Interventions</Link></li>
                <li><Link href="#" className="hover:text-cyan-400 transition-colors">Placement Memory</Link></li>
              </ul>
            </div>
          </div>

          {/* Copyright & Technical Info */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="text-center sm:text-left">
              &copy; {new Date().getFullYear()} UrPlaced. Multi-College Placement Preparation &amp; Management Platform. All rights reserved.
            </div>
            <div className="font-mono text-center">
              <span className="text-cyan-400/80">PostgreSQL RLS</span>
              {" "}&bull; Multi-Tenant &bull; Enterprise V1.0
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
