/**
 * Notification & Announcement System Type Definitions
 * UrPlaced Enterprise Notification Layer
 */

export type NotificationType =
  | "SYSTEM"
  | "ASSESSMENT_ASSIGNED"
  | "ASSESSMENT_REMINDER"
  | "ASSESSMENT_GRADED"
  | "DRIVE_ANNOUNCED"
  | "DRIVE_ELIGIBILITY"
  | "DRIVE_STAGE_UPDATE"
  | "TRAINING_ASSIGNED"
  | "STAFF_INVITATION"
  | "COLLEGE_ANNOUNCEMENT"
  | (string & {});

export type NotificationSource =
  | "SYSTEM_EVENT"
  | "MANUAL_ANNOUNCEMENT"
  | (string & {});

export type AnnouncementAudienceType =
  | "ALL_STUDENTS"
  | "SELECTED_STUDENTS"
  | "DEPARTMENT";

export type AnnouncementCategory =
  | "GENERAL"
  | "ACADEMIC"
  | "PLACEMENT_DRIVE"
  | "URGENT"
  | (string & {});

export interface NotificationRecord {
  id: string;
  recipient_user_id: string;
  college_id: string | null;
  actor_user_id: string | null;
  announcement_id?: string | null;
  source?: NotificationSource;
  type: string;
  title: string;
  body: string;
  action_url: string | null;
  metadata: Record<string, any>;
  deduplication_key: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateNotificationInput {
  recipientUserId: string;
  collegeId?: string | null;
  actorUserId?: string | null;
  announcementId?: string | null;
  source?: NotificationSource;
  type: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  metadata?: Record<string, any>;
  deduplicationKey?: string | null;
}

export interface CreateNotificationResult {
  success: boolean;
  notification: NotificationRecord;
  deduplicated?: boolean;
}

export interface ListNotificationsOptions {
  userId: string;
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}

export interface ListNotificationsResult {
  notifications: NotificationRecord[];
  unreadCount: number;
  total: number;
}

export interface AnnouncementRecord {
  id: string;
  college_id: string;
  created_by: string;
  title: string;
  body: string;
  category: string;
  audience_type: AnnouncementAudienceType;
  audience_filter: {
    department_id?: string;
    department_name?: string;
    student_ids?: string[];
    [key: string]: any;
  };
  action_url: string | null;
  status: "DRAFT" | "SENT" | "CANCELLED";
  recipient_count: number;
  created_at: string;
  sent_at: string;
  creator?: {
    id: string;
    email?: string;
    full_name?: string;
  };
}

export interface CreateAnnouncementInput {
  collegeId: string;
  createdByUserId: string;
  title: string;
  body: string;
  category?: string;
  audienceType: AnnouncementAudienceType;
  departmentId?: string;
  departmentName?: string;
  selectedStudentIds?: string[];
  actionUrl?: string | null;
}

export interface SendAnnouncementResult {
  success: boolean;
  announcement: AnnouncementRecord;
  recipientCount: number;
}

export interface ListAnnouncementsOptions {
  collegeId: string;
  limit?: number;
  offset?: number;
}

export interface ListAnnouncementsResult {
  announcements: AnnouncementRecord[];
  total: number;
}

export interface EligibleStudentItem {
  id: string;
  userId: string | null;
  fullName: string;
  enrollmentNumber: string;
  email: string;
  departmentId: string;
  departmentName?: string;
}

export interface RecipientPreviewOptions {
  collegeId: string;
  audienceType: AnnouncementAudienceType;
  departmentId?: string;
  search?: string;
  selectedStudentIds?: string[];
}

export interface RecipientPreviewResult {
  eligibleCount: number;
  students: EligibleStudentItem[];
}
