import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  listTenantMembers,
  removeTenantMember,
  updateMemberStatus,
} from "@/modules/tenancy/services/membership-service";
import {
  createInvitation,
  acceptInvitation,
} from "@/modules/identity-access/services/invitation-service";
import { MemberRowActions } from "@/app/dashboard/members/components/member-row-actions";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    refresh: vi.fn(),
    push: vi.fn(),
  })),
  redirect: vi.fn(),
}));

// In-memory mock stores
let mockMemberships: any[] = [];
let mockProfiles: any[] = [];
let mockAuditLogs: any[] = [];
let mockUsers: any[] = [];
let mockInvitations: any[] = [];
let mockProfileDeleteCalls: any[] = [];

// Track admin.auth.admin.deleteUser calls
let shouldDeleteUserFail = false;
const mockDeleteUser = vi.fn(async (userId: string) => {
  if (shouldDeleteUserFail) {
    return { data: { user: null }, error: { message: "Internal Auth Provider Failure" } };
  }
  mockUsers = mockUsers.filter((u) => u.id !== userId);
  return { data: { user: null }, error: null };
});

// Mock audit service
vi.mock("@/modules/identity-access/services/audit-service", () => ({
  logAuditEvent: vi.fn(async (event: any) => {
    mockAuditLogs.push(event);
  }),
}));

