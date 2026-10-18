import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldCheck, Database, Server, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ArchitectureSummaryPage() {
  const modules = [
    { name: "identity-access", desc: "User sessions, credentials, password reset, auth policies" },
    { name: "tenancy", desc: "Colleges, seat quotas, manual plan limits, tenant scoping" },
    { name: "academic", desc: "Departments, degree programs, cohorts, student rosters" },
    { name: "companies", desc: "Company profiles, recruiter contacts, hiring history" },
    { name: "recruitment-drives", desc: "Drives, job roles, selection stages, deadlines" },
    { name: "eligibility", desc: "Criteria DSL, evaluation engine, manual overrides" },
    { name: "recruitment-intel", desc: "Sourced notices, AI extraction review, provenance tracking" },
    { name: "question-bank", desc: "QuestionBank Sentinel, versions, duplicate checks, tags" },
    { name: "assessments", desc: "Test definitions, server timing, resilient autosave, scoring" },
    { name: "code-execution", desc: "Judge0/nsjail container adapter, time/memory sandbox" },
    { name: "mistake-mastery", desc: "Mistake Bank, revision scheduler, isomorphic retests" },
    { name: "training", desc: "Targeted workshops, attendance, diagnostic assessments" },
    { name: "placement-memory", desc: "Historical round archives, moderated candidate reports" },
    { name: "analytics", desc: "Readiness indices, cohort heatmaps, before/after training delta" },
    { name: "storage", desc: "Private S3 object keys, pre-signed upload/download URLs" },
    { name: "notifications", desc: "In-app notification center, transactional email dispatch" },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/design-system" className="inline-flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to Showcase
          </Link>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Phase 01 Architectural Foundation</Badge>
          <span className="text-xs text-text-muted font-mono">16 Monolith Modules</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary font-heading">
          UrPlaced Architecture &amp; Domain Boundaries
        </h1>
        <p className="text-base text-text-secondary max-w-3xl">
          Overview of the approved modular-monolith boundaries, PostgreSQL Row-Level Security,
          and provider adapters established in Phase 01.
        </p>
      </div>

      {/* Architecture Highlights */}
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-2">
              <Server className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Modular Monolith</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-text-secondary">
            Next.js 15 App Router with server-only domain services under <code className="font-mono text-[11px]">src/modules/</code>.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-secondary-subtle)] text-secondary flex items-center justify-center mb-2">
              <Database className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">PostgreSQL RLS</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-text-secondary">
            Kernel-level tenant isolation via dedicated runtime role and transaction-scoped context.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-primary-subtle)] text-primary flex items-center justify-center mb-2">
              <Cpu className="h-4 w-4" />
            </div>
            <CardTitle className="text-base">Isolated Code Runner</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-text-secondary">
            Student code evaluated in ephemeral container sandboxes with 2.0s CPU and 256MB RAM caps.
          </CardContent>
        </Card>
      </div>

      {/* Module Inventory */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Domain Module Boundary Inventory</CardTitle>
          <CardDescription>
            All 16 domain modules isolated under <code className="font-mono text-xs">src/modules/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <div
                key={m.name}
                className="p-3 rounded-lg border border-border bg-input flex flex-col justify-between"
              >
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-secondary shrink-0" />
                  <span className="font-mono text-xs font-semibold text-text-primary">
                    src/modules/{m.name}/
                  </span>
                </div>
                <p className="text-xs text-text-secondary">{m.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
