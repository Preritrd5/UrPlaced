/**
 * Policy Engine & Scoped RBAC Permissions Registry
 * Enforces deny-by-default authorization based on role, tenant membership, and resource scope.
 */

export const Permissions = {
  // Platform Administration
  TENANT_CREATE: "tenant.create",
  TENANT_MANAGE: "tenant.manage",
  TENANT_SUSPEND: "tenant.suspend",
  TENANT_REACTIVATE: "tenant.reactivate",
  PLATFORM_HEALTH_READ: "platform.health.read",

  // Staff & Role Governance
  STAFF_MANAGE: "staff.manage",
  STAFF_INVITE: "staff.invite",
  STAFF_ROLES_ASSIGN: "staff.roles.assign",

  // Student Administration
  STUDENTS_READ: "students.read",
  STUDENTS_IMPORT: "students.import",
  STUDENTS_EXPORT: "students.export",
  STUDENTS_EDIT: "students.edit",
  STUDENTS_ARCHIVE: "students.archive",

  // Academic Structure
  ACADEMIC_YEARS_MANAGE: "academic_years.manage",
  DEPARTMENTS_MANAGE: "departments.manage",

  // Companies & Recruitment Drives
  COMPANIES_MANAGE: "companies.manage",
  COMPANIES_READ: "companies.read",
  DRIVES_MANAGE: "drives.manage",
  DRIVES_PUBLISH: "drives.publish",
  DRIVES_VIEW_INTERNAL: "drives.view_internal",

  // Candidate Registration & Stages
  CANDIDATES_REGISTER: "candidates.register",
  STAGES_MANAGE: "stages.manage",

  // Outcomes & Offers
  OUTCOMES_MANAGE: "outcomes.manage",
  OUTCOMES_READ_OWN: "outcomes.read_own",

  // Reports & Dashboard
  DASHBOARD_READ: "dashboard.read",
  REPORTS_EXPORT: "reports.export",

  // Eligibility
  ELIGIBILITY_RULES_MANAGE: "eligibility.rules.manage",
  ELIGIBILITY_EVALUATE: "eligibility.evaluate",
  ELIGIBILITY_READ_OWN: "eligibility.read_own",

  // QuestionBank Sentinel & Assessments
  QUESTIONS_CREATE: "questions.create",
  QUESTIONS_MANAGE: "questions.manage",
  QUESTIONS_REVIEW: "questions.review",
  QUESTIONS_PUBLISH: "questions.publish",
  QUESTIONS_IMPORT: "questions.import",
  QUESTIONS_EXPORT: "questions.export",
  QUESTION_SETS_MANAGE: "question_sets.manage",
  QUESTION_SETS_READ: "question_sets.read",
  ASSESSMENTS_CREATE: "assessments.create",
  ASSESSMENTS_ATTEMPT: "assessments.attempt",

  // Results & Mistake Bank
  RESULTS_READ_OWN: "results.read_own",
  RESULTS_READ_COHORT: "results.read_cohort",
  MISTAKE_BANK_MANAGE_OWN: "mistake_bank.manage_own",

  // Training & Audit
  TRAINING_MANAGE: "training.manage",
  AUDIT_LOG_READ: "audit_log.read",

  // DriveFit & Recruitment Intelligence
  INTELLIGENCE_SOURCES_MANAGE: "intelligence.sources.manage",
  INTELLIGENCE_SOURCES_READ: "intelligence.sources.read",
  INTELLIGENCE_REQUIREMENTS_MANAGE: "intelligence.requirements.manage",
  INTELLIGENCE_REQUIREMENTS_VERIFY: "intelligence.requirements.verify",
  INTELLIGENCE_PUBLISH: "intelligence.publish",
  INTELLIGENCE_MAPPINGS_MANAGE: "intelligence.mappings.manage",
  DRIVEFIT_PLAN_MANAGE_OWN: "drivefit.plan.manage_own",
  DRIVEFIT_READ_PUBLISHED: "drivefit.read_published",
  EXPERIENCE_REPORTS_MODERATE: "experience_reports.moderate",
  EXPERIENCE_REPORTS_SUBMIT: "experience_reports.submit",
} as const;

export type PermissionIdentifier =
  (typeof Permissions)[keyof typeof Permissions];

export type UserRole =
  | "SUPER_ADMIN"
  | "PLACEMENT_HEAD"
  | "PLACEMENT_STAFF"
  | "TRAINER"
  | "STUDENT";

