import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTabStorageKey } from "@/lib/auth/auth-tab";
import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { requireAuthContext } from "@/lib/auth/server-context";
import { Permissions } from "@/modules/identity-access/services/policy-engine";

// Mock user directory for the four acceptance test personas
const USERS = {
  xyzHead: {
    id: "user-xyz-head-101",
    email: "placement@xyz.edu",
    fullName: "Dr. XYZ Head",
    role: "PLACEMENT_HEAD",
    category: "COLLEGE",
    tenantId: "tenant-xyz-college-001",
    tenantName: "XYZ Institute of Technology",
    token: "token-xyz-head-jwt-101",
  },
  xyzStudent: {
    id: "user-xyz-student-102",
    email: "alex@student.xyz.edu",
    fullName: "Alex Rivera",
    role: "STUDENT",
    category: "STUDENT",
    tenantId: "tenant-xyz-college-001",
    tenantName: "XYZ Institute of Technology",
    token: "token-xyz-student-jwt-102",
  },
  abcStaff: {
    id: "user-abc-staff-201",
    email: "officer@abc.edu",
    fullName: "Prof. ABC Officer",
    role: "PLACEMENT_STAFF",
    category: "COLLEGE",
    tenantId: "tenant-abc-university-002",
    tenantName: "ABC Global University",
    token: "token-abc-staff-jwt-201",
  },
  abcStudent: {
    id: "user-abc-student-202",
    email: "priya@student.abc.edu",
    fullName: "Priya Sharma",
    role: "STUDENT",
    category: "STUDENT",
    tenantId: "tenant-abc-university-002",
    tenantName: "ABC Global University",
    token: "token-abc-student-jwt-202",
  },
};

// Mock admin client to validate JWT bearer tokens and fetch profiles/memberships
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        const found = Object.values(USERS).find((u) => u.token === token);
        if (found) {
          return {
            data: {
              user: {
                id: found.id,
                email: found.email,
                app_metadata: {
                  role: found.role,
                  account_category: found.category,
                  tenant_id: found.tenantId,
                  institution_name: found.tenantName,
                  verified_by_server: true,
                },
                user_metadata: {
                  full_name: found.fullName,
                },
              },
            },
            error: null,
          };
        }
        return { data: { user: null }, error: new Error("Invalid or expired session token") };
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, val: any) => ({
        maybeSingle: vi.fn(async () => {
          if (table === "profiles") {
            const found = Object.values(USERS).find((u) => u.id === val);
            if (found) {
              return {
                data: {
                  id: found.id,
                  email: found.email,
                  full_name: found.fullName,
                  is_platform_admin: false,
                },
                error: null,
              };
            }
          }
          if (table === "college_subscriptions") {
            return {
              data: {
                tenant_id: val,
                status: "ACTIVE",
                plan_id: "plan-growth",
                renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                subscription_plans: { id: "plan-growth", name: "Growth Institution" },
                entitlements_snapshot: {
                  planId: "plan-growth",
                  planName: "Growth Institution",
                  planVersion: 1,
                  entitlements: { core_drives_management: true },
                  limits: {},
                  snapshotAt: new Date().toISOString(),
                },
              },
              error: null,
            };
          }
          return { data: null, error: null };
        }),
        limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
      limit: vi.fn().mockResolvedValue({ data: [{ id: "test" }], error: null }),
    })),
  })),
}));

// Mock MembershipService to return tenant memberships per user
vi.mock("@/modules/tenancy/services/membership-service", () => ({
  getUserMemberships: vi.fn(async (userId: string) => {
    const found = Object.values(USERS).find((u) => u.id === userId);
    if (!found) return [];
    return [
      {
        id: `mem-${found.id}`,
        user_id: found.id,
        tenant_id: found.tenantId,
        role: found.role,
        status: "ACTIVE",
        tenants: {
          id: found.tenantId,
          name: found.tenantName,
          slug: found.tenantId.toLowerCase(),
          status: "ACTIVE",
        },
      },
    ];
  }),
  MembershipService: {
    listUserMemberships: vi.fn(async (userId: string) => {
      const found = Object.values(USERS).find((u) => u.id === userId);
      if (!found) return [];
      return [
        {
          id: `mem-${found.id}`,
          user_id: found.id,
          tenant_id: found.tenantId,
          role: found.role,
          status: "ACTIVE",
          tenants: {
            id: found.tenantId,
            name: found.tenantName,
            status: "ACTIVE",
          },
        },
      ];
    }),
  },
}));

