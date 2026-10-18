import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, CircleDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function PhaseStatusPage() {
  const phases = [
    { id: "01", name: "Product Blueprint & Architecture", status: "COMPLETED", desc: "11 approved specification artifacts, ADRs, data model, threat checklist." },
    { id: "02", name: "Application Foundation & Design System", status: "ACTIVE", desc: "Tailwind tokens, fonts, shared UI primitives, responsive AppShell, showcase." },
    { id: "03", name: "College Administration & Student Ingestion", status: "UPCOMING", desc: "Batches, departments, validated bulk CSV upload with error manifests." },
    { id: "04", name: "Recruitment Drives & Eligibility Engine", status: "UPCOMING", desc: "Drive setup, notice parsing review, boolean rule engine with reason codes." },
    { id: "05", name: "QuestionBank Sentinel & Content Pipeline", status: "UPCOMING", desc: "Pre-commit quality review, duplicate check, immutable snapshots, licensing." },
    { id: "06", name: "Assessment Engine & Sandboxed Code Runner", status: "UPCOMING", desc: "Server timing, resilient autosave, server scoring, isolated judge runner." },
    { id: "07", name: "Personal Mistake Bank & Mastery Retest", status: "UPCOMING", desc: "Auto mistake capture, spaced revision, new isomorphic question retests." },
    { id: "08", name: "Placement Memory & DriveFit Mapping", status: "UPCOMING", desc: "Historical rounds, candidate debriefs, requirement-to-skill gap analysis." },
    { id: "09", name: "Institutional Analytics & Notifications", status: "UPCOMING", desc: "Readiness indices, training before/after delta, audit logs, CSV exports." },
    { id: "10", name: "Production Hardening & V1.0 Release", status: "UPCOMING", desc: "100% cross-tenant allow/deny test pass, DR drills, accessibility audit." },
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
          <Badge variant="secondary">Development Roadmap</Badge>
          <span className="text-xs text-text-muted font-mono">10 Sequential Phases</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text-primary font-heading">
          UrPlaced Implementation Phase Status
        </h1>
        <p className="text-base text-text-secondary max-w-3xl">
          Phases represent implementation sequencing, not product release versions.
          100% of agreed V1.0 scope is systematically mapped without feature deferral.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase Gates &amp; Progression Tracker</CardTitle>
          <CardDescription>
            Strict verification gates are enforced before moving from one phase to the next.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {phases.map((p) => {
            const isCompleted = p.status === "COMPLETED";
            const isActive = p.status === "ACTIVE";

            return (
              <div
                key={p.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isActive
                    ? "border-primary bg-[var(--color-primary-subtle)]"
                    : isCompleted
                    ? "border-secondary/30 bg-[var(--color-success-subtle)]"
                    : "border-border bg-input opacity-75"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-secondary" />
                    ) : isActive ? (
                      <CircleDot className="h-5 w-5 text-primary animate-pulse" />
                    ) : (
                      <Clock className="h-5 w-5 text-text-muted" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-text-primary">
                        Phase {p.id}:
                      </span>
                      <span className="font-semibold text-sm text-text-primary font-heading">
                        {p.name}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{p.desc}</p>
                  </div>
                </div>

                <div className="sm:self-center shrink-0">
                  <Badge
                    variant={
                      isCompleted ? "success" : isActive ? "default" : "outline"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