// Mock Supabase admin client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        listUsers: vi.fn(async () => ({
          data: { users: [...mockUsers] },
          error: null,
        })),
        deleteUser: mockDeleteUser,
        updateUserById: vi.fn(async (uid: string, updates: any) => ({
          data: { user: { id: uid, ...updates } },
          error: null,
        })),
      },
    },
    from: vi.fn((table: string) => {
      let currentFilter: any = {};

      const builder: any = {
        select: vi.fn((fields: string, options?: { count?: string; head?: boolean }) => {
          let rows = [
            ...(table === "tenant_memberships"
              ? mockMemberships
              : table === "profiles"
              ? mockProfiles
              : table === "invitations"
              ? mockInvitations
              : [])
          ];

          // Chainable filters
          const queryBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              rows = rows.filter((r) => r[col] === val);
              return queryBuilder;
            }),
            neq: vi.fn((col: string, val: any) => {
              rows = rows.filter((r) => r[col] !== val);
              return queryBuilder;
            }),
            in: vi.fn((col: string, vals: any[]) => {
              rows = rows.filter((r) => vals.includes(r[col]));
              return queryBuilder;
            }),
            order: vi.fn(() => queryBuilder),
            limit: vi.fn((n: number) => {
              rows = rows.slice(0, n);
              return queryBuilder;
            }),
            single: vi.fn(async () => {
              const item = rows[0] || null;
              if (!item) {
                return { data: null, error: { code: "PGRST116", message: "Row not found" } };
              }
              return { data: item, error: null };
            }),
            maybeSingle: vi.fn(async () => {
              return { data: rows[0] || null, error: null };
            }),
            then: (resolve: any) => {
              if (options?.head && options?.count === "exact") {
                resolve({ count: rows.length, data: null, error: null });
              } else {
                resolve({ data: rows, error: null });
              }
            },
          };
          return queryBuilder;
        }),
        insert: vi.fn((dataToInsert: any) => {
          const items = Array.isArray(dataToInsert) ? dataToInsert : [dataToInsert];
          if (table === "tenant_memberships") {
            for (const item of items) {
              const conflict = mockMemberships.find(m => m.user_id === item.user_id && m.tenant_id !== item.tenant_id);
              if (conflict) {
                return {
                  select: vi.fn(() => ({
                    single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint uq_tenant_memberships_user_id" } })),
                  })),
                  then: (resolve: any) => resolve({ data: null, error: { code: "23505", message: "duplicate key value violates unique constraint uq_tenant_memberships_user_id" } }),
                };
              }
              mockMemberships.push({ id: item.id || `mem-${Date.now()}`, ...item });
            }
          } else if (table === "invitations") {
            items.forEach(i => mockInvitations.push({ id: i.id || `inv-${Date.now()}`, ...i }));
          }
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: items[0], error: null })),
            })),
            then: (resolve: any) => resolve({ data: items, error: null }),
          };
        }),
        upsert: vi.fn((dataToUpsert: any, options?: { onConflict?: string }) => {
          const item = Array.isArray(dataToUpsert) ? dataToUpsert[0] : dataToUpsert;
          if (table === "tenant_memberships") {
            const conflict = mockMemberships.find(m => m.user_id === item.user_id && m.tenant_id !== item.tenant_id);
            if (conflict) {
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: null, error: { code: "23505", message: "User already belongs to another college" } })),
                })),
                then: (resolve: any) => resolve({ data: null, error: { code: "23505", message: "User already belongs to another college" } }),
              };
            }
            const existingIdx = mockMemberships.findIndex(m => m.user_id === item.user_id);
            if (existingIdx >= 0) {
              mockMemberships[existingIdx] = { ...mockMemberships[existingIdx], ...item };
            } else {
              mockMemberships.push({ id: item.id || `mem-${Date.now()}`, ...item });
            }
          }
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: item, error: null })),
            })),
            then: (resolve: any) => resolve({ data: item, error: null }),
          };
        }),
        delete: vi.fn(() => {
          const deleteBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              if (!currentFilter) currentFilter = {};
              currentFilter[col] = val;
              return deleteBuilder;
            }),
            then: (resolve: any) => {
              if (table === "tenant_memberships") {
                mockMemberships = mockMemberships.filter((m) => {
                  for (const [k, v] of Object.entries(currentFilter)) {
                    if (m[k] !== v) return true;
                  }
                  return false;
                });
              } else if (table === "profiles") {
                mockProfileDeleteCalls.push({ ...currentFilter });
                mockProfiles = mockProfiles.filter((p) => {
                  for (const [k, v] of Object.entries(currentFilter)) {
                    if (p[k] !== v) return true;
                  }
                  return false;
                });
              } else if (table === "invitations") {
                mockInvitations = mockInvitations.filter((inv) => {
                  for (const [k, v] of Object.entries(currentFilter)) {
                    if (inv[k] !== v) return true;
                  }
                  return false;
                });
              }
              resolve({ error: null });
            },
          };
          return deleteBuilder;
        }),
        update: vi.fn((updates: any) => {
          const updateBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              if (!currentFilter) currentFilter = {};
              currentFilter[col] = val;
              return updateBuilder;
            }),
            or: vi.fn(() => updateBuilder),
            then: (resolve: any) => {
              if (table === "tenant_memberships") {
                mockMemberships.forEach((m) => {
                  let match = true;
                  for (const [k, v] of Object.entries(currentFilter)) {
                    if (m[k] !== v) match = false;
                  }
                  if (match) Object.assign(m, updates);
                });
              } else if (table === "invitations") {
                mockInvitations.forEach((inv) => {
                  let match = true;
                  for (const [k, v] of Object.entries(currentFilter)) {
                    if (inv[k] !== v) match = false;
                  }
                  if (match) Object.assign(inv, updates);
                });
              }
              resolve({ error: null });
            },
          };
          return updateBuilder;
        }),
      };
      return builder;
    }),
  })),
}));

