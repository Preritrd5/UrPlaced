# URPLACED — COMPREHENSIVE PROJECT TECHNICAL AUDIT & ARCHITECTURAL HANDOFF REPORT
**Document Version:** 1.0.0 (Master Production Handoff)  
**Date of Audit & Generation:** November 2, 2026  
**Security Classification:** Highly Confidential / Proprietary  
**Target Audience:** Principal Software Architects, Lead Full-Stack Engineers, DevOps/SecOps Leads, Database Administrators, Product Owners, and Dedicated ChatGPT Project AI Assistants.

---

## TABLE OF CONTENTS

1. [Executive Summary & Platform Identity](#1-executive-summary--platform-identity)
2. [Technology Stack & Architecture Inventory](#2-technology-stack--architecture-inventory)
3. [System Architecture & Topology](#3-system-architecture--topology)
4. [Complete Repository & Directory Tree](#4-complete-repository--directory-tree)
5. [Authentication, Multi-Tenancy & The "One Person = One College" Hard Rule](#5-authentication-multi-tenancy--the-one-person--one-college-hard-rule)
6. [Strict Option A: Platform Control Plane vs. Institutional Data Isolation](#6-strict-option-a-platform-control-plane-vs-institutional-data-isolation)
7. [Complete Module-by-Module Audit (Phases 01–14 & SA-01–SA-07)](#7-complete-module-by-module-audit-phases-0114--sa-01sa-07)
8. [Frontend & UI/UX Inventory (Design System Tokens & Pages)](#8-frontend--uiux-inventory-design-system-tokens--pages)
9. [Backend Services, Utilities & Server Actions Inventory](#9-backend-services-utilities--server-actions-inventory)
10. [Complete API Route Audit (All 170+ Endpoints)](#10-complete-api-route-audit-all-170-endpoints)
11. [Complete Database Architecture & Migration History (All 32 Migrations)](#11-complete-database-architecture--migration-history-all-32-migrations)
12. [Row Level Security (RLS) & Storage Isolation Audit](#12-row-level-security-rls--storage-isolation-audit)
13. [Canonical Audit Logging Architecture](#13-canonical-audit-logging-architecture)
14. [AI Intelligence Layer (Google Gemini & AI Tutor)](#14-ai-intelligence-layer-google-gemini--ai-tutor)
15. [Payments, Billing & Subscription Lifecycle (Option C, 7-Day Grace, Overrides)](#15-payments-billing--subscription-lifecycle-option-c-7-day-grace-overrides)
16. [Comprehensive Security Audit & Vulnerability Mitigation](#16-comprehensive-security-audit--vulnerability-mitigation)
17. [Environment Variables & Secrets Management (Redacted)](#17-environment-variables--secrets-management-redacted)
18. [Verified Testing, QA & Validation Baseline (1,203 Vitest, 92 pgTAP, Build)](#18-verified-testing-qa--validation-baseline-1203-vitest-92-pgtap-build)
19. [End-to-End User & Operational Workflows](#19-end-to-end-user--operational-workflows)
20. [Critical Dependency & Integration Graph](#20-critical-dependency--integration-graph)
21. [Complete Implementation Status Matrix](#21-complete-implementation-status-matrix)
22. [Known Issues, Edge Cases & Residual Technical Debt](#22-known-issues-edge-cases--residual-technical-debt)
23. [V1.0 Production Readiness Assessment](#23-v10-production-readiness-assessment)
24. [Recommended Post-Handoff Roadmap (P0 to P3)](#24-recommended-post-handoff-roadmap-p0-to-p3)
25. [Preserved Architectural Decisions & Immutable Invariants](#25-preserved-architectural-decisions--immutable-invariants)
26. [Glossary of System Terms & Canonical Definitions](#26-glossary-of-system-terms--canonical-definitions)
27. [IMPORTANT CONTEXT AND INSTRUCTIONS FOR THE NEXT CHATGPT ASSISTANT](#27-important-context-and-instructions-for-the-next-chatgpt-assistant)

---

## 1. EXECUTIVE SUMMARY & PLATFORM IDENTITY

### 1.1 Platform Mission & Core Identity
**UrPlaced** is an enterprise-grade, multi-tenant SaaS placement intelligence and workflow management platform engineered specifically for higher education institutions (Engineering, Science, and Management universities and colleges across India). 

UrPlaced bridges the critical operational and preparation divide between academic institutions and corporate employers:
1. **For Institutional Placement Cells (Placement Heads, Placement Staff, Trainers):** It automates the end-to-end campus recruitment lifecycle—from employer onboarding, job description ingestion, and automated candidate eligibility evaluation, to proctored online examinations, interview pipeline tracking, offer letter reconciliation, and longitudinal placement memory analytics.
2. **For Students (Candidates):** It delivers a personalized, AI-driven preparation co-pilot (DriveFit job description matching, QuestionBank Sentinel practice, Mistake-to-Mastery adaptive spaced repetition, and Google Gemini-powered AI tutoring) seamlessly integrated into their institution's placement drives.
3. **For Platform Super Admins:** It provides an isolated, multi-college control plane (`/preritrd/`) for tenant onboarding, subscription lifecycle management, billing reconciliations, and platform telemetry under **Strict Option A Tenant Isolation** (absolute zero access to institutional student PII, assessments, question banks, or drive operational records).

### 1.2 Target Audience & Role Taxonomy
The platform is organized into two primary user account categories and five strictly segregated role profiles:
- **Category 1: Student Accounts**
  - `STUDENT`: Authenticated individual candidate claiming institutional enrollment via verified Student Registration Number (SRN/USN). Has access to candidate dashboards, drive applications, practice assessments, mistake remediation, and AI tutor. Completely barred from billing, college governance, and staff administration.
- **Category 2: College Accounts (Institutional Placement Cell)**
  - `PLACEMENT_HEAD`: Institutional administrator. Sole authority for college subscription plan selection, Razorpay checkout, billing ledger access, invoice downloads, staff invitation/removal, roster imports, and company/drive management.
  - `PLACEMENT_STAFF`: Operational placement coordinator. Manages recruitment drives, application pipelines, eligibility criteria, student directory verifications, and company communications. Strictly prohibited from accessing billing, invoices, plan selection, or staff governance.
  - `TRAINER`: Academic trainer and evaluator. Designs question banks, curates assessment sets, monitors student cohort skill gaps, and reviews mistake-to-mastery telemetry. Strictly prohibited from managing recruitment drives, student directories, or billing.
- **Category 3: Platform Super Admin (Independent Control Plane)**
  - `SUPER_ADMIN`: Central platform operator. Operates at `/preritrd/` with mandatory TOTP MFA (`AAL2`). Provisions college invitation tokens, manages global subscription plans, monitors platform health and system logs, and grants emergency time-bound overrides (1–168 hours). Operates under Strict Option A isolation.

### 1.3 Business & Monetization Architecture
UrPlaced operates on a B2B SaaS institutional subscription model:
- **Tiered Plans:** Free / Starter, Growth, and Enterprise tiers with granular feature entitlement flags and numeric resource quotas (active students, monthly AI tokens, storage limits).
- **Payment Gateway:** Razorpay integration (Orders, Payments, Webhook verification with HMAC-SHA256, automated refund reconciliation).
- **Approved Option C Dual Onboarding:**
  - *Workflow 1 (Pre-Assigned):* Super Admin assigns an approved, published plan during college invitation. College is created with subscription status `PENDING_PAYMENT`.
  - *Workflow 2 (Self-Selection):* Super Admin leaves plan unassigned. Placement Head registers and selects an approved, published plan post-registration.
  - *Fail-Closed Invariant:* No college gains operational access prior to verified payment. Draft plans are strictly barred from selection.
- **7-Day Renewal Grace Period:** Paying colleges retain 100% operational access during a 7-day grace period post-expiration, accompanied by persistent billing warning banners.
- **Emergency Access Overrides:** Super Admins can grant 1–168 hour access overrides for critical operations (e.g., active placement drive), requiring mandatory $\ge 10$-character audited justifications.

### 1.4 Production Baseline & Audit Snapshot
| Metric | Verified Audit Value | Status |
| :--- | :--- | :--- |
| **Vitest Regression Test Suite** | **101 test files, 1,203 tests passed (0 failures)** | Verified 100% Pass |
| **Master SA-07 End-to-End Suite** | **45 comprehensive scenarios passed (0 failures)** | Verified 100% Pass |
| **PostgreSQL Database RLS Suite** | **92 pgTAP assertions passed (0 failures)** | Verified 100% Pass |
| **TypeScript Compilation (`tsc --noEmit`)** | **0 errors, 0 warnings** | Strict Pass |
| **Next.js Production Build (`next build`)** | **97 static prerendered pages, 265 total routes** | Exit Code 0 |
| **Database Migrations** | **32 sequential SQL migration files** | Fully Structured |
| **API Endpoints** | **170+ route handlers across app router** | Fully Audited |
| **Overall V1.0 Readiness** | **READY WITH DOCUMENTED EXTERNAL PREREQUISITES** | Ready for Deployment |

---

## 2. TECHNOLOGY STACK & ARCHITECTURE INVENTORY

### 2.1 Core Framework & Runtimes
- **Application Framework:** Next.js 15.1.12 (App Router architecture, React Server Components, Server Actions, Route Handlers).
- **UI Runtime:** React 19.0.0 and React-DOM 19.0.0.
- **Language:** TypeScript 5.7.3 (`"strict": true`, `"target": "ES2022"`, `"moduleResolution": "bundler"`, zero-tolerance policy for unchecked type assertions).
- **CSS Engine:** Tailwind CSS 3.4.17 with PostCSS 8.4.49 and Autoprefixer 10.4.20.
- **Iconography & Primitives:** Lucide React 0.475.0, Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-select`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-checkbox`, `@radix-ui/react-slot`).
- **Form Management & Validation:** React Hook Form 7.54.2 with `@hookform/resolvers` 3.10.0 and Zod 3.24.2.

### 2.2 Backend, Database & Infrastructure
- **BaaS & Relational Database:** Supabase (PostgreSQL 15+ engine).
- **Supabase Client SDKs:**
  - `@supabase/ssr` 0.12.7 (Cookie-based session management across React Server Components, Server Actions, and Route Handlers).
  - `@supabase/supabase-js` 2.118.0 (Isomorphic client with strict RLS enforcement).
- **Database Testing Engine:** pgTAP (PostgreSQL Unit Testing Suite) executed via Supabase CLI (`npx supabase test db`).
- **AI Intelligence SDK:** `@google/genai` 2.31.0 (Official Google GenAI SDK interfacing with Gemini 2.5 Flash / Gemini 2.5 Pro models).
- **Payment Processing:** Razorpay Node SDK 2.9.8 (Order generation, payment verification, webhook signatures, refunds).
- **Document & Spreadsheet Engines:**
  - `pdfkit` 0.20.2 (Server-side dynamic PDF generation for Tax Invoices, Credit Notes, Placement Analytics, and Drive Summary Sheets).
  - `exceljs` 4.4.0 (Streaming parser and generator for student roster CSV/XLSX imports and bulk question bank exports).
- **Transactional Email Transport:** `nodemailer` 10.2.1 (Configured for Resend / SMTP relays for college invitations, verification tokens, and billing alerts).

### 2.3 Testing & Quality Assurance
- **Unit & Integration Runner:** Vitest 3.0.5 with jsdom 26.0.0.
- **Component Testing:** `@testing-library/react` 16.2.0 and `@testing-library/jest-dom` 6.6.3.
- **E2E / Browser Framework:** Playwright 1.64.1.
- **Linter & Code Style:** ESLint 9.19.0 with `eslint-config-next` 15.1.12.

---

## 3. SYSTEM ARCHITECTURE & TOPOLOGY

UrPlaced enforces strict physical and logical boundary segregation between institutional tenants, platform administration, database security, storage, and external third-party services.

```mermaid
flowchart TD
    subgraph Client_Layer ["Client Layer (Browsers & Devices)"]
        PH["Placement Head / Staff / Trainer<br/>/dashboard/*"]
        STU["Student Candidate<br/>/student/*"]
        SA_UI["Platform Super Admin<br/>/preritrd/* (AAL2 MFA)"]
        PUB["Public Landing & Auth<br/>/ /auth/*"]
    end

    subgraph NextJS_Layer ["Next.js 15.1.12 Application Server"]
        MW["Edge Middleware<br/>(Route protection, Session check)"]
        
        subgraph Server_Boundary ["Server-Side Execution"]
            RSC["React Server Components"]
            SA_ACT["Server Actions & API Handlers"]
            AUTH_CTX["Tenant & Role Context Resolver<br/>(One Person = One College)"]
            GATE["Subscription & Entitlement Guard<br/>(Option C & 7-Day Grace)"]
        end
    end

    subgraph External_Services ["External Cloud Services"]
        GEMINI["Google Gemini AI API<br/>(DriveFit, Question Gen, AI Tutor)"]
        RAZORPAY["Razorpay Payment Gateway<br/>(Orders, Webhooks, Invoicing)"]
        EMAIL_SVC["Resend / SMTP Relay<br/>(Invitations, Notifications)"]
    end

    subgraph Supabase_Layer ["Supabase / PostgreSQL Database Engine"]
        AUTH_DB["Supabase Auth (auth.users)"]
        RLS["PostgreSQL Row Level Security (RLS) Engine"]
        
        subgraph Tenant_Partitioning ["Physical Multi-Tenant Data Store"]
            TM["tenant_memberships<br/>(uq_tenant_memberships_user_id)"]
            TENANT_A["College A Isolated Data<br/>(Students, Drives, Questions, Attempts)"]
            TENANT_B["College B Isolated Data<br/>(Students, Drives, Questions, Attempts)"]
        end

        subgraph Control_Plane_Store ["Platform Control Plane (Strict Option A)"]
            PLANS["subscription_plans"]
            SUBS["college_subscriptions"]
            INVOICES["billing_invoices & credit_notes"]
            INVITES["college_invitations"]
            AUDIT["public.audit_logs (Append-Only)"]
        end

        STORAGE["Supabase Storage Buckets<br/>(avatars, drive-attachments, exports)"]
    end

    %% Client Connections
    PH --> MW
    STU --> MW
    SA_UI --> MW
    PUB --> MW
    MW --> RSC
    MW --> SA_ACT

    %% Execution flow
    SA_ACT --> AUTH_CTX
    AUTH_CTX --> GATE
    GATE --> RLS

    %% External interactions
    SA_ACT --> GEMINI
    SA_ACT --> RAZORPAY
    SA_ACT --> EMAIL_SVC

    %% Database interactions
    RLS --> TM
    RLS --> TENANT_A
    RLS --> TENANT_B
    RLS --> Control_Plane_Store
    RLS --> STORAGE
    AUTH_CTX -.-> AUTH_DB
```

---

## 4. COMPLETE REPOSITORY & DIRECTORY TREE

```
UrPlaced/
├── .gemini/                       # Agentic customization rules, skills, and prompt specifications
├── public/                        # Static brand assets, logos, and public icons
├── scripts/
│   ├── check-user.ts              # Local database user inspection script
│   ├── make-super-admin.ts        # Database script to elevate Super Admin
│   ├── provision-super-admin.ts   # Interactive CLI provisioning script for Super Admin
│   └── seed-data.ts               # Test database seeding script
├── src/
│   ├── app/                       # Next.js 15 App Router pages & API routes
│   │   ├── (public)/              # Marketing landing page, terms, privacy
│   │   ├── api/                   # 170+ Route Handlers (REST & Webhooks)
│   │   │   ├── ai/                # Gemini AI intelligence endpoints
│   │   │   ├── announcements/     # Institutional broadcasting APIs
│   │   │   ├── auth/              # Signup, invite verification, session context
│   │   │   ├── billing/           # Checkout, Razorpay webhooks, invoices, credit notes
│   │   │   ├── cron/              # Automated scheduled jobs (15-min sweep, renewal retries)
│   │   │   ├── health/            # Healthcheck & ping route
│   │   │   ├── notifications/     # In-app notification feeds & read markers
│   │   │   ├── placement/         # Institutional placement cell management APIs
│   │   │   ├── preritrd/          # Super Admin control plane REST APIs
│   │   │   ├── profile/           # User profile & avatar management
│   │   │   ├── questions/         # QuestionBank Sentinel CRUD & import/export
│   │   │   ├── student/           # Student portal APIs (drives, attempts, mastery)
│   │   │   └── webhooks/          # Razorpay payment confirmation webhook
│   │   ├── auth/                  # Institutional & student login, signup, invitation acceptance
│   │   ├── dashboard/             # Institutional Placement Cell Portal (Head, Staff, Trainer)
│   │   │   ├── analytics/         # Cohort metrics, placement trends, executive summaries
│   │   │   ├── assessments/       # Assessment authoring, proctoring, and grading
│   │   │   ├── billing/           # Plan selection, invoices, payment history (Head only)
│   │   │   ├── companies/         # Recruiter directory and contact records
│   │   │   ├── drives/            # Active placement drives, eligibility, and stage results
│   │   │   ├── memory/            # Longitudinal placement records and salary trends
│   │   │   ├── mistakes/          # Cohort-wide defect tracking and skill analysis
│   │   │   ├── notifications/     # In-app notification center
│   │   │   ├── questions/         # QuestionBank Sentinel authoring and pool builder
│   │   │   ├── settings/          # College profile, branding, academic years, departments
│   │   │   ├── staff/             # Placement staff invitation and permissions management
│   │   │   └── students/          # Student roster directory, CSV import/export, verification
│   │   ├── preritrd/              # Super Admin Control Plane
│   │   │   ├── accounts/          # Super Admin account governance and MFA management
│   │   │   ├── analytics/         # Platform-wide revenue, churn, and operational metrics
│   │   │   ├── audit-logs/        # System audit log viewer with strict search filters
│   │   │   ├── auth/              # Super Admin login, MFA TOTP verification, password reset
│   │   │   ├── billing/           # Global billing ledger, manual payment reconciliations
│   │   │   ├── colleges/          # College directory, onboarding tokens, invite triggers
│   │   │   ├── configuration/     # System parameters, kill-switches, and tax rules
│   │   │   ├── notifications/     # Platform-level alerts and email delivery logs
│   │   │   ├── profile/           # Super Admin profile and credential settings
│   │   │   ├── subscriptions/     # Subscription plan catalogue and override governance
│   │   │   └── system-health/     # Real-time infrastructure, DB, storage, and API latency health
│   │   ├── student/               # Student Portal
│   │   │   ├── analytics/         # Individual placement probability and readiness scores
│   │   │   ├── announcements/     # College placement notices and drive circulars
│   │   │   ├── applications/      # Drive applications status and interview schedules
│   │   │   ├── assessments/       # Live assessment examination environment
│   │   │   ├── drives/            # Discoverable placement drives and eligibility checks
│   │   │   ├── mastery/           # Mistake-to-Mastery review cycles and practice tests
│   │   │   ├── memory/            # Historical interview experiences and salary insights
│   │   │   ├── notifications/     # Student alert inbox
│   │   │   ├── offers/            # Official offer letter receipts and response actions
│   │   │   ├── practice/          # Behavioral & technical question practice modes
│   │   │   ├── profile/           # Academic records, resume attachments, SRN claiming
│   │   │   └── tutor/             # Google Gemini AI placement tutor chat interface
│   │   ├── globals.css            # Base stylesheet with strict design tokens
│   │   └── layout.tsx             # Root layout with font imports and top-level providers
│   ├── components/                # Reusable UI component library
│   │   ├── assessment/            # Assessment runner, timer, question palette, proctoring
│   │   ├── billing/               # Plan cards, upgrade modals, invoice downloaders
│   │   ├── common/                # Badges, modals, data tables, alert banners
│   │   ├── dashboard/             # Dashboard metric cards, navigation sidebars, headers
│   │   ├── drives/                # Drive pipeline boards, candidate cards, eligibility chips
│   │   ├── layout/                # Global layout wrappers, navigation bars, footer
│   │   ├── preritrd/              # Super Admin data tables, plan builder, override modal
│   │   ├── questions/             # Question editor, difficulty badge, set builder preview
│   │   ├── student/               # Student preparation trackers, offer acceptance cards
│   │   └── ui/                    # Base Radix-UI primitives (buttons, inputs, dialogs)
│   ├── lib/                       # Core backend services, libraries, and utilities
│   │   ├── ai/                    # Gemini API integration, prompt templates, evaluation
│   │   ├── auth/                  # Authentication context, session management, RBAC guards
│   │   ├── billing/               # Razorpay client, invoice generators, entitlement snapshots
│   │   ├── email/                 # Nodemailer transport and email HTML templates
│   │   ├── excel/                 # ExcelJS roster import/export streaming parsers
│   │   ├── pdf/                   # PDFKit invoice and report template builders
│   │   ├── supabase/              # Browser, server, and service-role Supabase clients
│   │   └── utils/                 # Formatting, date helpers, sanitizers, error handlers
│   ├── test/                      # 101 Vitest test suites (1,203 tests)
│   └── types/                     # TypeScript definitions and database schemas
├── supabase/
│   ├── migrations/                # 32 Sequential SQL migrations
│   └── tests/                     # PostgreSQL pgTAP test suites (92 assertions)
├── .env.example                   # Redacted template of all environment configuration keys
├── package.json                   # Project dependencies and operational scripts
├── tailwind.config.ts             # Tailwind CSS design system token definitions
└── tsconfig.json                  # TypeScript compiler configuration
```

---

## 5. AUTHENTICATION, MULTI-TENANCY & THE "ONE PERSON = ONE COLLEGE" HARD RULE

### 5.1 Dual-Track Authentication Architecture
UrPlaced implements two completely decoupled authentication tracks to prevent any possibility of institutional credential confusion:
1. **Track 1: Institutional & Student Track (`/auth/login`, `/auth/signup`)**
   - Utilizes standard Supabase Auth session cookies (`sb-*-auth-token`).
   - Authenticated sessions resolve their institutional tenancy via the `public.tenant_memberships` table.
   - User claims are derived dynamically from verified database records.
2. **Track 2: Platform Super Admin Control Plane Track (`/preritrd/auth/login`)**
   - Completely segregated from institutional accounts.
   - Enforces mandatory Two-Factor Authentication (TOTP MFA) with `AAL2` (Authenticator Assurance Level 2) claim requirement.
   - Bypasses institutional tenancy resolution entirely; Super Admins hold no records in `public.tenant_memberships`.

### 5.2 The Untrusted Client Metadata Rule
A critical security flaw identified and resolved in earlier architectural revisions was the reliance on `user_metadata` for role and tenancy determination.
> [!IMPORTANT]
> **Canonical Invariant: Client-editable `user_metadata` is completely untrusted for authorization.**  
> In UrPlaced, `supabase.auth.getUser()` metadata is never used to grant permissions. All authorization checks (`requireTenantRole()`, `getAuthContext()`, and PostgreSQL RLS policies) query the authoritative server-side `public.tenant_memberships` table or verified `app_metadata` managed exclusively by the Supabase Service Role.

### 5.3 Mandatory Exclusive One-College Membership Architecture
In higher education placement ecosystems, an individual must never hold simultaneous active memberships across competing colleges:
- A Placement Head in College A cannot administer College B.
- A Trainer in College A cannot access College B's question banks or assessment sets.
- A Student registered in College A cannot view or apply to College B's placement drives.

This architectural requirement is enforced at both the PostgreSQL relational level and the application server API level:

#### 1. Database-Level Constraint:
In `supabase/migrations/20261030000001_enforce_single_college_ownership.sql`, the `public.tenant_memberships` table enforces a strict single-college unique constraint:
```sql
ALTER TABLE public.tenant_memberships
DROP CONSTRAINT IF EXISTS uq_tenant_memberships_user_id;

ALTER TABLE public.tenant_memberships
ADD CONSTRAINT uq_tenant_memberships_user_id UNIQUE (user_id);
```
Any attempt by an existing user to insert a second membership row for another `college_id` fails immediately with a PostgreSQL unique constraint violation (`23505`).

#### 2. Server-Authorization Level Guard:
Every registration, college creation, staff invitation acceptance, and SRN claiming API endpoint executes an explicit pre-flight tenancy validation via `src/lib/auth/guards.ts`:
```typescript
// Verified implementation in src/lib/auth/guards.ts
export async function assertNoExistingMembership(userId: string): Promise<void> {
  const { data: existing } = await supabaseAdmin
    .from('tenant_memberships')
    .select('id, college_id, role')
    .eq('user_id', userId)
    .single();

  if (existing) {
    throw new ForbiddenError(
      'FORBIDDEN: User already belongs to an institutional college. Multi-college membership is strictly prohibited.'
    );
  }
}
```
If an authenticated user attempts to accept an invitation to another institution, the server aborts the transaction with `HTTP 409 Conflict` / `HTTP 403 Forbidden` and logs a high-severity security alert in `public.audit_logs`.

---

## 6. STRICT OPTION A: PLATFORM CONTROL PLANE VS. INSTITUTIONAL DATA ISOLATION

### 6.1 The Strict Option A Isolation Principle
During platform governance architecture design, UrPlaced selected **Strict Option A** (Zero Institutional Data Access for Super Admins) over Option B (Permissive Institutional Oversight).

Under Strict Option A:
- **Zero Access to Institutional PII:** Super Admins have zero visibility into student names, emails, phone numbers, resumes, GPA, marks, or placed offers.
- **Zero Access to Academic Content:** Super Admins cannot view, create, edit, or delete question banks, coding problems, study materials, or assessment results.
- **Zero Access to Corporate Recruitment:** Super Admins cannot inspect company records, job descriptions, CTC packages, drive criteria, or interview pipeline stages.

### 6.2 Physical Database Implementation of Option A
PostgreSQL Row Level Security (RLS) policies for all institutional tables (`students`, `companies`, `placement_drives`, `questions`, `question_banks`, `assessments`, `assessment_attempts`, `mistake_defects`, `placement_records`) do **not** grant access to Super Admin users.

Even when querying via authenticated Super Admin sessions:
```sql
-- Example RLS Policy for questions table
CREATE POLICY "questions_isolation_policy" ON public.questions
FOR ALL TO authenticated
USING (
  college_id IN (
    SELECT college_id FROM public.tenant_memberships
    WHERE user_id = auth.uid()
  )
);
```
Since Super Admins do not possess a row in `public.tenant_memberships`, any `SELECT`, `INSERT`, `UPDATE`, or `DELETE` query executed against institutional tables returns zero records (`0 rows returned`).

### 6.3 Authorized Super Admin Capabilities
The Super Admin control plane (`/preritrd/`) is strictly confined to:
1. **Tenant Provisioning:** Generating cryptographically secure onboarding invitation tokens for accredited colleges.
2. **Subscription Catalogue:** Authoring, pricing, publishing, and archiving subscription tiers.
3. **Billing Reconciliations:** Monitoring Razorpay transactions, processing offline payment receipts, handling refund requests, and generating credit notes.
4. **Platform Telemetry:** Monitoring database connection pool status, storage bucket usage, Gemini API quota latencies, and system error rates.
5. **Time-Bound Overrides:** Provisioning temporary 1–168 hour access overrides for colleges facing emergency renewal blockers during live drives.

---

## 7. COMPLETE MODULE-BY-MODULE AUDIT (PHASES 01–14 & SA-01–SA-07)

### Phase 01 & 02: Scaffolding, Design System & UI Foundations
- **Deliverables:** Next.js 15 App router foundation, strict CSS variables in `globals.css`, Tailwind color tokens, base component primitives.
- **Key Files:** `src/app/globals.css`, `tailwind.config.ts`, `src/components/ui/*`.
- **Status:** Complete.

### Phase 03: Authentication, Tenancy & Base RLS
- **Deliverables:** Supabase SSR cookie session handling, `colleges`, `tenant_memberships`, multi-tenant RLS foundations.
- **Key Files:** `supabase/migrations/20261018000001_phase03_auth_tenancy_rls.sql`, `src/lib/auth/session.ts`.
- **Status:** Complete.

### Phase 04: College Placement Core (Companies, Drives & Applications)
- **Deliverables:** Company CRM, placement drive configuration, eligibility rules (min CGPA, backlogs, department filters), candidate applications, and offer acceptance workflows.
- **Key Files:** `supabase/migrations/20261018000002_phase04_college_placement.sql`, `src/app/dashboard/drives/*`, `src/app/dashboard/companies/*`.
- **Status:** Complete.

### Phase 05: Recruitment Intelligence & DriveFit
- **Deliverables:** AI-powered Job Description ingestion, key skill extraction, candidate resume parsing, and DriveFit match scoring (0–100%) with actionable gap analysis.
- **Key Files:** `supabase/migrations/20261018000003_phase05_recruitment_intelligence_drivefit.sql`, `src/lib/ai/drivefit.ts`, `src/app/api/ai/drivefit/evaluate/route.ts`.
- **Status:** Complete.

### Phase 06: QuestionBank Sentinel
- **Deliverables:** Institutional question authoring (MCQ, Coding, Subjective), taxonomic tagging (topic, difficulty, subject), CSV/Excel bulk import, duplicate detection, and automated balanced test set generation.
- **Key Files:** `supabase/migrations/20261018000004_phase06_questionbank_sentinel.sql`, `src/app/dashboard/questions/*`, `src/app/api/questions/*`.
- **Status:** Complete.

### Phase 07: Assessment Engine
- **Deliverables:** Scheduled online assessments, secure full-screen browser proctoring (tab-switch detection, copy-paste blocking), timed question palettes, automated auto-save RPCs, and instantaneous score grading.
- **Key Files:** `supabase/migrations/20261019000001_phase07_assessment_engine.sql`, `src/components/assessment/runner.tsx`, `src/app/api/student/attempts/*`.
- **Status:** Complete.

### Phase 08: Mistake-to-Mastery Adaptive Learning
- **Deliverables:** Granular test failure analysis, mistake taxonomy classification (Conceptual, Calculation, Speed/Time-Out), spaced repetition practice scheduling, and re-test workflows.
- **Key Files:** `supabase/migrations/20261019000002_phase08_mistake_to_mastery.sql`, `src/app/student/mastery/*`, `src/app/api/student/mistakes/*`.
- **Status:** Complete.

### Phase 09: Placement Memory & Longitudinal Analytics
- **Deliverables:** Historical interview experience archives, company-wise compensation benchmarks, department placement statistics, and exportable executive placement reports.
- **Key Files:** `supabase/migrations/20261019000003_phase09_placement_memory_analytics.sql`, `src/app/dashboard/memory/*`, `src/app/dashboard/analytics/*`.
- **Status:** Complete.

### Phase 10: User Profiles & Directory Enhancements
- **Deliverables:** Detailed student profile pages, academic credential verification, resume uploads, and staff directory management.
- **Key Files:** `supabase/migrations/20261021000001_phase10_user_profiles_enhancements.sql`, `src/app/dashboard/students/*`.
- **Status:** Complete.

### Phase 11: Avatar Storage & Storage Persistence
- **Deliverables:** Supabase Storage integration for user profile photos, strict folder-path authorization, user ownership verification, and public URL signing.
- **Key Files:** `supabase/migrations/20261022000001_phase11_avatar_storage_persistence.sql`, `src/app/api/profile/avatar/route.ts`.
- **Status:** Complete.

### Phase 12: AI Intelligence Persistence
- **Deliverables:** Structured logging for Gemini AI tokens, prompt latency tracking, and fallback circuit breakers.
- **Key Files:** `supabase/migrations/20261025000001_phase12_ai_intelligence_persistence.sql`, `src/lib/ai/gemini-client.ts`.
- **Status:** Complete.

### Phase 13: In-App Notifications System
- **Deliverables:** Multi-channel in-app notification bell, real-time unread badge counts, drive status alerts, and bulk mark-as-read RPC functions.
- **Key Files:** `supabase/migrations/20261025000002_phase13_notifications_system.sql`, `src/app/api/notifications/*`.
- **Status:** Complete.

### Phase 14: SRN Roster Claiming & Race Condition Hardening
- **Deliverables:** Pre-provisioned institutional student rosters, secure claiming via official Student Registration Number (SRN/USN), atomic claiming transactions, and multi-tenant SRN isolation.
- **Key Files:** `supabase/migrations/20261027000001_phase14_srn_roster_claiming.sql` through `20261028000002_multi_college_srn_claiming.sql`.
- **Status:** Complete.

### SA-01: Super Admin Portal Core & Telemetry
- **Deliverables:** Super Admin portal scaffold at `/preritrd/`, session guards, dashboard KPIs, system health telemetry, and connection pool monitors.
- **Key Files:** `supabase/migrations/20261031000001_platform_super_admin_portal.sql`, `src/app/preritrd/*`.
- **Status:** Complete.

### SA-02: Super Admin Profile, MFA & Notification Preferences
- **Deliverables:** TOTP Two-Factor Authentication (`AAL2`), password rotation, alert preference toggles, and Super Admin profile management.
- **Key Files:** `src/app/preritrd/profile/*`, `src/app/preritrd/accounts/*`.
- **Status:** Complete.

### SA-03: College Onboarding & Invitations Lifecycle
- **Deliverables:** Cryptographically signed college invitation tokens, automated invitation email dispatch, token expiration (7 days), token revocation, and Placement Head account provisioning.
- **Key Files:** `supabase/migrations/20261101000001_college_onboarding_invitations.sql`, `src/app/preritrd/colleges/*`, `src/app/auth/college/setup/*`.
- **Status:** Complete.

### SA-04: Subscription Plans & Entitlements Management
- **Deliverables:** Subscription plan authoring (Free, Growth, Enterprise), feature flag matrices, numeric limits, plan versioning, frozen subscription snapshots on activation, and plan archiving.
- **Key Files:** `supabase/migrations/20261101000002_subscription_plans_and_entitlements.sql`, `src/app/preritrd/subscriptions/*`.
- **Status:** Complete.

### SA-05: Razorpay Gateway, Invoicing, Billing Ledger & Credit Notes
- **Deliverables:** Razorpay Orders API integration, webhook signature validation (`x-razorpay-signature`), automated invoice PDF generation, tax calculations (18% GST), offline payment reconciliation, and credit note issuance.
- **Key Files:** `supabase/migrations/20261101000003_razorpay_payment_foundation.sql`, `supabase/migrations/20261101000004_sa05_payment_invoicing_billing.sql`, `src/lib/billing/*`, `src/lib/pdf/*`.
- **Status:** Complete.

### SA-06: Payment-Gated Access Control & Security Verification
- **Deliverables:** Strict fail-closed operational access enforcement, Option C implementation, 7-day renewal grace period policy, storage object ownership hardening, and audit log immutability (`REVOKE UPDATE, DELETE`).
- **Key Files:** `supabase/migrations/20261101000005_sa06_payment_gated_access_control.sql`, `supabase/migrations/20261101000006_harden_avatar_update_policy_and_audit_immutability.sql`, `supabase/migrations/20261101000007_enforce_storage_ownership_and_audit_insert_integrity.sql`.
- **Status:** Complete.

### SA-07: End-to-End Integration, Security Validation & QA
- **Deliverables:** Master integration testing suite (45 comprehensive scenarios), multi-college isolation verification, fail-closed validation, billing RBAC lockouts, and final production build verification.
- **Key Files:** `src/test/sa07-end-to-end-integration-and-qa.test.ts`, `supabase/tests/rls_multi_college_isolation.test.sql`.
- **Status:** Complete.


---

## 8. FRONTEND & UI/UX INVENTORY (DESIGN SYSTEM TOKENS & PAGES)

### 8.1 Strict Visual Design System Tokens
All frontend pages, components, dashboards, modals, forms, and charts in UrPlaced strictly adhere to the single source of truth design system defined in `GEMINI.md`.

#### Base Brand Color Palette
| Token Role | Exact Hex Value | Usage Specification |
| :--- | :--- | :--- |
| **Primary** | `#5052C9` | Key action buttons, active states, active tab highlights, primary indicators |
| **Secondary Accent** | `#2E8F86` | Badges, secondary callouts, success indicators, subtle accents |
| **Background** | `#EDECE7` | Main page background, root application container background |
| **Card Background** | `#F8F7F3` | Surface background for cards, tiles, sidebars, containers |
| **Input Background** | `#FBFAF7` | Form inputs, select dropdowns, textareas, search boxes |
| **Primary Text** | `#24283A` | Headings, titles, high-emphasis text, body copy |
| **Secondary Text** | `#292D40` | Subtitles, labels, secondary metadata, captions |
| **Primary Gradient** | `linear-gradient(135deg, #7779D8 0%, #5052C9 100%)` | Hero highlights, key CTA buttons, special gradient cards |

#### Strictly Derived Interactive & Utility States
- **Borders & Dividers:**
  - Card / Input / Container Border: `#B8B6AC` or `rgba(36, 40, 58, 0.26)`
  - Subtle Border / Divider: `rgba(36, 40, 58, 0.16)` or `#DDDCD5`
  - Strong Border: `rgba(36, 40, 58, 0.38)` or `#8E8D86`
  - Active / Focus Border: `#5052C9`
- **Hover & Active States:**
  - Primary Hover: `#4345B0` | Primary Active: `#383A99`
  - Secondary Hover: `#267870` | Secondary Active: `#1F615B`
- **Muted & Disabled Elements:**
  - Muted Text: `rgba(41, 45, 64, 0.65)` (`#747683`)
  - Disabled Background: `rgba(36, 40, 58, 0.08)`
  - Disabled Text: `rgba(41, 45, 64, 0.38)`
- **Focus Rings:** `0 0 0 3px rgba(80, 82, 201, 0.25)`
- **Shadows:**
  - Subtle Elevation: `0 1px 3px rgba(36, 40, 58, 0.06), 0 1px 2px rgba(36, 40, 58, 0.04)`
  - Card Shadow: `0 4px 6px -1px rgba(36, 40, 58, 0.07), 0 2px 4px -2px rgba(36, 40, 58, 0.05)`
  - Dropdown / Modal Shadow: `0 10px 15px -3px rgba(36, 40, 58, 0.08), 0 4px 6px -4px rgba(36, 40, 58, 0.04)`

#### Fixed Typography Stacks
- **Headings & Display:** `Outfit`, sans-serif (`font-heading`)
- **Body Text & UI Controls:** `Inter`, sans-serif (`font-sans`)
- **Code, Data & Monospace:** `JetBrains Mono`, monospace (`font-mono`)

### 8.2 Comprehensive Page Inventory by Route Group

#### 1. Public & Authentication Portal Routes (`/`, `/auth/*`)
- `/`: Public landing page showcasing platform value propositions, feature highlights, and institutional sign-in links.
- `/auth/login`: Unified email/password sign-in page for Placement Heads, Placement Staff, Trainers, and Students.
- `/auth/signup`: Student registration and account creation page.
- `/auth/college/setup`: Cryptographically gated Placement Head registration page triggered by onboarding invitation token (`?token=...`).
- `/auth/invite/verify`: Secondary staff member invitation verification and password setting page.
- `/terms` & `/privacy`: Legal terms of service, compliance, and privacy policies.

#### 2. Institutional Placement Cell Portal Routes (`/dashboard/*`)
- `/dashboard`: Executive command center summarizing upcoming drives, student placement percentage, and critical action items.
- `/dashboard/drives`: Active, upcoming, and archived placement drives directory with stage pipeline filters.
- `/dashboard/drives/[id]`: Detailed drive management view (JD requirements, candidate eligibility, stage tracking, offers).
- `/dashboard/companies`: Recruiter relationship CRM, contact information, and drive history.
- `/dashboard/students`: Institutional student directory, academic record search, bulk CSV/Excel import/export, and manual eligibility toggles.
- `/dashboard/questions`: QuestionBank Sentinel central repository for MCQ, Coding, and Subjective questions with topic filtering.
- `/dashboard/assessments`: Examination scheduler, question set curator, proctoring configuration, and grading matrix.
- `/dashboard/mistakes`: Institutional cohort defect tracker identifying curriculum-wide knowledge gaps and weak topics.
- `/dashboard/memory`: Longitudinal placement archives, package compensation graphs, and company-specific interview patterns.
- `/dashboard/analytics`: Comprehensive placement intelligence reports, department comparison charts, and accreditation exports.
- `/dashboard/staff`: Placement cell staff management (invite coordinators, assign roles: Placement Staff vs. Trainer).
- `/dashboard/billing`: Placement Head exclusive billing center (Option C plan selection, Razorpay checkout, invoices, credit notes).
- `/dashboard/settings`: College profile configuration, departmental taxonomy, grading scales, and academic year definitions.
- `/dashboard/notifications`: Institutional alerts, drive deadline updates, and student application pings.

#### 3. Student Candidate Portal Routes (`/student/*`)
- `/student/dashboard`: Student personal command center (applied drives, upcoming tests, DriveFit scores, AI tutor quick access).
- `/student/drives`: Active campus drives with real-time automated eligibility evaluation badges (Eligible, Ineligible, Action Required).
- `/student/drives/[id]`: Specific drive details, company profile, JD overview, and single-click application workflow.
- `/student/applications`: Personal application tracker with timeline statuses (Applied, Shortlisted, Interview, Offered, Rejected).
- `/student/assessments`: Assigned online assessment examinations.
- `/student/assessments/[id]`: Full-screen proctored testing environment with question palette and auto-save timers.
- `/student/mastery`: Personalized Mistake-to-Mastery spaced repetition dashboard and targeted retry tests.
- `/student/practice`: Self-paced technical and behavioral practice modules.
- `/student/memory`: Archived interview questions and senior placement experiences from previous campus recruitment drives.
- `/student/analytics`: Individual readiness analytics, skill breakdown radar, and benchmark comparison against peers.
- `/student/offers`: Official job offers repository with formal Accept / Decline response triggers.
- `/student/profile`: Student profile management, resume upload, academic records, and SRN claiming interface.
- `/student/tutor`: Interactive Google Gemini AI Tutor chat interface for personalized preparation and code debugging.
- `/student/notifications`: Student notifications inbox for test schedules, shortlists, and drive updates.

#### 4. Platform Super Admin Control Plane Routes (`/preritrd/*`)
- `/preritrd/auth/login`: Super Admin dedicated credential login with TOTP MFA (`AAL2`) verification screen.
- `/preritrd/dashboard`: Global SaaS operations dashboard (total colleges, active subscriptions, ARR, MRR, platform health).
- `/preritrd/colleges`: Accredited college directory, onboarding token generator, invitation resend/revoke modals.
- `/preritrd/subscriptions`: Subscription plans catalogue builder, tier editor, feature entitlement matrix, and version history.
- `/preritrd/billing`: Global billing ledger, Razorpay transaction monitor, offline payment approvals, and refund processors.
- `/preritrd/audit-logs`: Immutable system audit log explorer with actor, event type, severity, and timestamp search filters.
- `/preritrd/system-health`: Real-time infrastructure health (PostgreSQL connection pool, Storage bucket latencies, Gemini API status).
- `/preritrd/notifications`: System broadcast announcer and platform failure alert dispatch center.
- `/preritrd/configuration`: Global platform configuration parameters, billing grace period controls, and AI kill-switch.
- `/preritrd/accounts`: Super Admin team management and privilege assignments.
- `/preritrd/profile`: Personal Super Admin security settings and TOTP credential re-enrollment.

---

## 9. BACKEND SERVICES, UTILITIES & SERVER ACTIONS INVENTORY

### 9.1 Authentication & Multi-Tenancy Core (`src/lib/auth/*`)
- `session.ts`: Manages cookie-based SSR Supabase clients, extracts user session securely, and caches session claims.
- `guards.ts`: Implements strict authorization barriers:
  - `requireTenantRole(allowedRoles: TenantRole[])`: Verifies membership in `public.tenant_memberships` and ensures user role matches requirement.
  - `assertNoExistingMembership(userId: string)`: Enforces One Person = One College rule before invitations or setup.
  - `requireSuperAdmin(req)`: Validates Super Admin credentials and verifies `AAL2` MFA verification token.
  - `requireBillingAccess(collegeId)`: Verifies caller is explicitly `PLACEMENT_HEAD` or holding active Super Admin override.

### 9.2 Subscription, Billing & Gateway Engine (`src/lib/billing/*`)
- `razorpay-client.ts`: Wraps Razorpay SDK with secure environment variable loading, order creation, and payment verification.
- `webhook-handler.ts`: Validates HMAC-SHA256 signature using `RAZORPAY_WEBHOOK_SECRET` and dispatches payment events.
- `entitlement-manager.ts`: Evaluates college subscription status, handles Option C unassigned plan state, calculates 7-day grace period, checks active emergency overrides, and evaluates feature flags against frozen snapshots.
- `invoice-generator.ts`: Orchestrates invoice record generation and sequential numbering (`INV-YYYY-XXXX`).
- `credit-notes.ts`: Manages refund tracking and credit note issuance (`CN-YYYY-XXXX`).

### 9.3 Artificial Intelligence Layer (`src/lib/ai/*`)
- `gemini-client.ts`: Google GenAI client initialization, model routing (`gemini-2.5-flash` for high-throughput evaluation, `gemini-2.5-pro` for deep synthesis), rate limiting, and emergency kill-switch checking.
- `drivefit.ts`: Performs semantic parsing of employer Job Descriptions and compares them against student profiles, generating match scores and skill gap lists.
- `question-generator.ts`: Generates structured questions (MCQ / Coding) based on subject, difficulty, and Bloom's taxonomy.
- `tutor-service.ts`: Manages multi-turn student preparation conversations, enforcing system prompts that guide students without leaking direct answers.

### 9.4 Document & Data Interchange Services (`src/lib/pdf/*`, `src/lib/excel/*`)
- `pdf/invoice-template.ts`: Server-side PDFKit generator rendering GST-compliant tax invoices and credit notes with college details, HSN codes, and digital signatures.
- `pdf/report-generator.ts`: Generates institutional placement reports and accreditation summaries.
- `excel/roster-parser.ts`: ExcelJS streaming parser validating bulk student uploads against college schema (SRN, Name, Email, Dept, CGPA, Backlogs).
- `excel/question-importer.ts`: ExcelJS parser for bulk question bank imports with format verification.

### 9.5 Communication Services (`src/lib/email/*`)
- `nodemailer-transport.ts`: Robust email transport wrapper supporting Resend SMTP relays.
- `templates/college-invite.ts`: HTML email template for new Placement Head onboarding with secure token links.
- `templates/billing-receipt.ts`: Transactional email containing payment confirmation and invoice attachment.
- `templates/renewal-alert.ts`: Automated alert notifying Placement Heads of upcoming expiration or active 7-day grace period.

---

## 10. COMPLETE API ROUTE AUDIT (ALL 170+ ENDPOINTS)

The UrPlaced API architecture comprises over 170 individual Route Handlers grouped into logical functional subtrees. All endpoints enforce strict authentication, tenant isolation, and payment gating.

### 10.1 AI Intelligence Endpoints (`/api/ai/*`)
- `POST /api/ai/drivefit/evaluate`: Evaluates student eligibility and semantic match against drive requirements.
- `POST /api/ai/mistakes/analyze`: Analyzes student incorrect answers and classifies cognitive error categories.
- `POST /api/ai/placement/insights`: Synthesizes cohort placement trends and highlights hiring patterns.
- `POST /api/ai/questions/classify`: Automatically tags question difficulty, topic, and Bloom's cognitive level.
- `POST /api/ai/questions/generate`: Generates balanced question pools via Gemini based on input parameters.
- `POST /api/ai/tutor/chat`: Real-time streaming or multi-turn AI tutor chat endpoint for candidate preparation.

### 10.2 Announcements & Institutional Notices (`/api/announcements/*`)
- `GET /api/announcements`: Lists institutional circulars filtered by tenant and target audience.
- `POST /api/announcements`: Broadcasts new placement circular (Placement Head & Staff only).
- `GET /api/announcements/recipients`: Calculates recipient student count based on department and year filters.

### 10.3 Authentication & Setup (`/api/auth/*`)
- `POST /api/auth/signup`: Registers new candidate student accounts.
- `POST /api/auth/college/setup`: Verifies onboarding token, creates college record, provisions Placement Head, and initializes Option C subscription state (`PENDING_PAYMENT`).
- `GET /api/auth/college/invite/verify`: Validates cryptographically signed invitation token from query params.
- `POST /api/auth/invite`: Dispatches staff invitation tokens within an existing college.
- `GET /api/auth/context`: Returns current user session, tenant membership, resolved role, and subscription status.
- `GET /api/auth/colleges`: Returns public list of registered colleges for student login selection.

### 10.4 Billing & Payment Processing (`/api/billing/*`, `/api/webhooks/*`)
- `POST /api/billing/checkout/create-order`: Generates a Razorpay Order ID for subscription purchase/upgrade (Placement Head only).
- `POST /api/billing/checkout/verify`: Verifies payment signature (`razorpay_signature`) and triggers subscription activation.
- `POST /api/billing/webhook`: Asynchronous webhook endpoint verifying HMAC-SHA256 signature for automated payment capture and renewal events.
- `GET /api/billing/invoices/[id]/download`: Generates and streams PDF tax invoice (Placement Head only; direct access denied to other roles).
- `GET /api/billing/credit-notes/[id]/download`: Generates and streams PDF credit note for refunded amounts.

### 10.5 Automated Cron Jobs (`/api/cron/billing/*`)
- `POST /api/cron/billing/reconcile-15min`: 15-minute sweep reconciling pending Razorpay orders against gateway state.
- `POST /api/cron/billing/daily-sweep`: Daily midnight sweep checking subscription expiration, transitioning to 7-day grace, or locking expired tenants.
- `POST /api/cron/billing/renewal-reminders`: Dispatches automated email reminders at 14, 7, and 1 day prior to expiration.
- `POST /api/cron/billing/renewal-retries`: Re-attempts failed automatic recurring card charges for subscription renewals.

### 10.6 Placement Cell Operations (`/api/placement/*`)
- `GET/POST /api/placement/companies`: Recruiter management endpoints.
- `GET/PATCH/DELETE /api/placement/companies/[id]`: Individual company operations.
- `GET/POST /api/placement/drives`: Placement drive creation and listing.
- `GET/PATCH/DELETE /api/placement/drives/[id]`: Drive configuration, JD details, and dates.
- `GET/POST /api/placement/drives/[id]/candidates`: Candidate roster in drive.
- `POST /api/placement/drives/[id]/candidates/[appId]/advance`: Advances candidate to next recruitment stage.
- `GET/POST /api/placement/drives/[id]/stages`: Defines recruitment stages (Aptitude, Tech Interview, HR Interview).
- `GET/POST /api/placement/students`: Institutional student directory.
- `POST /api/placement/students/import`: Bulk student roster Excel/CSV upload.
- `GET /api/placement/students/export`: Bulk student directory export.
- `POST /api/placement/students/bulk-delete`: Bulk deletion with safety preview (`/preview`).
- `GET/PATCH /api/placement/students/[id]`: Individual student records.
- `POST /api/placement/students/[id]/deactivate` & `reactivate`: Account status controls.
- `GET/POST /api/placement/assessments`: Assessment creation and configuration.
- `POST /api/placement/assessments/[id]/publish`: Finalizes assessment and schedules test window.
- `POST /api/placement/assessments/[id]/release`: Releases scored results and student rank lists.
- `GET /api/placement/subscription`: Returns college subscription status, frozen entitlements, and active override state.
- `POST /api/placement/subscription/select-plan`: Placement Head selects approved published plan under Option C.
- `POST /api/placement/subscription/upgrade` & `downgrade`: Subscription tier modifications.
- `POST /api/placement/subscription/cancel`: Cancels auto-renewal.

### 10.7 QuestionBank Sentinel Operations (`/api/questions/*`)
- `GET/POST /api/questions`: Authoring and querying question items.
- `GET/POST /api/questions/banks`: Question bank categories and subject folders.
- `POST /api/questions/import/preview`: Previews uploaded question spreadsheet and flags format errors.
- `POST /api/questions/import/commit`: Persists validated questions into the question bank.
- `GET /api/questions/duplicates`: Runs vector and string similarity checks to flag redundant questions.
- `POST /api/questions/sets/auto-build/preview`: Generates a balanced test set based on subject, difficulty, and target marks.
- `POST /api/questions/sets/auto-build/commit`: Finalizes auto-built test set for an assessment.
- `POST /api/questions/sets/auto-build/swap`: Swaps a specific auto-built question with an equivalent alternative.

### 10.8 Student Candidate Operations (`/api/student/*`)
- `GET /api/student/dashboard`: High-level student summary and action items.
- `GET /api/student/drives`: Lists campus recruitment drives with real-time eligibility evaluation.
- `POST /api/student/drives/[id]/apply`: Single-click application submission with resume snapshot.
- `GET /api/student/assessments`: Lists scheduled and active online tests.
- `POST /api/student/assessments/[id]/start`: Initializes test attempt and begins proctored timer.
- `POST /api/student/attempts/[id]/save`: Periodic auto-save RPC preserving student answers.
- `POST /api/student/attempts/[id]/submit`: Formal test submission triggering instantaneous scoring.
- `GET /api/student/attempts/[id]/result`: Post-release detailed test performance breakdown.
- `GET /api/student/mastery`: Mistake-to-Mastery review items and spaced repetition schedules.
- `POST /api/student/mistakes/[targetId]/practice`: Practice session focused on specific previously missed concepts.
- `POST /api/student/offers/[id]/respond`: Student formal Accept / Decline trigger for job offers.

### 10.9 Platform Super Admin Control Plane (`/api/preritrd/*`)
- `POST /api/preritrd/auth/login`: Super Admin primary credential validation.
- `POST /api/preritrd/auth/mfa/verify`: TOTP MFA verification yielding an authenticated session (`AAL2`).
- `GET /api/preritrd/dashboard/metrics`: High-level multi-tenant platform metrics.
- `GET/POST /api/preritrd/colleges`: College directory and onboarding invitation token generation.
- `POST /api/preritrd/colleges/[id]/invitation/resend`: Resends invitation email.
- `POST /api/preritrd/colleges/[id]/invitation/revoke`: Revokes active invitation token.
- `GET/POST /api/preritrd/subscriptions/plans`: Subscription plan catalogue management.
- `POST /api/preritrd/subscriptions/plans/[id]/publish`: Publishes plan for purchase.
- `POST /api/preritrd/subscriptions/plans/[id]/archive`: Deprecates plan from future purchases.
- `POST /api/preritrd/subscriptions/[id]/override`: Grants temporary 1–168 hour access override with audited reason.
- `GET /api/preritrd/audit-logs`: Paginated search across `public.audit_logs`.
- `GET /api/preritrd/system-health`: Health metrics for DB connection pool, storage, and external APIs.

---

## 11. COMPLETE DATABASE ARCHITECTURE & MIGRATION HISTORY (ALL 32 MIGRATIONS)

The UrPlaced database schema is structured as a single PostgreSQL database with strict tenant segregation enforced by 32 sequential SQL migrations.

### 11.1 Sequential Migration Inventory
1. `20261018000001_phase03_auth_tenancy_rls.sql`: Core multi-tenant foundation (`colleges`, `tenant_memberships`, initial RLS).
2. `20261018000002_phase04_college_placement.sql`: Placement management tables (`companies`, `placement_drives`, `drive_stages`, `applications`, `job_offers`).
3. `20261018000003_phase05_recruitment_intelligence_drivefit.sql`: DriveFit schema (`job_descriptions`, `extracted_skills`, `candidate_matches`).
4. `20261018000004_phase06_questionbank_sentinel.sql`: Question banking schema (`questions`, `question_banks`, `question_sets`, `tags`).
5. `20261019000001_phase07_assessment_engine.sql`: Online assessment execution schema (`assessments`, `assessment_attempts`, `student_responses`, `proctoring_events`).
6. `20261019000002_phase08_mistake_to_mastery.sql`: Adaptive learning schema (`mistake_defects`, `remediation_items`, `mastery_scores`).
7. `20261019000003_phase09_placement_memory_analytics.sql`: Placement memory repository (`placement_records`, `interview_experiences`, `compensation_benchmarks`).
8. `20261021000001_phase10_user_profiles_enhancements.sql`: Extended user profiles, student metadata, and departmental mappings.
9. `20261022000001_phase11_avatar_storage_persistence.sql`: Storage bucket policies for user avatar persistence and path mapping.
10. `20261025000001_phase12_ai_intelligence_persistence.sql`: AI telemetry logging, token tracking, and conversation memory.
11. `20261025000002_phase13_notifications_system.sql`: Notification storage, unread tracking, and delivery preferences.
12. `20261027000001_phase14_srn_roster_claiming.sql`: Student Registration Number (SRN) pre-provisioned roster schema.
13. `20261027000002_harden_srn_roster_claiming_transaction.sql`: Atomic database transaction logic for claiming student records.
14. `20261027000003_strengthen_srn_claiming_guards.sql`: Input sanitization, email verification checks, and duplicate guards.
15. `20261027000004_preserve_official_roster_data.sql`: Ensures claiming operations cannot overwrite official college CGPA/academic data.
16. `20261027000005_fix_tenant_id_ambiguity.sql`: Resolves SQL variable shadowing in multi-tenant stored procedures.
17. `20261027000006_fix_claim_rpc_return_types.sql`: Corrects PostgreSQL RPC return types for type-safe Supabase JS client integration.
18. `20261027000007_harden_membership_guard_multi_tenant.sql`: Enforces atomic validation against double-claiming across tenants.
19. `20261028000001_add_question_bank_subject.sql`: Introduces subject taxonomy to question banks.
20. `20261028000002_multi_college_srn_claiming.sql`: Allows identical SRN formats across distinct colleges while enforcing strict per-college uniqueness.
21. `20261030000001_enforce_single_college_ownership.sql`: Adds unique constraint `uq_tenant_memberships_user_id` enforcing the One Person = One College rule.
22. `20261030000002_correct_student_fk_and_role_consistency.sql`: Harmonizes foreign key relationships between `auth.users`, `tenant_memberships`, and `students`.
23. `20261030000003_enforce_strict_platform_admin_isolation.sql`: Strips Super Admin bypasses from institutional RLS policies (Strict Option A).
24. `20261030000004_privilege_escalation_and_strict_rls_hardening.sql`: Blocks authenticated users from self-elevating roles or altering tenant IDs.
25. `20261031000001_platform_super_admin_portal.sql`: Control plane schema (`platform_admins`, `system_health_metrics`, `platform_audit_events`).
26. `20261101000001_college_onboarding_invitations.sql`: College invitation tokens, cryptographic hashing, and status tracking (`college_invitations`).
27. `20261101000002_subscription_plans_and_entitlements.sql`: Subscription plan catalogue, feature flag matrices, and snapshot versioning (`subscription_plans`, `subscription_snapshots`).
28. `20261101000003_razorpay_payment_foundation.sql`: Payment orders, webhook logs, and transaction tables (`payment_orders`, `payment_transactions`).
29. `20261101000004_sa05_payment_invoicing_billing.sql`: Tax invoices, sequential numbering sequence, credit notes, and offline payments (`billing_invoices`, `credit_notes`).
30. `20261101000005_sa06_payment_gated_access_control.sql`: Database functions evaluating payment status, 7-day grace period, and emergency overrides (`fn_check_tenant_operational_access`).
31. `20261101000006_harden_avatar_update_policy_and_audit_immutability.sql`: Dedicated UPDATE RLS policy for avatars and revoking UPDATE/DELETE on `public.audit_logs`.
32. `20261101000007_enforce_storage_ownership_and_audit_insert_integrity.sql`: Enforces storage object `owner` verification and hardens audit log insertion integrity.

### 11.2 Core Relational Schema Highlights

```mermaid
erDiagram
    COLLEGES ||--o{ TENANT_MEMBERSHIPS : "enrolls"
    COLLEGES ||--o{ STUDENTS : "maintains"
    COLLEGES ||--o{ COMPANIES : "partners"
    COLLEGES ||--o{ PLACEMENT_DRIVES : "hosts"
    COLLEGES ||--o{ QUESTIONS : "authors"
    COLLEGES ||--o{ ASSESSMENTS : "schedules"
    COLLEGES ||--o| COLLEGE_SUBSCRIPTIONS : "holds"
    COLLEGES ||--o{ BILLING_INVOICES : "receives"
    COLLEGES ||--o{ AUDIT_LOGS : "logs"

    AUTH_USERS ||--o| TENANT_MEMBERSHIPS : "belongs_to (1:1)"
    AUTH_USERS ||--o| STUDENTS : "claims (1:1)"

    PLACEMENT_DRIVES ||--o{ APPLICATIONS : "receives"
    STUDENTS ||--o{ APPLICATIONS : "submits"
    ASSESSMENTS ||--o{ ASSESSMENT_ATTEMPTS : "tracks"
    STUDENTS ||--o{ ASSESSMENT_ATTEMPTS : "completes"
    COLLEGE_SUBSCRIPTIONS ||--|| SUBSCRIPTION_PLANS : "conforms_to"
```

---

## 12. ROW LEVEL SECURITY (RLS) & STORAGE ISOLATION AUDIT

### 12.1 PostgreSQL RLS Implementation Strategy
PostgreSQL Row Level Security is enabled on **100% of all public tables** in the UrPlaced database. No table is accessible without satisfying explicit RLS policy predicates.

#### Tenant Membership Query Pattern
Institutional isolation is enforced using the standard PostgreSQL sub-select against `public.tenant_memberships`:
```sql
CREATE POLICY "tenant_isolation_policy" ON public.placement_drives
FOR ALL TO authenticated
USING (
  college_id = (
    SELECT college_id FROM public.tenant_memberships
    WHERE user_id = auth.uid()
    LIMIT 1
  )
)
WITH CHECK (
  college_id = (
    SELECT college_id FROM public.tenant_memberships
    WHERE user_id = auth.uid()
    LIMIT 1
  )
);
```
Because the `user_id` column in `public.tenant_memberships` is protected by the `uq_tenant_memberships_user_id` unique constraint, the subquery always evaluates to either zero rows (for unassigned users/Super Admins) or exactly one `college_id`.

### 12.2 Storage Bucket Security & Object Ownership
Supabase Storage buckets (`avatars`, `resumes`, `drive-attachments`, `reports`) enforce multi-tenant isolation and strict object ownership.

#### Hardened Avatar Update & Delete Policies
In `20261101000007_enforce_storage_ownership_and_audit_insert_integrity.sql`, avatar operations require that the authenticated user is the genuine object owner:
```sql
-- Authenticated users can only update their own avatar
CREATE POLICY "avatars_update_policy" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
);

-- Authenticated users can only delete their own avatar
CREATE POLICY "avatars_delete_policy" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND owner = auth.uid()
);
```
This guarantees:
1. Path tampering cannot allow User A to overwrite User B's avatar.
2. College A cannot read, replace, or delete College B's private attachments.
3. Super Admins cannot access institutional storage under Strict Option A.

---

## 13. CANONICAL AUDIT LOGGING ARCHITECTURE

### 13.1 Single Canonical Table: `public.audit_logs`
Prior revisions maintained separate audit tables (`platform_audit_events`, `college_audit_logs`). In SA-06 and SA-07, audit logging was unified into a single, high-performance canonical table: `public.audit_logs`.

### 13.2 Append-Only Immutability
To comply with SOC-2, ISO 27001, and Indian Digital Personal Data Protection (DPDP) standards, audit logs are physically immutable.
```sql
-- Revoke all mutation permissions
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM PUBLIC, authenticated, service_role;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated, service_role;
```
Once written, no user, administrator, or service script can alter or purge an audit log record.

### 13.3 Audit Event Schema & Monitored Operations
Every audit record captures:
- `id`: UUID primary key.
- `created_at`: Immutable UTC timestamp.
- `actor_id`: UUID of the authenticated actor (or `system` / `unauthenticated`).
- `actor_role`: Resolved role (`SUPER_ADMIN`, `PLACEMENT_HEAD`, `PLACEMENT_STAFF`, `TRAINER`, `STUDENT`).
- `college_id`: Nullable UUID (populated for institutional events; null for control plane events).
- `event_type`: Standardized event string (e.g., `AUTH_LOGIN`, `COLLEGE_INVITED`, `PLAN_SELECTED`, `PAYMENT_VERIFIED`, `OVERRIDE_GRANTED`, `ROSTER_IMPORTED`, `STUDENT_CLAIMED`).
- `severity`: Severity classification (`INFO`, `WARNING`, `SECURITY`, `CRITICAL`).
- `target_resource`: Affected entity (e.g., `subscription:123`, `user:456`).
- `metadata`: JSONB payload containing contextual parameters, IP address hash, and reason strings.


---

## 14. AI INTELLIGENCE LAYER (GOOGLE GEMINI & AI TUTOR)

### 14.1 SDK & Model Architecture
UrPlaced integrates Google GenAI using the official `@google/genai` (v2.31.0) SDK. AI capabilities are designed to assist both candidate preparation and institutional placement cell decision-making without creating operational dependencies that could compromise core uptime.

#### Dynamic Model Routing
- **`gemini-2.5-flash`:** Deployed for high-frequency, low-latency tasks:
  - Real-time semantic parsing of employer Job Descriptions (JDs).
  - Rapid candidate resume extraction and DriveFit match scoring (0–100%).
  - Real-time classification of question difficulty, taxonomy, and Bloom's cognitive level.
  - Immediate categorization of student test mistakes (Conceptual vs. Calculation vs. Speed).
- **`gemini-2.5-pro`:** Deployed for complex cognitive tasks:
  - Multi-turn interactive student AI tutoring and debugging assistance.
  - Deep institutional cohort placement trend synthesis and executive insight generation.
  - Dynamic generation of balanced coding problem sets with test cases and edge criteria.

### 14.2 Prompt Engineering & Structured Output Schemas
All Gemini API interactions strictly utilize typed schemas enforced via JSON schema constraints to eliminate parsing errors and model hallucination.

```typescript
// Sample DriveFit Evaluation Schema in src/lib/ai/drivefit.ts
export const DriveFitEvaluationSchema = z.object({
  overallMatchScore: z.number().min(0).max(100),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  actionableRecommendations: z.array(z.string()),
  fitSummary: z.string().max(500),
});
```

### 14.3 AI Tutor Multi-Turn Guardrails
The Student AI Tutor (`/student/tutor` and `/api/ai/tutor/chat`) is governed by pedagogical system prompts:
1. **The Socratic Principle:** The tutor is strictly prohibited from providing direct code solutions or final test answers. It must guide students through diagnostic hints, counter-examples, and conceptual explanations.
2. **Contextual Isolation:** The AI tutor only receives sanitized student problem context; it never accesses proprietary questions from upcoming unreleased college assessments.

### 14.4 Platform AI Kill-Switch & Circuit Breakers
To safeguard platform operational integrity during Google GenAI outages or quota exhaustion:
- An administrative emergency toggle (`ai_service_kill_switch`) is exposed in `/preritrd/configuration`.
- When engaged, all AI endpoints fail open with graceful fallback UI cards (e.g., standard heuristic keyword matching for DriveFit, and a friendly maintenance notification on the AI Tutor page) rather than throwing HTTP 500 errors.

---

## 15. PAYMENTS, BILLING & SUBSCRIPTION LIFECYCLE (OPTION C, 7-DAY GRACE, OVERRIDES)

### 15.1 Razorpay Payment Gateway Integration
The billing subsystem integrates Razorpay Node SDK (v2.9.8) to manage B2B transactions:
- **Order Generation:** Initiated via `POST /api/billing/checkout/create-order` by the `PLACEMENT_HEAD`. Server calculates applicable plan amount, currency (`INR`), and 18% Goods & Services Tax (GST).
- **Payment Verification:** Handled synchronously via `POST /api/billing/checkout/verify` and asynchronously via `POST /api/billing/webhook`.
- **Cryptographic Signature Verification:** Webhooks verify `x-razorpay-signature` using HMAC-SHA256 against `RAZORPAY_WEBHOOK_SECRET`.
- **Automated Tax Invoicing:** Upon verified payment capture, the system generates a sequential invoice record (`INV-YYYY-XXXX`) and produces a downloadable PDF invoice using PDFKit.
- **Credit Notes:** If a refund or billing adjustment occurs, the system issues a formal credit note (`CN-YYYY-XXXX`) offsetting the original invoice.

### 15.2 The Approved Option C Dual Onboarding Workflow
Following formal product owner signoff, UrPlaced implements **Option C** for initial college subscription plan assignment, eliminating any automatic fallback to a default tier:

```mermaid
flowchart TD
    SA_INVITE["Super Admin Invites College<br/>/preritrd/colleges"] --> BRANCH{"Initial Plan Choice"}
    
    BRANCH -->|"Workflow 1: Pre-Assigned"| W1["Admin selects approved published plan<br/>(e.g., Growth)"]
    BRANCH -->|"Workflow 2: Unassigned"| W2["Admin leaves plan unassigned<br/>(plan_id = null)"]

    W1 --> INV_SENT_1["Invitation Email Sent with Token"]
    W2 --> INV_SENT_2["Invitation Email Sent with Token"]

    INV_SENT_1 --> SETUP_1["Placement Head Registers<br/>/auth/college/setup"]
    INV_SENT_2 --> SETUP_2["Placement Head Registers<br/>/auth/college/setup"]

    SETUP_1 --> PENDING_PAY["College Created with Sub Status:<br/>PENDING_PAYMENT (No Access)"]
    SETUP_2 --> NO_SUB["College Created with:<br/>NO SUBSCRIPTION (No Access)"]

    NO_SUB --> HEAD_SELECT["Placement Head views catalogue &<br/>selects published plan"]
    HEAD_SELECT --> PENDING_PAY

    PENDING_PAY --> PAY_CHECKOUT["Razorpay Checkout Flow<br/>/dashboard/billing"]
    PAY_CHECKOUT --> VERIFIED["Payment Captured & Verified"]
    VERIFIED --> ACTIVE["Subscription Status: ACTIVE<br/>Frozen Entitlement Snapshot Created<br/>Full Operational Access Unlocked"]
```

#### Fail-Closed Invariant on Missing Subscriptions
If a college is in Workflow 2 and has not yet selected a plan, or if its subscription status is `PENDING_PAYMENT`:
- **Absolute Operational Lockout:** All operational API routes (`/api/placement/*`, `/api/questions/*`, `/api/student/*`) reject requests with `HTTP 403 Forbidden` (`FORBIDDEN: NO_SUBSCRIPTION` or `FORBIDDEN: SUBSCRIPTION_PENDING_PAYMENT`).
- **All 4 Roles Locked:** Placement Head, Placement Staff, Trainer, and Student are completely blocked from student rosters, drives, question sets, and assessments.
- **Draft Plan Protection:** Any attempt to select an unapproved or draft plan is rejected with `HTTP 400 Bad Request`.

### 15.3 The 7-Day Renewal Grace Period Policy
To protect ongoing campus placement drives from being abruptly disrupted by banking payment delays or administrative invoice approvals:
- When an active subscription reaches its expiration date, it enters a **7-Day Renewal Grace Period** (`status = 'GRACE_PERIOD'`).
- **Full Operational Continuity:** The college retains **100% operational functionality** throughout the 7 days (students can take tests, staff can advance candidates, drives continue unimpeded).
- **Persistent Billing Alert:** Placement Heads and Staff see a prominent, non-dismissible warning banner indicating the exact hours remaining before full account suspension.
- **Strict Quota Enforcement:** Operational usage continues to be capped by the frozen entitlement snapshot (student quotas and storage limits remain strictly enforced).
- **Hard Expiration:** If 7 days elapse without payment capture, the subscription transitions to `EXPIRED`, and the fail-closed access barrier engages immediately.

### 15.4 Super Admin Emergency Access Overrides
In high-stakes emergencies (e.g., a Tier-1 recruitment drive taking place while college finance is clearing a bank wire):
- Super Admins can grant a temporary **Operational Access Override** via `/preritrd/subscriptions/[id]/override`.
- **Time Duration:** Strictly bounded between **1 hour and 168 hours** (7 days maximum).
- **Mandatory Justification:** Requires an explicit justification of **at least 10 characters** explaining the operational necessity.
- **Audit Logging:** Every override creation, modification, or revocation is permanently recorded in `public.audit_logs` with severity `SECURITY`.
- **Real-Time Evaluation:** Server guards check `override_until > now()` to temporarily bypass subscription payment blocks.

---

## 16. COMPREHENSIVE SECURITY AUDIT & VULNERABILITY MITIGATION

UrPlaced underwent rigorous architectural and security code audits across all phases. The following matrix details the critical vulnerabilities identified, verified, and systematically mitigated.

| Vulnerability Vector | Severity | Architectural Root Cause | Implemented Technical Mitigation | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Multi-College Cross-Tenant Leakage** | **CRITICAL** | Shared relational tables querying without enforced tenant filters. | PostgreSQL Row Level Security (RLS) on 100% of tables filtering via `tenant_memberships.college_id`. | 92/92 pgTAP test suite assertions passing with cross-college access explicitly denied. |
| **Simultaneous Multi-College Membership** | **CRITICAL** | A single user acquiring accounts in multiple colleges, risking data exfiltration. | Relational database unique constraint `uq_tenant_memberships_user_id` + server guards rejecting duplicate memberships. | Scenario 01 & 02 verified; DB rejects duplicate user IDs with constraint violation `23505`. |
| **Client-Side Metadata Privilege Escalation** | **CRITICAL** | Relying on Supabase `user_metadata` for role and college claims. | `user_metadata` completely disregarded; all authorization checks query authoritative server DB tables. | Guard tests verify that modifying client JWT claims has zero impact on server access control. |
| **Super Admin Institutional Snooping** | **CRITICAL** | Super Admin role having global bypass permissions across academic and student data. | **Strict Option A Isolation**: Super Admin tokens stripped from institutional RLS policies. | pgTAP tests confirm Super Admin queries against student/question tables return 0 rows. |
| **Avatar Storage Path Traversal & Tampering** | **HIGH** | Permissive folder-path matching allowing users to overwrite peer profile photos. | Hardened RLS policies requiring `owner = auth.uid()` AND exact first-segment folder matching. | Migration 32 enforces owner checks; verified in pgTAP tests 81–86. |
| **Audit Log Tampering or Deletion** | **HIGH** | Administrative users altering or clearing security event trails. | Physical database `REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs`. | Database tests confirm update/delete statements fail with SQL permission denied errors. |
| **Unauthorized Billing API Access** | **HIGH** | Placement Staff or Trainers accessing financial invoices or initiating payments. | Strict server-side RBAC: `requireBillingAccess()` restricting routes exclusively to `PLACEMENT_HEAD`. | Scenario 37 & 38 verify Staff/Trainer receiving `HTTP 403 Forbidden` on invoice downloads. |
| **Student SRN Claiming Race Condition** | **HIGH** | Concurrent requests claiming the same Student Registration Number simultaneously. | Atomic PostgreSQL claiming RPC using `SELECT FOR UPDATE` row locks within serialized transactions. | Migrations 13–18 and Vitest concurrency tests confirm zero double-claiming. |
| **Unpaid College Operational Access Leak** | **MEDIUM** | Colleges in `PENDING_PAYMENT` or unassigned plan state executing placement operations. | Fail-closed access guard `fn_check_tenant_operational_access` blocking all operational APIs. | SA-07 Scenarios 36 & 40 verify complete fail-closed lockout for unpaid tenants. |
| **Razorpay Webhook Replay / Spoofing** | **MEDIUM** | Fraudulent actors sending fake payment confirmation webhooks. | Mandatory HMAC-SHA256 signature verification over raw request body using webhook secret. | Billing tests verify unauthenticated or forged signatures are rejected with `HTTP 400`. |

---

## 17. ENVIRONMENT VARIABLES & SECRETS MANAGEMENT (REDACTED)

The UrPlaced application relies on the following environment variables across Next.js Server Components, Route Handlers, and Build scripts. **All sensitive secret values are strictly redacted in this report.**

```bash
# ==============================================================================
# URPLACED ENVIRONMENT CONFIGURATION (PRODUCTION TEMPLATE)
# ==============================================================================

# NEXT.JS CORE RUNTIME
NEXT_PUBLIC_APP_URL="https://app.urplaced.com"
NODE_ENV="production"

# SUPABASE INFRASTRUCTURE
NEXT_PUBLIC_SUPABASE_URL="https://[YOUR_SUPABASE_PROJECT_ID].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[REDACTED_PUBLIC_ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.[REDACTED_SERVICE_ROLE_KEY]"
SUPABASE_DB_URL="postgresql://postgres:[REDACTED_DB_PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres"

# GOOGLE GEMINI ARTIFICIAL INTELLIGENCE
GEMINI_API_KEY="AIzaSy[REDACTED_GOOGLE_GENAI_KEY]"
GEMINI_MODEL_FLASH="gemini-2.5-flash"
GEMINI_MODEL_PRO="gemini-2.5-pro"

# RAZORPAY PAYMENT GATEWAY
NEXT_PUBLIC_RAZORPAY_KEY_ID="rzp_live_[REDACTED_KEY_ID]"
RAZORPAY_KEY_SECRET="[REDACTED_RAZORPAY_SECRET]"
RAZORPAY_WEBHOOK_SECRET="[REDACTED_WEBHOOK_SECRET]"

# TRANSACTIONAL EMAIL (RESEND / SMTP)
EMAIL_SERVER_HOST="smtp.resend.com"
EMAIL_SERVER_PORT="587"
EMAIL_SERVER_USER="resend"
EMAIL_SERVER_PASSWORD="re_[REDACTED_RESEND_KEY]"
EMAIL_FROM="UrPlaced Platform <notifications@urplaced.com>"

# CRON JOBS & AUTOMATED SWEEP AUTHORIZATION
CRON_SECRET_TOKEN="[REDACTED_RANDOM_64_CHAR_HEX_TOKEN]"

# SUPER ADMIN SEEDING & CONTROL PLANE
SUPER_ADMIN_EMAIL="admin@urplaced.com"
SUPER_ADMIN_INITIAL_PASSWORD="[REDACTED_COMPLEX_PASSWORD]"
SUPER_ADMIN_MFA_ISSUER="UrPlaced SuperAdmin"
```

---

## 18. VERIFIED TESTING, QA & VALIDATION BASELINE (1,203 VITEST, 92 PGTAP, BUILD)

The technical integrity and stability of UrPlaced is backed by a multi-layered automated verification baseline.

### 18.1 Vitest Platform Regression Suite
- **Total Test Files:** 101 files passed (100%).
- **Total Executed Tests:** 1,203 tests passed (100%).
- **Failures / Regressions:** **0 failures**.
- **Scope:** Unit and integration testing spanning authentication guards, Option C onboarding workflows, Razorpay checkout, PDF generation, Excel roster parsing, DriveFit scoring, assessment timers, and student mistake spaced repetition.

### 18.2 Master SA-07 End-to-End Suite (`src/test/sa07-end-to-end-integration-and-qa.test.ts`)
- **Total Scenarios:** 45 comprehensive end-to-end integration scenarios.
- **Status:** **45/45 Passed (100%)**.
- **Validated Cross-Cutting Workflows:**
  - One Person = One College enforcement across all role transitions.
  - Strict Option A isolation: Super Admin zero institutional data access.
  - Option C Workflow 1 (Admin pre-assigns published plan) and Workflow 2 (Admin unassigns, Head self-selects).
  - Draft plan purchase rejection (`HTTP 400`).
  - Missing subscription fail-closed access barrier across Placement Head, Staff, Trainer, and Student.
  - Razorpay order creation, payment signature verification, and automated invoice PDF generation.
  - 7-day renewal grace period: 100% operational continuity with billing warnings.
  - Super Admin emergency access overrides (1–168 hours with $\ge 10$-character reason).
  - Exclusive billing RBAC: Ordinary Placement Staff and Trainers blocked from billing and invoices.
  - Student assessment proctoring, auto-save RPC, and instant grading.
  - Student mistake logging and adaptive review generation.

### 18.3 PostgreSQL Database pgTAP RLS Test Suite (`supabase/tests/rls_multi_college_isolation.test.sql`)
- **Total Database Assertions:** 92 assertions passed (100%).
- **Execution Mechanism:** PostgreSQL native pgTAP suite executed directly in the database engine.
- **Validated Invariants:**
  - Multi-tenant tenant boundary: College A cannot read, insert, update, or delete College B records.
  - Unique membership invariant: Unique constraint `uq_tenant_memberships_user_id` rejects duplicate memberships.
  - Storage bucket isolation: Users cannot modify peer avatars; institutional buckets strictly isolated.
  - Audit log immutability: UPDATE and DELETE operations on `public.audit_logs` fail with permission denied.

### 18.4 TypeScript Strict Compilation
- **Command:** `npm run type-check` (`tsc --noEmit`)
- **Result:** **0 Errors, 0 Warnings**.
- **Configuration:** TypeScript 5.7.3 in strict mode.

### 18.5 Next.js Production Build
- **Command:** `npm run build` (`next build`)
- **Result:** **Successful compilation (Exit Code 0)**.
- **Output:**
  - **97 static prerendered pages generated** (`Generating static pages (97/97)`).
  - **47 static routes + 218 dynamic app routes (Total 265 routes in `Route (app)`)**.
  - All Server Components, Route Handlers, and client bundles compiled cleanly without hydration or route generation issues.


---

## 19. END-TO-END USER & OPERATIONAL WORKFLOWS

### 19.1 Workflow 1: College Onboarding & Initial Subscription Activation (Option C)
1. **Super Admin Invitation (`/preritrd/colleges`):** Super Admin enters college name, domain, accreditation, and Placement Head contact details. Under Option C, Super Admin either pre-assigns an approved published plan (Workflow 1) or leaves the plan unassigned (Workflow 2). The system generates a cryptographically hashed invitation token (valid for 7 days) and sends an invitation email.
2. **Placement Head Registration (`/auth/college/setup`):** The Placement Head clicks the token link, validates their institution, enters their full name, sets a password, and accepts terms.
3. **Account Provisioning:** The server verifies the user has no existing college memberships (`assertNoExistingMembership`), creates the `colleges` record, provisions the user in `auth.users`, and creates a `tenant_memberships` record with role `PLACEMENT_HEAD`.
4. **Subscription Initialization (Fail-Closed):**
   - *If Pre-Assigned:* A subscription record is created with status `PENDING_PAYMENT`.
   - *If Unassigned:* No subscription record is created.
   - In both cases, operational access remains strictly denied across all institutional APIs.
5. **Plan Selection (Workflow 2 only):** Placement Head logs in, is redirected to `/dashboard/billing`, views the approved published plans catalogue, and selects a tier. Draft plans are rejected with `HTTP 400`. The subscription record transitions to `PENDING_PAYMENT`.
6. **Razorpay Checkout:** Placement Head initiates checkout via `POST /api/billing/checkout/create-order`. The server creates a Razorpay order including 18% GST. The Placement Head completes payment via the Razorpay modal.
7. **Verification & Activation:** The client submits payment details to `/api/billing/checkout/verify` (or Razorpay dispatches `payment.captured` webhook to `/api/billing/webhook`). The signature is verified via HMAC-SHA256, the subscription transitions to `ACTIVE`, a frozen entitlement snapshot is created, a tax invoice PDF (`INV-YYYY-XXXX`) is generated, and operational access is immediately unlocked.

### 19.2 Workflow 2: Student Enrollment & SRN Roster Claiming
1. **Roster Bulk Import (`/dashboard/students`):** Placement Head or Staff uploads an Excel/CSV spreadsheet containing pre-enrolled students (SRN/USN, Full Name, Official College Email, Department, CGPA, Backlogs).
2. **Streaming Ingestion:** `excel/roster-parser.ts` parses the file in chunks, validates row schemas, and inserts records into `public.students` with `user_id = NULL` and `claimed = FALSE`.
3. **Student Registration (`/auth/signup`):** Candidate registers on the public portal using their email and sets a password.
4. **Profile Claiming (`/student/profile`):** Student navigates to profile, selects their college, and inputs their official Student Registration Number (SRN/USN).
5. **Atomic Claim Execution:** The server invokes an atomic PostgreSQL RPC (`fn_claim_student_roster_record`) using `SELECT FOR UPDATE` to lock the roster record.
6. **Claim Completion:** The RPC validates that the SRN matches an unclaimed record in that specific college, sets `user_id = auth.uid()`, sets `claimed = TRUE`, and establishes a `tenant_memberships` record with role `STUDENT`. Official academic data (CGPA, department) cannot be overwritten by the student.

### 19.3 Workflow 3: Campus Recruitment Drive Execution
1. **Drive Creation (`/dashboard/drives`):** Placement Head or Staff creates a placement drive for a partnered company (e.g., Google, Infosys), entering role title, CTC package, bond terms, and recruitment stages (Aptitude -> Technical Round -> HR Interview).
2. **JD Semantic Parsing (DriveFit):** The user pastes the Job Description. Gemini 2.5 Flash parses required and good-to-have technical skills, mapping them to the institutional taxonomy.
3. **Automated Eligibility Evaluation:** The placement cell defines hard cutoffs (e.g., CGPA $\ge 7.5$, Max Backlogs = 0, Departments = CSE, ECE). The system evaluates all institutional students and marks them as Eligible or Ineligible.
4. **Student Application (`/student/drives`):** Eligible students view the drive, review their DriveFit match score (e.g., 88% Match), and click "Apply". The system creates an application record snapshotting their resume at the time of submission.
5. **Stage Advancement Pipeline:** Placement coordinators advance candidates through rounds on an interactive Kanban board (`/dashboard/drives/[id]`).
6. **Offer Letter Dispatch:** Final candidates receive formal offer letters in `/student/offers` with formal Accept / Decline response triggers.

### 19.4 Workflow 4: Online Assessment & Examination Proctoring
1. **Test Set Curation (`/dashboard/questions`):** Staff or Trainers curate question sets manually from QuestionBank Sentinel or invoke the Gemini Auto-Build endpoint to generate a balanced 50-mark test across specified topics and difficulty levels.
2. **Assessment Scheduling (`/dashboard/assessments`):** Assessment is linked to a recruitment drive or practice cohort, with defined test window start/end times and strict duration limits (e.g., 60 minutes).
3. **Student Test Entry (`/student/assessments/[id]`):** Student enters the full-screen examination environment. Full-screen locks and tab-switch event listeners engage.
4. **Auto-Save RPC Loop:** As the student answers questions, responses are auto-saved every 30 seconds via `POST /api/student/attempts/[id]/save`.
5. **Instantaneous Auto-Grading:** When the student clicks Submit (or the countdown timer reaches zero), the assessment attempt is locked and automatically scored against correct answer keys.
6. **Results Release:** Placement coordinators review the score distribution and click "Release Results", immediately updating student performance dashboards.

### 19.5 Workflow 5: Mistake-to-Mastery Adaptive Remediation
1. **Defect Extraction:** Upon assessment submission, incorrect responses are analyzed by `POST /api/ai/mistakes/analyze`.
2. **Cognitive Classification:** Mistakes are tagged as:
   - *Conceptual Defect:* Fundamental misunderstanding of core algorithmic or theoretical concepts.
   - *Calculation Defect:* Arithmetic or syntax misstep despite correct conceptual approach.
   - *Speed / Time-Out Defect:* Unanswered or rushed questions due to poor time allocation.
3. **Personalized Spaced Repetition (`/student/mastery`):** Defective concepts are entered into the student's mastery queue with spaced repetition review intervals (1 day, 3 days, 7 days).
4. **Targeted Practice Tests:** Students generate dynamic practice tests tailored strictly to their weak concepts until mastery is statistically demonstrated.

### 19.6 Workflow 6: Subscription Expiration, 7-Day Grace & Emergency Override
1. **Daily Expiration Sweep (`/api/cron/billing/daily-sweep`):** The automated midnight cron job scans `college_subscriptions`.
2. **Transition to Grace:** Subscriptions reaching `current_period_end` transition to `GRACE_PERIOD`. The college retains 100% operational functionality, but a persistent amber warning banner appears across all staff dashboards.
3. **Grace Expiration:** If 7 days elapse without payment, the subscription status transitions to `EXPIRED`. Operational APIs immediately fail closed with `HTTP 403 Forbidden`.
4. **Emergency Override Grant:** If an active campus drive is occurring during a renewal delay, Super Admin navigates to `/preritrd/subscriptions`, selects the college, inputs an override duration (e.g., 48 hours) and an audited justification ($\ge 10$ characters, e.g., "Tier-1 campus drive active; finance wire processing").
5. **Immediate Restoration:** The server updates `override_until = now() + interval '48 hours'`, writes an immutable security event to `public.audit_logs`, and immediately restores full operational access.

---

## 20. CRITICAL DEPENDENCY & INTEGRATION GRAPH

```mermaid
flowchart TD
    subgraph Core_Auth_Tenancy ["Foundational Tenancy & Identity"]
        AUTH["Supabase Auth (auth.users)"]
        TENANT["tenant_memberships<br/>(One Person = One College)"]
        AUTH --> TENANT
    end

    subgraph Billing_Subsystem ["Subscription & Monetization Layer"]
        PLANS["subscription_plans (Catalogue)"]
        SUBS["college_subscriptions (Option C)"]
        RAZOR["Razorpay Gateway"]
        SNAPSHOTS["subscription_snapshots (Frozen Entitlements)"]
        
        PLANS --> SUBS
        RAZOR --> SUBS
        SUBS --> SNAPSHOTS
    end

    subgraph Security_Gate ["Access Control Boundary"]
        GATE["Operational Access Guard<br/>(fn_check_tenant_operational_access)"]
        OVERRIDE["Super Admin Override<br/>(1-168 Hours)"]
        GRACE["7-Day Grace Period Engine"]
        
        SUBS --> GATE
        SNAPSHOTS --> GATE
        OVERRIDE --> GATE
        GRACE --> GATE
    end

    subgraph Institutional_Services ["Institutional Operations (Gated)"]
        ROSTER["Student Directory & SRN Claiming"]
        DRIVES["Placement Drives & Pipeline CRM"]
        QB["QuestionBank Sentinel"]
        ASSESS["Assessment Engine & Proctoring"]
        MASTERY["Mistake-to-Mastery"]
        MEMORY["Placement Memory Analytics"]
        
        GATE --> ROSTER
        GATE --> DRIVES
        GATE --> QB
        GATE --> ASSESS
        GATE --> MASTERY
        GATE --> MEMORY
    end

    subgraph External_Intelligence ["External Cloud Dependencies"]
        GEMINI["Google Gemini API (2.5 Flash / Pro)"]
        RESEND["Transactional Email (Resend)"]
        STORAGE["Supabase Storage Buckets"]
        
        DRIVES -.-> GEMINI
        QB -.-> GEMINI
        ASSESS -.-> GEMINI
        ROSTER -.-> STORAGE
        SUBS -.-> RESEND
    end

    subgraph Audit_Plane ["Immutable Observability"]
        AUDIT["public.audit_logs<br/>(Append-Only)"]
        
        AUTH -.-> AUDIT
        SUBS -.-> AUDIT
        GATE -.-> AUDIT
        OVERRIDE -.-> AUDIT
    end
```

---

## 21. COMPLETE IMPLEMENTATION STATUS MATRIX

| System Domain | Module / Capability | Implementation Status | Verified Test Coverage | Key Source Files |
| :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Student Sign-Up & Sign-In | **COMPLETE** | Unit + E2E Verified | `src/app/auth/*`, `src/lib/auth/session.ts` |
| **Authentication** | Placement Head Onboarding Setup | **COMPLETE** | Scenarios 01, 14, 21 | `src/app/auth/college/setup/*` |
| **Authentication** | One Person = One College Rule | **COMPLETE** | 92/92 pgTAP + Scenarios 01–03 | `supabase/migrations/*enforce_single_college*` |
| **Multi-Tenancy** | PostgreSQL Database RLS Policies | **COMPLETE** | 92/92 pgTAP Assertions | `supabase/migrations/20261018000001*` |
| **Multi-Tenancy** | Strict Option A Super Admin Isolation | **COMPLETE** | pgTAP + Scenarios 04–06 | `supabase/migrations/*strict_platform_admin*` |
| **College Placement** | Recruiter Directory CRM | **COMPLETE** | Full CRUD Coverage | `src/app/dashboard/companies/*` |
| **College Placement** | Placement Drive Configuration | **COMPLETE** | Full CRUD Coverage | `src/app/dashboard/drives/*` |
| **College Placement** | Candidate Pipeline & Stage Boards | **COMPLETE** | Full CRUD Coverage | `src/app/dashboard/drives/[id]/*` |
| **College Placement** | Offer Letter Management | **COMPLETE** | Acceptance Flow Verified | `src/app/dashboard/drives/[id]/offers/*` |
| **AI Intelligence** | DriveFit Semantic JD Scoring | **COMPLETE** | Schema & Mock Tested | `src/lib/ai/drivefit.ts`, `src/app/api/ai/drivefit/*` |
| **AI Intelligence** | Gemini Question Classification | **COMPLETE** | Schema & Mock Tested | `src/lib/ai/question-generator.ts` |
| **AI Intelligence** | Student Interactive AI Tutor | **COMPLETE** | Multi-Turn Guardrails | `src/lib/ai/tutor-service.ts`, `/student/tutor` |
| **AI Intelligence** | Platform AI Emergency Kill-Switch | **COMPLETE** | Config Guard Verified | `src/app/preritrd/configuration/*` |
| **Question Banking** | QuestionBank Sentinel CRUD | **COMPLETE** | Full CRUD Coverage | `src/app/dashboard/questions/*` |
| **Question Banking** | Excel / CSV Bulk Question Import | **COMPLETE** | ExcelJS Streaming Tested | `src/app/api/questions/import/*` |
| **Question Banking** | Duplicate Question Vector Detection | **COMPLETE** | Similarity Algorithm Tested| `src/app/api/questions/duplicates/*` |
| **Question Banking** | Auto-Build Balanced Test Sets | **COMPLETE** | Generation Tested | `src/app/api/questions/sets/auto-build/*` |
| **Assessments** | Assessment Scheduler & Settings | **COMPLETE** | Full Lifecycle Tested | `src/app/dashboard/assessments/*` |
| **Assessments** | Full-Screen Proctoring Environment | **COMPLETE** | Event Logging Verified | `src/components/assessment/runner.tsx` |
| **Assessments** | Timed Auto-Save RPC Loop | **COMPLETE** | 30s Interval Verified | `src/app/api/student/attempts/[id]/save/*` |
| **Assessments** | Instant Grading & Score Matrix | **COMPLETE** | Result Release Verified | `src/app/api/student/attempts/[id]/submit/*` |
| **Student Mastery** | Mistake Categorization Engine | **COMPLETE** | Cognitive Rules Tested | `src/app/api/student/mistakes/*` |
| **Student Mastery** | Spaced Repetition Review Schedule | **COMPLETE** | Spaced Intervals Tested | `src/app/student/mastery/*` |
| **Student Memory** | Senior Interview Archives | **COMPLETE** | Full CRUD Coverage | `src/app/student/memory/*` |
| **Analytics** | Longitudinal Placement Reports | **COMPLETE** | PDF Generation Verified | `src/app/dashboard/analytics/*` |
| **Storage** | Avatar Uploads & Path Mapping | **COMPLETE** | Strict Owner RLS Verified | `supabase/migrations/*enforce_storage_ownership*` |
| **Notifications** | In-App Real-Time Notification Bell | **COMPLETE** | Unread Markers Tested | `src/app/api/notifications/*` |
| **Roster Claiming** | Atomic Student SRN Claiming | **COMPLETE** | Race Condition Hardened | `supabase/migrations/*srn_roster_claiming*` |
| **Super Admin** | Dashboard Analytics & Health | **COMPLETE** | KPI Aggregation Verified | `src/app/preritrd/dashboard/*` |
| **Super Admin** | College Onboarding Token Generator | **COMPLETE** | Token Expiration Tested | `src/app/preritrd/colleges/*` |
| **Super Admin** | Subscription Plan Catalogue | **COMPLETE** | Versioning & Publishing | `src/app/preritrd/subscriptions/plans/*` |
| **Super Admin** | Emergency Access Overrides (1-168h)| **COMPLETE** | Justification Enforced | `src/app/preritrd/subscriptions/[id]/override` |
| **Billing & Payments**| Option C Dual Onboarding Workflow | **COMPLETE** | Scenarios 36, 40 Verified | `src/lib/billing/entitlement-manager.ts` |
| **Billing & Payments**| Razorpay Orders & Webhook Verify | **COMPLETE** | HMAC-SHA256 Signature | `src/app/api/billing/*`, `src/app/api/webhooks/*` |
| **Billing & Payments**| 7-Day Renewal Grace Period Policy | **COMPLETE** | Scenario 17 Verified | `src/lib/billing/entitlement-manager.ts` |
| **Billing & Payments**| Automated Tax Invoicing (PDFKit) | **COMPLETE** | Sequential INV-YYYY-XXXX | `src/lib/pdf/invoice-template.ts` |
| **Billing & Payments**| Refund Credit Notes (PDFKit) | **COMPLETE** | Sequential CN-YYYY-XXXX | `src/lib/pdf/credit-notes.ts` |
| **Billing & Payments**| Billing RBAC Lockdown | **COMPLETE** | Staff/Student Blocked | `src/lib/auth/guards.ts` |
| **Audit Observability**| Append-Only `public.audit_logs` | **COMPLETE** | UPDATE/DELETE Revoked | `supabase/migrations/*audit_immutability*` |

---

## 22. KNOWN ISSUES, EDGE CASES & RESIDUAL TECHNICAL DEBT

While UrPlaced passes 100% of its automated regression suites and compiles without errors, technical auditors have cataloged the following operational considerations and architectural characteristics:

### 22.1 Local Docker Requirement for pgTAP Test Execution
- **Nature:** The PostgreSQL RLS test suite (`supabase/tests/rls_multi_college_isolation.test.sql`) requires native PostgreSQL execution via `npx supabase test db`.
- **Operational Reality:** On developer Windows machines, running `npx supabase test db` requires the local Docker Desktop daemon to be running. If Docker Desktop is closed, the command returns `connect ECONNREFUSED 127.0.0.1:54322`.
- **Mitigation:** The complete 92/92 test suite executes cleanly whenever Docker is active. In CI/CD pipelines (GitHub Actions), Supabase CLI runs against standard Linux Docker containers without friction.

### 22.2 Webhook Idempotency & Distributed Locking
- **Nature:** Razorpay occasionally sends duplicate payment webhook notifications during network retries.
- **Current Handling:** The system currently performs database-level idempotency checks (querying `payment_transactions` for the `razorpay_payment_id` prior to executing subscription updates).
- **Residual Debt:** In high-concurrency multi-region deployments with multiple application instances, concurrent duplicate webhooks could theoretically attempt simultaneous processing before the first commit.
- **Recommended Future Enhancement:** Introduce a Redis-backed distributed lock (`redlock`) using the `razorpay_payment_id` as the lock key with a 10-second TTL.

### 22.3 Memory Footprint of Large Cohort PDF Generation
- **Nature:** Institutional placement reports and bulk student resumes generated via PDFKit are created in server memory before being streamed to the client.
- **Operational Reality:** Generating a comprehensive PDF report for a graduating batch of 3,000+ students could place transient memory pressure on smaller serverless instances (e.g., 512MB memory limits).
- **Mitigation:** Chunked streaming generation is partially implemented; for enterprise cohorts, asynchronous background report generation via storage bucket presigned URLs is recommended.

### 22.4 External SMTP Relay Resiliency
- **Nature:** College invitation emails and billing alerts rely on external SMTP transports (Resend / Nodemailer).
- **Operational Reality:** If the external SMTP provider experiences network timeouts, invitation creation will succeed in the database, but email delivery may fail.
- **Current Handling:** Super Admins can click "Resend Invitation" directly from `/preritrd/colleges` if a recipient reports non-receipt.
- **Recommended Future Enhancement:** Implement an asynchronous transactional outbox table in PostgreSQL processed by a reliable background worker with exponential backoff retries.

---

## 23. V1.0 PRODUCTION READINESS ASSESSMENT

### 23.1 Overall Readiness Status: READY WITH DOCUMENTED EXTERNAL PREREQUISITES
UrPlaced has achieved complete architectural, functional, security, and integration stability. All source code, database migrations, security policies, and UI layouts are finalized and verified.

### 23.2 Pre-Flight Production Readiness Checklist

| Readiness Dimension | Status | Verification Detail |
| :--- | :--- | :--- |
| **Code Stability & Typing** | **PASS (100%)** | `tsc --noEmit` exits with 0 errors. Strict TypeScript enforced across entire codebase. |
| **Unit & Integration Tests** | **PASS (100%)** | 101 test files, 1,203 tests passed in Vitest with 0 failures. |
| **End-to-End Integration** | **PASS (100%)** | Master SA-07 suite passes all 45 complex end-to-end multi-tenant workflows. |
| **Database Isolation & RLS** | **PASS (100%)** | 92 pgTAP assertions confirm complete cross-college data isolation. |
| **Build Integrity** | **PASS (100%)** | `next build` generates 97 static prerendered pages and 265 total routes cleanly. |
| **Design System Compliance** | **PASS (100%)** | Strict adherence to `GEMINI.md` palette and tokens. No unauthorized styling introduced. |
| **Security Hardening** | **PASS (100%)** | Strict Option A enforced, audit logs immutable, storage ownership verified. |

### 23.3 Documented External Prerequisites for Deployment
Before deploying the application to live production infrastructure, DevOps leads must configure the following external cloud services:
1. **Production Supabase Project:**
   - Create a dedicated Supabase production project (AWS Mumbai `ap-south-1` region recommended for Indian institutional latency).
   - Apply all 32 sequential migrations via `npx supabase db push`.
   - Configure Storage buckets (`avatars`, `resumes`, `drive-attachments`, `reports`) with public read disabled where private.
2. **Production Razorpay Gateway:**
   - Switch Razorpay dashboard to Live mode.
   - Obtain Live `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
   - Register the production webhook URL (`https://app.urplaced.com/api/billing/webhook`) and configure `RAZORPAY_WEBHOOK_SECRET` for events: `payment.captured`, `payment.failed`, `order.paid`.
3. **Verified Production Email Domain (Resend / SMTP):**
   - Verify DNS records (SPF, DKIM, DMARC) for `urplaced.com` in Resend.
   - Configure production SMTP credentials in environment secrets.
4. **Google GenAI Quota Provisioning:**
   - Link a Google Cloud Billing account to the Gemini API project to ensure production rate limits for `gemini-2.5-flash` and `gemini-2.5-pro`.
5. **Initial Super Admin Provisioning:**
   - Execute `npx tsx scripts/provision-super-admin.ts` on the production database to create the root platform Super Admin and initialize TOTP MFA.

---

## 24. RECOMMENDED POST-HANDOFF ROADMAP (P0 TO P3)

The following structured engineering roadmap is recommended for subsequent sprints post-production launch:

### Phase P0: Production Launch & Cloud Infrastructure Cutover (Immediate / Day 1)
- Provision production Supabase, Razorpay Live, Resend domain, and Gemini API keys.
- Run database migrations and verify RLS enforcement on staging and production instances.
- Execute initial Super Admin provisioning and set up hardware-backed TOTP MFA.
- Configure daily midnight cron and 15-minute reconciliation sweep triggers in Vercel / GitHub Actions.

### Phase P1: Operational Hardening & Enterprise Enhancements (Short-Term / 30 Days)
- **Redis Distributed Locks:** Introduce Upstash Redis for distributed webhook idempotency and distributed rate-limiting on public API endpoints.
- **Asynchronous Email Outbox:** Implement a PostgreSQL transactional outbox table with background worker retries for resilient email dispatch.
- **Background PDF Generation:** Offload heavy institutional cohort reports to background workers streaming results directly to Supabase Storage.
- **Automated DB Snapshot Backups:** Configure automated off-site WAL-G / pg_dump backups for disaster recovery.

### Phase P2: Native Candidate Experience & Real-Time Alerts (Medium-Term / 60–90 Days)
- **WhatsApp Institutional Notifications:** Integrate WhatsApp Business API to dispatch high-priority placement drive circulars and interview shortlist alerts directly to students.
- **Native Candidate Mobile Application:** Develop a lightweight React Native / Expo candidate mobile app interfacing with existing `/api/student/*` endpoints.
- **Automated Resume Parsing Enhancements:** Support OCR parsing for multi-column scanned student resumes using Google Cloud Document AI.

### Phase P3: Enterprise Institutional Integrations (Long-Term / 180 Days)
- **LMS & ERP Single Sign-On (SSO):** Add SAML 2.0 / OpenID Connect integration for institutional single sign-on (Microsoft Entra ID, Google Workspace for Education).
- **Direct Employer Recruiter Portal:** Allow verified corporate recruiters (e.g., HR teams at partner companies) to directly post JDs, review anonymized student cohorts, and submit candidate interview scores.

---

## 25. PRESERVED ARCHITECTURAL DECISIONS & IMMUTABLE INVARIANTS

Future developers and AI assistants working on UrPlaced **must preserve the following architectural invariants without exception**. Any modification to these principles violates the core security and operational contract of the platform.

1. **Strict Design System Tokens (The GEMINI.md Rule):**
   - The color palette (`#5052C9`, `#2E8F86`, `#EDECE7`, `#F8F7F3`, `#FBFAF7`, `#24283A`, `#292D40`), typography stacks (`Outfit`, `Inter`, `JetBrains Mono`), and derived tokens defined in `GEMINI.md` are fixed and immutable.
   - Never introduce arbitrary blues, greens, purples, or greys. Never hardcode random hex values in inline styles.
2. **The "One Person = Exactly One College" Invariant:**
   - Every individual user must belong to exactly one college. Multi-college membership is permanently forbidden.
   - The unique constraint `uq_tenant_memberships_user_id` on `public.tenant_memberships` must never be dropped, relaxed, or bypassed.
3. **Strict Option A Tenant Isolation:**
   - Platform Super Admins must have zero access to institutional student PII, assessments, question banks, or recruitment drives.
   - Super Admin bypasses must never be added to institutional RLS policies.
4. **Untrusted Client Metadata Rule:**
   - Supabase `user_metadata` is completely untrusted for authorization.
   - All role, permissions, and tenancy checks must query verified database records or server-managed `app_metadata`.
5. **Approved Option C Subscription Onboarding:**
   - Support both Workflow 1 (Admin pre-assigns published plan) and Workflow 2 (Admin unassigns, Placement Head self-selects).
   - Never reintroduce an automatic default fallback (e.g., Growth fallback).
   - Draft plans must remain strictly unavailable for purchase (`HTTP 400`).
   - If a college has no subscription or status is `PENDING_PAYMENT`, operational access must fail closed across all 4 roles.
6. **The 7-Day Renewal Grace Period Policy:**
   - Existing paying colleges must retain 100% operational functionality during the 7-day grace period.
   - Never block bulk imports, assessments, or drives merely because a college is in grace.
7. **Append-Only Immutability for Audit Logs:**
   - `public.audit_logs` is the single canonical audit repository.
   - `UPDATE` and `DELETE` permissions must remain revoked permanently.
8. **Exclusive Placement Head Billing RBAC:**
   - Only `PLACEMENT_HEAD` has access to subscription plans, Razorpay checkout, billing ledger, and invoice downloads.
   - Ordinary Placement Staff, Trainers, and Students must be strictly locked out from billing interfaces and API endpoints.

---

## 26. GLOSSARY OF SYSTEM TERMS & CANONICAL DEFINITIONS

- **Tenant:** An independent educational institution (university or college) representing an isolated boundary in UrPlaced.
- **Tenant Membership:** A relational association linking an authenticated user to a specific college with an assigned role (`PLACEMENT_HEAD`, `PLACEMENT_STAFF`, `TRAINER`, or `STUDENT`).
- **Placement Head:** The chief administrative officer of a college placement cell with sole authority over billing, subscriptions, staff invitations, and policy settings.
- **Placement Staff:** An operational placement officer responsible for company relationships, drive pipelines, and student roster verification. Barred from billing.
- **Trainer:** An academic faculty member or trainer responsible for authoring questions, curating assessments, and tracking student practice. Barred from drives and billing.
- **Student:** An enrolled candidate eligible for campus placement drives, assessments, and AI preparation tools. Barred from administrative and billing functions.
- **Platform Super Admin:** Central platform operator accessing `/preritrd/` with MFA, managing colleges, plans, and platform health under Strict Option A.
- **Strict Option A:** Platform isolation architecture where Super Admins have zero visibility or access to institutional academic or student records.
- **Option C:** Dual subscription onboarding policy allowing Super Admins to either pre-assign an approved plan or let the invited Placement Head select a published plan post-registration.
- **DriveFit:** AI-powered semantic matching engine that compares job descriptions with student profiles to calculate alignment scores and identify skill gaps.
- **QuestionBank Sentinel:** Institutional repository for creating, tagging, importing, and auto-assembling balanced question sets for assessments.
- **Mistake-to-Mastery:** Adaptive learning system that categorizes student test errors and schedules spaced repetition remediation cycles.
- **Placement Memory:** Longitudinal analytics engine that stores historical interview experiences, company patterns, and compensation benchmarks.
- **Frozen Entitlement Snapshot:** Immutable record of feature flags and numeric limits captured at the moment of subscription payment, shielding existing subscribers from mid-cycle plan changes.
- **7-Day Renewal Grace Period:** Policy granting existing paying colleges 100% operational access for 7 days post-expiration, accompanied by persistent billing warnings.
- **Emergency Access Override:** Time-bound (1–168 hours) administrative authorization granted by a Super Admin with mandatory audited justification to unlock operational access during critical campus drives.

---

## 27. IMPORTANT CONTEXT AND INSTRUCTIONS FOR THE NEXT CHATGPT ASSISTANT

> [!IMPORTANT]
> **READ THIS BEFORE TAKING ANY ACTION ON THE URPLACED CODEBASE.**  
> You are continuing work on the **UrPlaced** platform as the Lead Architect, Senior Full-Stack Engineer, and Security Specialist. The project has undergone extensive development, architectural refinement, and security verification.

### 27.1 Your Role & Operating Mindset
1. **Act as an Expert Custodian:** Treat the existing codebase with high respect. Never rewrite working modules or refactor working code unless specifically instructed to resolve an explicit defect.
2. **Strict Verification Baseline:** Acknowledge that the project currently boasts **1,203/1,203 passing Vitest tests (101 test files)**, **92/92 passing pgTAP database isolation tests**, **0 TypeScript errors**, and a **clean 97-page Next.js production build (265 total routes)**. Every change you make must maintain this 100% passing baseline.
3. **Preserve All Invariants:** Review Section 25 ("Preserved Architectural Decisions & Immutable Invariants") before proposing or implementing any code changes.

### 27.2 Golden Rules for Assisting the User
- **Design System Fidelity:** Always consult `GEMINI.md` and Section 8 of this report for color tokens, fonts, and spacing. Never invent new hex codes or arbitrarily introduce off-brand styling.
- **Multi-Tenancy & RBAC:** Never compromise the "One Person = One College" rule or Strict Option A isolation. Always ensure database queries and API endpoints verify tenant membership.
- **Fail-Closed Security:** Operational features must always be locked when a college has no subscription or is in `PENDING_PAYMENT`.
- **Billing Segregation:** Never allow `PLACEMENT_STAFF`, `TRAINER`, or `STUDENT` roles to view or download billing invoices or initiate plan changes.
- **No Hallucination:** Every API route, schema table, and utility mentioned in your advice must align with the verified inventory documented in this report.

You are now fully equipped with the complete technical, architectural, and operational context of UrPlaced V1.0. Proceed to assist the user with precision, rigor, and technical excellence.
