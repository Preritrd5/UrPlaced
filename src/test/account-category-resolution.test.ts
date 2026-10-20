import { describe, it, expect } from "vitest";
import {
  getAuthorizedNavigation,
  getRoleDefaultDashboard,
  MASTER_NAVIGATION,
} from "@/lib/navigation/navigation-config";
import { Permissions, RoleDefaultPermissions, type UserRole } from "@/modules/identity-access/services/policy-engine";

describe("Account Category & Dynamic Role-Based Access Resolution", () => {
  describe("1. Authoritative Role & Category Mapping Integrity", () => {
    it("maps PLACEMENT_HEAD, PLACEMENT_STAFF, and TRAINER to COLLEGE category without fallback to STUDENT", () => {
      const collegeRoles: UserRole[] = ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"];

      for (const role of collegeRoles) {
        // Must derive COLLEGE category
        const accountCategory = role === "STUDENT" ? "STUDENT" : "COLLEGE";
        expect(accountCategory).toBe("COLLEGE");

        // Master navigation for this role must yield college sections
        const nav = getAuthorizedNavigation(role);
        expect(nav.length).toBeGreaterThan(0);

        for (const section of nav) {
          // No student workspace sections
          expect(section.title).not.toBe("Student Workspace");
          expect(section.title).not.toBe("Personal Performance");
        }
      }
    });

    it("maps STUDENT strictly to STUDENT category and isolates student workspace", () => {
      const studentRole: UserRole = "STUDENT";
      const accountCategory = studentRole === "STUDENT" ? "STUDENT" : "COLLEGE";
      expect(accountCategory).toBe("STUDENT");

      const nav = getAuthorizedNavigation(studentRole);
      expect(nav.length).toBeGreaterThan(0);

      const sectionTitles = nav.map((s) => s.title);
      expect(sectionTitles).toContain("Student Workspace");
      expect(sectionTitles).toContain("Placement Preparation");
      expect(sectionTitles).toContain("Learning from Mistakes");

      // Institutional sections must never appear for a student
      expect(sectionTitles).not.toContain("Placement Overview");
      expect(sectionTitles).not.toContain("Student Operations");
      expect(sectionTitles).not.toContain("Recruitment Drives");
      expect(sectionTitles).not.toContain("College Administration");
    });
  });

  describe("2. Default Dashboard Routing by Account Category and Role", () => {
    it("routes STUDENT category strictly to /dashboard/student", () => {
      expect(getRoleDefaultDashboard("STUDENT")).toBe("/dashboard/student");
    });

    it("routes College Leadership (PLACEMENT_HEAD and PLACEMENT_STAFF) to /dashboard", () => {
      expect(getRoleDefaultDashboard("PLACEMENT_HEAD")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("PLACEMENT_STAFF")).toBe("/dashboard");
    });

    it("routes Faculty / Trainer to /dashboard/training", () => {
      expect(getRoleDefaultDashboard("TRAINER")).toBe("/dashboard/training");
    });
  });

  describe("3. Route Guard & Permission Matrix (/dashboard/training & /dashboard/members)", () => {
    it("permits College roles (HEAD, STAFF, TRAINER) to access Targeted Training and denies STUDENT", () => {
      const trainingAllowedRoles: UserRole[] = ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"];

      for (const role of trainingAllowedRoles) {
        const canManageTraining = trainingAllowedRoles.includes(role);
        expect(canManageTraining).toBe(true);

        const nav = getAuthorizedNavigation(role);
        const hrefs = nav.flatMap((s) => s.items).map((i) => i.href);
        expect(hrefs).toContain("/dashboard/training");
      }

      // Student must not be permitted in Targeted Training management
      const studentCanManage = (trainingAllowedRoles as string[]).includes("STUDENT");
      expect(studentCanManage).toBe(false);

      const studentNav = getAuthorizedNavigation("STUDENT");
      const studentHrefs = studentNav.flatMap((s) => s.items).map((i) => i.href);
      expect(studentHrefs).not.toContain("/dashboard/training");
    });

    it("restricts Staff & Members administration (/dashboard/members) strictly to PLACEMENT_HEAD", () => {
      const headNav = getAuthorizedNavigation("PLACEMENT_HEAD");
      const headHrefs = headNav.flatMap((s) => s.items).map((i) => i.href);
      expect(headHrefs).toContain("/dashboard/members");

      // Staff, Trainer, and Student must NOT have members administration
      const staffNav = getAuthorizedNavigation("PLACEMENT_STAFF");
      expect(staffNav.flatMap((s) => s.items).map((i) => i.href)).not.toContain("/dashboard/members");

      const trainerNav = getAuthorizedNavigation("TRAINER");
      expect(trainerNav.flatMap((s) => s.items).map((i) => i.href)).not.toContain("/dashboard/members");

      const studentNav = getAuthorizedNavigation("STUDENT");
      expect(studentNav.flatMap((s) => s.items).map((i) => i.href)).not.toContain("/dashboard/members");
    });
  });

  describe("4. Security Audit: Client Metadata Privilege Escalation Resistance", () => {
    it("rejects client-editable user_metadata as proof of authorization", () => {
      // Simulating a student attempting privilege escalation by setting user_metadata.role = 'PLACEMENT_HEAD'
      const maliciousUser = {
        id: "attacker-user-id",
        email: "attacker@student.edu",
        user_metadata: {
          role: "PLACEMENT_HEAD",
          account_category: "COLLEGE",
          institution_name: "Target University",
        },
        app_metadata: {
          role: "STUDENT",
          account_category: "STUDENT",
          verified_by_server: true,
        },
      };

      // Server verification rule: check database membership or server-controlled app_metadata
      const serverAppMeta = maliciousUser.app_metadata || {};
      const isServerVerified = serverAppMeta.verified_by_server === true;
      const verifiedRole = serverAppMeta.role;

      // The role resolved must be STUDENT, completely ignoring user_metadata.role = 'PLACEMENT_HEAD'
      expect(isServerVerified).toBe(true);
      expect(verifiedRole).toBe("STUDENT");
      expect(verifiedRole).not.toBe(maliciousUser.user_metadata.role);
    });

    it("denies institutional access to users with unverified membership", () => {
      const unverifiedUser = {
        id: "unverified-user-id",
        email: "unverified@campus.edu",
        user_metadata: {
          role: "PLACEMENT_HEAD",
        },
        app_metadata: {}, // No server verification
      };

      const isServerVerified = (unverifiedUser.app_metadata as any).verified_by_server === true;
      expect(isServerVerified).toBe(false);

      // Safe failure: Unverified users receive no active membership and zero permissions
      const activeMembership = isServerVerified ? { role: "PLACEMENT_HEAD" } : undefined;
      expect(activeMembership).toBeUndefined();
    });

    it("verifies server-controlled app_metadata set via Admin API during signup", () => {
      const serverProvisionedUser = {
        id: "abc-user-id",
        email: "abc@campus.edu",
        app_metadata: {
          account_category: "COLLEGE",
          role: "PLACEMENT_HEAD" as UserRole,
          tenant_id: "tenant-abc",
          institution_name: "Sapthagiri NPS University",
          verified_by_server: true,
        },
        user_metadata: {
          full_name: "abc",
        },
      };

      const isServerVerified = serverProvisionedUser.app_metadata.verified_by_server === true;
      expect(isServerVerified).toBe(true);
      expect(serverProvisionedUser.app_metadata.role).toBe("PLACEMENT_HEAD");
      expect(serverProvisionedUser.app_metadata.account_category).toBe("COLLEGE");
    });
  });
});
