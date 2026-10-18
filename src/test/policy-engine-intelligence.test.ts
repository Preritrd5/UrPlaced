import { describe, it, expect } from "vitest";
import { can, Permissions } from "@/modules/identity-access/services/policy-engine";

describe("Policy Engine DriveFit Permissions", () => {
  const tenantId = "tenant-alpha";

  it("permits PLACEMENT_HEAD to manage and publish intelligence", () => {
    const headCtx = {
      userId: "head-1",
      tenantId,
      role: "PLACEMENT_HEAD" as const,
      membershipStatus: "ACTIVE",
    };

    expect(can(headCtx, Permissions.INTELLIGENCE_SOURCES_MANAGE, { tenantId })).toBe(true);
    expect(can(headCtx, Permissions.INTELLIGENCE_REQUIREMENTS_VERIFY, { tenantId })).toBe(true);
    expect(can(headCtx, Permissions.INTELLIGENCE_PUBLISH, { tenantId })).toBe(true);
    expect(can(headCtx, Permissions.INTELLIGENCE_MAPPINGS_MANAGE, { tenantId })).toBe(true);
    expect(can(headCtx, Permissions.DRIVEFIT_READ_PUBLISHED, { tenantId })).toBe(true);
  });

  it("permits STUDENT to read published DriveFit and manage own prep plan", () => {
    const studentCtx = {
      userId: "student-1",
      tenantId,
      role: "STUDENT" as const,
      membershipStatus: "ACTIVE",
    };

    expect(can(studentCtx, Permissions.DRIVEFIT_READ_PUBLISHED, { tenantId })).toBe(true);
    expect(can(studentCtx, Permissions.DRIVEFIT_PLAN_MANAGE_OWN, { tenantId })).toBe(true);
    expect(can(studentCtx, Permissions.EXPERIENCE_REPORTS_SUBMIT, { tenantId })).toBe(true);

    // Students must NOT have staff management/publish permissions
    expect(can(studentCtx, Permissions.INTELLIGENCE_SOURCES_MANAGE, { tenantId })).toBe(false);
    expect(can(studentCtx, Permissions.INTELLIGENCE_REQUIREMENTS_VERIFY, { tenantId })).toBe(false);
    expect(can(studentCtx, Permissions.INTELLIGENCE_PUBLISH, { tenantId })).toBe(false);
    expect(can(studentCtx, Permissions.INTELLIGENCE_MAPPINGS_MANAGE, { tenantId })).toBe(false);
  });

  it("denies cross-tenant intelligence operations", () => {
    const staffCtx = {
      userId: "staff-1",
      tenantId: "tenant-alpha",
      role: "PLACEMENT_STAFF" as const,
      membershipStatus: "ACTIVE",
    };

    // Attempting to manage sources for College B while belonging to College A
    expect(can(staffCtx, Permissions.INTELLIGENCE_SOURCES_MANAGE, { tenantId: "tenant-beta" })).toBe(false);
    expect(can(staffCtx, Permissions.INTELLIGENCE_PUBLISH, { tenantId: "tenant-beta" })).toBe(false);
  });
});
