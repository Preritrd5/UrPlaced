# UrPlaced — Phase 03: Global Placement Preparation System Delivery Report

**Project:** UrPlaced — Multi-College Placement SaaS  
**Scope:** Phase 03 — Placement Preparation & Career Readiness Suite  
**Author / Agent:** Antigravity Engineering System  
**Date:** November 9, 2026  
**Status:** COMPLETED — ALL ACCEPTANCE CRITERIA VERIFIED  

---

## 1. Executive Summary

Phase 03 of UrPlaced delivers the **Global Placement Preparation System**, completing the end-to-end student placement workflow following Phase 01 (Student Career Intelligence: Profile & Completeness, ATS Resume Scanner, Smart Drive Matching) and Phase 02 (Student Career Improvement: Skill Gap Analyzer, Career Passport, Mock Interview Studio).

### Core Problem Solved
Prior to Phase 03, students could analyze gaps, polish resumes, and conduct mock interviews, but lacked an integrated curriculum of practice tests, company-specific preparation paths, and dynamic personalized learning guidance. Students had to source practice material and interview patterns externally without any closed-loop feedback or link back to their campus placement drives.

### Key Capabilities Delivered
1. **Module A: Placement Preparation Practice Centre** (`/dashboard/student/placement-practice`)
   - 4 foundational placement categories: Quantitative Aptitude, Logical Reasoning, Verbal Ability, Technical Core (DSA, DBMS, OS, Computer Networks).
   - 36 curated topic modules with adaptive question filtering across Beginner, Intermediate, and Advanced difficulties.
   - 4 flexible practice modes: Topic Practice (instant feedback), Timed Test (countdown timer with auto-submit), Full Mock (comprehensive balanced test across all categories), and Targeted Revision (curated missed/incorrect questions).
   - Server-authoritative scoring and client projection sanitization (answer keys and solving approaches are withheld from clients until submission).

2. **Module B: Advanced Company-Specific Preparation** (`/dashboard/student/company-preparation`)
   - Comprehensive employer profiles across Mass Recruiters (TCS, Infosys, Accenture) and Product Companies (Amazon), detailing CTC ranges, eligibility criteria, and hiring round workflows.
   - Interactive preparation modules per company track with granular student completion checkboxes.
   - AI-driven company-specific interview question generator powered by Google Gemini, equipped with deterministic offline rule-based fallback.
   - Deep integration with Phase 02 AI Mock Interview Studio (`/dashboard/student/mock-interview?company={slug}&role={role}&type=COMPANY_SPECIFIC`).

3. **Module C: Personalized Learning Recommendations** (`/dashboard/student/learning-recommendations`)
   - Cross-module intelligence engine that dynamically synthesizes diagnostic data from Profile completeness, ATS resume diagnostics, Drive match gaps, Skill gap analyses, Mock interview rubrics, and Practice test accuracy scores.
   - Algorithmic prioritization into `HIGH`, `MEDIUM`, and `LOW` action items with estimated time commitments and deep-linking action payloads.
   - Full lifecycle management (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `DISMISSED`) with interactive status controls.
   - Visual target-role learning roadmap showing sequential phases (Foundational, Core Competencies, Advanced Application, Mock Interview & Polish).

---

## 2. Repository Information

| Metric | Value |
| :--- | :--- |
| **Git Branch** | `phase03-placement-preparation` |
| **Base Branch** | `phase01-02-hardening` |
| **Base Commit SHA** | `a565ff6884131ed503cf5561378d37dfa4945d21` |
| **Commit Subject** | `fix(hardening): Phase 01 & 02 security hardening, integrity verification, and audit regression tests` |
| **Phase 03 Commit SHA** | `7baa04a0862f8de5d5ece6385cbb318327e922be` |
| **Remote Database Operations** | None. Zero remote database mutations or migrations applied. |
| **Target Deployment** | Local staging / pull request ready. Zero production push. |

---

## 3. Feature Implementation Walkthrough

### Module A: Placement Preparation Practice Centre (`/dashboard/student/placement-practice`)
- **Path & Components:**
  - Page: `src/app/dashboard/student/placement-practice/page.tsx`
  - Service: `src/modules/students/services/placement-practice-service.ts`
  - APIs:
    - `GET /api/student/placement-practice` — Retrieves overall dashboard metrics, categories, topics, and recent student attempts.
    - `POST /api/student/placement-practice/attempt/start` — Initializes a practice attempt; generates/fetches questions and strips answer keys/explanations.
    - `POST /api/student/placement-practice/attempt/complete` — Receives student responses, computes server-authoritative score percentage, records responses, and updates aggregate metrics.
    - `GET /api/student/placement-practice/revision` — Returns questions answered incorrectly in previous attempts for targeted remediation.