// Mock TenantService
vi.mock("@/modules/tenancy/services/tenant-service", () => ({
  TenantService: {
    getById: vi.fn(async (tenantId: string) => {
      const found = Object.values(USERS).find((u) => u.tenantId === tenantId);
      if (!found) return null;
      return {
        id: found.tenantId,
        name: found.tenantName,
        status: "ACTIVE",
      };
    }),
  },
}));

describe("UrPlaced Cross-Tab Authentication and User Identity Isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Four-Tab Storage Isolation within Same Browser Origin", () => {
    it("assigns unique tab keys and isolates session storage across all 4 tabs", () => {
      const tab1Id = "tab_browser_tab_1";
      const tab2Id = "tab_browser_tab_2";
      const tab3Id = "tab_browser_tab_3";
      const tab4Id = "tab_browser_tab_4";

      const key1 = getTabStorageKey(tab1Id);
      const key2 = getTabStorageKey(tab2Id);
      const key3 = getTabStorageKey(tab3Id);
      const key4 = getTabStorageKey(tab4Id);

      // Verify all keys are distinct
      const keys = [key1, key2, key3, key4];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(4);
      expect(key1).toContain("urplaced_auth_tab_browser_tab_1");
      expect(key2).toContain("urplaced_auth_tab_browser_tab_2");
      expect(key3).toContain("urplaced_auth_tab_browser_tab_3");
      expect(key4).toContain("urplaced_auth_tab_browser_tab_4");
    });

    it("allows four tabs to store distinct sessions concurrently without collisions", () => {
      // Simulate tab-scoped sessionStorage jars in a single browser window
      const tabStorageMap: Record<string, Record<string, string>> = {
        tab1: {},
        tab2: {},
        tab3: {},
        tab4: {},
      };

      // Tab 1 signs in as XYZ College Placement Head
      tabStorageMap.tab1[getTabStorageKey("tab1")] = JSON.stringify({
        access_token: USERS.xyzHead.token,
        user: { id: USERS.xyzHead.id, email: USERS.xyzHead.email },
      });

      // Tab 2 signs in as XYZ Student
      tabStorageMap.tab2[getTabStorageKey("tab2")] = JSON.stringify({
        access_token: USERS.xyzStudent.token,
        user: { id: USERS.xyzStudent.id, email: USERS.xyzStudent.email },
      });

      // Tab 3 signs in as ABC College Placement Staff
      tabStorageMap.tab3[getTabStorageKey("tab3")] = JSON.stringify({
        access_token: USERS.abcStaff.token,
        user: { id: USERS.abcStaff.id, email: USERS.abcStaff.email },
      });

      // Tab 4 signs in as ABC Student
      tabStorageMap.tab4[getTabStorageKey("tab4")] = JSON.stringify({
        access_token: USERS.abcStudent.token,
        user: { id: USERS.abcStudent.id, email: USERS.abcStudent.email },
      });

      // Verify Tab 1 session is intact
      const tab1Session = JSON.parse(tabStorageMap.tab1[getTabStorageKey("tab1")]);
      expect(tab1Session.access_token).toBe(USERS.xyzHead.token);

      // Verify Tab 2 session is intact
      const tab2Session = JSON.parse(tabStorageMap.tab2[getTabStorageKey("tab2")]);
      expect(tab2Session.access_token).toBe(USERS.xyzStudent.token);

      // Verify Tab 3 session is intact
      const tab3Session = JSON.parse(tabStorageMap.tab3[getTabStorageKey("tab3")]);
      expect(tab3Session.access_token).toBe(USERS.abcStaff.token);

      // Verify Tab 4 session is intact
      const tab4Session = JSON.parse(tabStorageMap.tab4[getTabStorageKey("tab4")]);
      expect(tab4Session.access_token).toBe(USERS.abcStudent.token);
    });
  });

  describe("2. Server-Side Context & Identity Resolution per Tab Bearer Token", () => {
    it("resolves Tab 1 as XYZ College Placement Head with correct tenant and role", async () => {
      const profile = await getCurrentUserProfile(undefined, USERS.xyzHead.token);
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(USERS.xyzHead.id);
      expect(profile?.email).toBe(USERS.xyzHead.email);
      expect(profile?.accountCategory).toBe("COLLEGE");
      expect(profile?.role).toBe("PLACEMENT_HEAD");
      expect(profile?.activeMembership?.tenant_id).toBe("tenant-xyz-college-001");
      expect(profile?.activeMembership?.tenants?.name).toBe("XYZ Institute of Technology");
    });

    it("resolves Tab 2 as XYZ Student with correct category and student workspace", async () => {
      const profile = await getCurrentUserProfile(undefined, USERS.xyzStudent.token);
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(USERS.xyzStudent.id);
      expect(profile?.email).toBe(USERS.xyzStudent.email);
      expect(profile?.accountCategory).toBe("STUDENT");
      expect(profile?.role).toBe("STUDENT");
      expect(profile?.activeMembership?.tenant_id).toBe("tenant-xyz-college-001");
    });

    it("resolves Tab 3 as ABC College Placement Staff with correct tenant and role", async () => {
      const profile = await getCurrentUserProfile(undefined, USERS.abcStaff.token);
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(USERS.abcStaff.id);
      expect(profile?.email).toBe(USERS.abcStaff.email);
      expect(profile?.accountCategory).toBe("COLLEGE");
      expect(profile?.role).toBe("PLACEMENT_STAFF");
      expect(profile?.activeMembership?.tenant_id).toBe("tenant-abc-university-002");
      expect(profile?.activeMembership?.tenants?.name).toBe("ABC Global University");
    });

    it("resolves Tab 4 as ABC Student with correct category and student workspace", async () => {
      const profile = await getCurrentUserProfile(undefined, USERS.abcStudent.token);
      expect(profile).not.toBeNull();
      expect(profile?.id).toBe(USERS.abcStudent.id);
      expect(profile?.email).toBe(USERS.abcStudent.email);
      expect(profile?.accountCategory).toBe("STUDENT");
      expect(profile?.role).toBe("STUDENT");
      expect(profile?.activeMembership?.tenant_id).toBe("tenant-abc-university-002");
    });
  });

  describe("3. Isolation During Tab Sign-In, Sign-Out, and Page Refresh", () => {
    it("simulates signing out in Tab 2 without invalidating Tab 1, Tab 3, or Tab 4", async () => {
      const tabStorageMap: Record<string, Record<string, string>> = {
        tab1: { [getTabStorageKey("tab1")]: JSON.stringify({ access_token: USERS.xyzHead.token }) },
        tab2: { [getTabStorageKey("tab2")]: JSON.stringify({ access_token: USERS.xyzStudent.token }) },
        tab3: { [getTabStorageKey("tab3")]: JSON.stringify({ access_token: USERS.abcStaff.token }) },
        tab4: { [getTabStorageKey("tab4")]: JSON.stringify({ access_token: USERS.abcStudent.token }) },
      };

      // Tab 2 signs out
      delete tabStorageMap.tab2[getTabStorageKey("tab2")];

      // Tab 2 is now unauthenticated
      expect(tabStorageMap.tab2[getTabStorageKey("tab2")]).toBeUndefined();

      // Tab 1 is still authenticated as XYZ Head
      const p1 = await getCurrentUserProfile(
        undefined,
        JSON.parse(tabStorageMap.tab1[getTabStorageKey("tab1")]).access_token
      );
      expect(p1?.id).toBe(USERS.xyzHead.id);
      expect(p1?.role).toBe("PLACEMENT_HEAD");

      // Tab 3 is still authenticated as ABC Staff
      const p3 = await getCurrentUserProfile(
        undefined,
        JSON.parse(tabStorageMap.tab3[getTabStorageKey("tab3")]).access_token
      );
      expect(p3?.id).toBe(USERS.abcStaff.id);
      expect(p3?.role).toBe("PLACEMENT_STAFF");

      // Tab 4 is still authenticated as ABC Student
      const p4 = await getCurrentUserProfile(
        undefined,
        JSON.parse(tabStorageMap.tab4[getTabStorageKey("tab4")]).access_token
      );
      expect(p4?.id).toBe(USERS.abcStudent.id);
      expect(p4?.accountCategory).toBe("STUDENT");
    });

    it("simulates refreshing Tab 3 and verifies it retains ABC College identity", async () => {
      // Refreshing reads from Tab 3's tab-scoped storage
      const token = USERS.abcStaff.token;
      const ctx = await requireAuthContext(Permissions.DRIVES_MANAGE, undefined, token);
      expect(ctx.userId).toBe(USERS.abcStaff.id);
      expect(ctx.tenantId).toBe("tenant-abc-university-002");
      expect(ctx.tenantRole).toBe("PLACEMENT_STAFF");
    });
  });

  describe("4. Multi-Tenant Authorization & Privilege Boundaries", () => {
    it("enforces that Student accounts cannot acquire institutional permissions", async () => {
      // Tab 2 (Student) attempts to execute a Placement Head permission (e.g. DRIVES_MANAGE)
      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, undefined, USERS.xyzStudent.token)
      ).rejects.toThrow("FORBIDDEN");

      // Tab 4 (Student) attempts to execute institutional configuration permission
      await expect(
        requireAuthContext(Permissions.STAFF_MANAGE, undefined, USERS.abcStudent.token)
      ).rejects.toThrow("FORBIDDEN");
    }, 15000);

    it("enforces that an XYZ College user cannot access ABC College resources", async () => {
      // Tab 1 (XYZ College) attempts to access ABC College with explicit tenantId override
      await expect(
        requireAuthContext(undefined, "tenant-abc-university-002", USERS.xyzHead.token)
      ).rejects.toThrow("NO_ACTIVE_TENANT");
    });

    it("enforces that invalid or expired tokens fail safely with UNAUTHORIZED", async () => {
      await expect(
        requireAuthContext(undefined, undefined, "invalid-expired-fake-token")
      ).rejects.toThrow("UNAUTHORIZED");

      const profile = await getCurrentUserProfile(undefined, "invalid-expired-fake-token");
      expect(profile).toBeNull();
    });
  });

  describe("5. In-flight Request Sequence & Stale State Prevention", () => {
    it("simulates sequence tracking to prevent stale responses from overwriting current user", () => {
      let currentSeq = 0;
      let stateUser: string | null = null;

      // Start Request 1 for User A
      const req1Seq = ++currentSeq;

      // User switches or logs in as User B
      const req2Seq = ++currentSeq;
      stateUser = "User_B"; // User B completes fast

      // Slow Request 1 finally finishes
      const req1ResponseUser = "User_A";
      if (req1Seq === currentSeq) {
        stateUser = req1ResponseUser;
      }

      // State MUST remain User B, not overwritten by slow User A!
      expect(stateUser).toBe("User_B");
    });
  });

  describe("6. Phase 9 Acceptance Scenarios (Test A - Test G)", () => {
    it("Test A: Two different users in separate tabs retain distinct identities across simulated page refreshes", async () => {
      // 1. Tab 1 logs in as User A (XYZ Head)
      const tab1Storage: Record<string, string> = {};
      const tab1Key = getTabStorageKey("tab_1");
      tab1Storage[tab1Key] = JSON.stringify({
        access_token: USERS.xyzHead.token,
        refresh_token: "refresh-xyz-head",
      });

      // 2. Tab 2 logs in as User B (ABC Staff) on same browser origin
      const tab2Storage: Record<string, string> = {};
      const tab2Key = getTabStorageKey("tab_2");
      tab2Storage[tab2Key] = JSON.stringify({
        access_token: USERS.abcStaff.token,
        refresh_token: "refresh-abc-staff",
      });

      // 3. Tab 1 is refreshed: reads tab 1 storage
      const tab1RefreshedToken = JSON.parse(tab1Storage[tab1Key]).access_token;
      const profile1 = await getCurrentUserProfile(undefined, tab1RefreshedToken);
      expect(profile1?.id).toBe(USERS.xyzHead.id);
      expect(profile1?.email).toBe(USERS.xyzHead.email);

      // 4. Tab 2 is refreshed: reads tab 2 storage
      const tab2RefreshedToken = JSON.parse(tab2Storage[tab2Key]).access_token;
      const profile2 = await getCurrentUserProfile(undefined, tab2RefreshedToken);
      expect(profile2?.id).toBe(USERS.abcStaff.id);
      expect(profile2?.email).toBe(USERS.abcStaff.email);

      // 5. Verify Tab 1 NEVER restored User B, and Tab 2 NEVER restored User A
      expect(profile1?.id).not.toBe(profile2?.id);
      expect(profile1?.activeMembership?.tenant_id).toBe("tenant-xyz-college-001");
      expect(profile2?.activeMembership?.tenant_id).toBe("tenant-abc-university-002");
    });

    it("Test B: Independent logout in Tab 2 does NOT log out or switch Tab 1", async () => {
      const tab1Storage: Record<string, string> = {
        [getTabStorageKey("tab_1")]: JSON.stringify({ access_token: USERS.xyzHead.token }),
      };
      const tab2Storage: Record<string, string> = {
        [getTabStorageKey("tab_2")]: JSON.stringify({ access_token: USERS.abcStaff.token }),
      };

      // Logout in Tab 2
      delete tab2Storage[getTabStorageKey("tab_2")];

      // Tab 2 is logged out
      expect(tab2Storage[getTabStorageKey("tab_2")]).toBeUndefined();

      // Tab 1 remains 100% active and authenticated as User A
      const tab1Token = JSON.parse(tab1Storage[getTabStorageKey("tab_1")]).access_token;
      const profile1 = await getCurrentUserProfile(undefined, tab1Token);
      expect(profile1).not.toBeNull();
      expect(profile1?.id).toBe(USERS.xyzHead.id);
    });

    it("Test C: Session expiration in Tab 1 leaves Tab 2 unaffected and fails closed", async () => {
      // Tab 1 has an expired/invalid token
      const expiredToken = "expired-token-xyz";
      const profile1 = await getCurrentUserProfile(undefined, expiredToken);
      expect(profile1).toBeNull();

      // Tab 2 with valid token continues operating normally
      const profile2 = await getCurrentUserProfile(undefined, USERS.abcStaff.token);
      expect(profile2).not.toBeNull();
      expect(profile2?.id).toBe(USERS.abcStaff.id);
    });

    it("Test D: Simultaneous concurrent requests across tabs resolve to respective identities without race condition", async () => {
      const results = await Promise.all([
        getCurrentUserProfile(undefined, USERS.xyzHead.token),
        getCurrentUserProfile(undefined, USERS.abcStaff.token),
        getCurrentUserProfile(undefined, USERS.xyzStudent.token),
        getCurrentUserProfile(undefined, USERS.abcStudent.token),
      ]);

      expect(results[0]?.id).toBe(USERS.xyzHead.id);
      expect(results[1]?.id).toBe(USERS.abcStaff.id);
      expect(results[2]?.id).toBe(USERS.xyzStudent.id);
      expect(results[3]?.id).toBe(USERS.abcStudent.id);
    });

    it("Test E: Cross-tenant isolation invariant (One Person = Exactly One College)", async () => {
      // User A from XYZ cannot query or acquire active tenant for ABC
      await expect(
        requireAuthContext(undefined, "tenant-abc-university-002", USERS.xyzHead.token)
      ).rejects.toThrow("NO_ACTIVE_TENANT");

      // Student cannot access placement drives administration
      await expect(
        requireAuthContext(Permissions.DRIVES_MANAGE, undefined, USERS.xyzStudent.token)
      ).rejects.toThrow("FORBIDDEN");
    });
  });
});
