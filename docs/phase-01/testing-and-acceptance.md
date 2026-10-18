# Testing Strategy & Acceptance Criteria Specification — UrPlaced V1.0

**Product:** UrPlaced — Multi-College Placement Preparation & Management SaaS  
**Phase:** 01 — Product Blueprint & Architecture  
**Status:** Approved Specification  

---

## 1. Testing Philosophy & Verification Tiers

To satisfy the **launch-blocking tenant isolation and data integrity requirements**, UrPlaced mandates an automated multi-tier testing strategy. Testing is not limited to UI rendering; it rigorously verifies security invariants, persistence semantics, concurrency, and sandbox isolation.

```
       ┌─────────────────────────┐
       │   E2E & Workflow Tests  │  (Playwright / Cypress)
       ├─────────────────────────┤
       │ Cross-Tenant Deny Suite │  (Automated Attack Vectors)
       ├─────────────────────────┤
       │ Domain Integration Tests│  (Prisma + Real PostgreSQL RLS)
       ├─────────────────────────┤
       │     Unit Tests & Zod    │  (Vitest / TypeScript Pure Functions)
       └─────────────────────────┘
```

---

## 2. Explicit Cross-Tenant Allow / Deny Matrix

This matrix forms an **automated integration test suite** executed against a real PostgreSQL instance with RLS enabled:

| Operation | Subject / Actor | Target Resource | Expected Outcome | Verification Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| `SELECT` | User (Tenant A) | Student Profile (Tenant A) | **ALLOW (200)** | Returns profile data matching Tenant A |
| `SELECT` | User (Tenant A) | Student Profile (Tenant B) | **DENY (404/Empty)** | RLS returns 0 rows; domain policy throws `NOT_FOUND` |
| `INSERT` | Placement Head (Tenant A)| Drive Record (Tenant A) | **ALLOW (201)** | Row inserted with `tenant_id = Tenant_A` |
| `INSERT` | Placement Head (Tenant A)| Drive Record (Tenant B) | **DENY (403/Error)** | RLS `CHECK` constraint fails with SQL violation |
| `UPDATE` | User (Tenant A) | Assessment Attempt (Tenant B)| **DENY (404/Error)** | RLS filter matches 0 rows; mutation rejected |
| `DELETE` | Placement Head (Tenant A)| Question (Tenant B) | **DENY (404/Error)** | 0 rows affected; audited alert triggered |
| `FILE_GET` | Student (Tenant A) | S3 Object (`/tenants/Tenant_B/..`)| **DENY (403)** | Pre-signed URL generator rejects mismatched tenant |
| `ACTION` | Student (Tenant A) | Server Action (`publishDrive(Drive_B)`)| **DENY (403)** | `can()` policy check returns false; action aborted |
| `JOB` | Background Job (Tenant A)| Batch Ingest (`targetTenant = Tenant_B`)| **DENY (Fatal)** | Worker rejects mismatch between token & payload |

---

## 3. Acceptance Test Scenarios by Workflow

### Workflow 1: Tenant Onboarding & Activation
- **TC-ONB-01:** Super Admin provisions tenant `College-X` with domain `@college-x.edu`. Verify initial placement head receives activation email with cryptographically random token.
- **TC-ONB-02:** Attempting student registration with `@gmail.com` under `College-X` is rejected with domain mismatch error.

### Workflow 2: Student Cohort Bulk Import
- **TC-IMP-01 (Clean Import):** Upload valid 500-student CSV. Verify all 500 profiles commit atomically, matching batches and departments.
- **TC-IMP-02 (Syntax/Type Errors):** Upload CSV with negative CGPA and invalid email syntax on rows 12 and 45. Verify system rejects commit, provides preview, and outputs error CSV pinpointing exact rows and columns.
- **TC-IMP-03 (Duplicate Roll Numbers):** Upload CSV with duplicate roll numbers within the file and against existing active database records. Verify duplicates are flagged and commit is halted until resolved.

