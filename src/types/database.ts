/**
-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- TypeScript Database Definitions (Supabase PostgreSQL Schema)
-- ==============================================================================
*/

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TenantStatus = "PENDING_SETUP" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";
export type TenantRole = "PLACEMENT_HEAD" | "PLACEMENT_STAFF" | "TRAINER" | "STUDENT";
export type MembershipStatus = "ACTIVE" | "SUSPENDED" | "REVOKED";
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

export type AcademicYearStatus = "PLANNED" | "ACTIVE" | "ARCHIVED";
export type DepartmentStatus = "ACTIVE" | "INACTIVE";
export type AcademicStatus = "ACTIVE" | "GRADUATED" | "WITHDRAWN" | "SUSPENDED";
export type RecruitmentType = "FULL_TIME" | "INTERNSHIP" | "INTERN_TO_FTE";
export type DriveStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_OPEN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";

export type StageType =
  | "REGISTRATION"
  | "ONLINE_TEST"
  | "CODING_TEST"
  | "GROUP_DISCUSSION"
  | "TECHNICAL_INTERVIEW"
  | "HR_INTERVIEW"
  | "FINAL_SELECTION";

export type ApplicationStatus =
  | "REGISTERED"
  | "WITHDRAWN"
  | "IN_PROCESS"
  | "REJECTED"
  | "OFFER_EXTENDED"
  | "OFFER_ACCEPTED"
  | "OFFER_DECLINED";

export type StageResultStatus =
  | "PENDING"
  | "SCHEDULED"
  | "PASSED"
  | "FAILED"
  | "SKIPPED"
  | "ON_HOLD";

export type OfferStatus = "OFFERED" | "ACCEPTED" | "DECLINED" | "RESCINDED";

export type SourceType =
  | "OFFICIAL_WEBSITE"
  | "PLACEMENT_NOTICE"
  | "OFFICIAL_JD"
  | "STUDENT_REPORT"
  | "HISTORICAL_REPORT"
  | "MANUAL_ENTRY";

export type VerificationStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "VERIFIED"
  | "REJECTED"
  | "SUPERSEDED"
  | "ARCHIVED";

export type AccessClassification = "PUBLIC" | "TENANT_CONFIDENTIAL" | "RESTRICTED";

export type ScopeLevel = "COMPANY" | "ROLE" | "DRIVE";

export type RequirementCategory =
  | "ELIGIBILITY"
  | "ROLE_RESPONSIBILITIES"
  | "TECHNICAL_SKILL"
  | "PROGRAMMING_LANGUAGE"
  | "APTITUDE_TOPIC"
  | "RECRUITMENT_PROCESS"
  | "COMPENSATION_BENEFITS"
  | "PREPARATION_TOPIC";

export type EvidenceLevel = "OFFICIAL" | "REPORTED" | "INFERRED" | "UNKNOWN";

export type SkillCategory =
  | "QUANTITATIVE_APTITUDE"
  | "LOGICAL_REASONING"
  | "VERBAL_ABILITY"
  | "PROGRAMMING_FUNDAMENTALS"
  | "DATA_STRUCTURES_ALGORITHMS"
  | "DATABASE_MANAGEMENT"
  | "OPERATING_SYSTEMS"
  | "COMPUTER_NETWORKS"
  | "OBJECT_ORIENTED_PROGRAMMING"
  | "SYSTEM_DESIGN"
  | "BEHAVIORAL_HR"
  | "CORE_ENGINEERING"
  | "OTHER";

export type MappingImportance = "MANDATORY" | "PREFERRED" | "RECOMMENDED";
export type MappingOrigin = "HUMAN_AUTHORED" | "AI_SUGGESTED" | "VERIFIED";

export type ResourceType =
  | "OFFICIAL_GUIDE"
  | "PRACTICE_SET"
  | "SYLLABUS_OUTLINE"
  | "INTERVIEW_CHECKLIST"
  | "SAMPLE_QUESTIONS"
  | "REVISION_NOTES";

export type ContentClass =
  | "OFFICIAL_COMPANY_RESOURCE"
  | "PREVIOUS_RECRUITMENT_QUESTIONS"
  | "NEWLY_AUTHORED_PRACTICE";

export type PreparationActivityType =
  | "CONCEPT_REVIEW"
  | "PRACTICE_DRILL"
  | "MOCK_EXAM_PREPARATION"
  | "CHECKLIST_ITEM";

export type PreparationPriority = "HIGH" | "MEDIUM" | "LOW";
export type PreparationTaskStatus = "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
export type PreparationPlanStatus = "ACTIVE" | "COMPLETED" | "ARCHIVED";
export type ReportOrigin = "CANDIDATE_REPORTED" | "COLLEGE_CONFIRMED";
export type ModerationStatus = "PENDING" | "APPROVED" | "REJECTED";

// Phase 06: Question Bank Management (QuestionBank Sentinel)
export type QuestionType =
  | "SINGLE_CHOICE"
  | "MULTIPLE_SELECT"
  | "NUMERIC"
  | "SHORT_ANSWER"
  | "CODING";

export type QuestionLifecycleStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "WITHDRAWN"
  | "ARCHIVED";

export type QuestionDifficulty = "EASY" | "MEDIUM" | "HARD";
export type QuestionContentFormat = "MARKDOWN" | "HTML" | "PLAIN";

export type QuestionSourceType =
  | "COLLEGE_AUTHORED"
  | "PLATFORM_ORIGINAL"
  | "OFFICIAL_COMPANY_PUBLIC"
  | "LICENSED_THIRD_PARTY"
  | "CANDIDATE_REPORTED"
  | "AI_GENERATED";

export type QuestionLicenseType =
  | "PROPRIETARY"
  | "PUBLIC_DOMAIN"
  | "PERMISSIVE"
  | "CANDIDATE_SHARED"
  | "RESTRICTED";

export type AnswerKeyReviewStatus =
  | "UNREVIEWED"
  | "VERIFIED_CORRECT"
  | "NEEDS_REVISION"
  | "REJECTED";

export type BankCategory =
  | "CODING"
  | "APTITUDE"
  | "TECHNICAL_CORE"
  | "BEHAVIORAL"
  | "GENERAL"
  | "COMPANY_SPECIFIC";

export type BankSharingPolicy =
  | "COLLEGE_PRIVATE"
  | "EXPLICITLY_SHARED"
  | "GLOBAL_SHARED";

export type BankStatus = "ACTIVE" | "ARCHIVED";

export type ImportJobStatus =
  | "PREVIEWED"
  | "COMMITTED"
  | "FAILED"
  | "CANCELLED";

export type DuplicateDetectionMethod =
  | "EXACT_FINGERPRINT"
  | "TEXT_SIMILARITY"
  | "OPTION_OVERLAP";

export type DuplicateStatus =
  | "PENDING_REVIEW"
  | "CONFIRMED_DUPLICATE"
  | "FALSE_POSITIVE"
  | "RESOLVED";

export type QuestionSetPurpose =
  | "ASSESSMENT"
  | "PRACTICE"
  | "DIAGNOSTIC"
  | "COMPANY_PREP"
  | "INTERVIEW";

export type QuestionSetStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// Phase 07: Assessment Engine & Student Preparation
export type AssessmentPurpose =
  | "ASSESSMENT"
  | "PRACTICE"
  | "DIAGNOSTIC"
  | "COMPANY_PREP"
  | "INTERVIEW";

export type AssessmentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ReviewPolicy = "IMMEDIATE" | "AFTER_DEADLINE" | "NEVER";
export type ReleasePolicy = "IMMEDIATE" | "AFTER_DEADLINE" | "MANUAL_STAFF_RELEASE";
export type AssignmentStatus = "ACTIVE" | "COMPLETED" | "REVOKED";
export type AttemptStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "EXPIRED"
  | "SCORING"
  | "SCORED"
  | "RESULT_RELEASED";

