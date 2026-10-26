import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";
import {
  NotificationService,
  NotificationValidationError,
} from "@/modules/notifications/services/notification-service";
import * as SupabaseAdminModule from "@/lib/supabase/admin";

describe("UrPlaced Notification System Service & Schema Suite", () => {
  const testUserId = "550e8400-e29b-41d4-a716-446655440000";
  const testCollegeId = "660e8400-e29b-41d4-a716-446655440001";
  const testActorId = "770e8400-e29b-41d4-a716-446655440002";
  const testNotificationId = "880e8400-e29b-41d4-a716-446655440003";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Database Migration File & Schema Integrity", () => {
    it("confirms Phase 13 notification migration exists and follows naming conventions", () => {
      const migrationPath = path.join(
        process.cwd(),
        "supabase",
        "migrations",
        "20261025000002_phase13_notifications_system.sql"
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const content = fs.readFileSync(migrationPath, "utf-8");
      // Check required table and columns
      expect(content).toContain("CREATE TABLE IF NOT EXISTS public.notifications");
      expect(content).toContain("recipient_user_id UUID NOT NULL REFERENCES auth.users(id)");
      expect(content).toContain("college_id UUID REFERENCES public.tenants(id)");
      expect(content).toContain("actor_user_id UUID REFERENCES auth.users(id)");
      expect(content).toContain("type VARCHAR(64) NOT NULL");
      expect(content).toContain("title VARCHAR(255) NOT NULL");
      expect(content).toContain("body TEXT NOT NULL");
      expect(content).toContain("action_url VARCHAR(512)");
      expect(content).toContain("metadata JSONB NOT NULL DEFAULT '{}'::jsonb");
      expect(content).toContain("deduplication_key VARCHAR(128)");
      expect(content).toContain("read_at TIMESTAMPTZ");

      // Check indexes
      expect(content).toContain("idx_notifications_recipient_created");
      expect(content).toContain("idx_notifications_recipient_unread");
      expect(content).toContain("uq_notifications_recipient_dedup");

      // Check RLS policies
      expect(content).toContain("ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY");
      expect(content).toContain("notifications_select_recipient");
      expect(content).toContain("notifications_update_read_at");
      expect(content).toContain("trg_notifications_protect_fields");
      expect(content).toContain("supabase_realtime");
    });
  });

  describe("2. URL Validation & Open-Redirect Protection", () => {
    it("accepts valid relative internal paths", () => {
      expect(NotificationService.isValidActionUrl("/dashboard")).toBe(true);
      expect(NotificationService.isValidActionUrl("/dashboard/assessments/123")).toBe(true);
      expect(NotificationService.isValidActionUrl("/dashboard/drives/abc?tab=prep")).toBe(true);
      expect(NotificationService.isValidActionUrl(null)).toBe(true);
      expect(NotificationService.isValidActionUrl(undefined)).toBe(true);
      expect(NotificationService.isValidActionUrl("")).toBe(true);
    });

    it("rejects malicious open-redirects, protocol-relative, and script URLs", () => {
      expect(NotificationService.isValidActionUrl("//evil.com")).toBe(false);
      expect(NotificationService.isValidActionUrl("https://evil.com")).toBe(false);
      expect(NotificationService.isValidActionUrl("http://evil.com/phish")).toBe(false);
      expect(NotificationService.isValidActionUrl("javascript:alert(1)")).toBe(false);
      expect(NotificationService.isValidActionUrl("data:text/html,<script>")).toBe(false);
      expect(NotificationService.isValidActionUrl("dashboard/no-leading-slash")).toBe(false);
      expect(NotificationService.isValidActionUrl("/".repeat(513))).toBe(false);
    });
  });

  describe("3. NotificationService.createNotification Input Validation", () => {
    it("rejects invalid or missing recipientUserId", async () => {
      await expect(
        NotificationService.createNotification({
          recipientUserId: "not-a-uuid",
          type: "SYSTEM",
          title: "Test",
          body: "Test body",
        })
      ).rejects.toThrow(NotificationValidationError);

      await expect(
        NotificationService.createNotification({
          recipientUserId: "",
          type: "SYSTEM",
          title: "Test",
          body: "Test body",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("rejects invalid collegeId or actorUserId format", async () => {
      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          collegeId: "invalid-uuid",
          type: "SYSTEM",
          title: "Test",
          body: "Test body",
        })
      ).rejects.toThrow(NotificationValidationError);

      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          actorUserId: "invalid-uuid",
          type: "SYSTEM",
          title: "Test",
          body: "Test body",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("rejects empty or excessively long title and body", async () => {
      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          type: "SYSTEM",
          title: "   ",
          body: "Valid body",
        })
      ).rejects.toThrow(NotificationValidationError);

      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          type: "SYSTEM",
          title: "a".repeat(256),
          body: "Valid body",
        })
      ).rejects.toThrow(NotificationValidationError);

      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          type: "SYSTEM",
          title: "Valid title",
          body: "a".repeat(2001),
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("rejects invalid actionUrl", async () => {
      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          type: "SYSTEM",
          title: "Valid title",
          body: "Valid body",
          actionUrl: "https://external.com",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("rejects metadata payload exceeding 16KB limit", async () => {
      const hugeMetadata = { data: "x".repeat(17000) };
      await expect(
        NotificationService.createNotification({
          recipientUserId: testUserId,
          type: "SYSTEM",
          title: "Valid title",
          body: "Valid body",
          metadata: hugeMetadata,
        })
      ).rejects.toThrow(NotificationValidationError);
    });
  });

  describe("4. Notification Creation & Idempotency", () => {
    it("successfully creates a notification using admin client", async () => {
      const mockInserted = {
        id: testNotificationId,
        recipient_user_id: testUserId,
        college_id: testCollegeId,
        actor_user_id: testActorId,
        type: "ASSESSMENT_ASSIGNED",
        title: "New Assessment Available",
        body: "Quantitative Aptitude Test 1 is now active.",
        action_url: "/dashboard/student/assessments/123",
        metadata: { assessmentId: "123" },
        deduplication_key: "assessment_assign_123_user_1",
        read_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockInserted, error: null }),
            }),
          }),
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const result = await NotificationService.createNotification({
        recipientUserId: testUserId,
        collegeId: testCollegeId,
        actorUserId: testActorId,
        type: "ASSESSMENT_ASSIGNED",
        title: "New Assessment Available",
        body: "Quantitative Aptitude Test 1 is now active.",
        actionUrl: "/dashboard/student/assessments/123",
        metadata: { assessmentId: "123" },
        deduplicationKey: "assessment_assign_123_user_1",
      });

      expect(result.success).toBe(true);
      expect(result.deduplicated).toBe(false);
      expect(result.notification.id).toBe(testNotificationId);
      expect(result.notification.title).toBe("New Assessment Available");
    });

    it("returns existing notification when deduplication key matches", async () => {
      const mockExisting = {
        id: testNotificationId,
        recipient_user_id: testUserId,
        type: "DRIVE_ANNOUNCED",
        title: "Google Recruitment Drive",
        body: "Google has announced software engineer drive.",
        deduplication_key: "drive_announce_google",
        read_at: null,
      };

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockExisting, error: null }),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const result = await NotificationService.createNotification({
        recipientUserId: testUserId,
        type: "DRIVE_ANNOUNCED",
        title: "Google Recruitment Drive",
        body: "Google has announced software engineer drive.",
        deduplicationKey: "drive_announce_google",
      });

      expect(result.success).toBe(true);
      expect(result.deduplicated).toBe(true);
      expect(result.notification.id).toBe(testNotificationId);
    });
  });

  describe("5. Read State Operations & Scoping", () => {
    it("marks single notification as read scoped to recipient", async () => {
      const mockUpdated = {
        id: testNotificationId,
        recipient_user_id: testUserId,
        read_at: new Date().toISOString(),
      };

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({ data: mockUpdated, error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const updated = await NotificationService.markAsRead({
        userId: testUserId,
        notificationId: testNotificationId,
      });

      expect(updated).not.toBeNull();
      expect(updated?.id).toBe(testNotificationId);
      expect(updated?.read_at).toBeDefined();
    });

    it("marks all unread notifications as read for recipient", async () => {
      const mockUnread = [{ id: "notif-1" }, { id: "notif-2" }];

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockResolvedValue({ data: mockUnread, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const result = await NotificationService.markAllAsRead(testUserId);
      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
    });
  });

  describe("6. Notification Announcements Schema & Migration Integrity", () => {
    it("confirms notification_announcements table and relations in Phase 13 migration", () => {
      const migrationPath = path.join(
        process.cwd(),
        "supabase",
        "migrations",
        "20261025000002_phase13_notifications_system.sql"
      );
      const content = fs.readFileSync(migrationPath, "utf-8");

      expect(content).toContain("CREATE TABLE IF NOT EXISTS public.notification_announcements");
      expect(content).toContain("college_id UUID NOT NULL REFERENCES public.tenants(id)");
      expect(content).toContain("created_by UUID NOT NULL REFERENCES auth.users(id)");
      expect(content).toContain("audience_type VARCHAR(32) NOT NULL");
      expect(content).toContain("recipient_count INTEGER NOT NULL");
      expect(content).toContain("announcement_id UUID REFERENCES public.notification_announcements(id)");
      expect(content).toContain("source VARCHAR(32) NOT NULL DEFAULT 'SYSTEM_EVENT'");

      // RLS policies for announcements
      expect(content).toContain("ALTER TABLE public.notification_announcements ENABLE ROW LEVEL SECURITY");
      expect(content).toContain("CREATE POLICY announcements_select_tenant_staff");
      expect(content).toContain("CREATE POLICY announcements_insert_tenant_admin");
    });
  });

  describe("7. NotificationService.sendAnnouncement Validation & Security", () => {
    const testDeptId = "990e8400-e29b-41d4-a716-446655440004";
    const testStudent1 = "aa0e8400-e29b-41d4-a716-446655440005";
    const testStudent2 = "bb0e8400-e29b-41d4-a716-446655440006";

    it("rejects invalid collegeId or createdByUserId", async () => {
      await expect(
        NotificationService.sendAnnouncement({
          collegeId: "invalid-uuid",
          createdByUserId: testActorId,
          title: "Drive Alert",
          body: "Drive message body",
          audienceType: "ALL_STUDENTS",
        })
      ).rejects.toThrow(NotificationValidationError);

      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: "invalid-uuid",
          title: "Drive Alert",
          body: "Drive message body",
          audienceType: "ALL_STUDENTS",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("rejects invalid title or body lengths", async () => {
      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: testActorId,
          title: "",
          body: "Valid body",
          audienceType: "ALL_STUDENTS",
        })
      ).rejects.toThrow(NotificationValidationError);

      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: testActorId,
          title: "Valid title",
          body: "a".repeat(2001),
          audienceType: "ALL_STUDENTS",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("rejects external or unapproved action URL formats", async () => {
      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: testActorId,
          title: "Valid title",
          body: "Valid body",
          audienceType: "ALL_STUDENTS",
          actionUrl: "https://phishing.site/login",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("requires departmentId when audienceType is DEPARTMENT", async () => {
      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: testActorId,
          title: "Dept Notice",
          body: "Body",
          audienceType: "DEPARTMENT",
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("requires selectedStudentIds when audienceType is SELECTED_STUDENTS", async () => {
      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: testActorId,
          title: "Targeted Notice",
          body: "Body",
          audienceType: "SELECTED_STUDENTS",
          selectedStudentIds: [],
        })
      ).rejects.toThrow(NotificationValidationError);
    });

    it("strictly rejects selected students belonging to another college (cross-college isolation)", async () => {
      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "students") {
            return {
              select: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                      // Only student 1 is in this college; student 2 is outside
                      data: [{ id: testStudent1, user_id: testUserId, tenant_id: testCollegeId }],
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      await expect(
        NotificationService.sendAnnouncement({
          collegeId: testCollegeId,
          createdByUserId: testActorId,
          title: "Targeted Notice",
          body: "Body",
          audienceType: "SELECTED_STUDENTS",
          selectedStudentIds: [testStudent1, testStudent2],
        })
      ).rejects.toThrow(/Security violation/);
    });

    it("broadcasts college-wide announcement and fans out individual notifications", async () => {
      const mockStudents = [
        { user_id: testUserId },
        { user_id: "cc0e8400-e29b-41d4-a716-446655440007" },
      ];

      const mockAnnouncementRecord = {
        id: "dd0e8400-e29b-41d4-a716-446655440008",
        college_id: testCollegeId,
        created_by: testActorId,
        title: "Campus Drive Kickoff",
        body: "All students are invited to the orientation.",
        category: "PLACEMENT_DRIVE",
        audience_type: "ALL_STUDENTS",
        audience_filter: {},
        action_url: "/dashboard/student/memory",
        status: "SENT",
        recipient_count: 2,
        created_at: new Date().toISOString(),
        sent_at: new Date().toISOString(),
      };

      let insertedNotifications: any[] = [];

      const mockAdmin = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === "students") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    not: vi.fn().mockResolvedValue({ data: mockStudents, error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "tenant_memberships") {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "notification_announcements") {
            return {
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAnnouncementRecord, error: null }),
                }),
              }),
            };
          }
          if (table === "notifications") {
            return {
              insert: vi.fn().mockImplementation((rows: any[]) => {
                insertedNotifications = rows;
                return Promise.resolve({ error: null });
              }),
            };
          }
          return {};
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const result = await NotificationService.sendAnnouncement({
        collegeId: testCollegeId,
        createdByUserId: testActorId,
        title: "Campus Drive Kickoff",
        body: "All students are invited to the orientation.",
        category: "PLACEMENT_DRIVE",
        audienceType: "ALL_STUDENTS",
        actionUrl: "/dashboard/student/memory",
      });

      expect(result.success).toBe(true);
      expect(result.recipientCount).toBe(2);
      expect(result.announcement.id).toBe("dd0e8400-e29b-41d4-a716-446655440008");
      expect(insertedNotifications.length).toBe(2);
      expect(insertedNotifications[0].source).toBe("MANUAL_ANNOUNCEMENT");
      expect(insertedNotifications[0].type).toBe("COLLEGE_ANNOUNCEMENT");
      expect(insertedNotifications[0].announcement_id).toBe("dd0e8400-e29b-41d4-a716-446655440008");
      expect(insertedNotifications[0].action_url).toBe("/dashboard/student/memory");
    });
  });

  describe("8. NotificationService.listAnnouncements & getEligibleStudents", () => {
    it("lists announcement history for college", async () => {
      const mockHistory = [
        {
          id: "ann-1",
          college_id: testCollegeId,
          title: "Drive update",
          recipient_count: 50,
          created_at: new Date().toISOString(),
        },
      ];

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: mockHistory, count: 1, error: null }),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const result = await NotificationService.listAnnouncements({
        collegeId: testCollegeId,
      });

      expect(result.announcements.length).toBe(1);
      expect(result.total).toBe(1);
      expect(result.announcements[0].title).toBe("Drive update");
    });

    it("queries eligible students scoped to college tenant", async () => {
      const mockStudents = [
        {
          id: "st-1",
          user_id: testUserId,
          full_name: "Rahul Sharma",
          enrollment_number: "EN-2026-001",
          email: "rahul@college.edu",
          department_id: "dept-1",
          department: { name: "Computer Science", code: "CSE" },
        },
      ];

      const mockAdmin = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({ data: mockStudents, error: null }),
                }),
              }),
            }),
          }),
        }),
      };

      vi.spyOn(SupabaseAdminModule, "createAdminClient").mockReturnValue(mockAdmin as any);

      const result = await NotificationService.getEligibleStudents({
        collegeId: testCollegeId,
        audienceType: "ALL_STUDENTS",
      });

      expect(result.eligibleCount).toBe(1);
      expect(result.students[0].fullName).toBe("Rahul Sharma");
      expect(result.students[0].departmentName).toBe("Computer Science");
    });
  });
});