- **User Experience & Flow:**
  - **Overview Header:** Displays total tests taken, overall accuracy %, total practice time, and questions flagged for revision.
  - **Practice Mode Selector:** Topic Practice (casual, modular), Timed Test (strict countdown timer with automated submission when time expires), Full Mock Test (comprehensive 20-question placement simulation), and Targeted Revision.
  - **Category Cards:** Quantitative Aptitude (10 topics), Logical Reasoning (8 topics), Verbal Ability (7 topics), Technical Core (11 topics).
  - **Interactive Testing Workspace:**
    - Live timer with warning color shifts when less than 2 minutes remain.
    - Question palette with dynamic status coloring: Current (primary purple), Answered (secondary green), Flagged for Review (gold/accent), Unanswered (card background).
    - Single and multi-select support with option clearance.
    - Next, Previous, Flag, and Submit controls.
  - **Results & Diagnostic Evaluation Modal:**
    - Visual score badge with percentage and pass/needs-improvement tier.
    - Detailed question-by-question review showing the student's answer vs. the correct answer, accompanied by step-by-step solving explanations and approaches.

### Module B: Advanced Company-Specific Preparation (`/dashboard/student/company-preparation`)
- **Path & Components:**
  - Page: `src/app/dashboard/student/company-preparation/page.tsx`
  - Service: `src/modules/students/services/company-preparation-service.ts`
  - APIs:
    - `GET /api/student/company-preparation` — Fetches employer directory with difficulty filters, search queries, and saved company tracking.
    - `GET /api/student/company-preparation/[slug]` — Retrieves full company profile, hiring rounds, roles, preparation modules, and student module progress.
    - `POST /api/student/company-preparation/save` — Toggles student saved/bookmarked company track.
    - `POST /api/student/company-preparation/progress` — Toggles completion status of specific preparation track modules.
    - `POST /api/student/company-preparation/questions` — Generates company-tailored interview and assessment questions via Gemini AI.
- **User Experience & Flow:**
  - **Company Directory:** Card grid featuring TCS, Infosys, Accenture, Amazon, and extensible partner listings. Displays industry, difficulty rating (Beginner to Hard), indicative CTC ranges, and hiring round count.
  - **Search & Filters:** Search by company name or role, filter by industry (IT Services, Cloud & Product, Core Engineering) or difficulty.
  - **Deep-Dive Company Modal:**
    - Role tabs (e.g. TCS Ninja vs. Digital vs. Prime; Amazon SDE-1).
    - Sequential hiring round timeline: Online Assessment -> Technical Interview -> Managerial / HR Round, with stage-specific tips and focus areas.
    - Preparation Checklist: Modular interactive track modules (Aptitude, Coding / DSA, System Design, Company Values) with real-time completion % progress bar.
    - AI Question Generator: Generates 5 company-specific technical and behavioral questions on demand with step-by-step model answers.
    - Launch Mock Interview CTA: Direct deep link into Phase 02 Mock Interview Studio pre-configured for the target company and role.

### Module C: Personalized Learning Recommendations (`/dashboard/student/learning-recommendations`)
- **Path & Components:**
  - Page: `src/app/dashboard/student/learning-recommendations/page.tsx`
  - Service: `src/modules/students/services/learning-recommendations-service.ts`
  - APIs:
    - `GET /api/student/learning-recommendations` — Synthesizes cross-module diagnostics and returns prioritized recommendations alongside the role-based learning roadmap.
    - `POST /api/student/learning-recommendations/[id]/status` — Updates recommendation status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `DISMISSED`).
- **User Experience & Flow:**
  - **Top Priority Hero Banner:** Prominently highlights the single most urgent recommendation derived from low test scores, ATS parse errors, or upcoming drive eligibility blockers.
  - **Category Tabs:** Filter recommendations across All, Skill Gaps, ATS Resume, Practice Tests, Mock Interviews, and Placement Drives.
  - **Recommendation Cards:**
    - Priority indicators: High (Urgent blocker), Medium (Improvement opportunity), Low (Polishing touch).
    - Supporting diagnostic evidence pills (e.g. "Triggered by: 42% accuracy in Logical Reasoning" or "Triggered by: Missing Cloud Architecture section in ATS Resume").
    - Estimated time commitment (e.g. 45 mins).
    - Contextual action buttons: direct routing to the appropriate diagnostic tool or practice mode.
    - Status dropdown: Mark In Progress, Complete, or Dismiss.
  - **Target Role Learning Roadmap:**
    - Interactive role switcher (Software Developer, Data Analyst, Cloud Engineer, Product Trainee).
    - 4-phase sequential timeline with milestone badges, core topics, and estimated completion timeframes.

