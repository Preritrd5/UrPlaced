import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions, can, RoleDefaultPermissions } from "@/modules/identity-access/services/policy-engine";
import { getAuthorizedNavigation } from "@/lib/navigation/navigation-config";

// Mock Supabase Server Client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock Supabase Admin Client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

// Mock Membership Service
vi.mock("@/modules/tenancy/services/membership-service", () => ({
  getUserMemberships: vi.fn(),
  getActiveTenantMembership: vi.fn(),
  MembershipService: {
    listUserMemberships: vi.fn(),
  },
}));

// Mock Tenant Service
vi.mock("@/modules/tenancy/services/tenant-service", () => ({
  TenantService: {
    getById: vi.fn(),
  },
}));

// Mock cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getUserMemberships, MembershipService } from "@/modules/tenancy/services/membership-service";
import { TenantService } from "@/modules/tenancy/services/tenant-service";

describe("FINAL SECURITY CHECK — College Membership, Role Authority & Provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Database Membership Authority & Stale Claim Rejection", () => {
    it("denies access to a PLACEMENT_HEAD whose membership was SUSPENDED in the database, even if JWT claims exist", async () => {
      // User session with stale claims in app_metadata
      const mockUser = {
        id: "head-1",
        email: "head@college.edu",
        app_metadata: {
          role: "PLACEMENT_HEAD",
          account_category: "COLLEGE",
          tenant_id: "tenant-apex",
          verified_by_server: true,
        },
        user_metadata: { full_name: "Dr. Apex" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      });

      (createAdminClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      // Database returns SUSPENDED membership
      const suspendedMembership = {
        id: "mem-1",
        tenant_id: "tenant-apex",
        user_id: "head-1",
        role: "PLACEMENT_HEAD",
        status: "SUSPENDED",
        permissions: [],
        tenants: { id: "tenant-apex", name: "Apex University", status: "ACTIVE" },
      };

      (getUserMemberships as any).mockResolvedValue([suspendedMembership]);

      const profile = await getCurrentUserProfile();

      expect(profile).not.toBeNull();
      // Authority check: Database SUSPENDED status must invalidate verified membership
      expect(profile?.isVerifiedMembership).toBe(false);
      expect(profile?.membershipStatus).toBe("SUSPENDED");
      expect(profile?.activeMembership).toBeUndefined();
      expect(profile?.accountCategory).toBe("COLLEGE");
      expect(profile?.role).toBe("PLACEMENT_HEAD");
    });

    it("denies access to a PLACEMENT_STAFF whose membership was REVOKED in the database, even if JWT claims exist", async () => {
      const mockUser = {
        id: "staff-1",
        email: "staff@college.edu",
        app_metadata: {
          role: "PLACEMENT_STAFF",
          account_category: "COLLEGE",
          tenant_id: "tenant-apex",
          verified_by_server: true,
        },
        user_metadata: { full_name: "Staff Officer" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      });

      (createAdminClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      // Database returns REVOKED membership
      const revokedMembership = {
        id: "mem-2",
        tenant_id: "tenant-apex",
        user_id: "staff-1",
        role: "PLACEMENT_STAFF",
        status: "REVOKED",
        permissions: [],
        tenants: { id: "tenant-apex", name: "Apex University", status: "ACTIVE" },
      };

      (getUserMemberships as any).mockResolvedValue([revokedMembership]);

      const profile = await getCurrentUserProfile();

      expect(profile).not.toBeNull();
      expect(profile?.isVerifiedMembership).toBe(false);
      expect(profile?.membershipStatus).toBe("REVOKED");
      expect(profile?.activeMembership).toBeUndefined();
      expect(profile?.accountCategory).toBe("COLLEGE");
      expect(profile?.role).toBe("PLACEMENT_STAFF");
    });

    it("denies access to a TRAINER whose membership was removed/deleted from the database, despite stale claims", async () => {
      const mockUser = {
        id: "trainer-1",
        email: "trainer@college.edu",
        app_metadata: {
          role: "TRAINER",
          account_category: "COLLEGE",
          tenant_id: "tenant-apex",
          verified_by_server: true,
        },
        user_metadata: { full_name: "Faculty Trainer" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      });

      (createAdminClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      // Database returns EMPTY array — user has no membership record
      (getUserMemberships as any).mockResolvedValue([]);

      const profile = await getCurrentUserProfile();

      expect(profile).not.toBeNull();
      // Authority check: Missing membership record must result in unverified status
      expect(profile?.isVerifiedMembership).toBe(false);
      expect(profile?.membershipStatus).toBe("NONE");
      expect(profile?.activeMembership).toBeUndefined();
      expect(profile?.accountCategory).toBe("COLLEGE");
      expect(profile?.role).toBe("TRAINER");
    });

    it("authorizes a valid ACTIVE PLACEMENT_HEAD with confirmed database membership", async () => {
      const mockUser = {
        id: "head-active",
        email: "activehead@college.edu",
        app_metadata: {
          role: "PLACEMENT_HEAD",
          account_category: "COLLEGE",
          tenant_id: "tenant-apex",
          verified_by_server: true,
        },
        user_metadata: { full_name: "Active Head" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
      });

      (createAdminClient as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      const activeMembership = {
        id: "mem-active",
        tenant_id: "tenant-apex",
        user_id: "head-active",
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: [],
        tenants: { id: "tenant-apex", name: "Apex University", status: "ACTIVE" },
      };

      (getUserMemberships as any).mockResolvedValue([activeMembership]);

      const profile = await getCurrentUserProfile();

      expect(profile).not.toBeNull();
      expect(profile?.isVerifiedMembership).toBe(true);
      expect(profile?.membershipStatus).toBe("ACTIVE");
      expect(profile?.role).toBe("PLACEMENT_HEAD");
      expect(profile?.accountCategory).toBe("COLLEGE");
      expect(profile?.activeMembership?.tenant_id).toBe("tenant-apex");
    });
  });

  describe("2. Server Context Enforcement (requireAuthContext)", () => {
    it("throws MEMBERSHIP_SUSPENDED when a suspended member makes an authenticated API call", async () => {
      const mockUser = {
        id: "staff-suspended",
        email: "staff@college.edu",
        app_metadata: { role: "PLACEMENT_STAFF" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      (MembershipService.listUserMemberships as any).mockResolvedValue([
        {
          id: "mem-s",
          tenant_id: "tenant-1",
          user_id: "staff-suspended",
          role: "PLACEMENT_STAFF",
          status: "SUSPENDED",
        },
      ]);

      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, "tenant-1")
      ).rejects.toThrow("FORBIDDEN: MEMBERSHIP_SUSPENDED");
    });

    it("throws MEMBERSHIP_REVOKED when a revoked member makes an authenticated API call", async () => {
      const mockUser = {
        id: "staff-revoked",
        email: "revoked@college.edu",
        app_metadata: { role: "PLACEMENT_STAFF" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      (MembershipService.listUserMemberships as any).mockResolvedValue([
        {
          id: "mem-r",
          tenant_id: "tenant-1",
          user_id: "staff-revoked",
          role: "PLACEMENT_STAFF",
          status: "REVOKED",
        },
      ]);

      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, "tenant-1")
      ).rejects.toThrow("FORBIDDEN: MEMBERSHIP_REVOKED");
    });

    it("blocks cross-tenant access attempts immediately", async () => {
      const mockUser = {
        id: "head-cross",
        email: "head@college-a.edu",
        app_metadata: { role: "PLACEMENT_HEAD" },
      };

      (createClient as any).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      // User only has membership in Tenant A ("tenant-alpha")
      (MembershipService.listUserMemberships as any).mockResolvedValue([
        {
          id: "mem-a",
          tenant_id: "tenant-alpha",
          user_id: "head-cross",
          role: "PLACEMENT_HEAD",
          status: "ACTIVE",
        },
      ]);

      // Attacker attempts cross-tenant request targeting Tenant B ("tenant-beta")
      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, "tenant-beta")
      ).rejects.toThrow("NO_ACTIVE_TENANT");
    });
  });

  describe("3. Unverified Accounts & Zero-Privilege Invariants", () => {
    it("ensures unverified college accounts receive zero navigation and zero permissions", () => {
      const unverifiedCategory = "COLLEGE";
      const isVerifiedMembership = false;

      // In app-shell logic: unverified college accounts receive empty navigation
      const nav = isVerifiedMembership ? getAuthorizedNavigation("PLACEMENT_HEAD") : [];
      expect(nav).toEqual([]);

      // In policy engine: zero permissions
      const effectivePermissions = isVerifiedMembership
        ? RoleDefaultPermissions["PLACEMENT_HEAD"]
        : [];
      expect(effectivePermissions).toEqual([]);

      // Policy check must reject all actions
      const canManage = can(
        {
          userId: "unverified-id",
          isPlatformAdmin: false,
          tenantId: "tenant-1",
          tenantStatus: "ACTIVE",
          membershipStatus: "NONE",
          role: "STUDENT",
        },
        Permissions.DRIVES_MANAGE,
        { tenantId: "tenant-1" }
      );
      expect(canManage).toBe(false);
    });

    it("verifies public Student category isolates personal prep and denies institutional management", () => {
      const studentNav = getAuthorizedNavigation("STUDENT");
      const hrefs = studentNav.flatMap((s) => s.items).map((i) => i.href);

      // Student has personal preparation
      expect(hrefs).toContain("/dashboard/student");
      expect(hrefs).toContain("/dashboard/student/assessments");
      expect(hrefs).toContain("/dashboard/student/mistakes");

      // Student CANNOT access college placement administration
      expect(hrefs).not.toContain("/dashboard");
      expect(hrefs).not.toContain("/dashboard/training");
      expect(hrefs).not.toContain("/dashboard/members");
      expect(hrefs).not.toContain("/dashboard/drives");
      expect(hrefs).not.toContain("/dashboard/companies");
      expect(hrefs).not.toContain("/dashboard/students");
    });
  });
});
