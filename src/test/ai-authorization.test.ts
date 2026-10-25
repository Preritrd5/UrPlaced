import { describe, it, expect } from "vitest";
import { can, Permissions, RoleDefaultPermissions } from "@/modules/identity-access/services/policy-engine";

describe("AI Intelligence Layer Scoped RBAC & Authorization Suite", () => {
  describe("1. Role-Based AI Capability Permissions", () => {
    it("grants students access to Study Tutor, Mistake Mastery, and DriveFit only", () => {
      const studentPermissions = RoleDefaultPermissions.STUDENT;

      expect(studentPermissions).toContain(Permissions.AI_STUDY_TUTOR_USE);
      expect(studentPermissions).toContain(Permissions.AI_MISTAKE_MASTERY_USE);
      expect(studentPermissions).toContain(Permissions.AI_DRIVEFIT_EVALUATE);

      // Students must NOT have permission to generate questions or access cohort intelligence
      expect(studentPermissions).not.toContain(Permissions.AI_QUESTIONS_GENERATE);
      expect(studentPermissions).not.toContain(Permissions.AI_PLACEMENT_INTEL_READ);
    });

    it("grants institutional placement staff permission to generate questions and read placement intelligence", () => {
      const staffPermissions = RoleDefaultPermissions.PLACEMENT_STAFF;
      expect(staffPermissions).toContain(Permissions.AI_QUESTIONS_GENERATE);
      expect(staffPermissions).toContain(Permissions.AI_PLACEMENT_INTEL_READ);

      const headPermissions = RoleDefaultPermissions.PLACEMENT_HEAD;
      expect(headPermissions).toContain(Permissions.AI_QUESTIONS_GENERATE);
      expect(headPermissions).toContain(Permissions.AI_PLACEMENT_INTEL_READ);
    });

    it("grants trainers question generation and placement intelligence", () => {
      const trainerPermissions = RoleDefaultPermissions.TRAINER;
      expect(trainerPermissions).toContain(Permissions.AI_QUESTIONS_GENERATE);
      expect(trainerPermissions).toContain(Permissions.AI_PLACEMENT_INTEL_READ);
    });
  });

  describe("2. Deny-by-Default Policy Evaluation", () => {
    it("denies unauthenticated or empty context from accessing AI capabilities", () => {
      const emptyContext: any = { userId: "anon" };
      expect(can(emptyContext, Permissions.AI_STUDY_TUTOR_USE)).toBe(false);
      expect(can(emptyContext, Permissions.AI_QUESTIONS_GENERATE)).toBe(false);
      expect(can(emptyContext, Permissions.AI_MISTAKE_MASTERY_USE)).toBe(false);
      expect(can(emptyContext, Permissions.AI_DRIVEFIT_EVALUATE)).toBe(false);
      expect(can(emptyContext, Permissions.AI_PLACEMENT_INTEL_READ)).toBe(false);
    });

    it("strictly rejects students attempting to invoke AI question generation", () => {
      const studentContext = {
        userId: "student-uid-1",
        tenantId: "tenant-college-a",
        role: "STUDENT" as const,
        membershipStatus: "ACTIVE",
        tenantStatus: "ACTIVE",
      };

      const allowed = can(studentContext, Permissions.AI_QUESTIONS_GENERATE, {
        tenantId: "tenant-college-a",
      });
      expect(allowed).toBe(false);
    });

    it("strictly rejects cross-tenant AI intelligence access", () => {
      const staffContext = {
        userId: "staff-uid-1",
        tenantId: "tenant-college-a",
        role: "PLACEMENT_STAFF" as const,
        membershipStatus: "ACTIVE",
        tenantStatus: "ACTIVE",
      };

      // Staff from college A trying to access college B data
      const allowed = can(staffContext, Permissions.AI_PLACEMENT_INTEL_READ, {
        tenantId: "tenant-college-b",
      });
      expect(allowed).toBe(false);
    });
  });
});
