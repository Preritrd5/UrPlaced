# Phase 08 — Implementation Report: Mistake Bank & Mistake-to-Mastery Engine

## 1. Project Identification & Scope

- **Product:** UrPlaced — Multi-College Placement Preparation & Management SaaS
- **Module:** Phase 08 — Mistake Bank & Mistake-to-Mastery Engine
- **Engine Capabilities:** Idempotent mistake capture, spaced repetition scheduling, unrevealed question retest drills, evidence-based skill mastery evaluation, and question defect moderation.

---

## 2. Deliverables Summary

### 2.1 Database & Migrations
- **Migration File:** [`supabase/migrations/20261019000002_phase08_mistake_to_mastery.sql`](file:///c:/Users/Ananya/UrPlaced/supabase/migrations/20261019000002_phase08_mistake_to_mastery.sql)
  - 6 new tables created with foreign keys, indexes, and forced multi-college tenant RLS:
    1. `mistake_review_targets`
    2. `mistake_occurrences`
    3. `review_sessions`
    4. `mastery_evidence_records`
    5. `student_skill_mastery`
    6. `question_defect_reports`
  - Explicit RLS policies enforcing tenant isolation and role restrictions.

### 2.2 TypeScript Type Definitions & RBAC
- [`src/types/database.ts`](file:///c:/Users/Ananya/UrPlaced/src/types/database.ts):
  - Added enums: `MistakePrimaryReason`, `ReviewTargetStatus`, `StudentReasonCategory`, `MistakeCaptureReason`, `ReviewActionType`, `MasteryStatus`, `EvidenceValidityStatus`, `QuestionDefectType`, `DefectReportStatus`.
  - Added typed schema definitions and exported row types for all 6 tables.
- [`src/modules/identity-access/services/policy-engine.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/identity-access/services/policy-engine.ts):
  - Added permissions: `MISTAKE_BANK_MANAGE_OWN`, `MISTAKE_BANK_READ_COHORT`, `MISTAKE_BANK_MANAGE`, `QUESTION_DEFECTS_MANAGE`, `QUESTION_DEFECTS_REPORT`.
  - Scoped role permissions for `SUPER_ADMIN`, `PLACEMENT_HEAD`, `PLACEMENT_STAFF`, `TRAINER`, and `STUDENT`.

### 2.3 Domain Services
- [`src/modules/mistake-mastery/services/mistake-capture-service.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/mistake-mastery/services/mistake-capture-service.ts):
  - Ingests attempt evidence into deduplicated review targets and granular occurrence logs.
  - Idempotent execution on re-scoring.
- [`src/modules/mistake-mastery/services/revision-scheduler-service.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/mistake-mastery/services/revision-scheduler-service.ts):
  - Spaced repetition intervals: 1d $\to$ 3d $\to$ 7d $\to$ 14d $\to$ 30d.
  - Progression on success, immediate regression to Stage 1 on failure.
  - Queue calculations for Due Today, Overdue, and Upcoming.
- [`src/modules/mistake-mastery/services/practice-recommendation-service.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/mistake-mastery/services/practice-recommendation-service.ts):
  - Recommends NEW unrevealed questions testing the same canonical skill.
  - Excludes previously attempted questions.
  - Saves student root-cause reflections.
- [`src/modules/mistake-mastery/services/mastery-evaluation-service.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/mistake-mastery/services/mastery-evaluation-service.ts):
  - Evaluates student retest submissions.
  - Enforces the non-negotiable invariant: re-testing revealed questions does not count toward independent mastery.
  - State machine: `UNASSESSED` $\to$ `NEEDS_REVIEW` $\to$ `PRACTISING` $\to$ `IMPROVING` $\to$ `PROVISIONAL_MASTERY` $\to$ `MASTERY_DEMONSTRATED`.
- [`src/modules/mistake-mastery/services/content-defect-service.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/mistake-mastery/services/content-defect-service.ts):
  - Handles question defect reports, staff moderation, and unfair penalty invalidation.

### 2.4 API Routes
- **Student Endpoints:**
  - `GET /api/student/mistakes`: Query targets, filter by status/reason/skill/due date, and retrieve queue KPIs.
  - `GET /api/student/mistakes/[targetId]`: Retrieve single target with question version, occurrences, and review logs.
  - `POST /api/student/mistakes/[targetId]/review`: Record explanation viewed, save reflection, or dismiss target.
  - `POST /api/student/mistakes/[targetId]/reschedule`: Adjust next due date.
  - `GET /api/student/mistakes/[targetId]/practice`: Fetch new unrevealed practice questions with sanitized answer keys.
  - `POST /api/student/mistakes/[targetId]/retest`: Submit practice answer, record evidence, and update mastery.
  - `GET /api/student/mastery`: Retrieve student's skill mastery radar.
  - `POST /api/student/mistakes/defects`: File question defect report.
- **Staff Endpoints:**
  - `GET /api/placement/mistakes/cohort-summary`: Cohort error aggregations, skill gaps, and question hotspots.
  - `GET /api/placement/mistakes/defects`: Defect tickets moderation queue.
  - `PATCH /api/placement/mistakes/defects/[defectId]`: Resolve defect and invalidate student mistakes.

### 2.5 UI Screens (Design System Compliant)
- [`src/app/dashboard/student/mistakes/page.tsx`](file:///c:/Users/Ananya/UrPlaced/src/app/dashboard/student/mistakes/page.tsx):
  - Mistake Bank Hub: Due Today/Overdue queue KPI cards, status/reason/skill filters, target cards with spaced repetition stage badges, and quick reschedule modal.
- [`src/app/dashboard/student/mistakes/[targetId]/page.tsx`](file:///c:/Users/Ananya/UrPlaced/src/app/dashboard/student/mistakes/[targetId]/page.tsx):
  - Target Detail & Mastery Drill: Context breakdown, submitted vs correct answer highlighting, step-by-step verified explanation, root-cause reflection form, interactive retest drill with new unrevealed questions, and question defect reporting modal.
- [`src/app/dashboard/student/mastery/page.tsx`](file:///c:/Users/Ananya/UrPlaced/src/app/dashboard/student/mastery/page.tsx):
  - Skill Mastery Radar: Comprehensive KPIs, accuracy progress bars, independent trial counts, and direct links to skill drills.
- [`src/app/dashboard/mistakes/page.tsx`](file:///c:/Users/Ananya/UrPlaced/src/app/dashboard/mistakes/page.tsx):
  - Placement Staff Portal: Cohort error analytics, skill gap hotspots, repeated question slip rates, and defect tickets moderation queue with one-click mistake invalidation.

---

## 3. Strict Directive Compliance

- **Git Commit / Push:** As strictly commanded by the user, **ZERO** `git commit` or `git push` commands were executed. All changes remain unstaged in the local working directory for manual management by the user.
- **Design System Invariants:** Adheres strictly to GEMINI.md tokens (`#5052C9`, `#2E8F86`, `#EDECE7`, `#F8F7F3`, `#FBFAF7`, `#24283A`, `#292D40`, fonts Outfit, Inter, JetBrains Mono).
- **Data Persistence:** 100% persistent PostgreSQL tables; zero fake or mock stats.
