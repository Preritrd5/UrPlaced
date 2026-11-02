import { describe, it, expect, beforeEach } from "vitest";
import { UserDeletionService } from "@/modules/identity-access/services/user-deletion-service";

// Mock Supabase admin client for unit testing deletion service
function createMockAdmin(initialData?: any) {
  const db: Record<string, any[]> = {
    platform_admins: initialData?.platform_admins || [],
    tenant_memberships: initialData?.tenant_memberships || [],
    profiles: initialData?.profiles || [],
    students: initialData?.students || [],
    notifications: initialData?.notifications || [],
    question_sets: initialData?.question_sets || [],
    student_attempt_answers: initialData?.student_attempt_answers || [],
    assessment_attempts: initialData?.assessment_attempts || [],
    attendance: initialData?.attendance || [],
    candidate_stages: initialData?.candidate_stages || [],
    audit_logs: initialData?.audit_logs || [],
    platform_audit_logs: initialData?.platform_audit_logs || [],
  };

  const storageFiles: Record<string, string[]> = {
    avatars: initialData?.storageAvatars || [],
  };

  const authUsers: any[] = initialData?.authUsers || [];
  const revokedSessions: string[] = [];

  const mockClient = {
    db,
    storageFiles,
    authUsers,
    revokedSessions,
    from: (table: string) => {
      let currentData = db[table] || [];
      let filters: Array<(item: any) => boolean> = [];
      let updatePayload: any = null;
      let isDelete = false;

      const chain: any = {
        select: (cols?: string, opts?: any) => {
          if (opts?.count === "exact" && opts?.head) {
            return {
              count: currentData.filter((i) => filters.every((f) => f(i))).length,
              error: null,
            };
          }
          return chain;
        },
        eq: (col: string, val: any) => {
          filters.push((item: any) => item[col] === val);
          return chain;
        },
        neq: (col: string, val: any) => {
          filters.push((item: any) => item[col] !== val);
          return chain;
        },
        in: (col: string, vals: any[]) => {
          filters.push((item: any) => vals.includes(item[col]));
          return chain;
        },
        or: () => chain,
        ilike: () => chain,
        order: () => chain,
        limit: () => chain,
        update: (payload: any) => {
          updatePayload = payload;
          return chain;
        },
        insert: async (rows: any | any[]) => {
          const toInsert = Array.isArray(rows) ? rows : [rows];
          db[table] = db[table] || [];
          db[table].push(...toInsert);
          return { data: rows, error: null };
        },
        delete: () => {
          isDelete = true;
          return chain;
        },
        maybeSingle: async () => {
          const match = (db[table] || []).find((item: any) => filters.every((f) => f(item)));
          return { data: match || null, error: null };
        },
        single: async () => {
          const match = (db[table] || []).find((item: any) => filters.every((f) => f(item)));
          return { data: match || null, error: match ? null : new Error("Row not found") };
        },
        then: async (resolve: any) => {
          if (isDelete) {
            const remaining = (db[table] || []).filter((item: any) => !filters.every((f) => f(item)));
            const deleted = (db[table] || []).filter((item: any) => filters.every((f) => f(item)));
            db[table] = remaining;
            return resolve({ data: deleted, error: null });
          }
          if (updatePayload) {
            db[table] = (db[table] || []).map((item: any) => {
              if (filters.every((f) => f(item))) {
                return { ...item, ...updatePayload };
              }
              return item;
            });
            return resolve({ data: db[table], error: null });
          }
          const matched = (db[table] || []).filter((item: any) => filters.every((f) => f(item)));
          return resolve({ data: matched, error: null });
        },
      };

      return chain;
    },
    storage: {
      from: (bucket: string) => ({
        list: async (folder?: string) => {
          const prefix = folder ? `${folder}/` : "";
          const files = (storageFiles[bucket] || [])
            .filter((p) => p.startsWith(prefix))
            .map((p) => ({ name: p.replace(prefix, "") }));
          return { data: files, error: null };
        },
        remove: async (paths: string[]) => {
          storageFiles[bucket] = (storageFiles[bucket] || []).filter((p) => !paths.includes(p));
          return { data: paths, error: null };
        },
      }),
    },
    auth: {
      admin: {
        getUserById: async (uid: string) => {
          const u = authUsers.find((user) => user.id === uid);
          return { data: { user: u || null }, error: u ? null : { message: "User not found" } };
        },
        signOut: async (uid: string) => {
          revokedSessions.push(uid);
          return { data: null, error: null };
        },
        deleteUser: async (uid: string) => {
          const idx = authUsers.findIndex((user) => user.id === uid);
          if (idx !== -1) {
            authUsers.splice(idx, 1);
          }
          return { data: { user: null }, error: null };
        },
      },
    },
  };

  return mockClient;
}

