/**
 * UrPlaced Centralized Authorization-Aware Navigation Registry
 * Single source of truth for all role-based sidebar menus, dashboards, and route access rules.
 */

import React from "react";
import {
  LayoutDashboard,
  Compass,
  GraduationCap,
  Building2,
  Briefcase,
  BookOpen,
  Target,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BarChart3,
  History,
  School,
  Users,
  ShieldCheck,
  FileSpreadsheet,
  Megaphone,
  Award,
  CreditCard,
  User,
  Bot,
  FileText,
} from "lucide-react";
import {
  Permissions,
  type PermissionIdentifier,
  type UserRole,
  RoleDefaultPermissions,
} from "@/modules/identity-access/services/policy-engine";

export type AccountCategory = "STUDENT" | "COLLEGE";

export interface NavigationItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: PermissionIdentifier;
  allowedRoles?: UserRole[];
  accountCategory: AccountCategory;
  entitlementKey?: string;
  badge?: string;
  exactMatch?: boolean;
}

export interface NavigationSection {
  title: string;
  items: NavigationItem[];
}

/**
 * Master Navigation Registry
 */
export const MASTER_NAVIGATION: {
  section: string;
  accountCategory: AccountCategory;
  items: NavigationItem[];
}[] = [
  // ==========================================
  // STUDENT WORKSPACE SECTIONS
  // ==========================================
  {
    section: "Student Workspace",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-dashboard",
        name: "My Dashboard",
        href: "/dashboard/student",
        icon: LayoutDashboard,
        requiredPermission: Permissions.DASHBOARD_READ,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        exactMatch: true,
      },
    ],
  },
  {
    section: "Campus Placements",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-drives",
        name: "Recruitment Drives",
        href: "/dashboard/student/drives",
        icon: Briefcase,
        requiredPermission: Permissions.COMPANIES_READ,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "core_drives_management",
      },
      {
        id: "student-applications",
        name: "My Applications",
        href: "/dashboard/student/applications",
        icon: FileSpreadsheet,
        requiredPermission: Permissions.CANDIDATES_REGISTER,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "core_drives_management",
      },
      {
        id: "student-offers",
        name: "Placement Offers",
        href: "/dashboard/student/offers",
        icon: Award,
        requiredPermission: Permissions.OUTCOMES_READ_OWN,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "core_drives_management",
      },
      {
        id: "student-announcements",
        name: "Announcements",
        href: "/dashboard/student/announcements",
        icon: Megaphone,
        requiredPermission: Permissions.ANNOUNCEMENTS_READ,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
      },
    ],
  },
  {
    section: "Career Intelligence",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-career-profile",
        name: "Career Profile",
        href: "/dashboard/student/career-profile",
        icon: User,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
      },
      {
        id: "student-resume-ats",
        name: "Resume & ATS Scanner",
        href: "/dashboard/student/resume",
        icon: FileText,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "AI",
      },
      {
        id: "student-placement-matches",
        name: "Smart Drive Matches",
        href: "/dashboard/student/placement-matches",
        icon: Target,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "Smart",
      },
    ],
  },
  {
    section: "Career Improvement",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-skill-gap",
        name: "Skill Gap Analyzer",
        href: "/dashboard/student/skill-gap",
        icon: Compass,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "AI",
      },
      {
        id: "student-career-passport",
        name: "Career Passport",
        href: "/dashboard/student/career-passport",
        icon: Award,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "Pro",
      },
      {
        id: "student-mock-interview",
        name: "Mock Interview Studio",
        href: "/dashboard/student/mock-interview",
        icon: Bot,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "AI",
      },
    ],
  },
  {
    section: "Placement Preparation",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-placement-practice",
        name: "Practice Centre",
        href: "/dashboard/student/placement-practice",
        icon: BookOpen,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "Practice",
      },
      {
        id: "student-company-preparation",
        name: "Company Preparation",
        href: "/dashboard/student/company-preparation",
        icon: Building2,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "Tracks",
      },
      {
        id: "student-learning-recommendations",
        name: "Learning Recommendations",
        href: "/dashboard/student/learning-recommendations",
        icon: Sparkles,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        badge: "Smart",
      },
      {
        id: "student-tutor",
        name: "AI Study Tutor",
        href: "/dashboard/student/tutor",
        icon: GraduationCap,
        requiredPermission: Permissions.AI_STUDY_TUTOR_USE,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "ai_tutor_assistant",
        badge: "AI",
      },
      {
        id: "student-assessments",
        name: "Assessments & Practice",
        href: "/dashboard/student/assessments",
        icon: Compass,
        requiredPermission: Permissions.ASSESSMENTS_ATTEMPT,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "standard_assessments",
      },
      {
        id: "student-memory",
        name: "Target Drive Insights",
        href: "/dashboard/student/memory",
        icon: Building2,
        requiredPermission: Permissions.PLACEMENT_MEMORY_READ,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "placement_memory_analytics",
      },
    ],
  },
  {
    section: "Learning from Mistakes",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-mistakes",
        name: "Mistake Bank & Review",
        href: "/dashboard/student/mistakes",
        icon: AlertCircle,
        requiredPermission: Permissions.MISTAKE_BANK_MANAGE_OWN,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "mistake_to_mastery",
      },
      {
        id: "student-mastery",
        name: "Mastery Tracker",
        href: "/dashboard/student/mastery",
        icon: Sparkles,
        requiredPermission: Permissions.RESULTS_READ_OWN,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "mistake_to_mastery",
      },
    ],
  },
  {
    section: "Personal Performance",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-analytics",
        name: "My Analytics & Readiness",
        href: "/dashboard/student/analytics",
        icon: BarChart3,
        requiredPermission: Permissions.ANALYTICS_READ_OWN,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
        entitlementKey: "placement_memory_analytics",
      },
    ],
  },
  {
    section: "Student Account",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-profile",
        name: "My Profile",
        href: "/dashboard/profile",
        icon: User,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
      },
    ],
  },

  // ==========================================
  // COLLEGE PLACEMENT MANAGEMENT SECTIONS
  // ==========================================
  {
    section: "Placement Overview",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-dashboard",
        name: "Command Center",
        href: "/dashboard",
        icon: LayoutDashboard,
        requiredPermission: Permissions.DASHBOARD_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
        exactMatch: true,
      },
    ],
  },
  {
    section: "Student Operations",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-students",
        name: "Student Directory",
        href: "/dashboard/students",
        icon: GraduationCap,
        requiredPermission: Permissions.STUDENTS_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "student_roster_directory",
      },
      {
        id: "college-announcements",
        name: "Announcements & Alerts",
        href: "/dashboard/announcements",
        icon: Megaphone,
        requiredPermission: Permissions.ANNOUNCEMENTS_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
      },
    ],
  },
  {
    section: "Recruitment Drives",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-companies",
        name: "Company Directory",
        href: "/dashboard/companies",
        icon: Building2,
        requiredPermission: Permissions.COMPANIES_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "company_management",
      },
      {
        id: "college-drives",
        name: "Recruitment Drives",
        href: "/dashboard/drives",
        icon: Briefcase,
        requiredPermission: Permissions.DRIVES_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
        entitlementKey: "core_drives_management",
      },
      {
        id: "college-offers",
        name: "Placement Offers",
        href: "/dashboard/offers",
        icon: Award,
        requiredPermission: Permissions.OUTCOMES_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
        entitlementKey: "core_drives_management",
      },
    ],
  },
  {
    section: "Preparation & Training",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-tutor",
        name: "AI Placement Tutor",
        href: "/dashboard/student/tutor",
        icon: Bot,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "ai_tutor_assistant",
        badge: "AI",
      },
      {
        id: "college-questions",
        name: "Question Bank Sentinel",
        href: "/dashboard/questions",
        icon: BookOpen,
        requiredPermission: Permissions.QUESTIONS_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "subject_question_banks",
      },
      {
        id: "college-assessments",
        name: "Assessment Engine",
        href: "/dashboard/assessments",
        icon: Compass,
        requiredPermission: Permissions.ASSESSMENTS_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "standard_assessments",
      },
      {
        id: "college-training",
        name: "Targeted Training",
        href: "/dashboard/training",
        icon: Target,
        requiredPermission: Permissions.TRAINING_SESSIONS_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
      },
      {
        id: "college-mistakes",
        name: "Cohort Mistake Analytics",
        href: "/dashboard/mistakes",
        icon: CheckCircle2,
        requiredPermission: Permissions.MISTAKE_BANK_READ_COHORT,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "mistake_to_mastery",
      },
    ],
  },
  {
    section: "Placement Intelligence",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-memory",
        name: "Placement Memory",
        href: "/dashboard/memory",
        icon: History,
        requiredPermission: Permissions.PLACEMENT_MEMORY_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
        entitlementKey: "placement_memory_analytics",
      },
      {
        id: "college-analytics",
        name: "Institutional Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        requiredPermission: Permissions.ANALYTICS_READ_COHORT,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
        entitlementKey: "placement_memory_analytics",
      },
    ],
  },
  {
    section: "College Administration",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-academic",
        name: "Academic Structure",
        href: "/dashboard/settings/academic",
        icon: School,
        requiredPermission: Permissions.DEPARTMENTS_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD"],
        accountCategory: "COLLEGE",
        entitlementKey: "department_hierarchy",
      },
      {
        id: "college-members",
        name: "Staff & Members",
        href: "/dashboard/members",
        icon: Users,
        requiredPermission: Permissions.STAFF_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD"],
        accountCategory: "COLLEGE",
      },
    ],
  },
  {
    section: "Account & Subscription",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-billing",
        name: "Subscription & Billing",
        href: "/dashboard/billing",
        icon: CreditCard,
        allowedRoles: ["PLACEMENT_HEAD"],
        accountCategory: "COLLEGE",
      },
      {
        id: "college-profile",
        name: "My Profile",
        href: "/dashboard/profile",
        icon: User,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
      },
    ],
  },
];