export const RoleDefaultPermissions: Record<UserRole, PermissionIdentifier[]> = {
  SUPER_ADMIN: [
    Permissions.TENANT_CREATE,
    Permissions.TENANT_MANAGE,
    Permissions.TENANT_SUSPEND,
    Permissions.TENANT_REACTIVATE,
    Permissions.PLATFORM_HEALTH_READ,
    Permissions.AUDIT_LOG_READ,
    Permissions.DASHBOARD_READ,
    Permissions.REPORTS_EXPORT,
    Permissions.INTELLIGENCE_SOURCES_READ,
    Permissions.DRIVEFIT_READ_PUBLISHED,
    Permissions.QUESTIONS_MANAGE,
    Permissions.QUESTIONS_CREATE,
    Permissions.QUESTIONS_REVIEW,
    Permissions.QUESTIONS_PUBLISH,
    Permissions.QUESTIONS_IMPORT,
    Permissions.QUESTIONS_EXPORT,
    Permissions.QUESTION_SETS_MANAGE,
    Permissions.QUESTION_SETS_READ,
  ],
  PLACEMENT_HEAD: [
    Permissions.STAFF_MANAGE,
    Permissions.STAFF_INVITE,
    Permissions.STAFF_ROLES_ASSIGN,
    Permissions.DASHBOARD_READ,
    Permissions.ACADEMIC_YEARS_MANAGE,
    Permissions.DEPARTMENTS_MANAGE,
    Permissions.COMPANIES_MANAGE,
    Permissions.COMPANIES_READ,
    Permissions.STUDENTS_READ,
    Permissions.STUDENTS_IMPORT,
    Permissions.STUDENTS_EXPORT,
    Permissions.STUDENTS_EDIT,
    Permissions.STUDENTS_ARCHIVE,
    Permissions.DRIVES_MANAGE,
    Permissions.DRIVES_PUBLISH,
    Permissions.DRIVES_VIEW_INTERNAL,
    Permissions.CANDIDATES_REGISTER,
    Permissions.STAGES_MANAGE,
    Permissions.OUTCOMES_MANAGE,
    Permissions.REPORTS_EXPORT,
    Permissions.ELIGIBILITY_RULES_MANAGE,
    Permissions.ELIGIBILITY_EVALUATE,
    Permissions.QUESTIONS_CREATE,
    Permissions.QUESTIONS_MANAGE,
    Permissions.QUESTIONS_REVIEW,
    Permissions.QUESTIONS_PUBLISH,
    Permissions.QUESTIONS_IMPORT,
    Permissions.QUESTIONS_EXPORT,
    Permissions.QUESTION_SETS_MANAGE,
    Permissions.QUESTION_SETS_READ,
    Permissions.ASSESSMENTS_CREATE,
    Permissions.RESULTS_READ_COHORT,
    Permissions.TRAINING_MANAGE,
    Permissions.AUDIT_LOG_READ,
    Permissions.INTELLIGENCE_SOURCES_MANAGE,
    Permissions.INTELLIGENCE_SOURCES_READ,
    Permissions.INTELLIGENCE_REQUIREMENTS_MANAGE,
    Permissions.INTELLIGENCE_REQUIREMENTS_VERIFY,
    Permissions.INTELLIGENCE_PUBLISH,
    Permissions.INTELLIGENCE_MAPPINGS_MANAGE,
    Permissions.DRIVEFIT_READ_PUBLISHED,
    Permissions.EXPERIENCE_REPORTS_MODERATE,
  ],
  PLACEMENT_STAFF: [
    Permissions.STAFF_INVITE,
    Permissions.DASHBOARD_READ,
    Permissions.COMPANIES_MANAGE,
    Permissions.COMPANIES_READ,
    Permissions.STUDENTS_READ,
    Permissions.STUDENTS_IMPORT,
    Permissions.STUDENTS_EXPORT,
    Permissions.STUDENTS_EDIT,
    Permissions.DRIVES_MANAGE,
    Permissions.DRIVES_PUBLISH,
    Permissions.DRIVES_VIEW_INTERNAL,
    Permissions.CANDIDATES_REGISTER,
    Permissions.STAGES_MANAGE,
    Permissions.OUTCOMES_MANAGE,
    Permissions.ELIGIBILITY_EVALUATE,
    Permissions.QUESTIONS_CREATE,
    Permissions.QUESTIONS_MANAGE,
    Permissions.QUESTIONS_REVIEW,
    Permissions.QUESTIONS_PUBLISH,
    Permissions.QUESTIONS_IMPORT,
    Permissions.QUESTIONS_EXPORT,
    Permissions.QUESTION_SETS_MANAGE,
    Permissions.QUESTION_SETS_READ,
    Permissions.ASSESSMENTS_CREATE,
    Permissions.RESULTS_READ_COHORT,
    Permissions.INTELLIGENCE_SOURCES_MANAGE,
    Permissions.INTELLIGENCE_SOURCES_READ,
    Permissions.INTELLIGENCE_REQUIREMENTS_MANAGE,
    Permissions.INTELLIGENCE_REQUIREMENTS_VERIFY,
    Permissions.INTELLIGENCE_PUBLISH,
    Permissions.INTELLIGENCE_MAPPINGS_MANAGE,
    Permissions.DRIVEFIT_READ_PUBLISHED,
    Permissions.EXPERIENCE_REPORTS_MODERATE,
  ],
  TRAINER: [
    Permissions.DASHBOARD_READ,
    Permissions.STUDENTS_READ,
    Permissions.COMPANIES_READ,
    Permissions.QUESTIONS_CREATE,
    Permissions.QUESTIONS_MANAGE,
    Permissions.QUESTIONS_REVIEW,
    Permissions.QUESTION_SETS_MANAGE,
    Permissions.QUESTION_SETS_READ,
    Permissions.ASSESSMENTS_CREATE,
    Permissions.RESULTS_READ_COHORT,
    Permissions.TRAINING_MANAGE,
    Permissions.INTELLIGENCE_SOURCES_READ,
    Permissions.DRIVEFIT_READ_PUBLISHED,
  ],
  STUDENT: [
    Permissions.DASHBOARD_READ,
    Permissions.COMPANIES_READ,
    Permissions.ELIGIBILITY_READ_OWN,
    Permissions.CANDIDATES_REGISTER,
    Permissions.OUTCOMES_READ_OWN,
    Permissions.QUESTION_SETS_READ,
    Permissions.ASSESSMENTS_ATTEMPT,
    Permissions.RESULTS_READ_OWN,
    Permissions.MISTAKE_BANK_MANAGE_OWN,
    Permissions.DRIVEFIT_READ_PUBLISHED,
    Permissions.DRIVEFIT_PLAN_MANAGE_OWN,
    Permissions.EXPERIENCE_REPORTS_SUBMIT,
  ],
};