export type AttemptScoringStatus = "PENDING" | "PROVISIONAL" | "FINAL";
export type ResponseScoringStatus =
  | "UNSCORED"
  | "AUTOMATICALLY_SCORED"
  | "MANUAL_REVIEW_REQUIRED"
  | "REVIEWED";

export type BehavioralCategory =
  | "HR_INTERVIEW"
  | "GROUP_DISCUSSION"
  | "SITUATIONAL";

export type AssessmentViolationType =
  | "TAB_SWITCH"
  | "DOCUMENT_HIDDEN"
  | "WINDOW_FOCUS_LOST"
  | "WINDOW_BLUR"
  | "FULLSCREEN_EXIT"
  | "NAVIGATION_AWAY"
  | "PAGE_HIDDEN"
  | "DEVTOOLS_ATTEMPT"
  | "COPY_PASTE_ATTEMPT"
  | "OTHER_CONFIGURED_VIOLATION";

// Phase 08: Mistake Bank & Mistake-to-Mastery Engine
export type MistakePrimaryReason =
  | "INCORRECT_ANSWER"
  | "SKIPPED_UNANSWERED"
  | "STUDENT_FLAGGED"
  | "CORRECT_REVIEW_LATER"
  | "CONTENT_DEFECT_SUSPECTED";

export type ReviewTargetStatus =
  | "NEEDS_REVIEW"
  | "PRACTISING"
  | "REVISION_DUE"
  | "IMPROVING"
  | "PROVISIONAL_MASTERY"
  | "MASTERY_DEMONSTRATED"
  | "CONTENT_DEFECT_SUSPECTED"
  | "RESOLVED_DISMISSED"
  | "CONTENT_INVALIDATED";

export type StudentReasonCategory =
  | "CONCEPT_NOT_UNDERSTOOD"
  | "FORMULA_FACT_FORGOTTEN"
  | "CALCULATION_MISTAKE"
  | "MISREAD_QUESTION"
  | "TIME_PRESSURE"
  | "GUESSED"
  | "CONFUSED_CHOICES"
  | "CARELESS_ERROR"
  | "NOT_SURE"
  | "OTHER";

export type MistakeCaptureReason =
  | "INCORRECT_ANSWER"
  | "SKIPPED_UNANSWERED"
  | "STUDENT_FLAGGED"
  | "CORRECT_REVIEW_LATER"
  | "MANUAL_SCORE_INCORRECT";

export type ReviewActionType =
  | "EXPLANATION_VIEWED"
  | "REFLECTION_SAVED"
  | "PRACTICE_STARTED"
  | "REVISION_RESCHEDULED"
  | "TARGET_DISMISSED";

export type MasteryStatus =
  | "UNASSESSED"
  | "NEEDS_REVIEW"
  | "PRACTISING"
  | "IMPROVING"
  | "PROVISIONAL_MASTERY"
  | "MASTERY_DEMONSTRATED"
  | "NEEDS_REASSESSMENT";

export type EvidenceValidityStatus =
  | "VALID"
  | "INVALIDATED_DEFECT"
  | "EXPIRED"
  | "SUPERSEDED";

export type QuestionDefectType =
  | "INCORRECT_ANSWER_KEY"
  | "AMBIGUOUS_PROMPT"
  | "MISSING_INVALID_OPTION"
  | "ERRONEOUS_EXPLANATION"
  | "BROKEN_RUNNER_CONFIG"
  | "WRONG_SKILL_MAPPING"
  | "OTHER";

export type DefectReportStatus =
  | "PENDING"
  | "CONFIRMED_DEFECT"
  | "FALSE_ALARM"
  | "RESOLVED";

// Phase 09: Placement Memory, Analytics & Improvement
export type HistoricalRecordType =
  | "OFFICIAL_NOTICE"
  | "COLLEGE_CONFIRMED"
  | "VERIFIED_REPORT"
  | "CANDIDATE_REPORTED"
  | "QUESTION_SET_REFERENCE"
  | "SUPERSEDED";

export type HistoricalReliabilityLabel =
  | "OFFICIAL_CONFIRMED"
  | "VERIFIED_HISTORICAL"
  | "CANDIDATE_REPORTED"
  | "INFERRED_GUIDANCE"
  | "DISPUTED"
  | "SUPERSEDED";

export type DriveMatchingBasis =
  | "SAME_COMPANY_AND_ROLE"
  | "SAME_COMPANY_DIFFERENT_ROLE"
  | "ROLE_FAMILY_MATCH"
  | "MANUAL_COMPARISON";

export type DriveComparabilityStatus =
  | "HIGHLY_COMPARABLE"
  | "PARTIALLY_COMPARABLE"
  | "LIMITED_EVIDENCE"
  | "INCOMPATIBLE";

export type TrainingSessionStatus =
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export type TrainingEnrollmentStatus =
  | "ENROLLED"
  | "WAITLISTED"
  | "DROPPED";

export type TrainingAttendanceStatus =
  | "ATTENDED"
  | "ABSENT"
  | "EXCUSED";

export type AnalyticsReportType =
  | "HISTORICAL_DRIVES"
  | "CANDIDATE_REPORTS"
  | "DRIVE_COMPARISONS"
  | "STUDENT_PERFORMANCE"
  | "COHORT_SKILL_GAPS"
  | "TRAINING_BEFORE_AFTER"
  | "PLACEMENT_OUTCOMES";

export type ExportJobStatus =
  | "PENDING"
  | "COMPLETED"
  | "FAILED";

