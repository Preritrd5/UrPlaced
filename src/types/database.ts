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
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tenants"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          is_platform_admin: boolean;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string;
          is_platform_admin?: boolean;
          avatar_url?: string | null;
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
    };
  };
}

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

