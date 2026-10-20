# Phase 07 — Assessment Engine & Student Preparation Architecture

## 1. System Overview

Phase 07 connects the approved question content managed through **QuestionBank Sentinel** (Phase 06) and the recruitment requirements analyzed through **DriveFit** (Phase 05) into an authoritative student assessment and preparation engine.

The platform distinguishes between formal, timed, cohort-assigned assessments and informal, untimed student practice drills, ensuring that informal learning clicks never contaminate formal placement assessment records.

---

## 2. Core Architectural Pillars

### 2.1 Immutable Question Set Snapshots
- Assessments link to a `question_set_id` and capture its `set_version_id`.
- When an assessment blueprint is published, the linked question set is locked, freezing the exact question versions (`question_versions`).
- Questions in an active attempt cannot be mutated or replaced mid-examination.

### 2.2 Server-Authoritative Timer & Attempt State Machine
- Client-side clocks are treated solely as UI display countdowns.
- `expires_at` is calculated and enforced server-side:
  $$\text{expires\_at} = \text{started\_at} + (\text{time\_limit\_minutes} \times 60\,\text{seconds})$$
- Attempt states:
  - `NOT_STARTED`: Initial assigned state.
  - `IN_PROGRESS`: Candidate is actively taking the test; server timer running.
  - `SUBMITTED`: Candidate explicitly confirmed submission within time.
  - `EXPIRED`: Server detected `now() > expires_at`; answers auto-locked and evaluated.
  - `SCORING`: Server is evaluating objective questions.
  - `SCORED`: Evaluation complete; provisional or final scores stored.
  - `RESULT_RELEASED`: Evaluation results visible to candidate per release policy.

### 2.3 Resilient Autosave with Sequence Versioning Concurrency Control
- Each client autosave includes:
  - `attempt_id`, `question_id`, `version_id`, `response_payload`, `save_sequence`.
- Monotonic sequence check on server:
  - If incoming `save_sequence < existing.save_sequence`: packet is dropped / acknowledged without overwriting newer answers (protects against delayed mobile packet arrival).
  - If `now() > expires_at`: autosave is rejected and attempt transitions to `EXPIRED`.

### 2.4 Isolated Code Runner Boundary
- Zero fake execution: If `CODE_RUNNER_ENDPOINT` is not configured, coding questions honestly report execution unavailability and are flagged for offline evaluation (`MANUAL_REVIEW_REQUIRED`) rather than fabricating test case outputs.

### 2.5 Student Preparation Hub
- Untimed practice drills logged in `preparation_practice_sessions`, tracking questions practiced, accuracy, and study time without creating high-stakes exam records.
- Behavioral & Group Discussion Hub:
  - Interactive STAR Method (Situation, Task, Action, Result) response builder.
  - Campus GD strategies (initiation, active moderation, body language, constructive counter-arguments, objective summarization).
  - Persistent private student reflection drafts in `student_behavioral_responses`.
