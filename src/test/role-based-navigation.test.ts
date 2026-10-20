import { describe, it, expect } from "vitest";
import {
  getAuthorizedNavigation,
  getRoleDefaultDashboard,
  MASTER_NAVIGATION,
  type NavigationSection,
} from "@/lib/navigation/navigation-config";
import { Permissions } from "@/modules/identity-access/services/policy-engine";

describe("Two-Portal Dynamic Role-Based Navigation & Access Control System", () => {
  describe("1. Master Navigation Configuration Integrity (Two-Portal Scope)", () => {
    it("ensures all navigation items define valid categories (STUDENT or COLLEGE) and valid routes", () => {
      expect(MASTER_NAVIGATION.length).toBeGreaterThan(0);

      for (const group of MASTER_NAVIGATION) {
        // Strictly two account categories in V1.0: Student vs College
        expect(["STUDENT", "COLLEGE"]).toContain(group.accountCategory);
        expect(group.items.length).toBeGreaterThan(0);

        for (const item of group.items) {
          expect(item.id).toBeTruthy();
          expect(item.name).toBeTruthy();
          expect(item.href).toMatch(/^\/dashboard/);
          expect(item.accountCategory).toBe(group.accountCategory);
          if (item.allowedRoles) {
            expect(item.allowedRoles.length).toBeGreaterThan(0);
          }
        }
      }
    });

    it("verifies no Recruiter navigation items or recruiter portals exist in master navigation", () => {
      const allHrefs: string[] = [];
      const allNames: string[] = [];

      for (const group of MASTER_NAVIGATION) {
        for (const item of group.items) {
          allHrefs.push(item.href);
          allNames.push(item.name);
        }
      }

      for (const href of allHrefs) {
        expect(href).not.toContain("/recruiter");
        expect(href).not.toContain("/portal");
      }

      for (const name of allNames) {
        expect(name.toLowerCase()).not.toContain("recruiter portal");
        expect(name.toLowerCase()).not.toContain("recruiter dashboard");
      }
    });

    it("verifies no separate Platform Admin / Super Admin portal navigation exists in V1.0", () => {
      const allHrefs: string[] = [];
      const sectionTitles: string[] = [];

      for (const group of MASTER_NAVIGATION) {
        sectionTitles.push(group.section);
        for (const item of group.items) {
          allHrefs.push(item.href);
        }
      }

      expect(sectionTitles).not.toContain("Platform Administration");

      for (const href of allHrefs) {
        expect(href).not.toContain("/admin");
      }
    });
  });

  describe("2. Student Portal Navigation Resolution", () => {
    it("returns ONLY student sections and items for STUDENT role", () => {
      const nav: NavigationSection[] = getAuthorizedNavigation("STUDENT");

      expect(nav.length).toBeGreaterThan(0);

      const sectionTitles = nav.map((s) => s.title);
      expect(sectionTitles).toContain("Student Workspace");
      expect(sectionTitles).toContain("Placement Preparation");
      expect(sectionTitles).toContain("Learning from Mistakes");
      expect(sectionTitles).toContain("Personal Performance");

      // Institutional and platform sections must be completely absent
      expect(sectionTitles).not.toContain("Placement Overview");
      expect(sectionTitles).not.toContain("Student Operations");
      expect(sectionTitles).not.toContain("Recruitment Drives");
      expect(sectionTitles).not.toContain("Preparation & Training");
      expect(sectionTitles).not.toContain("Placement Intelligence");
      expect(sectionTitles).not.toContain("College Administration");
      expect(sectionTitles).not.toContain("Platform Administration");

      // Verify each item's href is within student domain
      const allItems = nav.flatMap((s) => s.items);
      for (const item of allItems) {
        expect(item.accountCategory).toBe("STUDENT");
        expect(item.href).toMatch(/^\/dashboard\/student/);
        expect(item.allowedRoles).toContain("STUDENT");
      }
    });

    it("ensures student cannot see staff management, academic structure, or drive management", () => {
      const nav = getAuthorizedNavigation("STUDENT");
      const hrefs = nav.flatMap((s) => s.items).map((i) => i.href);

      expect(hrefs).not.toContain("/dashboard/students");
      expect(hrefs).not.toContain("/dashboard/companies");
      expect(hrefs).not.toContain("/dashboard/drives");
      expect(hrefs).not.toContain("/dashboard/questions");
      expect(hrefs).not.toContain("/dashboard/assessments");
      expect(hrefs).not.toContain("/dashboard/members");
      expect(hrefs).not.toContain("/dashboard/settings/academic");
      expect(hrefs).not.toContain("/admin/tenants");
    });
  });

  describe("3. College Portal: Trainer Role", () => {
    it("returns learning, question bank, and placement memory items for TRAINER, excluding administrative command center", () => {
      const nav = getAuthorizedNavigation("TRAINER");
      const sectionTitles = nav.map((s) => s.title);

      expect(sectionTitles).not.toContain("Placement Overview");
      expect(sectionTitles).toContain("Student Operations");
      expect(sectionTitles).toContain("Preparation & Training");
      expect(sectionTitles).toContain("Placement Intelligence");

      const hrefs = nav.flatMap((s) => s.items).map((i) => i.href);

      // Permitted for trainers
      expect(hrefs).toContain("/dashboard/students");
      expect(hrefs).toContain("/dashboard/companies");
      expect(hrefs).toContain("/dashboard/questions");
      expect(hrefs).toContain("/dashboard/assessments");
      expect(hrefs).toContain("/dashboard/training");
      expect(hrefs).toContain("/dashboard/mistakes");
      expect(hrefs).toContain("/dashboard/memory");

      // Restricted for trainers: Command Center, Drives management, Institutional Analytics, Staff, Academic Structure
      expect(hrefs).not.toContain("/dashboard");
      expect(hrefs).not.toContain("/dashboard/drives");
      expect(hrefs).not.toContain("/dashboard/analytics");
      expect(hrefs).not.toContain("/dashboard/members");
      expect(hrefs).not.toContain("/dashboard/settings/academic");
      expect(hrefs).not.toContain("/admin/tenants");

      // No student items
      expect(sectionTitles).not.toContain("Student Workspace");
      expect(sectionTitles).not.toContain("Learning from Mistakes");
    });
  });

  describe("4. College Portal: Placement Staff Role", () => {
    it("returns operational placement and analytics items for PLACEMENT_STAFF, excluding administration", () => {
      const nav = getAuthorizedNavigation("PLACEMENT_STAFF");
      const sectionTitles = nav.map((s) => s.title);

      expect(sectionTitles).toContain("Placement Overview");
      expect(sectionTitles).toContain("Student Operations");
      expect(sectionTitles).toContain("Recruitment Drives");
      expect(sectionTitles).toContain("Preparation & Training");
      expect(sectionTitles).toContain("Placement Intelligence");

      const hrefs = nav.flatMap((s) => s.items).map((i) => i.href);

      // Operational items
      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/dashboard/students");
      expect(hrefs).toContain("/dashboard/companies");
      expect(hrefs).toContain("/dashboard/drives");
      expect(hrefs).toContain("/dashboard/questions");
      expect(hrefs).toContain("/dashboard/assessments");
      expect(hrefs).toContain("/dashboard/training");
      expect(hrefs).toContain("/dashboard/mistakes");
      expect(hrefs).toContain("/dashboard/memory");
      expect(hrefs).toContain("/dashboard/analytics");

      // Must NOT contain head-only administrative sections
      expect(sectionTitles).not.toContain("College Administration");
      expect(hrefs).not.toContain("/dashboard/members");
      expect(hrefs).not.toContain("/dashboard/settings/academic");
      expect(hrefs).not.toContain("/admin/tenants");

      // No student items
      expect(sectionTitles).not.toContain("Student Workspace");
    });
  });

  describe("5. College Portal: Placement Head Role (Institutional Admin)", () => {
    it("returns complete institutional navigation including College Administration for PLACEMENT_HEAD", () => {
      const nav = getAuthorizedNavigation("PLACEMENT_HEAD");
      const sectionTitles = nav.map((s) => s.title);

      expect(sectionTitles).toContain("Placement Overview");
      expect(sectionTitles).toContain("Student Operations");
      expect(sectionTitles).toContain("Recruitment Drives");
      expect(sectionTitles).toContain("Preparation & Training");
      expect(sectionTitles).toContain("Placement Intelligence");
      expect(sectionTitles).toContain("College Administration");

      const hrefs = nav.flatMap((s) => s.items).map((i) => i.href);

      expect(hrefs).toContain("/dashboard");
      expect(hrefs).toContain("/dashboard/students");
      expect(hrefs).toContain("/dashboard/companies");
      expect(hrefs).toContain("/dashboard/drives");
      expect(hrefs).toContain("/dashboard/questions");
      expect(hrefs).toContain("/dashboard/assessments");
      expect(hrefs).toContain("/dashboard/training");
      expect(hrefs).toContain("/dashboard/mistakes");
      expect(hrefs).toContain("/dashboard/memory");
      expect(hrefs).toContain("/dashboard/analytics");
      expect(hrefs).toContain("/dashboard/settings/academic");
      expect(hrefs).toContain("/dashboard/members");

      // No student items
      expect(sectionTitles).not.toContain("Student Workspace");

      // No separate platform admin portal items
      expect(sectionTitles).not.toContain("Platform Administration");
      expect(hrefs).not.toContain("/admin/tenants");
    });
  });

  describe("6. Role Default Dashboard Routing Resolution (Two Portals)", () => {
    it("routes STUDENT strictly to /dashboard/student", () => {
      expect(getRoleDefaultDashboard("STUDENT")).toBe("/dashboard/student");
    });

    it("routes college operational leadership to /dashboard and trainers to /dashboard/training", () => {
      expect(getRoleDefaultDashboard("PLACEMENT_HEAD")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("PLACEMENT_STAFF")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("TRAINER")).toBe("/dashboard/training");
    });
  });

  describe("7. Granular Permission Override Behavior", () => {
    it("dynamically suppresses items when user lacks specific permission", () => {
      // PLACEMENT_HEAD with only DASHBOARD_READ permission
      const nav = getAuthorizedNavigation("PLACEMENT_HEAD", false, [Permissions.DASHBOARD_READ]);
      const hrefs = nav.flatMap((s) => s.items).map((i) => i.href);

      expect(hrefs).toContain("/dashboard");
      expect(hrefs).not.toContain("/dashboard/students");
      expect(hrefs).not.toContain("/dashboard/companies");
      expect(hrefs).not.toContain("/dashboard/drives");
      expect(hrefs).not.toContain("/dashboard/members");
    });
  });
});
