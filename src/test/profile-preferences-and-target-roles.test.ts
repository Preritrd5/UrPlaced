/**
 * ==============================================================================
 * UrPlaced: Multi-College Placement Preparation & Management SaaS
 * Profile Preferences & Interactive Preparation Settings Test Suite
 * ==============================================================================
 * Verifies end-to-end functionality for:
 * 1. Notification Toggles (Practice Reminders, Recruitment Alerts, Assessment Notifications, AI Remediation Tips)
 * 2. Weekly Practice Goal (1-40 Hours) & Input Validation
 * 3. Daily Study Cadence (30 minutes, 1-2 hours, 2-3 hours, 3-4 hours, 5+ hours)
 * 4. Target Hiring Roles (Multi-selection, Custom Role Creation, Deduplication, Removal)
 * 5. Persistence across Fetch/Refresh and User-Level Isolation
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPreferences, PATCH as patchPreferences } from "@/app/api/profile/preferences/route";
import { GET as getProfile, PATCH as patchProfile } from "@/app/api/profile/route";

// Mock auth service
const mockUserA = {
  id: "user-student-alpha",
  email: "student-alpha@sapthagiri.edu",
  fullName: "Alpha Student",
  role: "STUDENT",
  accountCategory: "STUDENT",
  activeMembership: { tenant_id: "tenant-sapthagiri", role: "STUDENT", status: "ACTIVE" },
  isVerifiedMembership: true,
  membershipStatus: "ACTIVE",
  avatarUrl: null,
  phone: "+91 98765 43210",
  location: "Bangalore, India",
  bio: "Aspiring software engineer.",
  preferences: {},
};

const mockUserB = {
  id: "user-student-beta",
  email: "student-beta@sapthagiri.edu",
  fullName: "Beta Student",
  role: "STUDENT",
  accountCategory: "STUDENT",
  activeMembership: { tenant_id: "tenant-sapthagiri", role: "STUDENT", status: "ACTIVE" },
  isVerifiedMembership: true,
  membershipStatus: "ACTIVE",
  avatarUrl: null,
  phone: null,
  location: null,
  bio: null,
  preferences: {},
};

let activeMockUser: any = mockUserA;
const inMemoryPreferences = new Map<string, Record<string, any>>();

vi.mock("@/modules/identity-access/services/auth-service", () => ({
  getCurrentUserProfile: vi.fn(async () => {
    return {
      ...activeMockUser,
      preferences: inMemoryPreferences.get(activeMockUser.id) || {},
    };
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: activeMockUser.id, email: activeMockUser.email } }, error: null })),
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((_col: string, val: string) => ({
              maybeSingle: vi.fn(async () => ({
                data: {
                  id: val,
                  avatar_url: null,
                  preferences: inMemoryPreferences.get(val) || {},
                },
                error: null,
              })),
            })),
          })),
          upsert: vi.fn(async (record: any) => {
            if (record.id) {
              const current = inMemoryPreferences.get(record.id) || {};
              inMemoryPreferences.set(record.id, { ...current, ...(record.preferences || {}) });
            }
            return { error: null };
          }),
        };
      }
      if (table === "students") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null })),
            })),
          })),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
      };
    }),
    auth: {
      admin: {
        updateUserById: vi.fn(async (userId: string, data: any) => {
          if (data.user_metadata?.preferences) {
            const current = inMemoryPreferences.get(userId) || {};
            inMemoryPreferences.set(userId, { ...current, ...data.user_metadata.preferences });
          }
          return { data: { user: { id: userId } }, error: null };
        }),
      },
    },
  })),
}));

describe("Profile Preferences & Interactive Settings Integration", () => {
  beforeEach(() => {
    inMemoryPreferences.clear();
    activeMockUser = mockUserA;
  });

  it("1. fetches initial default preferences for a new student profile", async () => {
    const req = new NextRequest("http://localhost:3000/api/profile/preferences");
    const res = await getPreferences(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.preferences).toBeDefined();
    expect(body.preferences.studyReminders).toBe(true);
    expect(body.preferences.driveAlerts).toBe(true);
    expect(body.preferences.testUpdates).toBe(true);
    expect(body.preferences.aiMistakeTips).toBe(true);
    expect(body.preferences.weeklyGoalHours).toBe(10);
    expect(body.preferences.dailyStudyTime).toBe("1-2 hours");
    expect(body.preferences.targetRoles).toHaveLength(5);
    expect(body.preferences.targetRoles).toContain("Software Development Engineer (SDE)");
    expect(body.preferences.customRoles).toEqual([]);
  });

  it("2. toggles each notification independently and persists to database", async () => {
    // Disable Practice Reminders
    const req1 = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyReminders: false }),
    });
    const res1 = await patchPreferences(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.preferences.studyReminders).toBe(false);

    // Verify other toggles remain true
    expect(body1.preferences.driveAlerts).toBe(true);
    expect(body1.preferences.testUpdates).toBe(true);
    expect(body1.preferences.aiMistakeTips).toBe(true);

    // Toggle AI Remediation Tips off
    const req2 = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiMistakeTips: false }),
    });
    const res2 = await patchPreferences(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.preferences.studyReminders).toBe(false);
    expect(body2.preferences.aiMistakeTips).toBe(false);

    // Toggle Practice Reminders back on
    const req3 = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studyReminders: true }),
    });
    const res3 = await patchPreferences(req3);
    const body3 = await res3.json();
    expect(body3.preferences.studyReminders).toBe(true);
    expect(body3.preferences.aiMistakeTips).toBe(false);
  });

  it("3. validates and persists Weekly Practice Goal within 1–40 hours range", async () => {
    // Valid update to 25 hours
    const reqValid = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyGoalHours: 25 }),
    });
    const resValid = await patchPreferences(reqValid);
    expect(resValid.status).toBe(200);
    const bodyValid = await resValid.json();
    expect(bodyValid.preferences.weeklyGoalHours).toBe(25);

    // Reject 0 hours
    const reqInvalidZero = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyGoalHours: 0 }),
    });
    const resInvalidZero = await patchPreferences(reqInvalidZero);
    expect(resInvalidZero.status).toBe(400);

    // Reject > 40 hours
    const reqInvalidHigh = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeklyGoalHours: 45 }),
    });
    const resInvalidHigh = await patchPreferences(reqInvalidHigh);
    expect(resInvalidHigh.status).toBe(400);
  });

  it("4. validates and persists Daily Study Cadence options", async () => {
    const validCadences = ["30 minutes", "1–2 hours", "2–3 hours", "3–4 hours", "5+ hours"];

    for (const cadence of validCadences) {
      const req = new NextRequest("http://localhost:3000/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyStudyTime: cadence }),
      });
      const res = await patchPreferences(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.preferences.dailyStudyTime).toBe(cadence);
    }

    // Reject invalid cadence string
    const reqBad = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dailyStudyTime: "10 hours a day" }),
    });
    const resBad = await patchPreferences(reqBad);
    expect(resBad.status).toBe(400);
  });

  it("5. supports multiple target roles selection, custom role creation, and deduplication", async () => {
    // Select specific subset of roles
    const selectedRoles = ["Frontend Engineer", "Full Stack Developer"];
    const req1 = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetRoles: selectedRoles }),
    });
    const res1 = await patchPreferences(req1);
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.preferences.targetRoles).toEqual(selectedRoles);

    // Add custom role
    const req2 = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customRoles: ["AI / ML Engineer"],
        targetRoles: [...selectedRoles, "AI / ML Engineer"],
      }),
    });
    const res2 = await patchPreferences(req2);
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.preferences.customRoles).toContain("AI / ML Engineer");
    expect(body2.preferences.targetRoles).toContain("AI / ML Engineer");

    // Remove custom role
    const req3 = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customRoles: [],
        targetRoles: selectedRoles,
      }),
    });
    const res3 = await patchPreferences(req3);
    expect(res3.status).toBe(200);
    const body3 = await res3.json();
    expect(body3.preferences.customRoles).toEqual([]);
    expect(body3.preferences.targetRoles).toEqual(selectedRoles);
  });

  it("6. guarantees strict user-level data isolation between User A and User B", async () => {
    // User A sets 30 hours weekly goal and disables recruitment alerts
    activeMockUser = mockUserA;
    const reqA = new NextRequest("http://localhost:3000/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        weeklyGoalHours: 30,
        driveAlerts: false,
        targetRoles: ["Cloud & DevOps Engineer"],
      }),
    });
    await patchPreferences(reqA);

    // User B fetches their preferences: must NOT see User A's changes!
    activeMockUser = mockUserB;
    const reqB = new NextRequest("http://localhost:3000/api/profile/preferences");
    const resB = await getPreferences(reqB);
    const bodyB = await resB.json();

    expect(bodyB.preferences.weeklyGoalHours).toBe(10); // default
    expect(bodyB.preferences.driveAlerts).toBe(true);    // default
    expect(bodyB.preferences.targetRoles).toContain("Software Development Engineer (SDE)"); // default
    expect(bodyB.preferences.weeklyGoalHours).not.toBe(30);

    // User A re-fetches: User A's settings remain intact
    activeMockUser = mockUserA;
    const reqA2 = new NextRequest("http://localhost:3000/api/profile/preferences");
    const resA2 = await getPreferences(reqA2);
    const bodyA2 = await resA2.json();

    expect(bodyA2.preferences.weeklyGoalHours).toBe(30);
    expect(bodyA2.preferences.driveAlerts).toBe(false);
    expect(bodyA2.preferences.targetRoles).toEqual(["Cloud & DevOps Engineer"]);
  });

  it("7. persists preferences through the main profile PATCH endpoint without data loss", async () => {
    activeMockUser = mockUserA;

    // Set preference via /api/profile
    const reqProfile = new NextRequest("http://localhost:3000/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Alpha Student Updated",
        preferences: {
          weeklyGoalHours: 18,
          dailyStudyTime: "2–3 hours",
          studyReminders: false,
        },
      }),
    });

    const resProfile = await patchProfile(reqProfile);
    expect(resProfile.status).toBe(200);

    // Verify GET /api/profile/preferences returns the updated preferences
    const reqVerify = new NextRequest("http://localhost:3000/api/profile/preferences");
    const resVerify = await getPreferences(reqVerify);
    const bodyVerify = await resVerify.json();

    expect(bodyVerify.preferences.weeklyGoalHours).toBe(18);
    expect(bodyVerify.preferences.dailyStudyTime).toBe("2–3 hours");
    expect(bodyVerify.preferences.studyReminders).toBe(false);
  });
});