---

## 4. Complete File-Change Inventory

### Database Migrations
- `supabase/migrations/20261109000004_phase03_placement_preparation.sql` *(335 lines, strictly additive, idempotent with IF NOT EXISTS)*

### Database Type Definitions
- `src/types/database.ts` *(Updated with 8 new table schemas and Row/Insert/Update exports)*

### Backend Services
- `src/modules/students/services/placement-practice-service.ts` *(4 categories, 36 topics, attempt lifecycle, sanitization, server scoring)*
- `src/modules/students/services/company-preparation-service.ts` *(Employer profiles, role tracks, progress tracking, AI question generation, deterministic fallback)*
- `src/modules/students/services/learning-recommendations-service.ts` *(Cross-module synthesis, multi-dimensional diagnostic extraction, role roadmaps)*
- `src/modules/ai/gemini-client.ts` *(Extended `feature` union with `"PRACTICE_CENTRE"` and `"COMPANY_PREPARATION"`)*

### API Endpoints
- `src/app/api/student/placement-practice/route.ts` *(GET dashboard overview, categories, topics)*
- `src/app/api/student/placement-practice/attempt/start/route.ts` *(POST start attempt with sanitized questions)*
- `src/app/api/student/placement-practice/attempt/complete/route.ts` *(POST submit attempt with server-side grading)*
- `src/app/api/student/placement-practice/revision/route.ts` *(GET questions for targeted revision)*
- `src/app/api/student/company-preparation/route.ts` *(GET employer directory)*
- `src/app/api/student/company-preparation/[slug]/route.ts` *(GET company profile and module progress)*
- `src/app/api/student/company-preparation/save/route.ts` *(POST bookmark company)*
- `src/app/api/student/company-preparation/progress/route.ts` *(POST update track module progress)*
- `src/app/api/student/company-preparation/questions/route.ts` *(POST AI company question generation)*
- `src/app/api/student/learning-recommendations/route.ts` *(GET prioritized recommendations and roadmap)*
- `src/app/api/student/learning-recommendations/[id]/status/route.ts` *(POST update recommendation lifecycle status)*

### Frontend Components & Pages
- `src/components/ui/progress.tsx` *(Reusable progress bar adhering to UrPlaced tokens)*
- `src/app/dashboard/student/placement-practice/page.tsx` *(Interactive practice centre, timer, palette, review modal)*
- `src/app/dashboard/student/company-preparation/page.tsx` *(Company directory, hiring journey, checklist, AI studio launch)*
- `src/app/dashboard/student/learning-recommendations/page.tsx` *(Priority action, evidence-backed recommendations, visual roadmap)*
- `src/lib/navigation/navigation-config.ts` *(Added Placement Preparation group with 3 sub-items in student navigation)*
- `src/app/dashboard/student/page.tsx` *(Added Placement Preparation & Readiness Suite cards on student dashboard)*

### Automated Test Suites
- `src/test/student-placement-preparation.test.ts` *(12 automated unit and integration tests for Phase 03)*

---

## 5. Database Migration Report

**Migration File:** `supabase/migrations/20261109000004_phase03_placement_preparation.sql`

### Schema Additions
1. **`placement_practice_questions`**: Global/tenant repository of curated practice questions across 4 categories and 36 topics.
2. **`placement_practice_attempts`**: Server-authoritative student practice sessions tracking mode, time spent, question count, and score percentage.
3. **`placement_practice_responses`**: Granular question-level answers with correctness flags and review states.
4. **`company_profiles`**: Employer directory containing hiring patterns, difficulty ratings, descriptions, and logos.
5. **`company_roles`**: Specific roles per company (e.g., TCS Ninja, Amazon SDE-1) with CTC ranges and hiring rounds.
6. **`company_prep_tracks`**: Preparation curricula and study modules mapped to companies and roles.
7. **`student_company_prep_progress`**: Tracks completed track modules and saved bookmarks per student.
8. **`student_learning_recommendations`**: Cross-module synthesized recommendations with priority, action payloads, and lifecycle statuses.

