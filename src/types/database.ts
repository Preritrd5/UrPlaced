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
    };
  };
}
