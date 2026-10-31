
"use client";

import * as React from "react";
import Link from "next/link";
import {
  GraduationCap,
  Building2,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  Target,
  BarChart3,
  Sparkles,
  Menu,
  X,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Phone,
  Mail,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const supportPhone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

  const socialLinks = [
    {
      label: "LinkedIn",
      href: process.env.NEXT_PUBLIC_LINKEDIN_URL,
      Icon: Linkedin,
    },
    {
      label: "Instagram",
      href: process.env.NEXT_PUBLIC_INSTAGRAM_URL,
      Icon: Instagram,
    },
    {
      label: "Facebook",
      href: process.env.NEXT_PUBLIC_FACEBOOK_URL,
      Icon: Facebook,
    },
    {
      label: "Twitter",
      href: process.env.NEXT_PUBLIC_TWITTER_URL,
      Icon: Twitter,
    },
  ];

  return (
    <div className="min-h-screen bg-[url('/assets/bghome.png')] bg-cover bg-center bg-no-repeat bg-fixed dark:bg-[linear-gradient(135deg,#111318_0%,#181B27_50%,#111318_100%)] text-text-primary flex flex-col selection:bg-primary/20">

      {/* 1. Global Public Navigation Header */}
      <header className="sticky top-4 z-50 mx-4 sm:mx-6 lg:mx-10 rounded-[2rem] md:rounded-full border-2 border-slate-400/70 dark:border-border bg-gradient-to-r from-orange-50/95 via-white/95 to-sky-50/95 dark:from-[#1B1E2A]/95 dark:via-[#1B1E2A]/95 dark:to-[#1B1E2A]/95 shadow-[0_10px_35px_rgba(15,23,42,0.12)] backdrop-blur-md transition-all">
        <div className="relative w-full px-5 sm:px-8 lg:px-10 h-20 flex items-center justify-between">

          {/* Brand */}
          <Link
            href="/"
            className="flex items-center gap-2.5 sm:gap-3 group shrink-0"
          >
            <UrPlacedLogo
              size="lg"
              priority
              className="h-9 w-9 sm:h-11 sm:w-11 group-hover:scale-105 transition-transform"
            />

            <span className="font-heading font-extrabold text-xl sm:text-2xl tracking-tight text-slate-900 dark:text-text-primary leading-none">
              UrPlaced
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-1 lg:gap-3">
            <a
              href="#solutions"
              className="px-3 lg:px-4 py-2 rounded-lg text-[15px] font-semibold text-slate-700 dark:text-slate-100 hover:text-primary dark:hover:text-cyan-400 hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Platform
            </a>

            <a
              href="#students"
              className="px-3 lg:px-4 py-2 rounded-lg text-[15px] font-semibold text-slate-700 dark:text-slate-100 hover:text-primary dark:hover:text-cyan-400 hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              For Students &amp; Colleges
            </a>

            <a
              href="#how-it-works"
              className="px-3 lg:px-4 py-2 rounded-lg text-[15px] font-semibold text-slate-700 dark:text-slate-100 hover:text-primary dark:hover:text-cyan-400 hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              How It Works
            </a>

            <a
              href="#features"
              className="px-3 py-2 rounded-lg text-base font-semibold text-slate-700 dark:text-slate-100 hover:text-primary dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              Features
            </a>
          </nav>

          {/* Desktop Login and Theme */}
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

      {/* 2. Hero Section */}
      <section className="relative min-h-[calc(100vh-5rem)] flex flex-col justify-between py-10 md:py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full my-auto">
          <div className="text-center max-w-4xl mx-auto space-y-8">

            {/* Enterprise Badge */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-2xl sm:rounded-full bg-card border border-border text-xs sm:text-sm font-medium text-text-secondary shadow-sm max-w-full text-center">
              <Badge
                variant="secondary"
                className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider bg-secondary text-white shrink-0"
              >
                Multi-College Placement SaaS
              </Badge>

              <span className="text-center">
                Student Preparation &amp; Institutional Placement Management
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-text-primary font-heading leading-[1.12]">
              Your Career Starts Here.
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl md:text-2xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
              The intelligent placement ecosystem connecting students and
              higher-education institutions with industry hiring standards.
              Turn campus recruitment into verifiable student mastery and
              streamlined, high-trust institutional operations.
            </p>
          </div>

          {/* Four Core Pillars */}
          <div className="max-w-6xl mx-auto w-full mt-12 md:mt-16">
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">
                      Multi-Tenant Isolation
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      PostgreSQL RLS security guarantees complete data
                      segregation per institution.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center shrink-0">
                    <BookOpen className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">
                      QuestionBank Sentinel
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      Curated, peer-reviewed question repository mapped to
                      recruitment patterns.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center shrink-0">
                    <Target className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">
                      Mistake-to-Mastery
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      Algorithmic revision cycles converting incorrect
                      answers into proven mastery.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5">
                  <div className="h-10 w-10 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center shrink-0">
                    <BarChart3 className="h-5 w-5" />
                  </div>

                  <div>
                    <h3 className="text-sm font-bold font-heading text-text-primary">
                      Placement Memory
                    </h3>
                    <p className="text-xs text-text-secondary mt-0.5 leading-relaxed">
                      Audited historical records and defensible cohort
                      before/after analytics.
                    </p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Students and Colleges */}
      <section
        id="solutions"
        className="py-20 md:py-28 bg-surface/75 dark:bg-[#111318]/70 border-y border-border scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary font-mono">
              Designed For the Entire Placement Lifecycle
            </h2>

            <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary font-heading">
              One Unified System. Two Purpose Built Experiences.
            </h3>

            <p className="text-base sm:text-lg text-text-secondary">
              UrPlaced bridges the gap between individual student preparation
              and institutional placement cell management.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 max-w-5xl mx-auto items-stretch">

            {/* Students */}
            <div id="students" className="scroll-mt-28 flex">
              <Card className="w-full flex flex-col justify-between border-border bg-card shadow-sm hover:shadow-lg transition-all rounded-2xl p-2">
                <CardHeader className="space-y-3 p-6 sm:p-8">
                  <div className="h-14 w-14 rounded-2xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center">
                    <GraduationCap className="h-7 w-7" />
                  </div>

                  <Badge
                    variant="outline"
                    className="w-fit text-xs font-semibold text-primary border-primary/30 py-1 px-2.5"
                  >
                    For Students
                  </Badge>

                  <CardTitle className="text-2xl sm:text-3xl font-heading font-bold text-text-primary">
                    Targeted Mastery for Every Drive
                  </CardTitle>

                  <CardDescription className="text-sm sm:text-base text-text-secondary leading-relaxed pt-1">
                    Eliminate guesswork. Prepare with precision for upcoming
                    campus drives using company-aligned question banks, timed
                    mock assessments, and intelligent error remediation.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 flex-1 flex flex-col justify-between p-6 sm:p-8 pt-0">
                  <ul className="space-y-3.5 text-xs sm:text-sm text-text-secondary">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>
                        <strong>DriveFit Assessments:</strong> Practice tests
                        mapped to actual company recruitment rounds, topics,
                        and syllabus cutoffs.
                      </span>
                    </li>

                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>
                        <strong>Mistake Bank:</strong> Automated capture of
                        missed concepts with step-by-step explanations and
                        scheduled revision retries.
                      </span>
                    </li>

                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>
                        <strong>Readiness Tracking:</strong> Objective
                        mastery metrics indicating your real preparation
                        readiness against drive benchmarks.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Colleges and Placement Cells */}
            <div id="colleges" className="scroll-mt-28 flex">
              <Card className="w-full flex flex-col justify-between border-border bg-card shadow-sm hover:shadow-lg transition-all rounded-2xl p-2">
                <CardHeader className="space-y-3 p-6 sm:p-8">
                  <div className="h-14 w-14 rounded-2xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center">
                    <Building2 className="h-7 w-7" />
                  </div>

                  <Badge
                    variant="outline"
                    className="w-fit text-xs font-semibold text-secondary border-secondary/30 py-1 px-2.5"
                  >
                    For Colleges &amp; Placement Cells
                  </Badge>

                  <CardTitle className="text-2xl sm:text-3xl font-heading font-bold text-text-primary">
                    Institutional Command &amp; Efficiency
                  </CardTitle>

                  <CardDescription className="text-sm sm:text-base text-text-secondary leading-relaxed pt-1">
                    Manage multi-company campus placement seasons seamlessly
                    with automated student eligibility gating, company
                    directory management, multi-round tracking, and verifiable
                    reporting.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6 flex-1 flex flex-col justify-between p-6 sm:p-8 pt-0">
                  <ul className="space-y-3.5 text-xs sm:text-sm text-text-secondary">
                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>
                        <strong>Roster Ingestion:</strong> Bulk student
                        onboarding with academic branch, batch, and CGPA
                        validation.
                      </span>
                    </li>

                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>
                        <strong>Automated Eligibility Gating:</strong> Real-time
                        filtering against backlogs, minimum marks, and
                        department cutoffs.
                      </span>
                    </li>

                    <li className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-secondary shrink-0 mt-0.5" />
                      <span>
                        <strong>Placement Memory:</strong> Sourced
                        institutional memory and defensible cohort
                        before/after analytics.
                      </span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>
      </section>

      {/* 4. How It Works */}
      <section
        id="how-it-works"
        className="py-20 md:py-28 scroll-mt-20"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary font-mono">
              Simple &amp; Repeatable
            </h2>

            <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary font-heading">
              How UrPlaced Powers Campus Recruitment
            </h3>

            <p className="text-base sm:text-lg text-text-secondary">
              A transparent, four-step process connecting college institutional
              preparation to verified corporate hiring outcomes.
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
                Colleges configure departments, academic years, and ingest
                verified student records under isolated tenant boundaries.
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
                Placement officers configure hiring companies, drive criteria
                cutoffs, eligibility rules, and required assessment skill
                targets.
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
                Students practice role-specific questions, take timed
                assessments, and remediate errors via the Mistake-to-Mastery
                engine.
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
                Recruitment drives execute with verified offer logging, cohort
                before/after analytics, and historical placement memory.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 5. Platform Core Pillars and Benefits */}
      <section
        id="features"
        className="py-20 md:py-28 bg-surface/75 dark:bg-[#111318]/70 border-t border-border"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-secondary font-mono">
              Engineered For Institutional Rigor
            </h2>

            <h3 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary font-heading">
              Built on Evidence, Not Guesses
            </h3>

            <p className="text-base sm:text-lg text-text-secondary">
              Every feature in UrPlaced is engineered to produce defensible
              data, ensure tenant isolation, and deliver measurable placement
              growth.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">

            {/* QuestionBank Sentinel */}
            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-3">
                  <BookOpen className="h-6 w-6" />
                </div>

                <CardTitle className="text-lg font-heading">
                  QuestionBank Sentinel
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Peer-reviewed question bank with multi-tier tags, cognitive
                complexity levels, and versioned answer keys.
              </CardContent>
            </Card>

            {/* DriveFit Matching */}
            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-3">
                  <Target className="h-6 w-6" />
                </div>

                <CardTitle className="text-lg font-heading">
                  DriveFit Matching
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Transparent student readiness indicators calculating match
                percentages against specific hiring requirements.
              </CardContent>
            </Card>

            {/* Mistake-to-Mastery */}
            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-3">
                  <Sparkles className="h-6 w-6" />
                </div>

                <CardTitle className="text-lg font-heading">
                  Mistake-to-Mastery
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Algorithmic error capture that turns incorrect answers into
                scheduled revisions and evidence-backed skill mastery.
              </CardContent>
            </Card>

            {/* Placement Memory */}
            <Card className="border-border bg-card p-6 shadow-sm">
              <CardHeader className="p-0 pb-3">
                <div className="h-12 w-12 rounded-xl bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-3">
                  <BarChart3 className="h-6 w-6" />
                </div>

                <CardTitle className="text-lg font-heading">
                  Placement Memory
                </CardTitle>
              </CardHeader>

              <CardContent className="p-0 text-xs sm:text-sm text-text-secondary leading-relaxed">
                Audited historical records and paired before/after cohort
                measurements that demonstrate actual institutional impact.
              </CardContent>
            </Card>

          </div>
        </div>
      </section>

      {/* 6. Global Footer */}
      <footer className="mt-auto border-t border-slate-800/80 bg-gradient-to-b from-[#0a0f1d] via-[#060913] to-[#03050a] text-xs text-slate-300 sm:text-sm">

        {/* Top Accent Line */}
        <div className="h-1 w-full rounded-b-md bg-[#5052C9]" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

          {/* Main Footer Grid */}
          <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 sm:gap-x-8 lg:grid-cols-12 lg:gap-x-5 lg:gap-y-10 lg:py-14">

            {/* Brand Column — Far Left */}
            <div className="space-y-4 sm:col-span-2 lg:col-span-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2.5"
              >
                <UrPlacedLogo size="md" className="h-9 w-9" />

                <span className="font-heading text-xl font-bold text-slate-100">
                  UrPlaced
                </span>
              </Link>

              <p className="max-w-xs text-xs leading-relaxed text-slate-400 sm:text-sm">
                Enterprise multi-college placement management and career
                preparation platform for colleges and students.
              </p>

              {/* Social Icons — Always Visible */}
              <div className="flex items-center gap-4 pt-2">
                {socialLinks.map(({ label, href, Icon }) => {
                  const icon = (
                    <Icon
                      aria-hidden="true"
                      className="h-[17px] w-[17px]"
                      strokeWidth={1.8}
                    />
                  );

                  if (href) {
                    return (
                      <a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`UrPlaced on ${label}`}
                        className="inline-flex items-center justify-center text-slate-400 transition-colors duration-200 hover:text-cyan-400"
                      >
                        {icon}
                      </a>
                    );
                  }

                  return (
                    <span
                      key={label}
                      title={`${label} URL not configured`}
                      className="inline-flex items-center justify-center text-slate-400"
                    >
                      {icon}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Intentional Empty Middle Gap */}
            <div
              aria-hidden="true"
              className="hidden lg:col-span-1 lg:block"
            />

            {/* Company Column */}
            <nav
              aria-label="Company"
              className="space-y-4 lg:col-span-2"
            >
              <h3 className="font-heading text-sm font-bold text-slate-100">
                Company
              </h3>

              <ul className="space-y-3 text-slate-400">
                <li>
                  <Link
                    href="/#features"
                    className="transition-colors hover:text-cyan-400"
                  >
                    About Us
                  </Link>
                </li>

                <li>
                  <Link
                    href="/#colleges"
                    className="transition-colors hover:text-cyan-400"
                  >
                    For Colleges
                  </Link>
                </li>

                <li>
                  <Link
                    href="/#students"
                    className="transition-colors hover:text-cyan-400"
                  >
                    For Students
                  </Link>
                </li>

                <li>
                  <Link
                    href={
                      supportEmail
                        ? `mailto:${supportEmail}`
                        : "/#solutions"
                    }
                    className="transition-colors hover:text-cyan-400"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Support Column */}
            <nav
              aria-label="Support"
              className="space-y-4 lg:col-span-2"
            >
              <h3 className="font-heading text-sm font-bold text-slate-100">
                Support
              </h3>

              <ul className="space-y-3 text-slate-400">
                <li>
                  <Link
                    href="/#features"
                    className="transition-colors hover:text-cyan-400"
                  >
                    Help Center
                  </Link>
                </li>

                <li>
                  <Link
                    href="/#features"
                    className="transition-colors hover:text-cyan-400"
                  >
                    FAQs
                  </Link>
                </li>

                <li>
                  <Link
                    href={
                      supportEmail
                        ? `mailto:${supportEmail}`
                        : "/#features"
                    }
                    className="transition-colors hover:text-cyan-400"
                  >
                    Technical Support
                  </Link>
                </li>

                <li>
                  <Link
                    href={
                      supportEmail
                        ? `mailto:${supportEmail}`
                        : "/#features"
                    }
                    className="transition-colors hover:text-cyan-400"
                  >
                    Feedback
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Platform Links Column */}
            <nav
              aria-label="Platform links"
              className="space-y-4 lg:col-span-2"
            >
              <h3 className="font-heading text-sm font-bold text-slate-100">
                Links
              </h3>

              <ul className="space-y-3 text-slate-400">
                <li>
                  <Link
                    href="/#students"
                    className="transition-colors hover:text-cyan-400"
                  >
                    Placement Preparation
                  </Link>
                </li>

                <li>
                  <Link
                    href="/auth/signin"
                    className="transition-colors hover:text-cyan-400"
                  >
                    DriveFit
                  </Link>
                </li>

                <li>
                  <Link
                    href="/auth/signin"
                    className="transition-colors hover:text-cyan-400"
                  >
                    QuestionBank Sentinel
                  </Link>
                </li>

                <li>
                  <Link
                    href="/auth/signin"
                    className="transition-colors hover:text-cyan-400"
                  >
                    Assessments
                  </Link>
                </li>
              </ul>
            </nav>

            {/* Contact Column — Far Right */}
            <div className="space-y-4 lg:col-span-2">
              <h3 className="font-heading text-sm font-bold text-slate-100">
                Contact Us
              </h3>

              <div className="space-y-4 text-slate-400">
                {supportPhone && (
                  <a
                    href={`tel:${supportPhone.replace(/[^\d+]/g, "")}`}
                    className="flex items-start gap-2.5 break-words transition-colors hover:text-cyan-400"
                  >
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[#6F8CFF]" />

                    <span>{supportPhone}</span>
                  </a>
                )}

                {supportEmail && (
                  <a
                    href={`mailto:${supportEmail}`}
                    className="flex items-start gap-2.5 transition-colors hover:text-cyan-400"
                  >
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#6F8CFF]" />

                    <span className="break-all">
                      {supportEmail}
                    </span>
                  </a>
                )}

                {!supportPhone && !supportEmail && (
                  <p className="text-xs leading-relaxed text-slate-500">
                    Contact details will be available here.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Separate Bottom Legal Bar */}
          <div className="flex flex-col items-center justify-between gap-5 border-t border-slate-800/80 py-6 text-center text-xs text-slate-500 sm:flex-row sm:text-left">

            {/* Copyright */}
            <p className="leading-relaxed">
              © {new Date().getFullYear()} UrPlaced. All rights reserved.
            </p>

            {/* Legal Navigation */}
            <nav
              aria-label="Legal navigation"
              className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 sm:justify-end"
            >
              <Link
                href="/privacy"
                className="transition-colors hover:text-cyan-400"
              >
                Privacy Policy
              </Link>

              <Link
                href="/terms"
                className="transition-colors hover:text-cyan-400"
              >
                Terms of Use
              </Link>

              <Link
                href="/legal"
                className="transition-colors hover:text-cyan-400"
              >
                Legal
              </Link>

              <a
                href="/sitemap.xml"
                className="transition-colors hover:text-cyan-400"
              >
                Site Map
              </a>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