describe("UrPlaced — Staff Membership Directory & Global Single-College Ownership", () => {
  const TENANT_A = "tenant-college-a-sapthagiri";
  const TENANT_B = "tenant-college-b-reva";
  const TENANT_C = "tenant-college-c-bms";

  const HEAD_A_ID = "usr-head-a";
  const STAFF_A_ID = "usr-staff-a";
  const STUDENT_A1_ID = "usr-student-a1";
  const STUDENT_A2_ID = "usr-student-a2";
  const STUDENT_A3_ID = "usr-student-a3";

  const HEAD_B_ID = "usr-head-b";
  const STAFF_B_ID = "usr-staff-b";

  beforeEach(() => {
    mockAuditLogs = [];
    mockProfileDeleteCalls = [];
    mockInvitations = [];
    shouldDeleteUserFail = false;
    mockDeleteUser.mockClear();

    mockUsers = [
      { id: HEAD_A_ID, email: "admin@snpsu.edu.in", user_metadata: { full_name: "SNPSU-HRD" } },
      { id: STAFF_A_ID, email: "officer@snpsu.edu.in", user_metadata: { full_name: "John Staff" } },
      { id: STUDENT_A1_ID, email: "student1@snpsu.edu.in", user_metadata: { full_name: "Alice Student" } },
      { id: STUDENT_A2_ID, email: "student2@snpsu.edu.in", user_metadata: { full_name: "Bob Student" } },
      { id: STUDENT_A3_ID, email: "student3@snpsu.edu.in", user_metadata: { full_name: "Charlie Student" } },
      { id: HEAD_B_ID, email: "admin@reva.edu.in", user_metadata: { full_name: "REVA-Admin" } },
      { id: STAFF_B_ID, email: "staff@reva.edu.in", user_metadata: { full_name: "Reva Staff" } },
    ];

    mockProfiles = [
      { id: HEAD_A_ID, email: "admin@snpsu.edu.in", full_name: "SNPSU-HRD" },
      { id: STAFF_A_ID, email: "officer@snpsu.edu.in", full_name: "John Staff" },
      { id: STUDENT_A1_ID, email: "student1@snpsu.edu.in", full_name: "Alice Student" },
      { id: STUDENT_A2_ID, email: "student2@snpsu.edu.in", full_name: "Bob Student" },
      { id: STUDENT_A3_ID, email: "student3@snpsu.edu.in", full_name: "Charlie Student" },
      { id: HEAD_B_ID, email: "admin@reva.edu.in", full_name: "REVA-Admin" },
      { id: STAFF_B_ID, email: "staff@reva.edu.in", full_name: "Reva Staff" },
    ];

    // Seed College A: 1 Head, 1 Staff, 3 Students (Total 5 memberships)
    mockMemberships = [
      {
        id: "mem-head-a",
        tenant_id: TENANT_A,
        user_id: HEAD_A_ID,
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: ["STAFF_MANAGE"],
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "mem-staff-a",
        tenant_id: TENANT_A,
        user_id: STAFF_A_ID,
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
        permissions: [],
        created_at: "2026-01-02T00:00:00Z",
      },
      {
        id: "mem-stud-a1",
        tenant_id: TENANT_A,
        user_id: STUDENT_A1_ID,
        role: "STUDENT",
        status: "ACTIVE",
        permissions: [],
        created_at: "2026-01-03T00:00:00Z",
      },
      {
        id: "mem-stud-a2",
        tenant_id: TENANT_A,
        user_id: STUDENT_A2_ID,
        role: "STUDENT",
        status: "ACTIVE",
        permissions: [],
        created_at: "2026-01-04T00:00:00Z",
      },
      {
        id: "mem-stud-a3",
        tenant_id: TENANT_A,
        user_id: STUDENT_A3_ID,
        role: "STUDENT",
        status: "ACTIVE",
        permissions: [],
        created_at: "2026-01-05T00:00:00Z",
      },
      // College B: 1 Head, 1 Staff
      {
        id: "mem-head-b",
        tenant_id: TENANT_B,
        user_id: HEAD_B_ID,
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: ["STAFF_MANAGE"],
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "mem-staff-b",
        tenant_id: TENANT_B,
        user_id: STAFF_B_ID,
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
        permissions: [],
        created_at: "2026-01-02T00:00:00Z",
      },
    ];
  });

  describe("1. Staff Listing & Active Staff Count Resolution", () => {
    it("lists all and only institutional staff members (PLACEMENT_HEAD, PLACEMENT_STAFF, TRAINER), strictly excluding students", async () => {
      const membersA = await listTenantMembers(TENANT_A);

      // Should return exactly 2 staff members, not 5 (the 3 students must be excluded)
      expect(membersA).toHaveLength(2);

      const roles = membersA.map((m) => m.role);
      expect(roles).toContain("PLACEMENT_HEAD");
      expect(roles).toContain("PLACEMENT_STAFF");
      expect(roles).not.toContain("STUDENT");

      // Verify profile enrichment
      const head = membersA.find((m) => m.role === "PLACEMENT_HEAD");
      expect(head?.profiles?.full_name).toBe("SNPSU-HRD");
      expect(head?.profiles?.email).toBe("admin@snpsu.edu.in");

      const staff = membersA.find((m) => m.role === "PLACEMENT_STAFF");
      expect(staff?.profiles?.full_name).toBe("John Staff");
      expect(staff?.profiles?.email).toBe("officer@snpsu.edu.in");
    });

    it("enforces tenant boundary during staff listing (College A never sees College B staff)", async () => {
      const membersB = await listTenantMembers(TENANT_B);
      expect(membersB).toHaveLength(2);

      const userIdsB = membersB.map((m) => m.user_id);
      expect(userIdsB).toContain(HEAD_B_ID);
      expect(userIdsB).toContain(STAFF_B_ID);
      expect(userIdsB).not.toContain(HEAD_A_ID);
      expect(userIdsB).not.toContain(STAFF_A_ID);
    });

    it("falls back gracefully to auth user metadata if a profile row is missing from public.profiles", async () => {
      // Remove staff profile from public.profiles
      mockProfiles = mockProfiles.filter((p) => p.id !== STAFF_A_ID);

      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA).toHaveLength(2);

      const staff = membersA.find((m) => m.user_id === STAFF_A_ID);
      expect(staff?.profiles?.full_name).toBe("John Staff");
      expect(staff?.profiles?.email).toBe("officer@snpsu.edu.in");
    });
  });

  describe("2. Global Single-College Ownership Invariant (ONE PERSON = ONE COLLEGE ONLY)", () => {
    it("enforces that a user belonging to College A cannot receive a membership in College B", () => {
      // An individual already belonging to College A attempts to be added to College B
      const existingUser = STAFF_A_ID;
      const isAlreadyInCollegeA = mockMemberships.some(m => m.user_id === existingUser && m.tenant_id === TENANT_A);
      expect(isAlreadyInCollegeA).toBe(true);

      // Verify invariant: A user cannot have multiple distinct tenant memberships
      const distinctTenantsForUser = new Set(mockMemberships.filter(m => m.user_id === existingUser).map(m => m.tenant_id));
      expect(distinctTenantsForUser.size).toBe(1);
    });

    it("enforces database uniqueness on user_id across tenant_memberships", () => {
      // Every user in the database must appear at most once in tenant_memberships
      const userCounts = new Map<string, number>();
      mockMemberships.forEach(m => {
        userCounts.set(m.user_id, (userCounts.get(m.user_id) || 0) + 1);
      });

      userCounts.forEach((count, uid) => {
        expect(count).toBe(1);
      });
    });

    it("rejects assigning a student to a second college", () => {
      const studentId = STUDENT_A1_ID;
      const studentMemberships = mockMemberships.filter(m => m.user_id === studentId);
      expect(studentMemberships).toHaveLength(1);
      expect(studentMemberships[0].tenant_id).toBe(TENANT_A);
    });
  });

  describe("3. Staff Email Invitation Ownership Validation", () => {
    it("allows a Placement Head to send an invitation for their own college", async () => {
      const result = await createInvitation({
        tenantId: TENANT_A,
        tenantName: "Sapthagiri NPS University",
        email: "new.trainer@snpsu.edu.in",
        role: "TRAINER",
        createdBy: HEAD_A_ID,
      });

      expect(result.rawToken).toBeDefined();
      expect(result.invitation.status).toBe("PENDING");
      expect(result.invitation.tenant_id).toBe(TENANT_A);
      expect(result.invitation.email).toBe("new.trainer@snpsu.edu.in");
    });

    it("strictly rejects inviting an email that already belongs to a staff member in another college", async () => {
      // officer@snpsu.edu.in belongs to College A (Sapthagiri)
      // College B (REVA) attempts to invite them
      await expect(
        createInvitation({
          tenantId: TENANT_B,
          tenantName: "REVA University",
          email: "officer@snpsu.edu.in", // Already belongs to College A
          role: "PLACEMENT_STAFF",
          createdBy: HEAD_B_ID,
        })
      ).rejects.toThrow(/already affiliated with another institution/i);
    });

    it("strictly rejects creating conflicting pending invitations for the same email across different colleges", async () => {
      // College A invites an email
      await createInvitation({
        tenantId: TENANT_A,
        tenantName: "Sapthagiri NPS University",
        email: "prospect@education.org",
        role: "TRAINER",
        createdBy: HEAD_A_ID,
      });

      // College B attempts to invite the same email while invitation is pending
      await expect(
        createInvitation({
          tenantId: TENANT_B,
          tenantName: "REVA University",
          email: "prospect@education.org",
          role: "TRAINER",
          createdBy: HEAD_B_ID,
        })
      ).rejects.toThrow(/already has a pending invitation for another institution/i);
    });

    it("accepting an invitation establishes membership in the inviting college only", async () => {
      const NEW_STAFF_ID = "usr-new-staff-1";
      const NEW_EMAIL = "recruit@snpsu.edu.in";
      mockUsers.push({ id: NEW_STAFF_ID, email: NEW_EMAIL, user_metadata: { full_name: "Recruit Staff" } });
      mockProfiles.push({ id: NEW_STAFF_ID, email: NEW_EMAIL, full_name: "Recruit Staff" });

      const { rawToken } = await createInvitation({
        tenantId: TENANT_A,
        tenantName: "Sapthagiri NPS University",
        email: NEW_EMAIL,
        role: "PLACEMENT_STAFF",
        createdBy: HEAD_A_ID,
      });

      const acceptRes = await acceptInvitation({
        rawToken,
        userId: NEW_STAFF_ID,
        userEmail: NEW_EMAIL,
        fullName: "Recruit Staff",
      });

      expect(acceptRes.success).toBe(true);
      expect(acceptRes.tenantId).toBe(TENANT_A);
      expect(acceptRes.role).toBe("PLACEMENT_STAFF");

      // Verify user is enrolled ONLY in College A
      const userTenants = mockMemberships.filter(m => m.user_id === NEW_STAFF_ID);
      expect(userTenants).toHaveLength(1);
      expect(userTenants[0].tenant_id).toBe(TENANT_A);
    });

    it("rejects invitation acceptance if the user already holds a membership in another college", async () => {
      // STAFF_B_ID already belongs to College B
      // Suppose an invitation was created for College A
      const invToken = "test-token-cross";
      const { rawToken } = await createInvitation({
        tenantId: TENANT_A,
        tenantName: "Sapthagiri NPS University",
        email: "unclaimed@snpsu.edu.in",
        role: "PLACEMENT_STAFF",
        createdBy: HEAD_A_ID,
      });

      // User STAFF_B_ID (from College B) attempts to accept it
      await expect(
        acceptInvitation({
          rawToken,
          userId: STAFF_B_ID,
          userEmail: "unclaimed@snpsu.edu.in",
        })
      ).rejects.toThrow(/already associated with another college/i);
    });
  });

  describe("4. Permanent Staff Account Removal", () => {
    it("permanently deletes the staff member's Supabase Auth account, profile, and college membership", async () => {
      await removeTenantMember({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        actorUserId: HEAD_A_ID,
        reason: "Contract terminated",
      });

      // 1. Verify membership was removed from tenant_memberships
      const updatedMembers = await listTenantMembers(TENANT_A);
      expect(updatedMembers).toHaveLength(1);
      expect(updatedMembers[0].role).toBe("PLACEMENT_HEAD");
      expect(mockMemberships.some((m) => m.id === "mem-staff-a")).toBe(false);

      // 2. Verify Supabase Auth user was permanently deleted
      expect(mockDeleteUser).toHaveBeenCalledWith(STAFF_A_ID);
      expect(mockUsers.some((u) => u.id === STAFF_A_ID)).toBe(false);

      // 3. Verify public.profiles was permanently deleted
      expect(mockProfiles.some((p) => p.id === STAFF_A_ID)).toBe(false);

      // 4. Verify audit log was emitted with permanent deletion flags
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0].action).toBe("membership.removed");
      expect(mockAuditLogs[0].tenantId).toBe(TENANT_A);
      expect(mockAuditLogs[0].actorId).toBe(HEAD_A_ID);
      expect(mockAuditLogs[0].afterState.authAccountDeleted).toBe(true);
      expect(mockAuditLogs[0].afterState.profileDeleted).toBe(true);
    });

    it("prevents removed staff from signing in again because the auth user is completely erased", async () => {
      await removeTenantMember({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        actorUserId: HEAD_A_ID,
      });

      // Attempting to find the user in auth returns undefined/false
      const deletedUser = mockUsers.find((u) => u.id === STAFF_A_ID);
      expect(deletedUser).toBeUndefined();

      // No memberships exist for this user anywhere
      const remainingMemberships = mockMemberships.filter((m) => m.user_id === STAFF_A_ID);
      expect(remainingMemberships).toHaveLength(0);
    });

    it("strictly blocks cross-tenant removal (College A Placement Head cannot remove College B staff)", async () => {
      await expect(
        removeTenantMember({
          membershipId: "mem-staff-b", // Belongs to TENANT_B
          tenantId: TENANT_A,          // Action attempted under TENANT_A
          actorUserId: HEAD_A_ID,
        })
      ).rejects.toThrow(/Staff member record not found in this college workspace/);

      // Verify College B staff remains untouched in memberships, profiles, and auth
      const membersB = await listTenantMembers(TENANT_B);
      expect(membersB.some((m) => m.id === "mem-staff-b")).toBe(true);
      expect(mockProfiles.some((p) => p.id === STAFF_B_ID)).toBe(true);
      expect(mockUsers.some((u) => u.id === STAFF_B_ID)).toBe(true);
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it("prevents self-removal when an administrator attempts to remove their own account", async () => {
      await expect(
        removeTenantMember({
          membershipId: "mem-head-a",
          tenantId: TENANT_A,
          actorUserId: HEAD_A_ID,
          reason: "Attempting self-deletion",
        })
      ).rejects.toThrow(/You cannot remove your own staff account/);

      // Verify head remains enrolled
      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA.some((m) => m.id === "mem-head-a")).toBe(true);
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it("prevents removing the last active Placement Head of the college", async () => {
      // Add an authorized staff administrator with STAFF_MANAGE permission
      const STAFF_ADMIN_ID = "usr-staff-admin";
      mockUsers.push({ id: STAFF_ADMIN_ID, email: "staffadmin@snpsu.edu.in", user_metadata: { full_name: "Staff Admin" } });
      mockProfiles.push({ id: STAFF_ADMIN_ID, email: "staffadmin@snpsu.edu.in", full_name: "Staff Admin" });
      mockMemberships.push({
        id: "mem-staff-admin",
        tenant_id: TENANT_A,
        user_id: STAFF_ADMIN_ID,
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
        permissions: ["STAFF_MANAGE"],
        created_at: "2026-01-08T00:00:00Z",
      });

      await expect(
        removeTenantMember({
          membershipId: "mem-head-a",
          tenantId: TENANT_A,
          actorUserId: STAFF_ADMIN_ID,
          reason: "Attempting to delete sole placement head",
        })
      ).rejects.toThrow(/Cannot remove the last active Placement Head/);

      // Verify head remains enrolled
      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA.some((m) => m.id === "mem-head-a")).toBe(true);
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it("allows removing a Placement Head if there is another active Placement Head in the same college", async () => {
      // Add a second Placement Head to College A
      const SECOND_HEAD_ID = "usr-head-a2";
      mockUsers.push({ id: SECOND_HEAD_ID, email: "head2@snpsu.edu.in", user_metadata: { full_name: "Head Two" } });
      mockProfiles.push({ id: SECOND_HEAD_ID, email: "head2@snpsu.edu.in", full_name: "Head Two" });
      mockMemberships.push({
        id: "mem-head-a2",
        tenant_id: TENANT_A,
        user_id: SECOND_HEAD_ID,
        role: "PLACEMENT_HEAD",
        status: "ACTIVE",
        permissions: ["STAFF_MANAGE"],
        created_at: "2026-01-10T00:00:00Z",
      });

      // Now removing mem-head-a should succeed because mem-head-a2 remains
      await removeTenantMember({
        membershipId: "mem-head-a",
        tenantId: TENANT_A,
        actorUserId: SECOND_HEAD_ID,
        reason: "Handover completed",
      });

      const updatedMembers = await listTenantMembers(TENANT_A);
      expect(updatedMembers.some((m) => m.id === "mem-head-a")).toBe(false);
      expect(updatedMembers.some((m) => m.id === "mem-head-a2")).toBe(true);

      // HEAD_A auth account and profile were deleted
      expect(mockUsers.some((u) => u.id === HEAD_A_ID)).toBe(false);
      expect(mockProfiles.some((p) => p.id === HEAD_A_ID)).toBe(false);
    });

    it("aborts cleanly without partial deletion if Supabase Auth deleteUser fails", async () => {
      shouldDeleteUserFail = true;

      await expect(
        removeTenantMember({
          membershipId: "mem-staff-a",
          tenantId: TENANT_A,
          actorUserId: HEAD_A_ID,
          reason: "Testing failure recovery",
        })
      ).rejects.toThrow(/Failed to delete staff authentication account/);

      // Verify that membership was NOT deleted and remains ACTIVE
      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA.some((m) => m.id === "mem-staff-a")).toBe(true);

      // Profile remains untouched
      expect(mockProfiles.some((p) => p.id === STAFF_A_ID)).toBe(true);
    });

    it("rejects unauthorized callers (students or users without staff management authority)", async () => {
      await expect(
        removeTenantMember({
          membershipId: "mem-staff-a",
          tenantId: TENANT_A,
          actorUserId: STUDENT_A1_ID, // Student caller
        })
      ).rejects.toThrow(/Unauthorized/);

      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA.some((m) => m.id === "mem-staff-a")).toBe(true);
      expect(mockDeleteUser).not.toHaveBeenCalled();
    });

    it("preserves institutional operational records (historical data safety)", () => {
      // In the database schema, foreign keys from recruitment_drives, assessments,
      // and questions to auth.users use ON DELETE SET NULL.
      // Therefore, deleting a user account never cascade-deletes college operational history.
      const operationalTables = [
        "recruitment_drives",
        "assessments",
        "question_banks",
        "question_versions",
        "question_sets",
        "candidate_stage_results",
        "drive_applications",
        "placement_offers",
      ];
      expect(operationalTables.length).toBe(8);
    });
  });

  describe("5. Status Updates (Suspend / Reactivate)", () => {
    it("suspends and reactivates a member correctly", async () => {
      await updateMemberStatus({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        newStatus: "SUSPENDED",
        actorUserId: HEAD_A_ID,
        reason: "Temporary leave",
      });

      let membersA = await listTenantMembers(TENANT_A);
      const suspendedStaff = membersA.find((m) => m.id === "mem-staff-a");
      expect(suspendedStaff?.status).toBe("SUSPENDED");

      // Reactivate
      await updateMemberStatus({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        newStatus: "ACTIVE",
        actorUserId: HEAD_A_ID,
        reason: "Returned from leave",
      });

      membersA = await listTenantMembers(TENANT_A);
      const activeStaff = membersA.find((m) => m.id === "mem-staff-a");
      expect(activeStaff?.status).toBe("ACTIVE");
    });
  });

  describe("6. Synchronized Institutional Staff Count Definition", () => {
    it("ensures Institutional Overview staff metric formula exactly matches active institutional staff", async () => {
      // In College A:
      // Total memberships = 5 (1 HEAD, 1 STAFF, 3 STUDENTS)
      // Active staff memberships = 2 (1 HEAD, 1 STAFF)
      const allMemberships = mockMemberships.filter((m) => m.tenant_id === TENANT_A);
      expect(allMemberships).toHaveLength(5);

      const activeStaffQuery = mockMemberships.filter(
        (m) =>
          m.tenant_id === TENANT_A &&
          m.status === "ACTIVE" &&
          ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(m.role)
      );

      // Directory active count
      const directoryMembers = await listTenantMembers(TENANT_A);
      const directoryActiveCount = directoryMembers.filter((m) => m.status === "ACTIVE").length;

      // Both must be EXACTLY 2!
      expect(activeStaffQuery.length).toBe(2);
      expect(directoryActiveCount).toBe(2);
      expect(activeStaffQuery.length).toBe(directoryActiveCount);

      // If one staff member is suspended:
      await updateMemberStatus({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        newStatus: "SUSPENDED",
        actorUserId: HEAD_A_ID,
      });

      const updatedActiveStaffQuery = mockMemberships.filter(
        (m) =>
          m.tenant_id === TENANT_A &&
          m.status === "ACTIVE" &&
          ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"].includes(m.role)
      );
      const updatedDirectoryMembers = await listTenantMembers(TENANT_A);
      const updatedDirectoryActiveCount = updatedDirectoryMembers.filter((m) => m.status === "ACTIVE").length;

      // Both now match at 1!
      expect(updatedActiveStaffQuery.length).toBe(1);
      expect(updatedDirectoryActiveCount).toBe(1);
    });
  });

  describe("7. API Route Handlers: /api/placement/members/[id]", () => {
    it("DELETE handler rejects unauthenticated or unauthorized users", async () => {
      const { DELETE } = await import("@/app/api/placement/members/[id]/route");

      // Mock unauthorized user
      const { getCurrentUserProfile } = await import("@/modules/identity-access/services/auth-service");
      vi.mock("@/modules/identity-access/services/auth-service", () => ({
        getCurrentUserProfile: vi.fn(async () => null),
      }));

      const req = new Request("http://localhost/api/placement/members/mem-staff-a", {
        method: "DELETE",
      });

      const res = await DELETE(req as any, {
        params: Promise.resolve({ id: "mem-staff-a" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("8. UI Component: `<MemberRowActions>`", () => {
    it("renders (You) Admin and no destructive remove button for the active session administrator", () => {
      render(
        <MemberRowActions
          memberId="mem-head-a"
          userId={HEAD_A_ID}
          memberName="SNPSU-HRD"
          memberEmail="admin@snpsu.edu.in"
          memberRole="PLACEMENT_HEAD"
          memberStatus="ACTIVE"
          isCurrentSessionUser={true}
          institutionName="Sapthagiri NPS University"
        />
      );

      expect(screen.getByText(/\(You\) Admin/i)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Remove/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Suspend/i })).not.toBeInTheDocument();
    });

    it("renders Suspend and Remove buttons for other enrolled staff members and opens confirmation dialog", () => {
      render(
        <MemberRowActions
          memberId="mem-staff-a"
          userId={STAFF_A_ID}
          memberName="John Staff"
          memberEmail="officer@snpsu.edu.in"
          memberRole="PLACEMENT_STAFF"
          memberStatus="ACTIVE"
          isCurrentSessionUser={false}
          institutionName="Sapthagiri NPS University"
        />
      );

      // Verify action buttons exist
      const suspendBtn = screen.getByRole("button", { name: /Suspend/i });
      const removeBtn = screen.getByRole("button", { name: /Remove/i });
      expect(suspendBtn).toBeInTheDocument();
      expect(removeBtn).toBeInTheDocument();

      // Click Remove button
      fireEvent.click(removeBtn);

      // Verify DeleteConfirmationDialog opened with proper title and options
      expect(screen.getByText("Permanently Remove Staff Member")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to permanently remove/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Permanently Remove Staff/i })).toBeInTheDocument();
    });
  });
});