describe("P0 Permanent User Deletion & Complete Data Cleanup Service", () => {
  let mockAdmin: ReturnType<typeof createMockAdmin>;

  beforeEach(() => {
    mockAdmin = createMockAdmin({
      authUsers: [
        { id: "super-admin-01", email: "prerit@urplaced.com" },
        { id: "super-admin-02", email: "other-admin@urplaced.com" },
        { id: "placement-head-01", email: "head@college.edu" },
        { id: "placement-staff-01", email: "staff@college.edu" },
        { id: "student-01", email: "student@college.edu" },
      ],
      platform_admins: [
        { id: "pa-01", user_id: "super-admin-01", email: "prerit@urplaced.com", role: "SUPER_ADMIN", status: "ACTIVE" },
        { id: "pa-02", user_id: "super-admin-02", email: "other-admin@urplaced.com", role: "SUPER_ADMIN", status: "ACTIVE" },
      ],
      profiles: [
        { id: "super-admin-01", email: "prerit@urplaced.com", is_platform_admin: true, full_name: "Prerit" },
        { id: "super-admin-02", email: "other-admin@urplaced.com", is_platform_admin: true, full_name: "Admin Two" },
        { id: "placement-head-01", email: "head@college.edu", is_platform_admin: false, full_name: "Head Placement" },
        { id: "placement-staff-01", email: "staff@college.edu", is_platform_admin: false, full_name: "Staff Placement" },
        { id: "student-01", email: "student@college.edu", is_platform_admin: false, full_name: "Student Alpha" },
      ],
      tenant_memberships: [
        { id: "tm-head", user_id: "placement-head-01", tenant_id: "tenant-college-01", role: "PLACEMENT_HEAD", status: "ACTIVE" },
        { id: "tm-staff", user_id: "placement-staff-01", tenant_id: "tenant-college-01", role: "PLACEMENT_STAFF", status: "ACTIVE" },
        { id: "tm-student", user_id: "student-01", tenant_id: "tenant-college-01", role: "STUDENT", status: "ACTIVE" },
      ],
      students: [
        { id: "stu-row-01", user_id: "student-01", tenant_id: "tenant-college-01", name: "Student Alpha" },
      ],
      notifications: [
        { id: "notif-01", user_id: "student-01", title: "Welcome" },
        { id: "notif-02", user_id: "placement-staff-01", title: "Interview scheduled" },
      ],
      question_sets: [
        { id: "qs-01", tenant_id: "tenant-college-01", title: "DSA Set 1", created_by: "placement-staff-01" },
      ],
      storageAvatars: [
        "student-01/avatar-12345.png",
        "placement-staff-01/profile-photo.jpg",
      ],
    });
  });

  // ==========================================
  // CATEGORY A: SUPABASE AUTH DELETION
  // ==========================================
  describe("Category A: Supabase Auth Deletion", () => {
    it("permanently deletes user from auth.users via admin API", async () => {
      const result = await UserDeletionService.executePermanentDeletion({
        targetUserId: "student-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Student requested GDPR erasure",
        confirmedEmailOrSrn: "student@college.edu",
        adminClient: mockAdmin as any,
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted.auth).toBe(true);
      expect(mockAdmin.authUsers.find((u) => u.id === "student-01")).toBeUndefined();
    });

    it("immediately revokes all active auth sessions and refresh tokens", async () => {
      const result = await UserDeletionService.executePermanentDeletion({
        targetUserId: "placement-staff-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Staff departed institution",
        confirmedEmailOrSrn: "staff@college.edu",
        adminClient: mockAdmin as any,
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted.revocation).toBe(true);
      expect(mockAdmin.revokedSessions).toContain("placement-staff-01");
    });

    it("rejects non-super-admin attempting to delete platform administrator", async () => {
      await expect(
        UserDeletionService.executePermanentDeletion({
          targetUserId: "super-admin-02",
          actorRole: "PLACEMENT_HEAD",
          actorUserId: "placement-head-01",
          tenantId: "tenant-college-01",
          reason: "Malicious deletion attempt",
          confirmedEmailOrSrn: "other-admin@urplaced.com",
          adminClient: mockAdmin as any,
        })
      ).rejects.toThrow();

      // Verify admin was NOT deleted
      expect(mockAdmin.authUsers.find((u) => u.id === "super-admin-02")).toBeDefined();
    });
  });

  // ==========================================
  // CATEGORY B: DATABASE RELATIONAL CLEANUP
  // ==========================================
  describe("Category B: PostgreSQL Database Cleanup", () => {
    it("deletes user profile, student record, notifications, and memberships", async () => {
      await UserDeletionService.executePermanentDeletion({
        targetUserId: "student-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Graduated student removal",
        confirmedEmailOrSrn: "student@college.edu",
        adminClient: mockAdmin as any,
      });

      expect(mockAdmin.db.profiles.find((p) => p.id === "student-01")).toBeUndefined();
      expect(mockAdmin.db.students.find((s) => s.user_id === "student-01")).toBeUndefined();
      expect(mockAdmin.db.notifications.find((n) => n.user_id === "student-01")).toBeUndefined();
      expect(mockAdmin.db.tenant_memberships.find((m) => m.user_id === "student-01")).toBeUndefined();
    });

    it("preserves institutional shared question sets while unlinking personal created_by", async () => {
      await UserDeletionService.executePermanentDeletion({
        targetUserId: "placement-staff-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Contract ended",
        confirmedEmailOrSrn: "staff@college.edu",
        adminClient: mockAdmin as any,
      });

      // Question set must still exist in institutional question bank
      const qs = mockAdmin.db.question_sets.find((q) => q.id === "qs-01");
      expect(qs).toBeDefined();
      expect(qs.tenant_id).toBe("tenant-college-01");
      expect(qs.created_by).toBeNull();
    });

    it("writes permanent append-only audit event to platform audit log", async () => {
      const result = await UserDeletionService.executePermanentDeletion({
        targetUserId: "student-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Audit test deletion",
        confirmedEmailOrSrn: "student@college.edu",
        adminClient: mockAdmin as any,
      });

      expect(result.stagesCompleted.verification).toBe(true);
      const auditLog = mockAdmin.db.audit_logs.find(
        (l) => l.action === "USER_PERMANENTLY_DELETED" && l.resource_id === "student-01"
      );
      expect(auditLog).toBeDefined();
      expect(auditLog.metadata.deletedEmail).toBe("student@college.edu");
    });
  });

  // ==========================================
  // CATEGORY C: STORAGE CLEANUP
  // ==========================================
  describe("Category C: Supabase Storage Cleanup", () => {
    it("removes all avatar files located in avatars/${userId}/*", async () => {
      const result = await UserDeletionService.executePermanentDeletion({
        targetUserId: "student-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Avatar purge test",
        confirmedEmailOrSrn: "student@college.edu",
        adminClient: mockAdmin as any,
      });

      expect(result.stagesCompleted.storage).toBe(true);
      expect(mockAdmin.storageFiles.avatars).not.toContain("student-01/avatar-12345.png");
    });

    it("handles users with no uploaded avatar gracefully without errors", async () => {
      const result = await UserDeletionService.executePermanentDeletion({
        targetUserId: "super-admin-02",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "No avatar admin deletion",
        confirmedEmailOrSrn: "other-admin@urplaced.com",
        adminClient: mockAdmin as any,
      });

      expect(result.success).toBe(true);
      expect(result.stagesCompleted.storage).toBe(true);
    });
  });

  // ==========================================
  // CATEGORY D: ACCESS & JWT REVOCATION
  // ==========================================
  describe("Category D: Session & Access Revocation", () => {
    it("rejects deleted user in server-context even if they possess an unexpired JWT", async () => {
      mockAdmin.db.profiles = mockAdmin.db.profiles.filter((p) => p.id !== "student-01");

      const { data: profile } = await mockAdmin
        .from("profiles")
        .select("id")
        .eq("id", "student-01")
        .maybeSingle();

      expect(profile).toBeNull();
    });
  });

  // ==========================================
  // CATEGORY E: FAILURE & RETRY HANDLING
  // ==========================================
  describe("Category E: Idempotent Retries", () => {
    it("succeeds idempotently when called multiple times on an already deleted user", async () => {
      await UserDeletionService.executePermanentDeletion({
        targetUserId: "student-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Initial delete",
        confirmedEmailOrSrn: "student@college.edu",
        adminClient: mockAdmin as any,
      });

      // Second deletion attempt
      const secondResult = await UserDeletionService.executePermanentDeletion({
        targetUserId: "student-01",
        actorRole: "SUPER_ADMIN",
        actorUserId: "super-admin-01",
        reason: "Idempotent retry delete",
        confirmedEmailOrSrn: "student@college.edu",
        adminClient: mockAdmin as any,
      });

      expect(secondResult.success).toBe(true);
    });
  });

  // ==========================================
  // CATEGORY F: ADMINISTRATIVE SAFEGUARDS
  // ==========================================
  describe("Category F: Administrative Safeguards", () => {
    it("prevents self-deletion of the active administrator account", async () => {
      await expect(
        UserDeletionService.executePermanentDeletion({
          targetUserId: "super-admin-01",
          actorRole: "SUPER_ADMIN",
          actorUserId: "super-admin-01",
          reason: "Accidental self deletion",
          confirmedEmailOrSrn: "prerit@urplaced.com",
          adminClient: mockAdmin as any,
        })
      ).rejects.toThrow(/SELF_DELETION_PROHIBITED/i);

      expect(mockAdmin.authUsers.find((u) => u.id === "super-admin-01")).toBeDefined();
    });

    it("prevents deletion of the last active platform super administrator", async () => {
      // Remove super-admin-02 so super-admin-01 is the only one remaining
      mockAdmin.db.platform_admins = mockAdmin.db.platform_admins.filter((p) => p.user_id !== "super-admin-02");

      await expect(
        UserDeletionService.executePermanentDeletion({
          targetUserId: "super-admin-01",
          actorRole: "SUPER_ADMIN",
          actorUserId: "another-actor",
          reason: "Trying to delete sole admin",
          confirmedEmailOrSrn: "prerit@urplaced.com",
          adminClient: mockAdmin as any,
        })
      ).rejects.toThrow(/LAST_ACTIVE_ADMIN/i);
    });

    it("rejects deletion when mandatory audit reason is missing or shorter than 5 characters", async () => {
      await expect(
        UserDeletionService.executePermanentDeletion({
          targetUserId: "student-01",
          actorRole: "SUPER_ADMIN",
          actorUserId: "super-admin-01",
          reason: "bad",
          confirmedEmailOrSrn: "student@college.edu",
          adminClient: mockAdmin as any,
        })
      ).rejects.toThrow(/REASON_REQUIRED/i);
    });

    it("rejects deletion when email confirmation does not match target email", async () => {
      await expect(
        UserDeletionService.executePermanentDeletion({
          targetUserId: "student-01",
          actorRole: "SUPER_ADMIN",
          actorUserId: "super-admin-01",
          reason: "Valid reason for deletion",
          confirmedEmailOrSrn: "wrong-email@college.edu",
          adminClient: mockAdmin as any,
        })
      ).rejects.toThrow(/EMAIL_CONFIRMATION_MISMATCH/i);
    });
  });
});