### Relational Integrity & Composite Foreign Keys
In strict alignment with the UrPlaced multi-tenant security standard, all student-owned tables enforce composite foreign keys referencing `(tenant_id, id)` on `public.students`:
```sql
CONSTRAINT fk_practice_attempts_student
  FOREIGN KEY (tenant_id, student_id)
  REFERENCES public.students(tenant_id, id)
  ON DELETE CASCADE;

CONSTRAINT fk_practice_responses_student
  FOREIGN KEY (tenant_id, student_id)
  REFERENCES public.students(tenant_id, id)
  ON DELETE CASCADE;

CONSTRAINT fk_company_prep_progress_student
  FOREIGN KEY (tenant_id, student_id)
  REFERENCES public.students(tenant_id, id)
  ON DELETE CASCADE;

CONSTRAINT fk_learning_recommendations_student
  FOREIGN KEY (tenant_id, student_id)
  REFERENCES public.students(tenant_id, id)
  ON DELETE CASCADE;
```
Every table enforces composite uniqueness on `(tenant_id, id)` to prevent cross-tenant ID collisions.

### Row-Level Security (RLS) Policy Matrix

| Table | PLACEMENT_HEAD / PLACEMENT_STAFF / TRAINER | STUDENT |
| :--- | :--- | :--- |
| `placement_practice_questions` | SELECT, INSERT, UPDATE, DELETE (within tenant or global) | SELECT only (active questions) |
| `placement_practice_attempts` | SELECT (all tenant students for monitoring) | SELECT (own attempts), DELETE (own attempts) — **No student INSERT/UPDATE** |
| `placement_practice_responses` | SELECT (all tenant responses) | SELECT (own responses), DELETE (own responses) — **No student INSERT/UPDATE** |
| `company_profiles` | SELECT, INSERT, UPDATE, DELETE (tenant or global) | SELECT only (active companies) |
| `company_roles` | SELECT, INSERT, UPDATE, DELETE (tenant or global) | SELECT only (active roles) |
| `company_prep_tracks` | SELECT, INSERT, UPDATE, DELETE (tenant or global) | SELECT only (active tracks) |
| `student_company_prep_progress`| SELECT (all tenant students) | SELECT, INSERT, UPDATE, DELETE (own progress only) |
| `student_learning_recommendations` | SELECT, INSERT, UPDATE (tenant students) | SELECT, UPDATE (status only for own records) |

