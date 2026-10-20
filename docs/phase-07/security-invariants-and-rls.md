# Phase 07 Security Invariants & Row-Level Security (RLS)

## 1. Zero Answer-Key Leakage Invariant

During an active test attempt:
- The taking workspace endpoint (`GET /api/student/attempts/[id]`) and start endpoint (`POST /api/student/assessments/[id]/start`) pass all question records through `QuestionService.sanitizeForStudent(ver, qType)`.
- `answer_key`, `explanation`, internal scoring rubrics, and hidden test cases are stripped out before returning the JSON payload to the browser.
- Inspecting browser network tools or local storage yields zero solution data.

---

## 2. Server-Authoritative Timer Invariant

- The client timer is for presentation only.
- Whenever an attempt is started, the server calculates `expires_at = started_at + duration`.
- If a client alters their local system time or pauses execution, the next autosave or submission request checks `now() > expires_at`.
- Expired attempts are immediately transitioned to `EXPIRED`, locked against further answer modifications, and scored based on saved responses.

---

## 3. Row-Level Security (RLS) Policies

All 6 Phase 07 tables enforce Row-Level Security (`ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`):

| Table | Policy Summary |
| :--- | :--- |
| `assessments` | Staff and platform admins have full CRUD. Students can only `SELECT` records where `status = 'PUBLISHED'`. |
| `assessment_assignments` | Staff have full CRUD. Students can only read assignments where `student_id = auth.uid()` or `student_id IS NULL` (cohort assignments). |
| `assessment_attempts` | Staff can view all tenant attempts. Students can only select, insert, or update their own attempt records (`student_id IN (SELECT id FROM students WHERE user_id = auth.uid())`). |
| `attempt_responses` | Students can only access responses tied to their own attempts. Staff can view all. |
| `preparation_practice_sessions` | Private to each student; staff can view aggregate analytics. |
| `student_behavioral_responses` | Completely private to the student creator; protected against other students and unauthorized staff. |
