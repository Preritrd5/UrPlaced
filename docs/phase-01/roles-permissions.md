# Roles, Permissions & Access Control Specification — UrPlaced V1.0

**Product:** UrPlaced — Multi-College Placement Preparation & Management SaaS  
**Phase:** 01 — Product Blueprint & Architecture  
**Status:** Approved Specification  

---

## 1. Authorization Philosophy & Core Model

UrPlaced employs a hybrid **Attribute-Based and Scoped Role-Based Access Control (Scoped RBAC / ABAC)** model. 

### Core Invariants:
1. **Tenant Context Is Invariant:** No user action is permitted without an authenticated, active tenant context (except for Platform Super Admin platform-level maintenance).
2. **Deny-by-Default:** Any action, resource, or context lacking explicit permission evaluation is immediately denied.
3. **No UI-Driven Security:** Hiding buttons or navigation links is an ergonomics feature, never a security boundary. Every API route handler, Server Action, and domain service must independently verify permissions.
4. **Data Ownership Scoping:** Even if a user has `results.read_own`, they can never access another student's attempts or personal Mistake Bank.

---

## 2. System Roles & Scopes

| Role | Scope | Description & Boundary |
| :--- | :--- | :--- |
| **Platform Super Admin** | Global Platform | Provisions tenants, configures platform quotas, monitors infrastructure health. **Has NO routine access to student data or college-private questions.** Support access requires an explicit, audited elevation procedure. |
| **College Placement Head** | College Tenant | Chief institutional administrator. Manages placement policies, staff permissions, drive configurations, eligibility rules, question banks, and institutional analytics. |
| **Placement Staff / Coordinator** | College Tenant (Scoped) | Operational placement team members assigned specific functional permissions (e.g., student roster import, assessment scheduling, question review, or drive management). |
| **Trainer / Faculty** | Assigned Cohorts / Courses | Learning specialists. Manages assigned training modules, cohorts, and diagnostic tests. Cannot modify placement drives, view sensitive compensation packages, or access students outside assigned batches. |
| **Student** | Personal Record | Enrolled candidate. Accesses assigned drives, views personal eligibility results, takes assessments, manages personal Mistake Bank, updates verified profile details. |
| **System Background Worker** | Scoped Service Identity | Automated workers for imports, document parsing, AI extraction, and notification dispatch. Executes under scoped tenant tokens with full audit attribution. |

---

## 3. Granular Permission Identifiers Inventory

Permissions are defined as string constants in the format `<domain>.<action>`. Hardcoded role names must never be evaluated directly in business logic.

### Complete Permission Register:

```typescript
export const Permissions = {
  // Tenancy & Platform Administration
  TENANT_CREATE: 'tenant.create',
  TENANT_MANAGE: 'tenant.manage',
  TENANT_SUSPEND: 'tenant.suspend',
  TENANT_LIMITS_MANAGE: 'tenant.limits.manage',
  PLATFORM_HEALTH_READ: 'platform.health.read',
  SUPPORT_ELEVATION_REQUEST: 'support.elevation.request',

  // Staff & Role Governance
  STAFF_MANAGE: 'staff.manage',
  STAFF_ROLES_ASSIGN: 'staff.roles.assign',
  STAFF_PERMISSIONS_OVERRIDE: 'staff.permissions.override',

  // Student Administration & Ingestion
  STUDENTS_READ: 'students.read',
  STUDENTS_IMPORT: 'students.import',
  STUDENTS_EDIT: 'students.edit',
  STUDENTS_ARCHIVE: 'students.archive',
  ACADEMIC_RECORDS_UPDATE: 'academic_records.update',

  // Companies & Recruitment Drives
  COMPANIES_MANAGE: 'companies.manage',
  DRIVES_MANAGE: 'drives.manage',
  DRIVES_PUBLISH: 'drives.publish',
  DRIVES_VIEW_INTERNAL: 'drives.view_internal',
  DRIVE_SOURCES_ATTACH: 'drive.sources.attach',
  DRIVE_SOURCES_VERIFY: 'drive.sources.verify',

  // Eligibility Evaluation
  ELIGIBILITY_RULES_MANAGE: 'eligibility.rules.manage',
  ELIGIBILITY_EVALUATE: 'eligibility.evaluate',
  ELIGIBILITY_OVERRIDE_MANUAL: 'eligibility.override_manual',
  ELIGIBILITY_READ_COHORT: 'eligibility.read_cohort',
  ELIGIBILITY_READ_OWN: 'eligibility.read_own',

  // QuestionBank Sentinel & Content
  QUESTIONS_CREATE: 'questions.create',
  QUESTIONS_IMPORT: 'questions.import',
  QUESTIONS_REVIEW: 'questions.review',
  QUESTIONS_PUBLISH: 'questions.publish',
  QUESTIONS_ARCHIVE: 'questions.archive',
  QUESTION_SETS_MANAGE: 'question_sets.manage',

  // Assessments & Code Runner
  ASSESSMENTS_CREATE: 'assessments.create',
  ASSESSMENTS_PUBLISH: 'assessments.publish',
  ASSESSMENTS_ASSIGN: 'assessments.assign',
  ASSESSMENTS_ATTEMPT: 'assessments.attempt',
  ASSESSMENTS_GRADE_MANUAL: 'assessments.grade_manual',

  // Results & Mistake Bank
  RESULTS_READ_OWN: 'results.read_own',
  RESULTS_READ_COHORT: 'results.read_cohort',
  MISTAKE_BANK_MANAGE_OWN: 'mistake_bank.manage_own',
  MASTERY_RETEST_TRIGGER: 'mastery.retest_trigger',

  // Training & Structured Peer Coordination
  TRAINING_MANAGE: 'training.manage',
  TRAINING_ATTENDANCE_RECORD: 'training.attendance.record',
  PEER_PRACTICE_SCHEDULE: 'peer_practice.schedule',

  // Placement Memory & Moderation
  PLACEMENT_MEMORY_READ: 'placement_memory.read',
  CANDIDATE_REPORT_SUBMIT: 'candidate_report.submit',
  CANDIDATE_REPORT_MODERATE: 'candidate_report.moderate',

  // Reports, Exports & Audit
  REPORTS_EXPORT_COHORT: 'reports.export_cohort',
  REPORTS_EXPORT_EXECUTIVE: 'reports.export_executive',
  AUDIT_LOG_READ: 'audit_log.read',
} as const;
```