export interface PolicyContext {
  userId: string;
  isPlatformAdmin?: boolean;
  tenantId?: string;
  tenantStatus?: string;
  membershipStatus?: string;
  role?: UserRole;
  customPermissions?: string[];
}

export interface ResourceTarget {
  tenantId?: string;
  ownerId?: string;
}

/**
 * Central Policy Function: can(context, action, resource)
 * Evaluates authorization with deny-by-default semantics.
 */
export function can(
  ctx: PolicyContext,
  action: PermissionIdentifier,
  resource?: ResourceTarget
): boolean {
  // 1. Platform Super Admin permissions check
  if (ctx.isPlatformAdmin) {
    const platformPerms = RoleDefaultPermissions.SUPER_ADMIN;
    if (platformPerms.includes(action)) {
      return true;
    }
    // Super Admin has NO automatic access to student-private data without support elevation
    if (
      action === Permissions.RESULTS_READ_OWN ||
      action === Permissions.MISTAKE_BANK_MANAGE_OWN
    ) {
      return false;
    }
  }

  // 2. Deny if tenant is not ACTIVE
  if (ctx.tenantStatus && ctx.tenantStatus !== "ACTIVE") {
    return false;
  }

  // 3. Deny if membership is not ACTIVE
  if (ctx.membershipStatus && ctx.membershipStatus !== "ACTIVE") {
    return false;
  }

  // 4. Strict Tenant Boundary Check
  if (resource?.tenantId && ctx.tenantId && resource.tenantId !== ctx.tenantId) {
    return false;
  }

  // 5. Ownership Boundary Check
  if (
    (action === Permissions.RESULTS_READ_OWN ||
      action === Permissions.MISTAKE_BANK_MANAGE_OWN) &&
    resource?.ownerId &&
    resource.ownerId !== ctx.userId
  ) {
    return false;
  }

  // 6. Role Permissions Check
  if (!ctx.role) {
    return false;
  }

  const rolePerms = RoleDefaultPermissions[ctx.role] || [];
  if (rolePerms.includes(action)) {
    return true;
  }

  // 7. Check Custom Granular Permissions
  if (ctx.customPermissions && ctx.customPermissions.includes(action)) {
    return true;
  }

  // Default to DENY
  return false;
}
