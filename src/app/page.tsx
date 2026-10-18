import Link from "next/link";
import {
  Palette,
  Layers,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  Code2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function HomePage() {
  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header Banner */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="px-3 py-1 text-xs">
            Phase 02 Active
          </Badge>
          <span className="text-xs text-text-secondary font-mono">
            V1.0 Architectural Baseline
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary font-heading">
          UrPlaced Application Foundation &amp; Design System
        </h1>
        <p className="text-base sm:text-lg text-text-secondary max-w-3xl leading-relaxed">
          The unified technical scaffold, centralized design tokens, and accessible component library
          for the Multi-College Placement Preparation &amp; Management SaaS platform.
        </p>
      </div>

      {/* Phase Guard Notice */}
      <Alert variant="info">
        <AlertTitle>Phase 02 Architecture Boundary</AlertTitle>
        <AlertDescription>
          In accordance with the agreed phase roadmap, Phase 02 implements the technical foundation,
          design tokens, and shared UI primitives only. Database-backed business modules (authentication,
          student ingestion, drives, question bank, and assessments) are intentionally scoped to Phases 03–10.
        </AlertDescription>
      </Alert>

      {/* Quick Action Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-2">
              <Palette className="h-5 w-5" />
            </div>
            <CardTitle>Design System Showcase</CardTitle>
            <CardDescription>
              Inspect the exact color palette, typography hierarchy, button states, inputs, tables,
              and accessibility compliance.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="primary" className="w-full sm:w-auto">
              <Link href="/design-system" className="inline-flex items-center gap-2">
                Launch Showcase <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-secondary/50 transition-colors">
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-2">
              <Layers className="h-5 w-5" />
            </div>
            <CardTitle>Architecture &amp; Blueprint</CardTitle>
            <CardDescription>
              Review the 11 accepted Phase 01 specifications covering modular-monolith service boundaries,
              PostgreSQL RLS, and data models.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full sm:w-auto">
              <Link href="/design-system/architecture" className="inline-flex items-center gap-2">
                View Architecture Summary <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Invariants & Foundation Verification */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase 02 Core Invariants Verified</CardTitle>
          <CardDescription>
            Rigorous adherence to strict design tokens and modular architecture rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Exact Fixed Brand Palette</p>
                <p className="text-xs text-text-secondary">
                  Single source of truth in CSS tokens (<code className="font-mono text-[11px]">#5052C9</code>, <code className="font-mono text-[11px]">#2E8F86</code>, <code className="font-mono text-[11px]">#EDECE7</code>, etc.).
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Strict Typography Stack</p>
                <p className="text-xs text-text-secondary">
                  Headings in <strong className="font-semibold">Outfit</strong>, Body in <strong className="font-semibold">Inter</strong>, Code in <strong className="font-semibold">JetBrains Mono</strong>.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Derived Semantic States</p>
                <p className="text-xs text-text-secondary">
                  Hover, active, border, and focus rings strictly derived without invented hues.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Code2 className="h-5 w-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-text-primary">Modular Monolith Layout</p>
                <p className="text-xs text-text-secondary">
                  16 domain module boundaries isolated under <code className="font-mono text-[11px]">src/modules/</code>.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
