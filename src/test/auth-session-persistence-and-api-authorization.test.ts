import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getNotifications } from "@/app/api/notifications/route";
import { GET as getProfile } from "@/app/api/profile/route";
import { GET as getStudentDashboard } from "@/app/api/student/dashboard/route";
import { getTabAccessToken } from "@/lib/auth/auth-fetch";
import { getTabStorageKey } from "@/lib/auth/auth-tab";

// Mock Supabase Server and Admin
const mockUser = {
  id: "student-user-uuid-1",
  email: "alex@student.xyz.edu",
  app_metadata: {
    role: "STUDENT",
    account_category: "STUDENT",
    tenant_id: "tenant-xyz-001",
    verified_by_server: true,
  },
  user_metadata: {
    full_name: "Alex Rivera",
  },
};

const mockStudentProfile = {
  id: mockUser.id,
  email: mockUser.email,
  fullName: "Alex Rivera",
  role: "STUDENT" as const,
  accountCategory: "STUDENT" as const,
  institutionName: "XYZ Institute",
  isPlatformAdmin: false,
  avatarUrl: null,
  memberships: [
    {
      id: "membership-1",
      tenant_id: "tenant-xyz-001",
      user_id: mockUser.id,
      role: "STUDENT" as const,
      status: "ACTIVE" as const,
      permissions: [],
      tenants: { id: "tenant-xyz-001", name: "XYZ Institute", status: "ACTIVE" },
    },
  ],
  activeMembership: {
    id: "membership-1",
    tenant_id: "tenant-xyz-001",
    user_id: mockUser.id,
    role: "STUDENT" as const,
    status: "ACTIVE" as const,
    permissions: [],
    tenants: { id: "tenant-xyz-001", name: "XYZ Institute", status: "ACTIVE" },
  },
  isVerifiedMembership: true,
  membershipStatus: "ACTIVE" as const,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(async (token: string) => {
        if (token === "valid-student-token") {
          return { data: { user: mockUser }, error: null };
        }
        return { data: { user: null }, error: new Error("Invalid token") };
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => {
        if (table === "students") {
          return {
            data: {
              id: "student-row-id-1",
              user_id: mockUser.id,
              tenant_id: "tenant-xyz-001",
              full_name: "Alex Rivera",
              academic_status: "ACTIVE",
              is_archived: false,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    })),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async (explicitToken?: string) => ({
    auth: {
      getUser: vi.fn(async (jwt?: string) => {
        const token = jwt || explicitToken;
        if (token === "valid-student-token") {
          return { data: { user: mockUser }, error: null };
        }
        return { data: { user: null }, error: { message: "Auth session missing!" } };
      }),
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn(async () => {
        if (table === "students") {
          return {
            data: {
              id: "student-row-id-1",
              user_id: mockUser.id,
              tenant_id: "tenant-xyz-001",
              full_name: "Alex Rivera",
              academic_status: "ACTIVE",
              is_archived: false,
            },
            error: null,
          };
        }
        return { data: null, error: null };
      }),
    })),
  })),
}));

vi.mock("@/modules/notifications/services/notification-service", () => ({
  NotificationService: {
    listNotifications: vi.fn(async () => ({
      notifications: [
        {
          id: "notif-1",
          title: "Assessment Scheduled",
          message: "DSA Mock Assessment is now available.",
          type: "ASSESSMENT",
          read_at: null,
          created_at: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
      total: 1,
    })),
  },
}));

vi.mock("@/modules/identity-access/services/auth-service", () => ({
  getCurrentUserProfile: vi.fn(async (_tenantId?: string, explicitToken?: string) => {
    if (explicitToken === "valid-student-token") {
      return mockStudentProfile;
    }
    return null;
  }),
}));

vi.mock("@/lib/auth/server-context", () => ({
  requireAuthContext: vi.fn(async (_perm?: string, _tenant?: string, explicitToken?: string) => {
    if (explicitToken === "valid-student-token") {
      return {
        userId: mockUser.id,
        email: mockUser.email,
        isPlatformAdmin: false,
        tenantId: "tenant-xyz-001",
        tenantRole: "STUDENT",
        tenantStatus: "ACTIVE",
        membershipStatus: "ACTIVE",
      };
    }
    throw new Error("UNAUTHORIZED");
  }),
}));

describe("Authentication, Session Persistence & Intermittent API Authorization Regression Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. /api/notifications Authorization & Identity Resolution", () => {
    it("returns 200 with notification payload when valid Bearer token is attached", async () => {
      const req = new NextRequest("http://localhost:3000/api/notifications?limit=30", {
        headers: {
          authorization: "Bearer valid-student-token",
        },
      });

      const res = await getNotifications(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.notifications).toHaveLength(1);
      expect(json.unreadCount).toBe(1);
    });

    it("returns 401 Unauthorized when request carries no session or invalid token", async () => {
      const req = new NextRequest("http://localhost:3000/api/notifications?limit=30");
      const res = await getNotifications(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });
  });

  describe("2. /api/profile Authorization & Error Resilience", () => {
    it("returns 200 with complete profile when Bearer token is provided", async () => {
      const req = new NextRequest("http://localhost:3000/api/profile", {
        headers: {
          authorization: "Bearer valid-student-token",
        },
      });

      const res = await getProfile(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.profile.id).toBe(mockUser.id);
      expect(json.profile.email).toBe(mockUser.email);
      expect(json.profile.role).toBe("STUDENT");
    });

    it("returns 401 Unauthorized when request has no active session", async () => {
      const req = new NextRequest("http://localhost:3000/api/profile");
      const res = await getProfile(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toBe("UNAUTHORIZED");
    });
  });

  describe("3. /api/student/dashboard HTTP Status Accuracy & Authorization", () => {
    it("returns 200 with metrics and assessments when student is authorized", async () => {
      const req = new NextRequest("http://localhost:3000/api/student/dashboard", {
        headers: {
          authorization: "Bearer valid-student-token",
        },
      });

      const res = await getStudentDashboard(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.studentId).toBe("student-row-id-1");
      expect(json.studentName).toBe("Alex Rivera");
      expect(json.metrics).toBeDefined();
    });

    it("returns 401 Unauthorized (NOT 403) when user session is missing or unauthenticated", async () => {
      const req = new NextRequest("http://localhost:3000/api/student/dashboard");
      const res = await getStudentDashboard(req);
      expect(res.status).toBe(401);

      const json = await res.json();
      expect(json.error).toContain("UNAUTHORIZED");
    });
  });

  describe("4. getTabAccessToken Tab Storage Isolation & Non-Leakage", () => {
    it("returns null when tab sessionStorage is empty even if document.cookie contains auth tokens", () => {
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "sb-access-token=shared-origin-cookie-token; path=/",
      });

      // Strict Tab Isolation: An unauthenticated tab must NOT steal or adopt origin cookies
      const token = getTabAccessToken();
      expect(token).toBeNull();
    });

    it("reads and returns the tab's isolated access token when present in tabSessionStorage", () => {
      const storageKey = getTabStorageKey();
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ access_token: "tab-isolated-bearer-token" })
      );

      const token = getTabAccessToken();
      expect(token).toBe("tab-isolated-bearer-token");
    });
  });
});