---

## 4. Role vs. Permission Matrix

| Permission Identifier | Platform Super Admin | College Placement Head | Placement Coordinator | Trainer / Faculty | Student |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `tenant.manage` | **Yes** | No | No | No | No |
| `tenant.limits.manage` | **Yes** | No | No | No | No |
| `platform.health.read` | **Yes** | No | No | No | No |
| `staff.manage` | No* | **Yes** | No | No | No |
| `students.read` | No* | **Yes** | **Yes** | Assigned Only | Self Only |
| `students.import` | No* | **Yes** | Configurable | No | No |
| `drives.manage` | No* | **Yes** | Configurable | No | No |
| `drives.publish` | No* | **Yes** | Configurable | No | No |
| `drive.sources.verify` | No* | **Yes** | Configurable | No | No |
| `eligibility.rules.manage` | No* | **Yes** | Configurable | No | No |
| `eligibility.evaluate` | No* | **Yes** | **Yes** | No | No |
| `eligibility.override_manual` | No* | **Yes** | No | No | No |
| `eligibility.read_own` | No | No | No | No | **Yes** |
| `questions.create` | No | **Yes** | **Yes** | **Yes** | No |
| `questions.review` | No | **Yes** | **Yes** | No | No |
| `questions.publish` | No | **Yes** | Configurable | No | No |
| `assessments.create` | No | **Yes** | **Yes** | Assigned Only | No |
| `assessments.attempt` | No | No | No | No | **Yes** |
| `results.read_own` | No | No | No | No | **Yes** |
| `results.read_cohort` | No* | **Yes** | **Yes** | Assigned Only | No |
| `mistake_bank.manage_own` | No | No | No | No | **Yes** |
| `training.manage` | No | **Yes** | **Yes** | Assigned Only | No |
| `candidate_report.moderate` | No | **Yes** | **Yes** | No | No |
| `candidate_report.submit` | No | No | No | No | **Yes** |
| `reports.export_cohort` | No* | **Yes** | Configurable | No | No |
| `audit_log.read` | Platform Only | **Yes** | No | No | No |

*\*Note: Platform Super Admin does not possess tenant operational permissions by default. Access to tenant data requires audited emergency support elevation.*

---

## 5. Formal Policy Evaluation Specification

Authorization decisions are mediated exclusively through the domain policy function `can()`:

```typescript
interface PolicyContext {
  userId: string;
  tenantId: string;
  roles: string[];
  permissions: Set<string>;
  assignedBatchIds?: string[];
  assignedCourseIds?: string[];
}

interface Resource {
  resourceType: string;
  tenantId: string;
  ownerId?: string;
  batchId?: string;
  assignedTrainerId?: string;
}

export function can(
  ctx: PolicyContext,
  action: string,
  resource?: Resource
): boolean {
  // 1. Invariant: Action must be in granted permissions
  if (!ctx.permissions.has(action)) {
    return false;
  }

  // If no specific resource instance, permission presence suffices
  if (!resource) {
    return true;
  }

  // 2. Invariant: Strict Tenant Match
  if (resource.tenantId !== ctx.tenantId) {
    return false;
  }

  // 3. Resource Ownership / Scoping Rules
  switch (action) {
    case Permissions.RESULTS_READ_OWN:
    case Permissions.MISTAKE_BANK_MANAGE_OWN:
      return resource.ownerId === ctx.userId;

    case Permissions.STUDENTS_READ:
    case Permissions.RESULTS_READ_COHORT:
      // If Trainer, verify batch/course assignment
      if (ctx.roles.includes('TRAINER')) {
        return !!(resource.batchId && ctx.assignedBatchIds?.includes(resource.batchId));
      }
      return true;

    case Permissions.ASSESSMENTS_CREATE:
      if (ctx.roles.includes('TRAINER')) {
        return resource.assignedTrainerId === ctx.userId;
      }
      return true;

    default:
      return true;
  }
}
```

---

## 6. Super Admin Emergency Support Protocol

To uphold tenant data privacy and regulatory compliance:
1. **No Routine Access:** Platform Super Admin accounts cannot browse or query college tenant student records, question banks, or marks.
2. **Elevation Request Workflow:**
   - Super Admin submits a formal Elevation Ticket stating the target `tenantId`, specific `reason` (e.g., critical data ingestion bug, corrupted drive state), and requested duration (max 4 hours).
   - The College Placement Head receives a real-time notification with one-click approval or auto-approval rules for critical severity.
   - An ephemeral, time-bounded session token is minted.
3. **Comprehensive Audit Recording:**
   - Every database query, record view, and action executed during elevated sessions is recorded in a tamper-resistant security audit log with actor ID, IP address, exact payload, and timestamp.