### Workflow 3: Recruitment Drive & Transparent Eligibility
- **TC-DRV-01 (Eligibility Calculation):** Create drive with criteria: `CGPA >= 8.0, Active Backlogs = 0`. Evaluate against cohort:
  - Student A (CGPA 8.5, Backlogs 0) -> `ELIGIBLE`
  - Student B (CGPA 7.9, Backlogs 0) -> `DISQUALIFIED` (Reason: `CGPA 7.9 < 8.0`)
  - Student C (CGPA 8.2, Backlogs 1) -> `DISQUALIFIED` (Reason: `Active Backlogs 1 > 0`)
  - Student D (CGPA missing) -> `NEEDS_REVIEW` (Reason: `Missing Academic Record`)
- **TC-DRV-02 (Student Transparency):** Authenticate as Student B. Verify student dashboard displays exact failure reason (`CGPA 7.9 < 8.0`) without exposing other students' statuses.

### Workflow 4: QuestionBank Sentinel
- **TC-QBS-01 (Quality Validation):** Attempt to submit MCQ without marking a correct answer. Sentinel blocks save with validation error.
- **TC-QBS-02 (Duplicate Detection):** Submit question with body text having 90% Levenshtein similarity to an existing question in the same topic. Sentinel flags duplicate warning before drafting.
- **TC-QBS-03 (Snapshot Immutability):** Create assessment with Question Set Version 1. Update Question in Question Bank to Version 2. Verify assessment attempt continues to render Version 1.

### Workflow 5: Resilient Assessment Attempt & Autosave
- **TC-AST-01 (Server Clock Authority):** Start 60-minute test. Alter client machine clock forward by 2 hours. Verify server rejects visual tampering and measures remaining time from server database timestamp.
- **TC-AST-02 (Autosave Under Network Disruption):** Answer questions 1–5. Disconnect client network for 45 seconds while answering question 6. Reconnect network. Verify autosave queue flushes in sequence without data loss.
- **TC-AST-03 (Concurrent / Out-of-Order Packets):** Send autosave packet with sequence number 5, followed by stale packet with sequence number 3 arriving late. Verify server ignores packet 3 and preserves packet 5 state.

### Workflow 6: Isolated Code Runner Sandbox
- **TC-RUN-01 (Infinite Loop / Timeout):** Submit Python script `while True: pass`. Verify runner terminates within 2.0s with `TIME_LIMIT_EXCEEDED` status; web server remains unaffected.
- **TC-RUN-02 (Memory Exhaustion):** Submit script attempting to allocate 2GB memory array. Verify runner terminates with `MEMORY_LIMIT_EXCEEDED` under 256MB cgroup limit.
- **TC-RUN-03 (Host Escape & Network Egress):** Submit script attempting socket connection to `169.254.169.254` (cloud metadata) or local filesystem write to `/etc/passwd`. Verify runner denies network access (`socket.error: Network unreachable`) and write permissions.

### Workflow 7: Mistake Bank & Mastery Retest
- **TC-MB-01 (Mistake Capture):** Complete assessment scoring 70%. Verify all 3 incorrect questions and 1 skipped question appear in student's personal Mistake Bank with attempt context.
- **TC-MB-02 (Mastery Retest Requirement):** Trigger retest for topic "Binary Trees". Verify system serves *new isomorphic questions*, not the identical question previously answered incorrectly.
- **TC-MB-03 (Mastery Threshold):** Student answers 2 consecutive new questions correctly. Verify topic status transitions from `UNRESOLVED` to `MASTERED`.

---

## 4. Definition of Done for Testing (Phase Gates)

Before any functional implementation phase is declared complete in Phases 02–10:
1. **100% Cross-Tenant Security Suite Pass:** Zero unauthorized cross-tenant reads or writes across all new tables.
2. **Deterministic Seed Data:** Test environments seed reproducible test fixtures for Tenant A (`Apex Institute`) and Tenant B (`Beacon College`).
3. **No Flaky Timing Assertions:** Assessment timer tests mock server clocks deterministically.
4. **Clean Lint & Strict TypeScript Compilation:** Zero type errors (`tsc --noEmit`), zero lint warnings (`eslint --max-warnings 0`).