/**
 * Filter and resolve authorized navigation sections for the active user context.
 * Enforces SA-03 / SA-06 subscription entitlement locking:
 * When college subscription is not ACTIVE (e.g. PENDING_PAYMENT), only
 * Subscription & Billing and My Profile are permitted in navigation.
 */
export function getAuthorizedNavigation(
  userRole: UserRole,
  isPlatformAdmin?: boolean,
  userPermissions?: string[],
  subscriptionStatus?: string | null,
  isGracePeriod?: boolean,
  entitlements?: Record<string, boolean> | null
): NavigationSection[] {
  // Determine user's effective permissions:
  // If userPermissions is undefined, null, or empty array, fall back to RoleDefaultPermissions
  const effectivePerms = new Set<string>(
    userPermissions && userPermissions.length > 0
      ? userPermissions
      : RoleDefaultPermissions[userRole] || []
  );

  const targetCategory: AccountCategory =
    userRole === "STUDENT" ? "STUDENT" : "COLLEGE";

  // Platform Super Admins are never locked out of institutional administration
  if (isPlatformAdmin) {
    // Return all sections for target category with role permissions satisfied
  }

  // During 7-day grace period, full subscribed navigation is retained (Q1)
  const isGrace = Boolean(isGracePeriod || subscriptionStatus === "PAST_DUE_GRACE");
  const isLocked =
    !isPlatformAdmin &&
    (subscriptionStatus === "NO_SUBSCRIPTION" ||
      Boolean(
        subscriptionStatus &&
        subscriptionStatus !== "ACTIVE" &&
        subscriptionStatus !== "TRIALING" &&
        !isGrace
      ));

  const resolvedSections: NavigationSection[] = [];

  for (const group of MASTER_NAVIGATION) {
    if (group.accountCategory !== targetCategory) {
      continue;
    }

    const permittedItems: NavigationItem[] = [];

    for (const item of group.items) {
      // 1. Role match check
      if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
        continue;
      }

      // 2. Permission match check (if requiredPermission is defined)
      if (item.requiredPermission && !effectivePerms.has(item.requiredPermission)) {
        continue;
      }

      // 2.5 Feature Entitlement check (SA-04 / SA-06 Controlled feature matrix)
      // When a feature is disabled in the plan snapshot (entitlements[key] === false),
      // it must be completely hidden from navigation for institutional users.
      if (!isPlatformAdmin && item.entitlementKey && entitlements) {
        if (entitlements[item.entitlementKey] === false) {
          continue;
        }
      }

      // 3. Strict Subscription Entitlement Filter:
      // If subscription is locked, permit only billing and profile for staff, and profile for students
      if (isLocked) {
        if (targetCategory === "COLLEGE") {
          const isPermittedUnderLocked =
            (item.href === "/dashboard/billing" && userRole === "PLACEMENT_HEAD") ||
            item.href === "/dashboard/profile";
          if (!isPermittedUnderLocked) {
            continue;
          }
        } else if (targetCategory === "STUDENT") {
          const isPermittedUnderLocked = item.href === "/dashboard/profile";
          if (!isPermittedUnderLocked) {
            continue;
          }
        }
      }

      permittedItems.push(item);
    }

    // Only render section if it contains at least one permitted item
    if (permittedItems.length > 0) {
      resolvedSections.push({
        title: group.section,
        items: permittedItems,
      });
    }
  }

  return resolvedSections;
}

/**
 * Resolves the primary landing dashboard for a given role
 */
export function getRoleDefaultDashboard(userRole: UserRole): string {
  if (userRole === "STUDENT") {
    return "/dashboard/student";
  }
  if (userRole === "TRAINER") {
    return "/dashboard/training";
  }
  return "/dashboard";
}
