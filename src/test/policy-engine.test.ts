import { describe, it, expect } from "vitest";
import { can, Permissions } from "@/modules/identity-access/services/policy-engine";

describe("Policy Engine & Scoped RBAC", () => {
  const tenantA = "tenant-a-uuid";
  const tenantB = "tenant-b-uuid";
  const userA = "user-a-uuid";
  const userB = "user-b-uuid";

  it("grants Platform Super Admin platform-level permissions", () => {
    const ctx = {
      userId: userA,
      isPlatformAdmin: true,
    };
    expect(can(ctx, Permissions.TENANT_CREATE)).toBe(true);
    expect(can(ctx, Permissions.TENANT_SUSPEND)).toBe(true);
  });

  it("denies Platform Super Admin routine access to private student answers without support elevation", () => {
    const ctx = {
      userId: userA,
      isPlatformAdmin: true,
    };
    expect(can(ctx, Permissions.MISTAKE_BANK_MANAGE_OWN)).toBe(false);
    expect(can(ctx, Permissions.RESULTS_READ_OWN)).toBe(false);
    // Strict Option A: Platform Super Admin is also denied access to private college operational data
    expect(can(ctx, Permissions.STUDENTS_READ)).toBe(false);
    expect(can(ctx, Permissions.STUDENTS_DELETE)).toBe(false);
    expect(can(ctx, Permissions.DRIVES_MANAGE)).toBe(false);
    expect(can(ctx, Permissions.QUESTIONS_MANAGE)).toBe(false);
    expect(can(ctx, Permissions.ASSESSMENTS_MANAGE)).toBe(false);
    expect(can(ctx, Permissions.STAFF_MANAGE)).toBe(false);
  });

  it("grants Placement Head institution management within own tenant", () => {
    const ctx = {
      userId: userA,
      tenantId: tenantA,
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      role: "PLACEMENT_HEAD" as const,
    };
    expect(can(ctx, Permissions.DRIVES_MANAGE, { tenantId: tenantA })).toBe(true);
    expect(can(ctx, Permissions.STAFF_INVITE, { tenantId: tenantA })).toBe(true);
  });

  it("DENIES cross-tenant actions even for Placement Head (Tenant A cannot manage Tenant B)", () => {
    const ctx = {
      userId: userA,
      tenantId: tenantA,
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      role: "PLACEMENT_HEAD" as const,
    };
    expect(can(ctx, Permissions.DRIVES_MANAGE, { tenantId: tenantB })).toBe(false);
    expect(can(ctx, Permissions.STAFF_INVITE, { tenantId: tenantB })).toBe(false);
  });

  it("DENIES all operations if tenant is SUSPENDED", () => {
    const ctx = {
      userId: userA,
      tenantId: tenantA,
      tenantStatus: "SUSPENDED",
      membershipStatus: "ACTIVE",
      role: "PLACEMENT_HEAD" as const,
    };
    expect(can(ctx, Permissions.DRIVES_MANAGE, { tenantId: tenantA })).toBe(false);
    expect(can(ctx, Permissions.STUDENTS_READ, { tenantId: tenantA })).toBe(false);
  });

  it("DENIES all operations if membership is SUSPENDED or REVOKED", () => {
    const ctx = {
      userId: userA,
      tenantId: tenantA,
      tenantStatus: "ACTIVE",
      membershipStatus: "SUSPENDED",
      role: "STUDENT" as const,
    };
    expect(can(ctx, Permissions.ASSESSMENTS_ATTEMPT, { tenantId: tenantA })).toBe(false);
  });

  it("enforces student ownership boundary: student cannot access another student's Mistake Bank", () => {
    const ctx = {
      userId: userA,
      tenantId: tenantA,
      tenantStatus: "ACTIVE",
      membershipStatus: "ACTIVE",
      role: "STUDENT" as const,
    };
    // Own mistake bank -> ALLOW
    expect(can(ctx, Permissions.MISTAKE_BANK_MANAGE_OWN, { tenantId: tenantA, ownerId: userA })).toBe(true);
    // Another student's mistake bank -> DENY
    expect(can(ctx, Permissions.MISTAKE_BANK_MANAGE_OWN, { tenantId: tenantA, ownerId: userB })).toBe(false);
  });

  it("defaults to DENY when permission or context is missing", () => {
    const ctx = {
      userId: userA,
    };
    // No role, no permissions
    expect(can(ctx, Permissions.DRIVES_MANAGE)).toBe(false);
  });
});
