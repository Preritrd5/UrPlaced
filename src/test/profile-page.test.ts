import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock Supabase Admin and Client
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        updateUserById: vi.fn().mockResolvedValue({
          data: { user: { id: "mock-user-id" } },
          error: null,
        }),
      },
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
    storage: {
      getBucket: vi.fn().mockResolvedValue({ data: { id: "avatars", public: true }, error: null }),
      createBucket: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "student-123/avatar.png" }, error: null }),
        getPublicUrl: vi.fn((path: string) => ({
          data: { publicUrl: `https://mock.supabase.co/storage/v1/object/public/avatars/${path}` },
        })),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })),
  }),
}));

vi.mock("@/modules/identity-access/services/auth-service", () => ({
  getCurrentUserProfile: vi.fn(),
}));

import { getCurrentUserProfile } from "@/modules/identity-access/services/auth-service";
import { GET as getProfileHandler, PATCH as patchProfileHandler } from "@/app/api/profile/route";
import { POST as postAvatarHandler, DELETE as deleteAvatarHandler } from "@/app/api/profile/avatar/route";

describe("Production-Ready Role-Aware Profile Page & API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. GET /api/profile Authentication & Role-Aware Data", () => {
    it("returns 401 when the request is unauthenticated", async () => {
      (getCurrentUserProfile as any).mockResolvedValue(null);

      const res = await getProfileHandler();
      expect(res.status).toBe(401);

      const data = await res.json();
      expect(data.error).toBe("UNAUTHORIZED");
    });

    it("returns student-tailored metrics and details for a STUDENT account", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
        fullName: "Alex Student",
        role: "STUDENT",
        accountCategory: "STUDENT",
        avatarUrl: null,
        phone: "+91 98765 43210",
        location: "Bengaluru, Karnataka",
        bio: "Computer Science student passionate about full-stack engineering.",
        preferences: {
          weeklyGoalHours: 15,
          dailyStudyTime: "2 hours",
        },
        isVerifiedMembership: true,
        membershipStatus: "ACTIVE",
      });

      const res = await getProfileHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.profile.accountCategory).toBe("STUDENT");
      expect(data.profile.role).toBe("STUDENT");
      expect(data.profile.fullName).toBe("Alex Student");
      expect(data.studentMetrics).toBeDefined();
      expect(data.studentMetrics.testsAttempted).toBeDefined();
      expect(data.studentMetrics.averageAccuracy).toBeDefined();
    });

    it("returns institutional metrics for a COLLEGE PLACEMENT_HEAD account", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "head-123",
        email: "head@sapthagiri.edu",
        fullName: "Dr. Rajesh Kumar",
        role: "PLACEMENT_HEAD",
        accountCategory: "COLLEGE",
        institutionName: "Sapthagiri NPS University",
        tenantId: "tenant-apex-123",
        avatarUrl: null,
        phone: "+91 80 1234 5678",
        location: "Bengaluru, India",
        bio: "Director of Training & Placement.",
        isVerifiedMembership: true,
        membershipStatus: "ACTIVE",
        activeMembership: {
          tenant_id: "tenant-apex-123",
        },
      });

      const res = await getProfileHandler();
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.profile.accountCategory).toBe("COLLEGE");
      expect(data.profile.role).toBe("PLACEMENT_HEAD");
      expect(data.profile.institutionName).toBe("Sapthagiri NPS University");
      expect(data.collegeMetrics).toBeDefined();
      expect(data.collegeMetrics.staffMembers).toBeGreaterThanOrEqual(1);
    });
  });

  describe("2. PATCH /api/profile Validation & Field Protection", () => {
    it("updates allowed fields (fullName, phone, location, bio, preferences)", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
        fullName: "Alex Student",
        role: "STUDENT",
        accountCategory: "STUDENT",
      });

      const req = new NextRequest("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Alex Updated",
          phone: "+91 99999 88888",
          location: "Bengaluru",
          bio: "Updated bio description",
          preferences: { weeklyGoalHours: 20 },
        }),
      });

      const res = await patchProfileHandler(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("Profile updated successfully");
    });

    it("rejects invalid fullName lengths (< 2 chars or > 100 chars)", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
      });

      // Too short
      const reqShort = new NextRequest("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "A" }),
      });
      const resShort = await patchProfileHandler(reqShort);
      expect(resShort.status).toBe(400);

      // Too long
      const reqLong = new NextRequest("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: "A".repeat(101) }),
      });
      const resLong = await patchProfileHandler(reqLong);
      expect(resLong.status).toBe(400);
    });

    it("rejects bio length exceeding 300 characters", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
      });

      const req = new NextRequest("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: "X".repeat(301) }),
      });
      const res = await patchProfileHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("300 characters");
    });

    it("strictly prevents modification of protected fields (role, accountCategory, tenantId)", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
        role: "STUDENT",
        accountCategory: "STUDENT",
      });

      // Attacker attempts privilege escalation in body
      const req = new NextRequest("http://localhost:3000/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: "Attacker Name",
          role: "PLACEMENT_HEAD",
          accountCategory: "COLLEGE",
          tenantId: "tenant-stolen",
          isPlatformAdmin: true,
        }),
      });

      const res = await patchProfileHandler(req);
      expect(res.status).toBe(200);

      // Verify profile response did NOT adopt malicious fields
      const getRes = await getProfileHandler();
      const getData = await getRes.json();
      expect(getData.profile.role).toBe("STUDENT");
      expect(getData.profile.accountCategory).toBe("STUDENT");
    });
  });

  describe("3. Avatar Operations (/api/profile/avatar)", () => {
    it("validates and accepts valid base64 image uploads", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
        fullName: "Alex",
      });

      const validPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

      const req = new NextRequest("http://localhost:3000/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: validPngDataUrl }),
      });

      const res = await postAvatarHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.avatarUrl).toContain("https://mock.supabase.co/storage/v1/object/public/avatars/student-123/");
    });

    it("rejects invalid MIME types (e.g. text/html, application/pdf)", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
      });

      const invalidPayload = "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==";

      const req = new NextRequest("http://localhost:3000/api/profile/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: invalidPayload }),
      });

      const res = await postAvatarHandler(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("Invalid image format");
    });

    it("resets avatar URL to null on DELETE", async () => {
      (getCurrentUserProfile as any).mockResolvedValue({
        id: "student-123",
        email: "student@campus.edu",
      });

      const res = await deleteAvatarHandler();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("Avatar removed");
    });
  });
});
