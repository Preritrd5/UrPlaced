# Phase 03 — Roles & Permissions Matrix

This document defines the authorization model, role hierarchy, permission catalog, and enforcement mechanisms for **UrPlaced**, adhering to the modular monolith architecture established in Phase 01.

---

## 1. System Roles Overview

UrPlaced operates on a hybrid **RBAC (Role-Based Access Control) + Scoped Tenancy Context** model:

| Role Identifier | Display Name | Scope | Description |
| :--- | :--- | :--- | :--- |
| `SUPER_ADMIN` | Platform Super Admin | Global (System-wide) | System owner across all tenants. Manages tenant lifecycles, global settings, and audit logs. |
| `COLLEGE_SUPER_ADMIN` | Placement Head | Tenant-scoped | College authority with full control over college settings, coordinators, student rosters, drives, and invitation dispatch. |
| `PLACEMENT_OFFICER` | Placement Coordinator | Tenant-scoped | Staff member managing drives, eligibility evaluations, verification queues, and cohorts. |
| `TRAINER` | Faculty / Trainer | Tenant-scoped | Content creator and cohort evaluator. Configures learning tracks, mock tests, and evaluates performance. |
| `STUDENT` | Candidate / Student | Tenant-scoped | End user taking assessments, tracking placement eligibility, viewing DriveFit readiness, and logging mistake reflections. |

---

## 2. Resource Domains & Permissions Catalog

Permissions are structured as `<domain>:<action>` pairs and registered in [`src/modules/identity-access/services/policy-engine.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/identity-access/services/policy-engine.ts).

### Domain 1: Tenant Management (`tenants:*`)
- `tenants:read_global` — View all colleges and platform metrics.
- `tenants:create` — Provision a new college tenant workspace.
- `tenants:update_status` — Change tenant lifecycle status (`ACTIVE`, `SUSPENDED`, `ARCHIVED`).
- `tenants:manage_settings` — Configure tenant branding, academic years, and departments.
- `tenants:read_scoped` — View current college profile and active settings.

### Domain 2: Identity & Memberships (`members:*`)
- `members:read` — View members of the current tenant.
- `members:invite` — Dispatch invitations to staff or students.
- `members:update_role` — Modify member roles within the tenant.
- `members:suspend` — Suspend or deactivate a member's access to the tenant.
- `members:remove` — Remove a member from the college workspace.

### Domain 3: Student Profiles & Batches (`students:*`)
- `students:import_bulk` — Upload CSV rosters for bulk registration and cohort assignment.
- `students:read_roster` — View full student rosters and academic metrics.
- `students:read_profile` — View individual student profile and readiness data.
- `students:edit_own_profile` — Update self-managed contact details and resumes.

### Domain 4: Recruitment Drives & Eligibility (`drives:*`)
- `drives:create` — Create recruitment opportunities and criteria.
- `drives:read_all` — View all drives configured for the tenant.
- `drives:read_eligible` — View drives for which the student is marked eligible.
- `drives:override_eligibility` — Manually adjust student eligibility with recorded rationale.

### Domain 5: Question Bank Sentinel (`questions:*`)
- `questions:create` — Create or import question sets.
- `questions:review` — Approve, flag, or modify questions in the review queue.
- `questions:read_bank` — Browse approved college question repository.

### Domain 6: Assessments & Proctoring (`assessments:*`)
- `assessments:create` — Schedule assessments and mock tests.
- `assessments:take` — Attempt an active assessment session.
- `assessments:grade` — Review student submissions and proctoring telemetry.

### Domain 7: Mistake Bank & Learning (`mistakes:*`)
- `mistakes:read_own` — View personal mistake bank and flagged tags.
- `mistakes:log_reflection` — Add root-cause explanations and study notes.
- `mistakes:generate_retest` — Trigger targeted retest assessments.

### Domain 8: Analytics & Audit (`analytics:*`, `audit:*`)
- `analytics:read_cohort` — View aggregate batch performance and placement statistics.
- `analytics:read_student` — View detailed drill-down report for an individual student.
- `audit:read_global` — Read immutable platform audit trail across all tenants.
- `audit:read_tenant` — Read scoped audit events for the active tenant.

---

## 3. Comprehensive Role-Permission Matrix

| Permission | `SUPER_ADMIN` | `COLLEGE_SUPER_ADMIN` | `PLACEMENT_OFFICER` | `TRAINER` | `STUDENT` |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `tenants:read_global` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `tenants:create` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `tenants:update_status` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `tenants:manage_settings` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `tenants:read_scoped` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `members:read` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `members:invite` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `members:update_role` | ✅ | ✅ (staff/student only) | ❌ | ❌ | ❌ |
| `members:suspend` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `students:import_bulk` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `students:read_roster` | ✅ | ✅ | ✅ | ✅ (assigned cohorts) | ❌ |
| `students:read_profile` | ✅ | ✅ | ✅ | ✅ | ✅ (self only) |
| `students:edit_own_profile` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `drives:create` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `drives:read_all` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `drives:read_eligible` | ❌ | ✅ | ✅ | ✅ | ✅ |
| `drives:override_eligibility` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `questions:create` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `questions:review` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `questions:read_bank` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `assessments:create` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `assessments:take` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `assessments:grade` | ❌ | ✅ | ✅ | ✅ | ❌ |
| `mistakes:read_own` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `mistakes:log_reflection` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `mistakes:generate_retest` | ❌ | ❌ | ❌ | ❌ | ✅ |
| `analytics:read_cohort` | ✅ | ✅ | ✅ | ✅ (assigned cohorts) | ❌ |
| `analytics:read_student` | ✅ | ✅ | ✅ | ✅ | ✅ (self only) |
| `audit:read_global` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `audit:read_tenant` | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 4. Policy Engine Implementation

Authorization logic is centralized in [`src/modules/identity-access/services/policy-engine.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/identity-access/services/policy-engine.ts) via the `can()` policy evaluation function:

```typescript
export interface PolicyContext {
  userId: string;
  isPlatformAdmin: boolean;
  activeTenantId?: string;
  activeTenantRole?: TenantRole;
  isTenantActive?: boolean;
}

export function can(
  ctx: PolicyContext,
  permission: Permission,
  resource?: { tenantId?: string; ownerId?: string }
): boolean
```

### Invariants Enforced by `can()`:
1. **Deny-by-default:** Any unrecognized role, expired session, or unmapped action returns `false`.
2. **Platform Super Admin Global Override:** `isPlatformAdmin === true` bypasses tenant-scoped restrictions for administrative and audit operations, but cannot impersonate a student in assessment evaluation.
3. **Tenant Inactivity Lockdown:** If `ctx.isTenantActive === false`, all tenant-scoped operations are immediately rejected with `SUSPENDED_TENANT`.
4. **Tenant Boundary Enforcement:** If `resource?.tenantId` is supplied and does not match `ctx.activeTenantId`, access is denied (preventing IDOR).
5. **Self-Ownership Guards:** Actions requiring ownership (such as `students:edit_own_profile` and `mistakes:read_own`) verify `resource?.ownerId === ctx.userId`.

---

## 5. Privilege Escalation Prevention

To prevent vertical and horizontal privilege escalation:
1. **No Self-Role Granting:** Users cannot modify their own role or upgrade their permissions.
2. **Role Hierarchy Boundary:** A `COLLEGE_SUPER_ADMIN` can only invite or assign roles up to `PLACEMENT_OFFICER`, `TRAINER`, or `STUDENT`. They cannot grant `SUPER_ADMIN` or create another `COLLEGE_SUPER_ADMIN` unless explicitly authorized.
3. **Platform Super Admin Isolation:** `SUPER_ADMIN` status is not stored in regular tenant membership rows; it is determined by the `is_platform_admin` column in the protected `profiles` table.
4. **Token Verification at Rest:** All invitation tokens are hashed with SHA-256 before persistence. Plaintext tokens exist only in generated acceptance URLs sent via transactional emails.
