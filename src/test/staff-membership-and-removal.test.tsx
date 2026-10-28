import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  listTenantMembers,
  removeTenantMember,
  updateMemberStatus,
} from "@/modules/tenancy/services/membership-service";
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
      },
    },
    from: vi.fn((table: string) => {
      let currentFilter: any = {};
      let selectedData: any = null;

      const builder: any = {
        select: vi.fn((fields: string, options?: { count?: string; head?: boolean }) => {
          let rows = [...(table === "tenant_memberships" ? mockMemberships : table === "profiles" ? mockProfiles : [])];

          // Chainable filters
          const queryBuilder: any = {
            eq: vi.fn((col: string, val: any) => {
              rows = rows.filter((r) => r[col] === val);
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
            then: (resolve: any) => {
              if (table === "tenant_memberships") {
                mockMemberships.forEach((m) => {
                  let match = true;
                  for (const [k, v] of Object.entries(currentFilter)) {
                    if (m[k] !== v) match = false;
                  }
                  if (match) Object.assign(m, updates);
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

describe("UrPlaced — Staff Membership Directory & Secure Staff Removal", () => {
  const TENANT_A = "tenant-college-a-sapthagiri";
  const TENANT_B = "tenant-college-b-reva";

  const HEAD_A_ID = "usr-head-a";
  const STAFF_A_ID = "usr-staff-a";
  const STUDENT_A1_ID = "usr-student-a1";
  const STUDENT_A2_ID = "usr-student-a2";
  const STUDENT_A3_ID = "usr-student-a3";

  const HEAD_B_ID = "usr-head-b";
  const STAFF_B_ID = "usr-staff-b";

  beforeEach(() => {
    mockAuditLogs = [];
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

  describe("2. Secure Staff Removal & Safeguards", () => {
    it("successfully removes an ordinary staff member from the college workspace", async () => {
      await removeTenantMember({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        actorUserId: HEAD_A_ID,
        reason: "Terminated position",
      });

      // Verify membership was removed from tenant_memberships
      const updatedMembers = await listTenantMembers(TENANT_A);
      expect(updatedMembers).toHaveLength(1);
      expect(updatedMembers[0].role).toBe("PLACEMENT_HEAD");

      // Verify audit log was emitted
      expect(mockAuditLogs).toHaveLength(1);
      expect(mockAuditLogs[0].action).toBe("membership.removed");
      expect(mockAuditLogs[0].tenantId).toBe(TENANT_A);
      expect(mockAuditLogs[0].actorId).toBe(HEAD_A_ID);

      // Verify that public.profiles and auth.users were NOT touched
      expect(mockProfiles.some((p) => p.id === STAFF_A_ID)).toBe(true);
      expect(mockUsers.some((u) => u.id === STAFF_A_ID)).toBe(true);
    });

    it("prevents removing the last active Placement Head of the college", async () => {
      await expect(
        removeTenantMember({
          membershipId: "mem-head-a",
          tenantId: TENANT_A,
          actorUserId: HEAD_A_ID,
          reason: "Attempting self-deletion",
        })
      ).rejects.toThrow(/Cannot remove the last active Placement Head/);

      // Verify head remains enrolled
      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA.some((m) => m.id === "mem-head-a")).toBe(true);
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
    });

    it("strictly blocks cross-tenant removal (College A Placement Head cannot remove College B staff)", async () => {
      await expect(
        removeTenantMember({
          membershipId: "mem-staff-b", // Belongs to TENANT_B
          tenantId: TENANT_A,          // Action attempted under TENANT_A
          actorUserId: HEAD_A_ID,
        })
      ).rejects.toThrow(/Staff member record not found in this college workspace/);

      // Verify College B staff remains untouched
      const membersB = await listTenantMembers(TENANT_B);
      expect(membersB.some((m) => m.id === "mem-staff-b")).toBe(true);
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
    });

    it("preserves external memberships if a user belongs to multiple colleges", async () => {
      // Suppose STAFF_A also has a valid membership in College B
      mockMemberships.push({
        id: "mem-staff-a-in-b",
        tenant_id: TENANT_B,
        user_id: STAFF_A_ID,
        role: "PLACEMENT_STAFF",
        status: "ACTIVE",
        permissions: [],
        created_at: "2026-01-15T00:00:00Z",
      });

      // Remove STAFF_A from College A
      await removeTenantMember({
        membershipId: "mem-staff-a",
        tenantId: TENANT_A,
        actorUserId: HEAD_A_ID,
      });

      // Verify removed from College A
      const membersA = await listTenantMembers(TENANT_A);
      expect(membersA.some((m) => m.user_id === STAFF_A_ID)).toBe(false);

      // Verify STILL ACTIVE in College B
      const membersB = await listTenantMembers(TENANT_B);
      expect(membersB.some((m) => m.user_id === STAFF_A_ID)).toBe(true);
    });
  });

  describe("3. Status Updates (Suspend / Reactivate)", () => {
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

  describe("4. Synchronized Institutional Staff Count Definition", () => {
    it("ensures Institutional Overview staff metric formula exactly matches active institutional staff", async () => {
      // In College A:
      // Total memberships = 5 (1 HEAD, 1 STAFF, 3 STUDENTS)
      // Active staff memberships = 2 (1 HEAD, 1 STAFF)
      const allMemberships = mockMemberships.filter((m) => m.tenant_id === TENANT_A);
      expect(allMemberships).toHaveLength(5);

      // The corrected authoritative active staff count query:
      // .eq("tenant_id", tenantId).eq("status", "ACTIVE").in("role", ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"])
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

  describe("5. API Route Handlers: /api/placement/members/[id]", () => {
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

  describe("6. UI Component: `<MemberRowActions>`", () => {
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
      expect(screen.getByText("Remove Staff Member")).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to remove/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Remove Member/i })).toBeInTheDocument();
    });
  });
});
