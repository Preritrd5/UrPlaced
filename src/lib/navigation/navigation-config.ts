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
    section: "Placement Preparation",
    accountCategory: "STUDENT",
    items: [
      {
        id: "student-assessments",
        name: "Assessments & Practice",
        href: "/dashboard/student/assessments",
        icon: Compass,
        requiredPermission: Permissions.ASSESSMENTS_ATTEMPT,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
      },
      {
        id: "student-memory",
        name: "Target Drive Insights",
        href: "/dashboard/student/memory",
        icon: Building2,
        requiredPermission: Permissions.PLACEMENT_MEMORY_READ,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
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
      },
      {
        id: "student-mastery",
        name: "Mastery Tracker",
        href: "/dashboard/student/mastery",
        icon: Sparkles,
        requiredPermission: Permissions.RESULTS_READ_OWN,
        allowedRoles: ["STUDENT"],
        accountCategory: "STUDENT",
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
      },
      {
        id: "college-drives",
        name: "Recruitment Drives",
        href: "/dashboard/drives",
        icon: Briefcase,
        requiredPermission: Permissions.DRIVES_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
      },
    ],
  },
  {
    section: "Preparation & Training",
    accountCategory: "COLLEGE",
    items: [
      {
        id: "college-questions",
        name: "Question Bank Sentinel",
        href: "/dashboard/questions",
        icon: BookOpen,
        requiredPermission: Permissions.QUESTIONS_MANAGE,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
      },
      {
        id: "college-assessments",
        name: "Assessment Engine",
        href: "/dashboard/assessments",
        icon: Compass,
        requiredPermission: Permissions.ASSESSMENTS_READ,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"],
        accountCategory: "COLLEGE",
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
      },
      {
        id: "college-analytics",
        name: "Institutional Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
        requiredPermission: Permissions.ANALYTICS_READ_COHORT,
        allowedRoles: ["PLACEMENT_HEAD", "PLACEMENT_STAFF"],
        accountCategory: "COLLEGE",
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
];

/**
 * Filter and resolve authorized navigation sections for the active user context
 */
export function getAuthorizedNavigation(
  userRole: UserRole,
  isPlatformAdmin?: boolean,
  userPermissions?: string[]
): NavigationSection[] {
  // Determine user's effective permissions
  const effectivePerms = new Set<string>(
    userPermissions || RoleDefaultPermissions[userRole] || []
  );

  const targetCategory: AccountCategory =
    userRole === "STUDENT" ? "STUDENT" : "COLLEGE";

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

      // 2. Permission match check
      if (item.requiredPermission && !effectivePerms.has(item.requiredPermission)) {
        continue;
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
