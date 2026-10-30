const fs = require('fs');
const path = require('path');

const dbSection = fs.readFileSync('scratch/database-inventory-section.md', 'utf8');

const content = `# UrPlaced — Phase 0 Correction & Verification Addendum
## Codebase Verification, Security Audit & Architectural Evidence

**Document Status:** FINAL AUDIT VERIFICATION ADDENDUM (PHASE 0 SIGN-OFF)  
**Execution Mode:** READ-ONLY AUDIT — ZERO IMPLEMENTATION MUTATIONS  
**Target Repository:** \`C:\\Users\\Ananya\\UrPlaced\`  
**Target Branch:** \`main\`  
**Framework Stack:** Next.js 15.1.12 (App Router), React 19.0.0, TypeScript 5, Supabase (PostgreSQL 15+, Auth, Storage), Vitest 3.2.7, Tailwind CSS 3.4.17.  
**Audit Verification Date:** October 30, 2026  

---

## EXECUTIVE SUMMARY & PHASE 0 READ-ONLY MANDATE

This document constitutes the formal **Phase 0 Correction & Verification Addendum** for the UrPlaced platform. It supplements and hardens the initial audit report (\`docs/audit/UrPlaced_Phase_0_Complete_Application_Audit.md\`) through systematic verification against the local source code, database migrations (\`supabase/migrations/*.sql\`), automated test suites (\`src/test/*.test.ts*\`), and runtime configuration.

In strict compliance with the **READ-ONLY MANDATE**, no application code, UI components, API routes, database records, schema definitions, migrations, RLS policies, environment variables, or production infrastructure were modified during this investigation.

---

## 1. CORRECTIONS & CLARIFICATIONS TO INITIAL REPORT

The initial audit report provided an accurate high-level topology of the application. However, targeted investigation revealed several critical nuances and discrepancies that require explicit correction:

### 1.1 Staff Member Removal: Single-College vs. Global Account Deletion
* **Initial Report Finding:** Reported that \`MembershipService.removeTenantMember\` mutates \`tenant_memberships\`, \`profiles\`, and \`auth.users\`.
* **Verified Local Implementation:** Inspection of \`src/modules/tenancy/services/membership-service.ts\` (lines 377–406) confirms that when a Placement Head removes a staff member, the service executes:
  1. \`DELETE FROM tenant_memberships WHERE id = params.membershipId AND tenant_id = params.tenantId\`
  2. \`DELETE FROM profiles WHERE id = targetUserId\` (unconditionally)
  3. \`admin.auth.admin.deleteUser(targetUserId)\` (unconditionally)
* **Architectural Discrepancy & Multi-College Isolation Hazard:**
  - This implementation enforces **Global Platform Account Deletion**, NOT single-college institutional membership removal.
  - While this was implemented to satisfy an earlier administrative requirement ("remove staff account permanently"), in a multi-tenant platform where a user may legitimately hold active memberships in multiple institutions (e.g., Trainer or Visiting Faculty across College A and College B), this behavior introduces severe cross-tenant collateral damage:
    1. **Global Auth Invalidation:** The user's Supabase Auth credentials are deleted from \`auth.users\`, permanently locking them out of College B.
    2. **PostgreSQL Foreign-Key Cascade:** In \`supabase/migrations/20261018000001_phase03_auth_tenancy_rls.sql\`, \`tenant_memberships.user_id\` references \`auth.users(id) ON DELETE CASCADE\`. Deleting the user in \`auth.users\` triggers an automatic database cascade that deletes the user's membership records in College B as well.
    3. **Constraint Failure Risk:** If College B has records referencing \`profiles(id)\` or \`auth.users(id)\` with \`ON DELETE RESTRICT\` or \`NO ACTION\`, the deletion fails with PostgreSQL error \`23503\` (Foreign Key Violation).
* **Remediation Specification for Phase 1:**
  - Update \`MembershipService.removeTenantMember\` to query remaining active memberships across other tenants: \`SELECT COUNT(*) FROM tenant_memberships WHERE user_id = targetUserId AND tenant_id != params.tenantId\`.
  - If other memberships exist, **only** the \`tenant_memberships\` row for the current college must be deleted.
  - Only when no other memberships exist should platform-level profile archiving or account deletion be permitted.

### 1.2 Route and API Handler Count Reconciliation
* **Initial Report Figures:** 53 pages, 114/115 API routes.
* **Verified Codebase Counts:**
  - **App Router Pages (\`page.tsx\`):** Exactly **53**.
  - **Root & Auth Layouts (\`layout.tsx\`):** Exactly **2** (\`src/app/layout.tsx\` and \`src/app/auth/layout.tsx\`).
  - **Route Handlers (\`route.ts\`):** Exactly **115** (114 handlers located under \`src/app/api/**\` plus 1 auth callback handler located at \`src/app/auth/callback/route.ts\`).
  - **Server Actions:** Exactly **6 inline server actions** located inside \`src/app/dashboard/members/page.tsx\` (\`handleInviteMember\`, \`handleResendInvitation\`, \`handleRevokeInvitation\`, \`handleDeleteInvitation\`, \`handleToggleMemberStatus\`, \`handleRemoveMember\`). No standalone action files exist in the repository.
  - **Edge / Node Middleware:** Exactly **1** (\`src/middleware.ts\`).
  - **Reusable Components:** Exactly **63** components (62 shared components in \`src/components/**\` and 1 page-scoped component in \`src/app/dashboard/members/components/member-row-actions.tsx\`).

---

## 2. EXACT ROUTE, LAYOUT & API INVENTORY RECONCILIATION

### 2.1 Complete App Router Page Inventory (53 Pages)

#### A. Institutional & College Placement Head Portal (20 Pages)
1. \`/dashboard\` — College Overview & Executive Command Center
2. \`/dashboard/analytics\` — Institutional Analytics & Placement Intelligence
3. \`/dashboard/announcements\` — Campus Broadcasts & Communication Center
4. \`/dashboard/assessments\` — Assessment Authoring, Availability & Results
5. \`/dashboard/companies\` — Company Directory & Recruiter Relationships
6. \`/dashboard/companies/new\` — Register Partner Company
7. \`/dashboard/companies/[id]\` — Company Profile & Recruitment History
8. \`/dashboard/drives\` — Recruitment Drives Roster & Scheduling
9. \`/dashboard/drives/new\` — Create Recruitment Drive
10. \`/dashboard/drives/[id]\` — Drive Pipeline, Stages & Candidate Roster
11. \`/dashboard/members\` — Placement Cell Staff Directory, Roles & Invitations
12. \`/dashboard/memory\` — Institutional Placement Memory & Historical Archives
13. \`/dashboard/mistakes\` — Cohort Mistake Analytics & Skill Defect Trends
14. \`/dashboard/questions\` — QuestionBank Sentinel & Repository
15. \`/dashboard/questions/new\` — Author Verified Question
16. \`/dashboard/questions/import\` — Bulk CSV Question Ingestion
17. \`/dashboard/questions/sets\` — Question Sets & Assessment Blueprints
18. \`/dashboard/questions/[id]\` — Question Detail, Revisions & Answer Key Review
19. \`/dashboard/settings/academic\` — Academic Calendar, Batches & Departments
20. \`/dashboard/training\` — Training Sessions & Remediation Workshops

#### B. Student Roster Management (Institutional Role) (4 Pages)
21. \`/dashboard/students\` — Student Roster Directory & Eligibility Filters
22. \`/dashboard/students/new\` — Manually Register Single Student
23. \`/dashboard/students/import\` — Bulk CSV Student Roster Ingestion
24. \`/dashboard/students/[id]\` — Student Profile, Academic Data & Placement Progress

#### C. Student Preparation Portal (10 Pages)
25. \`/dashboard/student\` — Student Preparation Hub & Action Items
26. \`/dashboard/student/tutor\` — AI Conversational Placement Tutor
27. \`/dashboard/student/assessments\` — Available & Assigned Assessments
28. \`/dashboard/student/assessments/[id]/take\` — Timed Assessment Taking Engine
29. \`/dashboard/student/attempts/[attemptId]/review\` — Attempt Performance & Solution Keys
30. \`/dashboard/student/mastery\` — Skill Mastery Radar & Proficiency Tracking
31. \`/dashboard/student/memory\` — Placement Memory Insights & Interview Experiences
32. \`/dashboard/student/mistakes\` — Personal Mistake-to-Mastery Notebook
33. \`/dashboard/student/mistakes/[targetId]\` — Targeted Practice on Flagged Mistakes
34. \`/dashboard/student/analytics\` — Personal Performance Analytics & Benchmark Comparison

#### D. Shared Core & Workspace Switching (3 Pages)
35. \`/dashboard/profile\` — User Profile Settings, Avatars & Credentials
36. \`/dashboard/select-tenant\` — Multi-Tenant College Workspace Selector
37. \`/dashboard/drives/[id]/prep\` — Student Drive Preparation & Interview Readiness

#### E. Authentication & Onboarding (12 Pages)
38. \`/auth/signin\` — Student Sign In Portal
39. \`/auth/signup\` — Student Self-Registration (SRN Roster Claiming)
40. \`/auth/college/signin\` — Placement Head / Staff Sign In Portal
41. \`/auth/college/signup\` — Institution Registration & Placement Head Onboarding
42. \`/auth/forgot-password\` — Password Reset Request
43. \`/auth/reset-password\` — Password Reset Confirmation
44. \`/auth/invite/[token]\` — Student Invitation Claiming
45. \`/auth/college/invite/[token]\` — Institutional Staff Invitation Verification
46. \`/auth/college/invite/accept\` — Staff Invitation Acceptance & Account Setup
47. \`/auth/access-denied\` — Role / Permission Violation Screen
48. \`/auth/membership-suspended\` — Member Suspension Notification
49. \`/auth/tenant-suspended\` — Institutional Account Suspension Screen

#### F. Public & Internal Tools (4 Pages)
50. \`/\` — UrPlaced Public Landing Page
51. \`/design-system\` — Design System Token Showcase & Visual Invariants
52. \`/design-system/architecture\` — Platform Architecture Documentation
53. \`/design-system/status\` — Engineering & Subsystem Status Matrix

---

### 2.2 Complete API Route Inventory (115 Route Handlers)

The 115 API handlers are partitioned into clear functional domains:

| Domain | Route Count | Path Prefix | Core Capabilities |
| :--- | :--- | :--- | :--- |
| **Placement Operations & Administration** | 55 | \`/api/placement/*\` | Companies, Drives, Stages, Candidates, Offers, Training, Academic Settings, Members, Directory, Deletion |
| **Student Preparation & Testing** | 22 | \`/api/student/*\` | Student Dashboard, Assessments, Timed Attempts, Mistake Practice, Mastery Tracking, Behavioral Prep |
| **QuestionBank Sentinel & Smart Sets** | 19 | \`/api/questions/*\` | Banks, Question Authoring, Bulk Review, Duplicate Detection, CSV Ingestion, Auto-Build Sets, Blueprints |
| **AI Intelligence & Copilots** | 6 | \`/api/ai/*\` | Gemini Question Generation, DriveFit Analysis, Mistake Analysis, Placement Insights, AI Tutor Chat |
| **Authentication & Tenancy Handlers** | 5 | \`/api/auth/*\` & \`/auth/callback\` | Colleges Listing, Auth Context Resolution, Invitation Dispatch, Signup Compensation, OAuth Callback |
| **Announcements, Notifications & Profile** | 7 | \`/api/announcements*\`, \`/api/notifications*\`, \`/api/profile*\` | Campus Broadcasts, In-App Notifications, Read States, Profile Update, Avatar Storage Upload |
| **System Health** | 1 | \`/api/health\` | Database & Storage Connectivity Health Probe |

---

## 3. STAFF REMOVAL SAFETY & MULTI-COLLEGE SCENARIOS

### 3.1 Code Inspection of \`removeTenantMember\`
Located at [membership-service.ts](file:///C:/Users/Ananya/UrPlaced/src/modules/tenancy/services/membership-service.ts#L310-L428):

\`\`\`typescript
export async function removeTenantMember(params: {
  membershipId: string;
  tenantId: string;
  actorUserId: string;
  reason?: string;
}): Promise<void> {
  const admin = createAdminClient();

  // 1. Authorize: Actor must be PLACEMENT_HEAD or possess STAFF_MANAGE
  // 2. Fetch target membership strictly scoped by (membershipId, tenantId)
  // 3. Prevent self-removal: targetMember.user_id === params.actorUserId
  // 4. Last Admin Safeguard: activeHeadsCount <= 1 throws error
  // 5. Delete tenant membership:
  await admin.from("tenant_memberships").delete().eq("id", params.membershipId).eq("tenant_id", params.tenantId);
  // 6. Delete profile:
  await admin.from("profiles").delete().eq("id", targetUserId);
  // 7. Delete Supabase Auth account:
  await admin.auth.admin.deleteUser(targetUserId);
}
\`\`\`

### 3.2 Evaluation Against the Two-College Scenario
Consider the scenario where User X (\`user_id: U-123\`) holds two institutional memberships:
- **College A:** Placement Staff (\`membershipId: M-A\`, \`tenant_id: T-A\`)
- **College B:** Trainer (\`membershipId: M-B\`, \`tenant_id: T-B\`)

When College A's Placement Head invokes \`removeTenantMember\` for \`M-A\`:
1. **Intended Isolation Behavior:**
   - \`M-A\` deleted from \`tenant_memberships\`.
   - \`M-B\` in College B remains completely untouched.
   - User X's global profile and authentication credentials remain active so User X can sign in and continue serving College B.
2. **Current Actual Execution Behavior:**
   - \`M-A\` is deleted.
   - \`profiles\` row for \`U-123\` is deleted.
   - \`auth.users\` row for \`U-123\` is deleted.
   - **Resulting Fault:** The Supabase Auth deletion cascades in PostgreSQL to delete \`M-B\` (due to \`ON DELETE CASCADE\` on \`tenant_memberships.user_id\`). User X is entirely erased from College B and cannot log into UrPlaced.

### 3.3 Verified Working Safeguards
1. **Self-Removal Protection:** Verified. An administrator cannot remove their own account (\`targetMember.user_id === params.actorUserId\` throws an exception).
2. **Last Admin Protection:** Verified. If the target is a \`PLACEMENT_HEAD\`, the service counts active heads in the tenant. If \`activeHeadsCount <= 1\`, the operation is aborted.
3. **Cross-Tenant Guard:** Verified. The query enforces \`.eq("id", membershipId).eq("tenant_id", tenantId)\`. College A cannot target a membership belonging to College B.

---

## 4. DETAILED RLS & MULTI-COLLEGE SECURITY EVIDENCE

### 4.1 Row Level Security (RLS) Coverage
- **Total Tables in Database:** **55**
- **Tables with RLS Enabled (\`ENABLE ROW LEVEL SECURITY\`):** **55 (100% Coverage)**
- **Total Security Policies Defined:** **147**
- **Security Definer Helper Functions:**
  - \`public.is_platform_admin(user_id)\`
  - \`public.get_user_active_tenants(p_user_id)\`
  - \`public.is_active_tenant_member(p_tenant_id, p_user_id)\`
  - \`public.is_tenant_admin(p_tenant_id, p_user_id)\`
  - \`public.is_tenant_staff(p_tenant_id, p_user_id)\`
  - \`public.claim_student_roster(p_srn, p_user_id, p_full_name, p_email, p_tenant_id)\`

### 4.2 Storage Security Matrix
- **Bucket:** \`avatars\` (Public: true, Size limit: 2MB, Allowed MIME types: \`['image/jpeg', 'image/png', 'image/webp', 'image/gif']\`).
- **Object Policies:**
  1. \`"Public avatars are viewable by everyone"\`: \`FOR SELECT USING (bucket_id = 'avatars')\`
  2. \`"Users can upload their own avatar"\`: \`FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[2] = auth.uid()::text))\`
  3. \`"Users can update their own avatar"\`: \`FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[2] = auth.uid()::text))\`
  4. \`"Users can delete their own avatar"\`: \`FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND ((storage.foldername(name))[1] = auth.uid()::text OR (storage.foldername(name))[2] = auth.uid()::text))\`

---

## 5. ACTUAL TEST EXECUTION EVIDENCE

### 5.1 Test Suite Inventory
The local repository contains **78 automated test suites** in \`src/test/\` covering unit logic, integration workflows, policy enforcement, multi-college claiming, responsive viewports, and dark mode themes.

### 5.2 Critical Suite Vitest Execution Results
A targeted execution of 5 primary suites was conducted:
\`\`\`bash
npx vitest run \
  src/test/staff-membership-and-removal.test.tsx \
  src/test/dark-mode-and-theme-toggle.test.tsx \
  src/test/multi-college-srn-signup.test.ts \
  src/test/student-srn-claiming.test.ts \
  src/test/ai-question-generation-and-quantity.test.tsx
\`\`\`

**Execution Output:**
\`\`\`text
 RUN  v3.2.7 C:/Users/Ananya/UrPlaced

 ✓ src/test/student-srn-claiming.test.ts (38 tests) 183ms
 ✓ src/test/multi-college-srn-signup.test.ts (11 tests) 133ms
 ✓ src/test/dark-mode-and-theme-toggle.test.tsx (18 tests) 316ms
 ✓ src/test/ai-question-generation-and-quantity.test.tsx (7 tests) 669ms
 ✓ src/test/staff-membership-and-removal.test.tsx (15 tests) 769ms

 Test Files  5 passed (5)
      Tests  89 passed (89)
   Start at  07:01:19
   Duration  99.35s
\`\`\`
**Result:** **100% Pass Rate** across all 89 executed test assertions.

### 5.3 Static Analysis & Linter Verification
- **ESLint (\`npm run lint\`):** Exited with code \`0\`.
  - Exactly 1 non-blocking hook warning: \`./src/app/dashboard/page.tsx:102:6 Warning: React Hook React.useEffect has a missing dependency: 'auth'\`.
- **TypeScript Compiler Check (\`npx tsc --noEmit\`):**
  - **Identified Finding:** \`src/app/auth/signin/page.tsx\` had its entire implementation commented out with \`//\` in the local working tree, producing \`TS2306: File is not a module\`.
  - In accordance with read-only rules, this file was inspected but not modified. Restoring its uncommented state from git history eliminates the error.

---

## 6. COMPLETE DATABASE SCHEMA INVENTORY (ALL 55 TABLES)

Below is the verified schema inventory for all 55 database tables declared across migrations \`20261018000001\` through \`20261028000002\`:

${dbSection}

---

## 7. STRENGTHENED RECRUITMENT WORKFLOW ACCEPTANCE CRITERIA

To guarantee absolute data integrity and student equity across colleges, all recruitment workflows must satisfy these strict server-side safeguards:

### 7.1 Student Drive Discovery
- Students query drives via \`/api/placement/drives\` or dedicated student endpoints.
- **Tenant Isolation:** Query must strictly enforce \`tenant_id = ctx.tenantId\`.
- **Status Filter:** Only drives with status \`PUBLISHED\` or \`REGISTRATION_OPEN\` must be visible to students. Draft or archived drives must return empty arrays.

### 7.2 Server-Side Eligibility Verification
- Client-side checks are strictly advisory UI indicators.
- When an application is submitted (\`POST /api/placement/drives/[id]/candidates\`), \`CandidateService.registerCandidate\` executes \`EligibilityEngine.evaluate(student, criteria)\` on the server.
- Verifies:
  1. Minimum CGPA threshold
  2. Maximum allowable active backlogs
  3. Maximum allowable historical backlogs
  4. Permitted department codes
  5. Matching graduation/academic year

### 7.3 Application Registration Safeguards
1. **Deadline Check:** \`drive.registration_deadline\` is validated against current server time (\`new Date() > new Date(drive.registration_deadline)\`). Expired windows reject with HTTP 400.
2. **Duplicate Application Prevention:** Database unique constraint on \`drive_applications(tenant_id, drive_id, student_id)\` catches duplicates (PostgreSQL error \`23505\`), returning a user-friendly error.
3. **Institutional Boundary Check:** The student record must exist within \`ctx.tenantId\`. Cross-tenant candidate registration is impossible.

### 7.4 Stage Progression & Status Governance
1. **Role Enforcement:** Only users with \`DRIVES_MANAGE\` or \`OUTCOMES_MANAGE\` can advance candidates or record evaluation results.
2. **Sequential Flow:** Advancement from Stage $N$ automatically initializes Stage $N+1$ with status \`PENDING\`.
3. **Data Masking:** Placement staff internal notes (\`internal_notes\`) are stripped from payloads delivered to students (\`internal_notes: undefined\`).

### 7.5 Placement Offer Recording & Acceptance
1. **Compensation Tracking:** Captures CTC (\`compensation_amount\`), stipend, currency, and bonus details in \`placement_offers\`.
2. **Policy Enforcement:** Institutional policies (single-offer dream company rule, multiple offer allowance) are governed server-side before an offer is finalized.

---

## 8. OPTIONAL ENHANCEMENTS VS. REQUIRED CORE FEATURES

To provide crystal-clear scope boundaries for Phase 1 execution, existing backlog items are classified into **Mandatory Core Requirements** and **Optional P3 Enhancements**:

| Feature Item | Classification | Rationale |
| :--- | :--- | :--- |
| **Scoping Staff Removal to Single College** | **MANDATORY (P0)** | Essential multi-tenant isolation requirement; prevents cross-college account deletion. |
| **Student Drive Discovery & Self-Apply** | **MANDATORY (P1)** | Primary student functional capability in recruitment workflow. |
| **Server-Side Offer Acceptance / Rejection** | **MANDATORY (P1)** | Closes the loop on candidate selection and institutional reporting. |
| **Dedicated Student Announcement Archive Page** | **ENHANCEMENT (P3)** | Students already receive live notifications; a full archive page is a secondary convenience. |
| **Rich Text Editor for Job Descriptions** | **ENHANCEMENT (P3)** | Plain-text / markdown descriptions currently function reliably. |
| **Bulk Offer Letter PDF Generation** | **ENHANCEMENT (P3)** | Nice-to-have automation; manual tracking via dashboard is fully operational. |

---

## 9. REMAINING UNVERIFIED ITEMS & RUNTIME LIMITATIONS

In keeping with Phase 0 audit standards, the following limitation is explicitly documented:

- **Live Two-College Interactive Session In-Flight Verification:**  
  While all multi-tenant RLS policies, unique constraints, and claiming RPCs have been verified via migrations, service logic, and automated Vitest integration suites, **live end-to-end interactive verification using two real concurrent user browser sessions against a multi-college staging database** cannot be performed in read-only audit mode without provisioning test tenant data. This will be the first verification step executed upon commencing Phase 1 in an active testing environment.

---

## 10. UPDATED SEVERITY & PRIORITY REGISTER

| Severity | Issue Description | Location | Remediation Phase |
| :--- | :--- | :--- | :--- |
| **P0 - Critical** | \`removeTenantMember\` deletes global auth account and profile, affecting cross-college users | \`src/modules/tenancy/services/membership-service.ts\` | Phase 1 (First Priority) |
| **P1 - High** | \`src/app/auth/signin/page.tsx\` commented out in working tree causing \`TS2306\` compile error | \`src/app/auth/signin/page.tsx\` | Phase 1 (Immediate uncomment) |
| **P1 - High** | Student portal lacks direct self-service application submission UI for published drives | \`src/app/dashboard/student/*\` | Phase 1 |
| **P2 - Medium** | Placement Head dashboard missing hook dependency in \`useEffect\` | \`src/app/dashboard/page.tsx:102\` | Phase 1 |
| **P3 - Low** | Add dedicated Student Announcements Archive page | \`src/app/dashboard/student/announcements\` | Phase 2 |

---

## AUDIT SIGN-OFF & CONCLUSION

Phase 0 verification is now complete. The architecture, route topology, database schema, security policies, and test suite baseline of UrPlaced have been documented with local evidence.

**Phase 0 is marked as FINALIZED. All further activities require explicit user instruction to transition into Phase 1 implementation.**
`;

fs.writeFileSync('docs/audit/UrPlaced_Phase_0_Correction_Addendum.md', content);
console.log('Successfully wrote docs/audit/UrPlaced_Phase_0_Correction_Addendum.md!');
