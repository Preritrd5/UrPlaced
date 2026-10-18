# Architectural Decision Records (ADRs) & Open Questions — UrPlaced V1.0

**Product:** UrPlaced — Multi-College Placement Preparation & Management SaaS  
**Phase:** 01 — Product Blueprint & Architecture  
**Status:** Approved Specification  

---

## 1. Architectural Decision Records (ADRs)

### ADR-01: Architecture Pattern — Modular Monolith over Microservices
- **Status:** Accepted
- **Context:** UrPlaced requires high domain coherence across tenancy, student records, drives, question sets, assessments, and analytics. Managing distributed transactions and multi-repo CI/CD at V1.0 introduces excessive operational overhead.
- **Decision:** Build as a strictly modular monolith within Next.js App Router. Enforce module boundaries via TypeScript interfaces and server-only domain services under `src/modules/`.
- **Consequences:** Low deployment complexity, zero network overhead between internal domains, atomic ACID transactions in PostgreSQL. Modules can be extracted into microservices in the future if scale warrants.

### ADR-02: Multi-Tenancy Strategy — Shared Database with PostgreSQL Row-Level Security (RLS)
- **Status:** Accepted
- **Context:** College placement platforms demand absolute data isolation. Database-per-tenant introduces severe operational burden (hundreds of migration runs, idle connection overhead). Pure application-level filtering risks accidental cross-tenant data leaks if a developer omits a `where: { tenantId }` clause.
- **Decision:** Adopt a single shared PostgreSQL database where every table has `tenant_id`. Enforce isolation via two independent layers: (1) Domain service queries, and (2) PostgreSQL Row-Level Security (RLS) policies using a dedicated non-owner runtime user (`urplaced_app_runtime`) and transaction-scoped `SET LOCAL app.current_tenant_id`.
- **Consequences:** Hardware efficiency with database-enforced security guarantees. Requires strict management of transaction boundaries and connection-pooling resets.

### ADR-03: Authentication Engine — Better Auth with Explicit Application RBAC
- **Status:** Accepted
- **Context:** We require robust email/password auth, secure session cookies, email verification, and password reset flows with direct Prisma ORM integration, without relying on third-party proprietary auth lock-in.
- **Decision:** Use Better Auth with its Prisma adapter. Manage core user identities and credentials through Better Auth, but keep institutional tenant memberships, scoped roles, and permissions explicitly modelled in UrPlaced application tables.
- **Consequences:** Fully self-hosted authentication, no external vendor per-user fees, full flexibility over domain-specific RBAC.

### ADR-04: Question & Assessment Snapshots — Immutable Versioning
- **Status:** Accepted
- **Context:** If a teacher edits a typo or alters an answer key in a question bank, previously completed assessments or in-progress tests must not be corrupted or re-scored retroactively.
- **Decision:** Questions and assessments are immutable once published. Every publication creates a `QuestionVersion` and `AssessmentVersion`. Student attempts reference specific immutable version IDs.
- **Consequences:** Absolute historical auditability and scoring stability. Requires minor additional storage for version rows.

### ADR-05: Assessment Integrity — Server-Authoritative Clock & Resilient Autosave
- **Status:** Accepted
- **Context:** Network unreliability on campus Wi-Fi causes lost student answers. Client-side timers can be bypassed by manipulating local device clocks.
- **Decision:** The server clock is the sole source of truth for start and expiry timestamps. Answers autosave with monotonic sequence numbers (`sequence_number`) to prevent stale packets from overwriting newer entries.
- **Consequences:** Resilient assessment delivery immune to local device tampering or transient connection drops.

### ADR-06: Code Execution Sandbox — Isolated Runner Adapter (Judge0 / nsjail)
- **Status:** Accepted
- **Context:** Students submit code in Python, Java, C++, and JavaScript. Executing untrusted student code inside the main web server process presents extreme security risks (fork bombs, data theft, remote code execution).
- **Decision:** Sandboxed execution via an isolated runner adapter (e.g., Judge0 or custom nsjail/gVisor container). Web server dispatches execution payloads to the sandbox over a private, unexposed VPC channel with strict cgroup CPU/memory caps and zero network egress.
- **Consequences:** Guaranteed server safety; isolated blast radius for student code crashes or malicious attempts.

### ADR-07: Provenance-First Recruitment Intelligence
- **Status:** Accepted
- **Context:** Students and placement cells often confuse rumors or AI summaries with official company policy.
- **Decision:** All recruitment data must carry explicit provenance classification (`OFFICIAL_DOCUMENT`, `COLLEGE_OFFICIAL`, `HISTORICAL_VERIFIED`, `CANDIDATE_REPORTED`, `INFERRED_GUIDANCE`, `AI_GENERATED`). Unverified candidate debriefs or AI extracts remain marked `needs_review` until verified by authorized staff.
- **Consequences:** Eliminates misinformation; maintains trust with students and recruiting enterprises.

### ADR-08: Mistake-to-Mastery — Retest with New Isomorphic Questions
- **Status:** Accepted
- **Context:** Answering a previously failed question correctly after reading its explanation is merely memorization, not proof of conceptual mastery.
- **Decision:** Mastery is achieved only when a student answers *new, isomorphic questions* on the same topic and difficulty.
- **Consequences:** Legitimate learning evidence; prevents superficial score inflation.

---

## 2. Chosen Defaults for Unresolved Business Choices

| Business Area | Default Decision for V1.0 | Rationale |
| :--- | :--- | :--- |
| **Student Registration** | Institutional binding only; no open public self-signup | Protects tenant data boundaries and prevents unauthorized campus claims. |
| **Subscription & Billing** | Manually managed tenant limits via Super Admin; no automated Stripe billing | Campus procurement operates on annual institutional invoicing, not self-serve monthly credit cards. |
| **Question Bank Sharing** | Strictly college-private by default; opt-in sharing only | Colleges treat placement test papers as proprietary institutional assets. |
| **Peer Practice Rooms** | Structured prep scheduling without live WebRTC rooms | Maximizes V1.0 reliability; avoids high bandwidth costs and WebRTC operational complexity. |

---

## 3. Open Questions & Uncertainty Register

| ID | Open Question / Decision | Impacted Modules | Potential Options | Current Default Stance | Owner |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **OQ-01** | Should historical drive data from College A be anonymized and aggregated into a cross-college benchmark? | Placement Memory, Analytics | A: Strictly isolate by college.<br>B: Opt-in anonymous cross-college hiring trends. | **Option A (Strict isolation by default)** | Product Owner |
| **OQ-02** | What exact threshold of isomorphic question passes defines "Mastery"? | Mistake Bank, Analytics | A: 2 consecutive correct.<br>B: 3 correct over 7 days.<br>C: Configurable by placement officer. | **Option A (2 consecutive correct passes as baseline, configurable by college)** | Learning Team |
| **OQ-03** | Should coding assessments support custom unit-testing frameworks (e.g. JUnit, PyTest) or standard stdin/stdout? | Code Execution, QuestionBank | A: Standard stdin/stdout parsing.<br>B: Full AST/JUnit harness. | **Option A (Standard stdin/stdout with hidden test cases for V1.0)** | Tech Lead |
| **OQ-04** | How should student academic record corrections be handled after a drive is active? | Eligibility, Student Admin | A: Immediate retroactive recalculation.<br>B: Require manual placement officer confirmation for active drives. | **Option B (Require manual review to prevent silent disqualifications mid-drive)** | Placement Ops |