export type StudentRow = Database["public"]["Tables"]["students"]["Row"];

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string;
          name: string;
          slug: string;
          primary_domain: string | null;
          status: TenantStatus;
          student_seat_limit: number;
          official_email: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          onboarding_status: "INVITED" | "PENDING_VERIFICATION" | "COMPLETED" | "ACTION_REQUIRED";
          onboarding_token: string | null;
          onboarding_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          primary_domain?: string | null;
          status?: TenantStatus;
          student_seat_limit?: number;
          official_email?: string | null;
          contact_name?: string | null;
          contact_phone?: string | null;
          onboarding_status?: "INVITED" | "PENDING_VERIFICATION" | "COMPLETED" | "ACTION_REQUIRED";
          onboarding_token?: string | null;
          onboarding_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      platform_admins: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: "SUPER_ADMIN";
          status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REVOKED";
          mfa_enabled: boolean;
          mfa_enforced: boolean;
          last_sign_in_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          role?: "SUPER_ADMIN";
          status?: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "REVOKED";
          mfa_enabled?: boolean;
          mfa_enforced?: boolean;
          last_sign_in_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_admins"]["Insert"]>;
      };
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price_inr: number;
          billing_cycle: "MONTHLY" | "ANNUAL";
          student_limit: number;
          staff_limit: number;
          storage_limit_gb: number;
          features: Json;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          slug: string;
          description?: string | null;
          price_inr?: number;
          billing_cycle?: "MONTHLY" | "ANNUAL";
          student_limit?: number;
          staff_limit?: number;
          storage_limit_gb?: number;
          features?: Json;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["subscription_plans"]["Insert"]>;
      };
      college_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          plan_id: string;
          status: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
          start_date: string;
          expiry_date: string;
          renewal_date: string;
          grace_period_days: number;
          student_seat_limit: number;
          staff_seat_limit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plan_id: string;
          status?: "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "EXPIRED";
          start_date?: string;
          expiry_date?: string;
          renewal_date?: string;
          grace_period_days?: number;
          student_seat_limit?: number;
          staff_seat_limit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["college_subscriptions"]["Insert"]>;
      };
      platform_invoices: {
        Row: {
          id: string;
          invoice_number: string;
          tenant_id: string;
          subscription_id: string | null;
          amount_inr: number;
          tax_inr: number;
          currency: string;
          status: "PAID" | "PENDING" | "OVERDUE" | "CANCELED" | "REFUNDED";
          issue_date: string;
          due_date: string;
          paid_at: string | null;
          payment_method: string;
          is_demo: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          tenant_id: string;
          subscription_id?: string | null;
          amount_inr?: number;
          tax_inr?: number;
          currency?: string;
          status?: "PAID" | "PENDING" | "OVERDUE" | "CANCELED" | "REFUNDED";
          issue_date?: string;
          due_date?: string;
          paid_at?: string | null;
          payment_method?: string;
          is_demo?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_invoices"]["Insert"]>;
      };
      platform_settings: {
        Row: {
          key: string;
          value: Json;
          category: string;
          description: string | null;
          updated_by: string | null;
          updated_at: string;
        };
        Insert: {
          key: string;
          value?: Json;
          category?: string;
          description?: string | null;
          updated_by?: string | null;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_settings"]["Insert"]>;
      };
      platform_admin_invitations: {
        Row: {
          id: string;
          email: string;
          role: "SUPER_ADMIN";
          token_hash: string;
          status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
          invited_by: string | null;
          expires_at: string;
          accepted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          role?: "SUPER_ADMIN";
          token_hash: string;
          status?: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
          invited_by?: string | null;
          expires_at?: string;
          accepted_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["platform_admin_invitations"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          is_platform_admin: boolean;
          avatar_url: string | null;
          phone: string | null;
          location: string | null;
          bio: string | null;
          preferences: Record<string, any> | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          is_platform_admin?: boolean;
          avatar_url?: string | null;
          phone?: string | null;
          location?: string | null;
          bio?: string | null;
          preferences?: Record<string, any> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      tenant_memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: TenantRole;
          status: MembershipStatus;
          permissions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: TenantRole;
          status?: MembershipStatus;
          permissions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenant_memberships"]["Insert"]>;
      };
      academic_years: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status: AcademicYearStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          start_date: string;
          end_date: string;
          status?: AcademicYearStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["academic_years"]["Insert"]>;
      };
      departments: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          code: string;
          status: DepartmentStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          code: string;
          status?: DepartmentStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["departments"]["Insert"]>;
      };
      students: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string | null;
          enrollment_number: string;
          full_name: string;
          email: string;
          phone: string | null;
          department_id: string;
          graduation_year: number;
          degree: string;
          cgpa: number;
          tenth_percentage: number | null;
          twelfth_percentage: number | null;
          active_backlogs: number;
          total_backlogs: number;
          academic_status: AcademicStatus;
          skills: string[];
          resume_url: string | null;
          claimed_at: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id?: string | null;
          enrollment_number: string;
          full_name: string;
          email: string;
          phone?: string | null;
          department_id: string;
          graduation_year: number;
          degree?: string;
          cgpa: number;
          tenth_percentage?: number | null;
          twelfth_percentage?: number | null;
          active_backlogs?: number;
          total_backlogs?: number;
          academic_status?: AcademicStatus;
          skills?: string[];
          resume_url?: string | null;
          claimed_at?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["students"]["Insert"]>;
      };
      companies: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          normalized_name: string;
          website: string | null;
          industry: string | null;
          contact_person: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          internal_notes: string | null;
          is_archived: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          normalized_name: string;
          website?: string | null;
          industry?: string | null;
          contact_person?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          internal_notes?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["companies"]["Insert"]>;
      };
      recruitment_drives: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          academic_year_id: string;
          title: string;
          role_title: string;
          recruitment_type: RecruitmentType;
          job_description: string | null;
          location: string | null;
          compensation_range: string | null;
          status: DriveStatus;
          registration_start: string | null;
          registration_deadline: string | null;
          cancellation_reason: string | null;
          internal_notes: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          academic_year_id: string;
          title: string;
          role_title: string;
          recruitment_type?: RecruitmentType;
          job_description?: string | null;
          location?: string | null;
          compensation_range?: string | null;
          status?: DriveStatus;
          registration_start?: string | null;
          registration_deadline?: string | null;
          cancellation_reason?: string | null;
          internal_notes?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recruitment_drives"]["Insert"]>;
      };
      drive_eligibility_criteria: {
        Row: {
          id: string;
          tenant_id: string;
          drive_id: string;
          min_cgpa: number;
          min_tenth_percentage: number | null;
          min_twelfth_percentage: number | null;
          max_active_backlogs: number;
          max_total_backlogs: number | null;
          allowed_departments: string[];
          allowed_graduation_years: number[];
          allowed_degrees: string[];
          allowed_academic_statuses: string[];
          criteria_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          drive_id: string;
          min_cgpa?: number;
          min_tenth_percentage?: number | null;
          min_twelfth_percentage?: number | null;
          max_active_backlogs?: number;
          max_total_backlogs?: number | null;
          allowed_departments?: string[];
          allowed_graduation_years?: number[];
          allowed_degrees?: string[];
          allowed_academic_statuses?: string[];
          criteria_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drive_eligibility_criteria"]["Insert"]>;
      };
      drive_stages: {
        Row: {
          id: string;
          tenant_id: string;
          drive_id: string;
          name: string;
          stage_type: StageType;
          stage_order: number;
          description: string | null;
          scheduled_at: string | null;
          is_student_visible: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          drive_id: string;
          name: string;
          stage_type: StageType;
          stage_order: number;
          description?: string | null;
          scheduled_at?: string | null;
          is_student_visible?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drive_stages"]["Insert"]>;
      };
      drive_applications: {
        Row: {
          id: string;
          tenant_id: string;
          drive_id: string;
          student_id: string;
          status: ApplicationStatus;
          eligibility_snapshot: Json;
          current_stage_id: string | null;
          registration_date: string;
          withdrawn_at: string | null;
          withdrawn_reason: string | null;
          registered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          drive_id: string;
          student_id: string;
          status?: ApplicationStatus;
          eligibility_snapshot?: Json;
          current_stage_id?: string | null;
          registration_date?: string;
          withdrawn_at?: string | null;
          withdrawn_reason?: string | null;
          registered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["drive_applications"]["Insert"]>;
      };
      candidate_stage_results: {
        Row: {
          id: string;
          tenant_id: string;
          application_id: string;
          stage_id: string;
          status: StageResultStatus;
          score: number | null;
          student_feedback: string | null;
          internal_notes: string | null;
          evaluated_by: string | null;
          evaluated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          application_id: string;
          stage_id: string;
          status?: StageResultStatus;
          score?: number | null;
          student_feedback?: string | null;
          internal_notes?: string | null;
          evaluated_by?: string | null;
          evaluated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["candidate_stage_results"]["Insert"]>;
      };
      placement_offers: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          drive_id: string;
          application_id: string;
          offer_type: RecruitmentType;
          compensation_amount: number | null;
          compensation_details: string | null;
          status: OfferStatus;
          offered_at: string;
          decision_at: string | null;
          joining_date: string | null;
          is_verified: boolean;
          internal_notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          drive_id: string;
          application_id: string;
          offer_type?: RecruitmentType;
          compensation_amount?: number | null;
          compensation_details?: string | null;
          status?: OfferStatus;
          offered_at?: string;
          decision_at?: string | null;
          joining_date?: string | null;
          is_verified?: boolean;
          internal_notes?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["placement_offers"]["Insert"]>;
      };
      audit_logs: {
        Row: {
          id: number;
          tenant_id: string | null;
          actor_id: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          before_state: Json | null;
          after_state: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          tenant_id?: string | null;
          actor_id?: string | null;
          action: string;
          resource_type: string;
          resource_id: string;
          before_state?: Json | null;
          after_state?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Insert"]>;
      };
      canonical_skills: {
        Row: {
          id: string;
          name: string;
          normalized_name: string;
          category: SkillCategory;
          description: string | null;
          tags: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          normalized_name: string;
          category: SkillCategory;
          description?: string | null;
          tags?: string[];
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["canonical_skills"]["Insert"]>;
      };
      practice_resources: {
        Row: {
          id: string;
          tenant_id: string | null;
          skill_id: string;
          title: string;
          resource_type: ResourceType;
          content_class: ContentClass;
          url: string | null;
          description: string | null;
          estimated_minutes: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          skill_id: string;
          title: string;
          resource_type: ResourceType;
          content_class: ContentClass;
          url?: string | null;
          description?: string | null;
          estimated_minutes?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["practice_resources"]["Insert"]>;
      };
      recruitment_sources: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          drive_id: string | null;
          title: string;
          publisher: string;
          source_type: SourceType;
          canonical_url: string | null;
          document_ref: string | null;
          published_at: string | null;
          effective_at: string | null;
          collected_at: string;
          last_checked_at: string;
          verification_status: VerificationStatus;
          access_classification: AccessClassification;
          raw_content: string | null;
          excerpt: string | null;
          created_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          drive_id?: string | null;
          title: string;
          publisher: string;
          source_type: SourceType;
          canonical_url?: string | null;
          document_ref?: string | null;
          published_at?: string | null;
          effective_at?: string | null;
          collected_at?: string;
          last_checked_at?: string;
          verification_status?: VerificationStatus;
          access_classification?: AccessClassification;
          raw_content?: string | null;
          excerpt?: string | null;
          created_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recruitment_sources"]["Insert"]>;
      };
      recruitment_requirements: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          drive_id: string | null;
          source_id: string | null;
          scope_level: ScopeLevel;
          category: RequirementCategory;
          title: string;
          description: string | null;
          structured_value: Json | null;
          source_excerpt: string | null;
          evidence_level: EvidenceLevel;
          verification_status: VerificationStatus;
          is_published_to_students: boolean;
          has_conflict: boolean;
          conflict_details: Json | null;
          is_stale: boolean;
          stale_reason: string | null;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          drive_id?: string | null;
          source_id?: string | null;
          scope_level?: ScopeLevel;
          category: RequirementCategory;
          title: string;
          description?: string | null;
          structured_value?: Json | null;
          source_excerpt?: string | null;
          evidence_level?: EvidenceLevel;
          verification_status?: VerificationStatus;
          is_published_to_students?: boolean;
          has_conflict?: boolean;
          conflict_details?: Json | null;
          is_stale?: boolean;
          stale_reason?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recruitment_requirements"]["Insert"]>;
      };
      requirement_skill_mappings: {
        Row: {
          id: string;
          tenant_id: string;
          drive_id: string;
          requirement_id: string;
          skill_id: string;
          importance: MappingImportance;
          mapping_rationale: string;
          mapping_origin: MappingOrigin;
          verification_status: VerificationStatus;
          evidence_level: EvidenceLevel;
          verified_by: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          drive_id: string;
          requirement_id: string;
          skill_id: string;
          importance?: MappingImportance;
          mapping_rationale: string;
          mapping_origin?: MappingOrigin;
          verification_status?: VerificationStatus;
          evidence_level?: EvidenceLevel;
          verified_by?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["requirement_skill_mappings"]["Insert"]>;
      };
      student_preparation_plans: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          drive_id: string;
          status: PreparationPlanStatus;
          target_completion_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          drive_id: string;
          status?: PreparationPlanStatus;
          target_completion_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_preparation_plans"]["Insert"]>;
      };
      preparation_tasks: {
        Row: {
          id: string;
          tenant_id: string;
          plan_id: string;
          requirement_id: string | null;
          skill_id: string;
          resource_id: string | null;
          stage_id: string | null;
          title: string;
          activity_type: PreparationActivityType;
          priority: PreparationPriority;
          status: PreparationTaskStatus;
          recommendation_rationale: string | null;
          due_date: string | null;
          estimated_minutes: number;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          plan_id: string;
          requirement_id?: string | null;
          skill_id: string;
          resource_id?: string | null;
          stage_id?: string | null;
          title: string;
          activity_type?: PreparationActivityType;
          priority?: PreparationPriority;
          status?: PreparationTaskStatus;
          recommendation_rationale?: string | null;
          due_date?: string | null;
          estimated_minutes?: number;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["preparation_tasks"]["Insert"]>;
      };
      recruitment_experience_reports: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          drive_id: string | null;
          academic_year_id: string | null;
          role_title: string;
          recruitment_cycle: string;
          report_origin: ReportOrigin;
          rounds_described: Json;
          key_topics: string[];
          moderation_status: ModerationStatus;
          is_anonymous: boolean;
          student_id: string | null;
          verified_by: string | null;
          verified_at: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          drive_id?: string | null;
          academic_year_id?: string | null;
          role_title: string;
          recruitment_cycle: string;
          report_origin?: ReportOrigin;
          rounds_described?: Json;
          key_topics?: string[];
          moderation_status?: ModerationStatus;
          is_anonymous?: boolean;
          student_id?: string | null;
          verified_by?: string | null;
          verified_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["recruitment_experience_reports"]["Insert"]>;
      };
      question_banks: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          subject: string | null;
          description: string | null;
          category: BankCategory;
          sharing_policy: BankSharingPolicy;
          status: BankStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          subject?: string | null;
          description?: string | null;
          category: BankCategory;
          sharing_policy?: BankSharingPolicy;
          status?: BankStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_banks"]["Insert"]>;
      };
      questions: {
        Row: {
          id: string;
          tenant_id: string;
          bank_id: string;
          question_type: QuestionType;
          current_version_id: string | null;
          lifecycle_status: QuestionLifecycleStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          bank_id: string;
          question_type: QuestionType;
          current_version_id?: string | null;
          lifecycle_status?: QuestionLifecycleStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["questions"]["Insert"]>;
      };
      question_versions: {
        Row: {
          id: string;
          tenant_id: string;
          question_id: string;
          version_number: number;
          prompt: string;
          content_format: QuestionContentFormat;
          options: Json;
          answer_key: Json;
          explanation: string | null;
          difficulty: QuestionDifficulty;
          skill_id: string | null;
          topic_tags: string[];
          source_type: QuestionSourceType;
          source_reference: string | null;
          license_type: QuestionLicenseType;
          review_status: AnswerKeyReviewStatus;
          review_notes: string | null;
          fingerprint: string;
          change_summary: string | null;
          published_at: string | null;
          created_by: string | null;
          reviewed_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          question_id: string;
          version_number?: number;
          prompt: string;
          content_format?: QuestionContentFormat;
          options?: Json;
          answer_key?: Json;
          explanation?: string | null;
          difficulty?: QuestionDifficulty;
          skill_id?: string | null;
          topic_tags?: string[];
          source_type?: QuestionSourceType;
          source_reference?: string | null;
          license_type?: QuestionLicenseType;
          review_status?: AnswerKeyReviewStatus;
          review_notes?: string | null;
          fingerprint: string;
          change_summary?: string | null;
          published_at?: string | null;
          created_by?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_versions"]["Insert"]>;
      };
      question_import_jobs: {
        Row: {
          id: string;
          tenant_id: string;
          bank_id: string | null;
          file_name: string;
          total_rows: number;
          valid_rows: number;
          invalid_rows: number;
          duplicate_rows: number;
          status: ImportJobStatus;
          error_report: Json;
          created_by: string | null;
          created_at: string;
          committed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          bank_id?: string | null;
          file_name: string;
          total_rows?: number;
          valid_rows?: number;
          invalid_rows?: number;
          duplicate_rows?: number;
          status?: ImportJobStatus;
          error_report?: Json;
          created_by?: string | null;
          created_at?: string;
          committed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["question_import_jobs"]["Insert"]>;
      };
      question_duplicate_candidates: {
        Row: {
          id: string;
          tenant_id: string;
          source_question_id: string;
          matched_question_id: string;
          similarity_score: number;
          detection_method: DuplicateDetectionMethod;
          status: DuplicateStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          source_question_id: string;
          matched_question_id: string;
          similarity_score: number;
          detection_method: DuplicateDetectionMethod;
          status?: DuplicateStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_duplicate_candidates"]["Insert"]>;
      };
      question_sets: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          purpose: QuestionSetPurpose;
          status: QuestionSetStatus;
          version_number: number;
          is_locked: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          purpose?: QuestionSetPurpose;
          status?: QuestionSetStatus;
          version_number?: number;
          is_locked?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_sets"]["Insert"]>;
      };
      question_set_items: {
        Row: {
          id: string;
          tenant_id: string;
          set_id: string;
          question_id: string;
          version_id: string;
          sequence_order: number;
          points: number;
          negative_points: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          set_id: string;
          question_id: string;
          version_id: string;
          sequence_order?: number;
          points?: number;
          negative_points?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_set_items"]["Insert"]>;
      };
      assessments: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          purpose: AssessmentPurpose;
          question_set_id: string;
          set_version_id: number;
          drive_id: string | null;
          time_limit_minutes: number | null;
          allowed_attempts: number;
          review_policy: ReviewPolicy;
          release_policy: ReleasePolicy;
          shuffle_questions: boolean;
          pass_percentage: number;
          status: AssessmentStatus;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          description?: string | null;
          purpose?: AssessmentPurpose;
          question_set_id: string;
          set_version_id?: number;
          drive_id?: string | null;
          time_limit_minutes?: number | null;
          allowed_attempts?: number;
          review_policy?: ReviewPolicy;
          release_policy?: ReleasePolicy;
          shuffle_questions?: boolean;
          pass_percentage?: number;
          status?: AssessmentStatus;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessments"]["Insert"]>;
      };
      assessment_assignments: {
        Row: {
          id: string;
          tenant_id: string;
          assessment_id: string;
          student_id: string | null;
          cohort_name: string | null;
          window_start: string | null;
          window_end: string | null;
          max_attempts_override: number | null;
          status: AssignmentStatus;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          assessment_id: string;
          student_id?: string | null;
          cohort_name?: string | null;
          window_start?: string | null;
          window_end?: string | null;
          max_attempts_override?: number | null;
          status?: AssignmentStatus;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessment_assignments"]["Insert"]>;
      };
      assessment_attempts: {
        Row: {
          id: string;
          tenant_id: string;
          assessment_id: string;
          assignment_id: string | null;
          student_id: string;
          attempt_number: number;
          status: AttemptStatus;
          started_at: string;
          expires_at: string | null;
          submitted_at: string | null;
          total_points: number;
          earned_points: number;
          score_percentage: number;
          is_passed: boolean;
          scoring_status: AttemptScoringStatus;
          submission_reason: string | null;
          violation_count: number;
          is_fullscreen_enforced: boolean;
          client_meta: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          assessment_id: string;
          assignment_id?: string | null;
          student_id: string;
          attempt_number?: number;
          status?: AttemptStatus;
          started_at?: string;
          expires_at?: string | null;
          submitted_at?: string | null;
          total_points?: number;
          earned_points?: number;
          score_percentage?: number;
          is_passed?: boolean;
          scoring_status?: AttemptScoringStatus;
          submission_reason?: string | null;
          violation_count?: number;
          is_fullscreen_enforced?: boolean;
          client_meta?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessment_attempts"]["Insert"]>;
      };
      assessment_violations: {
        Row: {
          id: string;
          tenant_id: string;
          attempt_id: string;
          assessment_id: string;
          student_id: string;
          violation_type: AssessmentViolationType;
          metadata: Json;
          triggered_submission: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          attempt_id: string;
          assessment_id: string;
          student_id: string;
          violation_type: AssessmentViolationType;
          metadata?: Json;
          triggered_submission?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["assessment_violations"]["Insert"]>;
      };
      attempt_responses: {
        Row: {
          id: string;
          tenant_id: string;
          attempt_id: string;
          question_id: string;
          version_id: string;
          response_payload: Json;
          save_sequence: number;
          is_flagged: boolean;
          is_answered: boolean;
          points_awarded: number;
          is_correct: boolean | null;
          scoring_status: ResponseScoringStatus;
          manual_notes: string | null;
          last_saved_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          attempt_id: string;
          question_id: string;
          version_id: string;
          response_payload?: Json;
          save_sequence?: number;
          is_flagged?: boolean;
          is_answered?: boolean;
          points_awarded?: number;
          is_correct?: boolean | null;
          scoring_status?: ResponseScoringStatus;
          manual_notes?: string | null;
          last_saved_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["attempt_responses"]["Insert"]>;
      };
      preparation_practice_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          skill_id: string | null;
          topic: string | null;
          questions_practiced: number;
          correct_count: number;
          time_spent_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          skill_id?: string | null;
          topic?: string | null;
          questions_practiced?: number;
          correct_count?: number;
          time_spent_seconds?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["preparation_practice_sessions"]["Insert"]>;
      };
      student_behavioral_responses: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          prompt: string;
          category: BehavioralCategory;
          response_text: string;
          self_reflection: string | null;
          key_learnings: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          prompt: string;
          category?: BehavioralCategory;
          response_text: string;
          self_reflection?: string | null;
          key_learnings?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_behavioral_responses"]["Insert"]>;
      };
      mistake_review_targets: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          question_id: string;
          version_id: string;
          skill_id: string | null;
          primary_reason: MistakePrimaryReason;
          status: ReviewTargetStatus;
          occurrence_count: number;
          revision_stage: number;
          last_reviewed_at: string | null;
          next_due_at: string;
          first_observed_at: string;
          last_observed_at: string;
          student_reflection: string | null;
          student_reason_category: StudentReasonCategory | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          question_id: string;
          version_id: string;
          skill_id?: string | null;
          primary_reason: MistakePrimaryReason;
          status?: ReviewTargetStatus;
          occurrence_count?: number;
          revision_stage?: number;
          last_reviewed_at?: string | null;
          next_due_at?: string;
          first_observed_at?: string;
          last_observed_at?: string;
          student_reflection?: string | null;
          student_reason_category?: StudentReasonCategory | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mistake_review_targets"]["Insert"]>;
      };
      mistake_occurrences: {
        Row: {
          id: string;
          tenant_id: string;
          target_id: string;
          student_id: string;
          attempt_id: string;
          response_id: string | null;
          question_id: string;
          version_id: string;
          capture_reason: MistakeCaptureReason;
          submitted_payload: Json;
          points_awarded: number;
          occurred_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          target_id: string;
          student_id: string;
          attempt_id: string;
          response_id?: string | null;
          question_id: string;
          version_id: string;
          capture_reason: MistakeCaptureReason;
          submitted_payload?: Json;
          points_awarded?: number;
          occurred_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mistake_occurrences"]["Insert"]>;
      };
      review_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          target_id: string;
          student_id: string;
          action_type: ReviewActionType;
          notes: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          target_id: string;
          student_id: string;
          action_type: ReviewActionType;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["review_sessions"]["Insert"]>;
      };
      mastery_evidence_records: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          skill_id: string;
          target_id: string | null;
          evidence_question_id: string;
          evidence_version_id: string;
          attempt_id: string | null;
          is_new_question: boolean;
          is_correct: boolean;
          points_earned: number;
          difficulty: QuestionDifficulty;
          validity_status: EvidenceValidityStatus;
          invalidation_reason: string | null;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          skill_id: string;
          target_id?: string | null;
          evidence_question_id: string;
          evidence_version_id: string;
          attempt_id?: string | null;
          is_new_question?: boolean;
          is_correct: boolean;
          points_earned?: number;
          difficulty?: QuestionDifficulty;
          validity_status?: EvidenceValidityStatus;
          invalidation_reason?: string | null;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["mastery_evidence_records"]["Insert"]>;
      };
      student_skill_mastery: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          skill_id: string;
          mastery_status: MasteryStatus;
          total_mistakes_count: number;
          active_review_count: number;
          independent_correct_count: number;
          independent_attempts_count: number;
          accuracy_percentage: number;
          last_evidence_at: string | null;
          policy_version: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          skill_id: string;
          mastery_status?: MasteryStatus;
          total_mistakes_count?: number;
          active_review_count?: number;
          independent_correct_count?: number;
          independent_attempts_count?: number;
          accuracy_percentage?: number;
          last_evidence_at?: string | null;
          policy_version?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_skill_mastery"]["Insert"]>;
      };
      question_defect_reports: {
        Row: {
          id: string;
          tenant_id: string;
          question_id: string;
          version_id: string;
          reported_by: string | null;
          defect_type: QuestionDefectType;
          description: string;
          status: DefectReportStatus;
          reviewed_by: string | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          question_id: string;
          version_id: string;
          reported_by?: string | null;
          defect_type: QuestionDefectType;
          description: string;
          status?: DefectReportStatus;
          reviewed_by?: string | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["question_defect_reports"]["Insert"]>;
      };
      historical_recruitment_records: {
        Row: {
          id: string;
          tenant_id: string;
          company_id: string;
          role_title: string;
          recruitment_year: string;
          recruitment_cycle: string;
          historical_drive_id: string | null;
          source_id: string | null;
          record_type: HistoricalRecordType;
          reliability_label: HistoricalReliabilityLabel;
          process_summary: string | null;
          eligibility_criteria_snapshot: Json;
          confirmed_rounds: Json;
          reported_rounds: Json;
          relevant_question_set_id: string | null;
          verification_status: VerificationStatus;
          source_date: string | null;
          last_verified_at: string | null;
          is_superseded: boolean;
          superseded_by: string | null;
          sharing_scope: "COLLEGE_PRIVATE" | "GLOBAL_SHARED";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_id: string;
          role_title: string;
          recruitment_year: string;
          recruitment_cycle: string;
          historical_drive_id?: string | null;
          source_id?: string | null;
          record_type?: HistoricalRecordType;
          reliability_label?: HistoricalReliabilityLabel;
          process_summary?: string | null;
          eligibility_criteria_snapshot?: Json;
          confirmed_rounds?: Json;
          reported_rounds?: Json;
          relevant_question_set_id?: string | null;
          verification_status?: VerificationStatus;
          source_date?: string | null;
          last_verified_at?: string | null;
          is_superseded?: boolean;
          superseded_by?: string | null;
          sharing_scope?: "COLLEGE_PRIVATE" | "GLOBAL_SHARED";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["historical_recruitment_records"]["Insert"]>;
      };
      historical_drive_comparisons: {
        Row: {
          id: string;
          tenant_id: string;
          current_drive_id: string;
          historical_record_id: string;
          matching_basis: DriveMatchingBasis;
          shared_attributes: Json;
          differing_attributes: Json;
          unknown_fields: Json;
          conflicts: Json;
          comparability_status: DriveComparabilityStatus;
          limitations_disclaimer: string;
          generated_by: string | null;
          generated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          current_drive_id: string;
          historical_record_id: string;
          matching_basis: DriveMatchingBasis;
          shared_attributes?: Json;
          differing_attributes?: Json;
          unknown_fields?: Json;
          conflicts?: Json;
          comparability_status?: DriveComparabilityStatus;
          limitations_disclaimer: string;
          generated_by?: string | null;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["historical_drive_comparisons"]["Insert"]>;
      };
      experience_report_moderation_logs: {
        Row: {
          id: string;
          tenant_id: string;
          report_id: string;
          previous_status: string;
          new_status: string;
          moderated_by: string | null;
          moderation_notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          report_id: string;
          previous_status: string;
          new_status: string;
          moderated_by?: string | null;
          moderation_notes?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["experience_report_moderation_logs"]["Insert"]>;
      };
      training_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          title: string;
          description: string | null;
          skill_id: string | null;
          topic: string;
          trainer_id: string | null;
          session_date: string;
          duration_minutes: number;
          baseline_assessment_id: string | null;
          follow_up_assessment_id: string | null;
          status: TrainingSessionStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          title: string;
          description?: string | null;
          skill_id?: string | null;
          topic: string;
          trainer_id?: string | null;
          session_date: string;
          duration_minutes?: number;
          baseline_assessment_id?: string | null;
          follow_up_assessment_id?: string | null;
          status?: TrainingSessionStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_sessions"]["Insert"]>;
      };
      training_attendance: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string;
          student_id: string;
          enrollment_status: TrainingEnrollmentStatus;
          attendance_status: TrainingAttendanceStatus;
          pre_score: number | null;
          post_score: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id: string;
          student_id: string;
          enrollment_status?: TrainingEnrollmentStatus;
          attendance_status?: TrainingAttendanceStatus;
          pre_score?: number | null;
          post_score?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_attendance"]["Insert"]>;
      };
      training_before_after_comparisons: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string;
          skill_id: string | null;
          baseline_assessment_id: string;
          follow_up_assessment_id: string;
          eligible_students_count: number;
          paired_students_count: number;
          baseline_avg_score: number;
          followup_avg_score: number;
          absolute_delta: number;
          relative_percentage_delta: number | null;
          limitations_disclaimer: string;
          generated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id: string;
          skill_id?: string | null;
          baseline_assessment_id: string;
          follow_up_assessment_id: string;
          eligible_students_count?: number;
          paired_students_count?: number;
          baseline_avg_score?: number;
          followup_avg_score?: number;
          absolute_delta?: number;
          relative_percentage_delta?: number | null;
          limitations_disclaimer: string;
          generated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["training_before_after_comparisons"]["Insert"]>;
      };
      analytics_export_jobs: {
        Row: {
          id: string;
          tenant_id: string;
          requested_by: string | null;
          report_type: AnalyticsReportType;
          filter_payload: Json;
          file_name: string;
          file_path: string | null;
          status: ExportJobStatus;
          record_count: number;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          requested_by?: string | null;
          report_type: AnalyticsReportType;
          filter_payload?: Json;
          file_name: string;
          file_path?: string | null;
          status?: ExportJobStatus;
          record_count?: number;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["analytics_export_jobs"]["Insert"]>;
      };
      student_career_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          headline: string | null;
          bio: string | null;
          location: string | null;
          linkedin_url: string | null;
          github_url: string | null;
          portfolio_url: string | null;
          technical_skills: Json;
          soft_skills: Json;
          projects: Json;
          experience: Json;
          certifications: Json;
          completeness_percentage: number;
          completeness_breakdown: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          headline?: string | null;
          bio?: string | null;
          location?: string | null;
          linkedin_url?: string | null;
          github_url?: string | null;
          portfolio_url?: string | null;
          technical_skills?: Json;
          soft_skills?: Json;
          projects?: Json;
          experience?: Json;
          certifications?: Json;
          completeness_percentage?: number;
          completeness_breakdown?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_career_profiles"]["Insert"]>;
      };
      student_resumes: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          file_type: "pdf" | "docx";
          is_primary: boolean;
          parsed_text: string | null;
          parsing_status: "PENDING" | "PARSED" | "PARTIALLY_PARSED" | "FAILED";
          parsing_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          file_name: string;
          file_path: string;
          file_size_bytes: number;
          file_type: "pdf" | "docx";
          is_primary?: boolean;
          parsed_text?: string | null;
          parsing_status?: "PENDING" | "PARSED" | "PARTIALLY_PARSED" | "FAILED";
          parsing_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_resumes"]["Insert"]>;
      };
      resume_scans: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          resume_id: string;
          target_drive_id: string | null;
          target_role: string | null;
          model: string;
          status: "PENDING" | "COMPLETED" | "FAILED";
          overall_quality_score: number;
          parseability_score: number;
          content_quality_score: number;
          skills_coverage_score: number | null;
          match_score: number | null;
          analysis_summary: string;
          detected_sections: string[];
          missing_sections: string[];
          strengths: Json;
          issues: Json;
          skills_analysis: Json;
          improvement_suggestions: Json;
          limitations: string[];
          token_usage: Json;
          processing_duration_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          resume_id: string;
          target_drive_id?: string | null;
          target_role?: string | null;
          model: string;
          status?: "PENDING" | "COMPLETED" | "FAILED";
          overall_quality_score: number;
          parseability_score: number;
          content_quality_score: number;
          skills_coverage_score?: number | null;
          match_score?: number | null;
          analysis_summary: string;
          detected_sections?: string[];
          missing_sections?: string[];
          strengths?: Json;
          issues?: Json;
          skills_analysis?: Json;
          improvement_suggestions?: Json;
          limitations?: string[];
          token_usage?: Json;
          processing_duration_ms?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["resume_scans"]["Insert"]>;
      };
      student_drive_matches: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          drive_id: string;
          resume_id: string | null;
          match_score: number;
          official_eligibility: "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL" | "UNKNOWN";
          eligibility_reasons: Json;
          matched_skills: string[];
          missing_skills: string[];
          preferred_skills: string[];
          strengths: Json;
          recommendations: Json;
          match_explanation: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          drive_id: string;
          resume_id?: string | null;
          match_score: number;
          official_eligibility?: "ELIGIBLE" | "INELIGIBLE" | "CONDITIONAL" | "UNKNOWN";
          eligibility_reasons?: Json;
          matched_skills?: string[];
          missing_skills?: string[];
          preferred_skills?: string[];
          strengths?: Json;
          recommendations?: Json;
          match_explanation?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_drive_matches"]["Insert"]>;
      };
      student_skill_gap_analyses: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          target_role: string;
          target_drive_id: string | null;
          custom_job_description: string | null;
          overall_readiness_score: number;
          summary: string;
          market_context: string | null;
          matched_skills: Json;
          missing_required_skills: Json;
          missing_preferred_skills: Json;
          skills_with_insufficient_evidence: Json;
          learning_roadmap: Json;
          profile_snapshot_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          target_role: string;
          target_drive_id?: string | null;
          custom_job_description?: string | null;
          overall_readiness_score: number;
          summary: string;
          market_context?: string | null;
          matched_skills?: Json;
          missing_required_skills?: Json;
          missing_preferred_skills?: Json;
          skills_with_insufficient_evidence?: Json;
          learning_roadmap?: Json;
          profile_snapshot_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_skill_gap_analyses"]["Insert"]>;
      };
      student_skill_progress: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          skill_name: string;
          status: string;
          target_role: string | null;
          evidence_links: Json;
          notes: string | null;
          verified_at: string | null;
          verified_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          skill_name: string;
          status?: string;
          target_role?: string | null;
          evidence_links?: Json;
          notes?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_skill_progress"]["Insert"]>;
      };
      student_career_passports: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          visibility: string;
          headline: string | null;
          summary: string | null;
          career_interests: string[];
          preferred_roles: string[];
          included_sections: Json;
          custom_skills: Json;
          custom_projects: Json;
          custom_experience: Json;
          custom_certifications: Json;
          published_snapshot: Json | null;
          published_at: string | null;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          visibility?: string;
          headline?: string | null;
          summary?: string | null;
          career_interests?: string[];
          preferred_roles?: string[];
          included_sections?: Json;
          custom_skills?: Json;
          custom_projects?: Json;
          custom_experience?: Json;
          custom_certifications?: Json;
          published_snapshot?: Json | null;
          published_at?: string | null;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_career_passports"]["Insert"]>;
      };
      career_passport_shares: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          passport_id: string;
          token_hash: string;
          label: string;
          is_active: boolean;
          expires_at: string | null;
          access_count: number;
          last_accessed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          passport_id: string;
          token_hash: string;
          label?: string;
          is_active?: boolean;
          expires_at?: string | null;
          access_count?: number;
          last_accessed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["career_passport_shares"]["Insert"]>;
      };
      student_mock_interview_sessions: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          interview_type: string;
          target_role: string;
          difficulty: string;
          target_drive_id: string | null;
          total_questions: number;
          current_question_index: number;
          status: string;
          overall_score: number | null;
          relevance_score: number | null;
          technical_accuracy_score: number | null;
          depth_score: number | null;
          structure_score: number | null;
          practical_reasoning_score: number | null;
          communication_score: number | null;
          final_feedback_summary: string | null;
          strong_answers: Json;
          weak_answers: Json;
          technical_gaps: Json;
          recommended_exercises: Json;
          suggested_next_level: string | null;
          model: string;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          interview_type: string;
          target_role: string;
          difficulty?: string;
          target_drive_id?: string | null;
          total_questions?: number;
          current_question_index?: number;
          status?: string;
          overall_score?: number | null;
          relevance_score?: number | null;
          technical_accuracy_score?: number | null;
          depth_score?: number | null;
          structure_score?: number | null;
          practical_reasoning_score?: number | null;
          communication_score?: number | null;
          final_feedback_summary?: string | null;
          strong_answers?: Json;
          weak_answers?: Json;
          technical_gaps?: Json;
          recommended_exercises?: Json;
          suggested_next_level?: string | null;
          model?: string;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_mock_interview_sessions"]["Insert"]>;
      };
      student_mock_interview_messages: {
        Row: {
          id: string;
          tenant_id: string;
          session_id: string;
          student_id: string;
          question_index: number;
          question_text: string;
          question_category: string;
          is_follow_up: boolean;
          parent_message_id: string | null;
          student_answer: string | null;
          answer_submitted_at: string | null;
          evaluation: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          session_id: string;
          student_id: string;
          question_index: number;
          question_text: string;
          question_category?: string;
          is_follow_up?: boolean;
          parent_message_id?: string | null;
          student_answer?: string | null;
          answer_submitted_at?: string | null;
          evaluation?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_mock_interview_messages"]["Insert"]>;
      };
      placement_practice_questions: {
        Row: {
          id: string;
          tenant_id: string | null;
          category: string;
          topic: string;
          difficulty: string;
          question_type: string;
          question_text: string;
          options: Json;
          correct_answer: Json;
          explanation: string;
          solving_approach: string | null;
          recommended_time_seconds: number;
          tags: string[];
          is_published: boolean;
          is_global: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          category: string;
          topic: string;
          difficulty?: string;
          question_type?: string;
          question_text: string;
          options?: Json;
          correct_answer: Json;
          explanation: string;
          solving_approach?: string | null;
          recommended_time_seconds?: number;
          tags?: string[];
          is_published?: boolean;
          is_global?: boolean;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["placement_practice_questions"]["Insert"]>;
      };
      placement_practice_attempts: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          practice_mode: string;
          category: string | null;
          topic: string | null;
          difficulty: string | null;
          total_questions: number;
          correct_count: number;
          incorrect_count: number;
          unanswered_count: number;
          score_percentage: number;
          time_spent_seconds: number;
          time_limit_seconds: number | null;
          assigned_question_ids: string[];
          status: string;
          results_breakdown: Json;
          started_at: string;
          deadline_at: string | null;
          submitted_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          practice_mode: string;
          category?: string | null;
          topic?: string | null;
          difficulty?: string | null;
          total_questions?: number;
          correct_count?: number;
          incorrect_count?: number;
          unanswered_count?: number;
          score_percentage?: number;
          time_spent_seconds?: number;
          time_limit_seconds?: number | null;
          assigned_question_ids?: string[];
          status?: string;
          results_breakdown?: Json;
          started_at?: string;
          deadline_at?: string | null;
          submitted_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["placement_practice_attempts"]["Insert"]>;
      };
      placement_practice_responses: {
        Row: {
          id: string;
          tenant_id: string;
          attempt_id: string;
          student_id: string;
          question_id: string;
          student_answer: Json | null;
          is_correct: boolean;
          is_marked_for_review: boolean;
          time_spent_seconds: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          attempt_id: string;
          student_id: string;
          question_id: string;
          student_answer?: Json | null;
          is_correct?: boolean;
          is_marked_for_review?: boolean;
          time_spent_seconds?: number;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["placement_practice_responses"]["Insert"]>;
      };
      company_profiles: {
        Row: {
          id: string;
          tenant_id: string | null;
          name: string;
          slug: string;
          description: string;
          industry: string;
          website_url: string | null;
          logo_url: string | null;
          difficulty: string;
          hiring_workflow: Json;
          overview_notes: string | null;
          is_global: boolean;
          source_url: string | null;
          source_type: string;
          verification_date: string | null;
          disclaimer: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          name: string;
          slug: string;
          description: string;
          industry: string;
          website_url?: string | null;
          logo_url?: string | null;
          difficulty?: string;
          hiring_workflow?: Json;
          overview_notes?: string | null;
          is_global?: boolean;
          source_url?: string | null;
          source_type?: string;
          verification_date?: string | null;
          disclaimer?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_profiles"]["Insert"]>;
      };
      company_roles: {
        Row: {
          id: string;
          tenant_id: string | null;
          company_id: string;
          role_name: string;
          role_slug: string;
          description: string | null;
          required_skills: string[];
          preferred_skills: string[];
          eligibility_criteria: Json;
          is_global: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          company_id: string;
          role_name: string;
          role_slug: string;
          description?: string | null;
          required_skills?: string[];
          preferred_skills?: string[];
          eligibility_criteria?: Json;
          is_global?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_roles"]["Insert"]>;
      };
      company_prep_tracks: {
        Row: {
          id: string;
          tenant_id: string | null;
          company_id: string;
          role_id: string | null;
          track_name: string;
          description: string | null;
          modules: Json;
          is_active: boolean;
          is_global: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id?: string | null;
          company_id: string;
          role_id?: string | null;
          track_name: string;
          description?: string | null;
          modules?: Json;
          is_active?: boolean;
          is_global?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["company_prep_tracks"]["Insert"]>;
      };
      student_company_prep_progress: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          company_id: string;
          track_id: string | null;
          completed_module_ids: string[];
          overall_progress_percentage: number;
          is_saved_for_later: boolean;
          last_practiced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          company_id: string;
          track_id?: string | null;
          completed_module_ids?: string[];
          overall_progress_percentage?: number;
          is_saved_for_later?: boolean;
          last_practiced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_company_prep_progress"]["Insert"]>;
      };
      student_learning_recommendations: {
        Row: {
          id: string;
          tenant_id: string;
          student_id: string;
          title: string;
          description: string;
          category: string;
          priority: string;
          supporting_evidence: Json;
          reason_recommended: string;
          suggested_action: string;
          destination_route: string;
          expected_outcome: string;
          status: string;
          dismissal_reason: string | null;
          source_hash: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          student_id: string;
          title: string;
          description: string;
          category: string;
          priority?: string;
          supporting_evidence?: Json;
          reason_recommended: string;
          suggested_action: string;
          destination_route: string;
          expected_outcome: string;
          status?: string;
          dismissal_reason?: string | null;
          source_hash: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["student_learning_recommendations"]["Insert"]>;
      };
    };
  };
}

export type PlacementPracticeQuestionRow = Database["public"]["Tables"]["placement_practice_questions"]["Row"];
export type PlacementPracticeAttemptRow = Database["public"]["Tables"]["placement_practice_attempts"]["Row"];
export type PlacementPracticeResponseRow = Database["public"]["Tables"]["placement_practice_responses"]["Row"];
export type CompanyProfileRow = Database["public"]["Tables"]["company_profiles"]["Row"];
export type CompanyRoleRow = Database["public"]["Tables"]["company_roles"]["Row"];
export type CompanyPrepTrackRow = Database["public"]["Tables"]["company_prep_tracks"]["Row"];
export type StudentCompanyPrepProgressRow = Database["public"]["Tables"]["student_company_prep_progress"]["Row"];
export type StudentLearningRecommendationRow = Database["public"]["Tables"]["student_learning_recommendations"]["Row"];

export type CanonicalSkillRow = Database["public"]["Tables"]["canonical_skills"]["Row"];
export type PracticeResourceRow = Database["public"]["Tables"]["practice_resources"]["Row"];
export type RecruitmentSourceRow = Database["public"]["Tables"]["recruitment_sources"]["Row"];
export type RecruitmentRequirementRow = Database["public"]["Tables"]["recruitment_requirements"]["Row"];
export type RequirementSkillMappingRow = Database["public"]["Tables"]["requirement_skill_mappings"]["Row"];
export type StudentPreparationPlanRow = Database["public"]["Tables"]["student_preparation_plans"]["Row"];
export type PreparationTaskRow = Database["public"]["Tables"]["preparation_tasks"]["Row"];
export type RecruitmentExperienceReportRow = Database["public"]["Tables"]["recruitment_experience_reports"]["Row"];

export type QuestionBankRow = Database["public"]["Tables"]["question_banks"]["Row"];
export type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
export type QuestionVersionRow = Database["public"]["Tables"]["question_versions"]["Row"];
export type QuestionImportJobRow = Database["public"]["Tables"]["question_import_jobs"]["Row"];
export type QuestionDuplicateCandidateRow = Database["public"]["Tables"]["question_duplicate_candidates"]["Row"];
export type QuestionSetRow = Database["public"]["Tables"]["question_sets"]["Row"];
export type QuestionSetItemRow = Database["public"]["Tables"]["question_set_items"]["Row"];

export type AssessmentRow = Database["public"]["Tables"]["assessments"]["Row"];
export type AssessmentAssignmentRow = Database["public"]["Tables"]["assessment_assignments"]["Row"];
export type AssessmentAttemptRow = Database["public"]["Tables"]["assessment_attempts"]["Row"];
export type AssessmentViolationRow = Database["public"]["Tables"]["assessment_violations"]["Row"];
export type AttemptResponseRow = Database["public"]["Tables"]["attempt_responses"]["Row"];
export type PreparationPracticeSessionRow = Database["public"]["Tables"]["preparation_practice_sessions"]["Row"];
export type StudentBehavioralResponseRow = Database["public"]["Tables"]["student_behavioral_responses"]["Row"];

export type MistakeReviewTargetRow = Database["public"]["Tables"]["mistake_review_targets"]["Row"];
export type MistakeOccurrenceRow = Database["public"]["Tables"]["mistake_occurrences"]["Row"];
export type ReviewSessionRow = Database["public"]["Tables"]["review_sessions"]["Row"];
export type MasteryEvidenceRecordRow = Database["public"]["Tables"]["mastery_evidence_records"]["Row"];
export type StudentSkillMasteryRow = Database["public"]["Tables"]["student_skill_mastery"]["Row"];
export type QuestionDefectReportRow = Database["public"]["Tables"]["question_defect_reports"]["Row"];

export type HistoricalRecruitmentRecordRow = Database["public"]["Tables"]["historical_recruitment_records"]["Row"];
export type HistoricalDriveComparisonRow = Database["public"]["Tables"]["historical_drive_comparisons"]["Row"];
export type ExperienceReportModerationLogRow = Database["public"]["Tables"]["experience_report_moderation_logs"]["Row"];
export type TrainingSessionRow = Database["public"]["Tables"]["training_sessions"]["Row"];
export type TrainingAttendanceRow = Database["public"]["Tables"]["training_attendance"]["Row"];
export type TrainingBeforeAfterComparisonRow = Database["public"]["Tables"]["training_before_after_comparisons"]["Row"];
export type AnalyticsExportJobRow = Database["public"]["Tables"]["analytics_export_jobs"]["Row"];

export type StudentCareerProfileRow = Database["public"]["Tables"]["student_career_profiles"]["Row"];
export type StudentResumeRow = Database["public"]["Tables"]["student_resumes"]["Row"];
export type ResumeScanRow = Database["public"]["Tables"]["resume_scans"]["Row"];
export type StudentDriveMatchRow = Database["public"]["Tables"]["student_drive_matches"]["Row"];

export type StudentSkillGapAnalysisRow = Database["public"]["Tables"]["student_skill_gap_analyses"]["Row"];
export type StudentSkillProgressRow = Database["public"]["Tables"]["student_skill_progress"]["Row"];
export type StudentCareerPassportRow = Database["public"]["Tables"]["student_career_passports"]["Row"];
export type CareerPassportShareRow = Database["public"]["Tables"]["career_passport_shares"]["Row"];
export type StudentMockInterviewSessionRow = Database["public"]["Tables"]["student_mock_interview_sessions"]["Row"];
export type StudentMockInterviewMessageRow = Database["public"]["Tables"]["student_mock_interview_messages"]["Row"];