### Additive Safety Verification
- Zero `DROP TABLE`, `ALTER COLUMN DROP`, or destructive DDL statements.
- All new tables and types use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`.
- Phase 01 tables (`student_profiles`, `student_resumes`, `placement_drives`) and Phase 02 tables (`student_skill_gap_analyses`, `student_career_passports`, `student_mock_interview_sessions`) are completely untouched.
- Extended the check constraint `ai_usage_logs_feature_check` additively to permit `'PRACTICE_CENTRE'` and `'COMPANY_PREPARATION'`.

---

## 6. Security and Privacy Report

1. **Multi-Tenant Data Isolation:**
   - Every database query in all Phase 03 services unconditionally filters by `tenant_id` alongside `student_id`.
   - Verified via unit test `enforces strict multi-tenant isolation on attempts`: attempts belonging to Tenant B are never returned to requests authenticated for Tenant A.
2. **Client Projection Sanitization:**
   - During active tests (`/api/student/placement-practice/attempt/start`), the backend sanitizes the question payload by stripping `correct_answer`, `explanation`, and `solving_approach`.
   - Verified via unit test `sanitizes questions delivered to student clients by stripping answers`: answer keys and solving approaches are confirmed undefined in client payloads.
3. **Server-Authoritative Evaluation:**
   - Students cannot self-report test scores or submit pre-computed percentages.
   - When a test is submitted to `/api/student/placement-practice/attempt/complete`, the server loads the canonical question records from the database, compares student answers against canonical answer keys, and calculates the authoritative score percentage.
   - Database RLS prevents students from directly inserting or modifying records in `placement_practice_attempts` and `placement_practice_responses`.
4. **AI Generation Resiliency & Deterministic Fallback:**
   - Company question generation leverages Google Gemini with strict prompt engineering and JSON schema enforcement.
   - If AI quota is exhausted, rate-limited, or network connectivity is interrupted, the service automatically falls back to curated deterministic offline questions without throwing unhandled exceptions.

---

## 7. Test and Build Report

### Automated Test Suite (Vitest)
- Command: `npx vitest run src/test/student-placement-preparation.test.ts src/test/student-career-improvement.test.ts src/test/student-career-intelligence.test.ts src/test/phase01-phase02-hardening-audit.test.ts`
- **Result:** **60 / 60 tests passed** across 4 test suites.
- Full Suite Run: `npx vitest run`
- **Full Suite Result:** **135 / 135 test files passed, 1,535 / 1,535 total tests passed (0 failures)**.

### Detailed Breakdown of Phase 03 Tests (`student-placement-preparation.test.ts`)
1. `Placement Practice Service > initializes practice attempt and returns sanitized questions` — PASSED (Verifies question payload sanitization)
2. `Placement Practice Service > scores practice attempt server-side and stores responses` — PASSED (Verifies server-authoritative scoring)
3. `Placement Practice Service > retrieves revision questions based on past mistakes` — PASSED (Verifies targeted revision retrieval)
4. `Placement Practice Service > enforces strict multi-tenant isolation on attempts` — PASSED (Verifies tenant isolation)
5. `Company Preparation Service > retrieves company profiles and role tracks` — PASSED (Verifies employer catalogue retrieval)
6. `Company Preparation Service > updates student module completion progress` — PASSED (Verifies checklist persistence)
7. `Company Preparation Service > toggles saved company bookmark for a student` — PASSED (Verifies bookmarking)
8. `Company Preparation Service > generates deterministic fallback practice questions when AI is offline` — PASSED (Verifies offline fallback resilience)
9. `Learning Recommendations Service > generates personalized recommendations across multiple diagnostics` — PASSED (Verifies cross-module diagnostic extraction)
10. `Learning Recommendations Service > calculates priority score correctly` — PASSED (Verifies HIGH/MEDIUM/LOW priority sorting)
11. `Learning Recommendations Service > provides target-role sequential learning roadmap` — PASSED (Verifies 4-phase roadmap)
12. `Learning Recommendations Service > updates recommendation status` — PASSED (Verifies lifecycle state machine)

### Static Analysis & Build Verification
- **TypeScript (`tsc --noEmit`):** **0 errors (Exit code 0)**.
- **Linter (`next lint`):** **0 errors, 0 warnings in Phase 03 code (Exit code 0)**.
- **Dialog System Audit (`dialog-system-and-modal-alignment.test.tsx`):** **14 / 14 tests passed, 0 browser-native popup violations**.
- **Next.js Production Build (`next build`):** **Exit code 0**. All 67 static and dynamic routes compiled and optimized successfully.

---

## 8. User Interface Verification Report

### Design System Compliance
All Phase 03 components strictly adhere to the UrPlaced Design System tokens defined in `GEMINI.md`:
- **Primary:** `#5052C9` (Active buttons, progress highlights, active tabs, timer accent)
- **Secondary Accent:** `#2E8F86` (Answered indicators, completed badges, success checkmarks)
- **Background:** `#EDECE7` (Main app layout background)
- **Card Background:** `#F8F7F3` (Surface background for cards, modals, question containers)
- **Input Background:** `#FBFAF7` (Search inputs, option radio/checkbox buttons)
- **Primary Text:** `#24283A` (Headings, titles, question prompts)
- **Secondary Text:** `#292D40` (Subtitles, labels, option text, metadata)
- **Typography:** Headings in `Outfit`, body/UI controls in `Inter`, scores/timers/code in `JetBrains Mono`.

### Dialog System Alignment
Zero instances of browser-native popups (`alert()`, `confirm()`, `prompt()`) exist in Phase 03 code. All user feedback, error states, and confirmation dialogs utilize `@/components/ui/dialog-system` toasts and accessible React modals.

---

## 9. Known Issues, Limitations & Future Enhancements

1. **Database Migration State:**
   - Migration `20261109000004_phase03_placement_preparation.sql` has been drafted, verified, and validated in code and tests.
   - In accordance with non-negotiable safety rules, the migration has **not** been applied to the remote Supabase database (`supabase db push` was not run).
   - In offline/mock mode or before remote migration execution, all service layers gracefully fall back to in-memory curated seed datasets.
2. **Future Enhancements:**
   - Real-time peer mock challenges between students within the same college tenant.
   - Code execution sandbox integration for live compiler evaluation during technical tests.

---

## 10. Final Implementation Status

```
================================================================================
FINAL IMPLEMENTATION STATUS: COMPLETED — ALL ACCEPTANCE CRITERIA VERIFIED
================================================================================
Phase 03 — Global Placement Preparation System is fully implemented, verified,
and ready for production migration approval.
================================================================================
```
