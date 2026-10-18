# Phase 05: Student Preparation Planner & Experience Reports

## 1. Personalized Student Preparation Planner

When an eligible student opens DriveFit for an active recruitment drive, `PreparationPlannerService.getOrCreatePlan()` synthesizes an actionable study plan tailored to that drive's confirmed process.

### 1.1 Round-by-Round Task Assembly
- If recruitment stages (`drive_stages`) are confirmed:
  - Quantitative and logical reasoning tasks are mapped to **Round 1 (Online Assessment)**.
  - Data structures, algorithms, and SQL tasks are mapped to **Round 2 (Technical Interview / Coding Round)**.
  - Behavioral and leadership principles tasks are mapped to **Round 3 (HR / Managerial Round)**.
- If recruitment stages are unconfirmed:
  - Tasks are organized in a general recommended sequence, explicitly tagged as **Inferred Guidance**.
  - No fake universal four-round process is invented.

### 1.2 Task Structure & Student Interactivity
Each preparation task includes:
- `activity_type`: `CONCEPT_REVIEW`, `PRACTICE_DRILL`, `MOCK_EXAM_PREPARATION`, `CHECKLIST_ITEM`.
- `priority`: `HIGH`, `MEDIUM`, `LOW`.
- `status`: `PLANNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `COMPLETED` $\rightarrow$ `SKIPPED`.
- `recommendation_rationale`: Transparent explanation of why this activity is in the student's plan.
- Direct links to verified practice resources.

---

## 2. Honest Unavailable State (Phase 06 & 07 Boundary)

The student preparation view does not simulate or pretend that timed coding environments or mock test evaluations are completed when those modules belong to later phases:
- A clear banner informs students: *"Timed Coding Runner, adaptive test sessions, and Mistake-to-Mastery review are scheduled for integration in Phase 06 & 07."*
- Tasks link to available syllabus outlines and practice materials without fabricating test scores or performance histories.

---

## 3. Historical Candidate Experience Reports

Students and alumni can submit retrospective accounts of previous recruitment cycles for the company via `ExperienceReportService`:
- **Candidate Anonymity:** When reports are displayed to students, student personal details are automatically scrubbed (`is_anonymous = true`).
- **Staff Moderation:** Submissions enter `PENDING` status and require placement staff approval before becoming visible to cohort peers.
