-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 04 Migration: College Placement Management Schema & RLS
-- ==============================================================================

-- 1. Helper Function: Check if user is tenant staff (Placement Head, Staff, or Trainer)
CREATE OR REPLACE FUNCTION public.is_tenant_staff(target_tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.tenant_id = target_tenant_id
      AND tm.user_id = user_id
      AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
      AND tm.status = 'ACTIVE'
      AND t.status = 'ACTIVE'
  ) OR public.is_platform_admin(user_id);
$$;

-- 2. Academic Years Table
CREATE TABLE IF NOT EXISTS public.academic_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_academic_year_dates CHECK (start_date < end_date),
    CONSTRAINT uq_academic_year_tenant_name UNIQUE (tenant_id, name),
    CONSTRAINT uq_academic_year_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_academic_years_tenant ON public.academic_years(tenant_id);
CREATE INDEX IF NOT EXISTS idx_academic_years_status ON public.academic_years(tenant_id, status);

-- 3. Departments Table
CREATE TABLE IF NOT EXISTS public.departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    code VARCHAR(32) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_departments_tenant_code UNIQUE (tenant_id, code),
    CONSTRAINT uq_departments_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_departments_tenant ON public.departments(tenant_id);

-- 4. Students Table
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    enrollment_number VARCHAR(64) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    department_id UUID NOT NULL,
    graduation_year INTEGER NOT NULL,
    degree VARCHAR(64) NOT NULL DEFAULT 'B.Tech',
    cgpa NUMERIC(4, 2) NOT NULL CHECK (cgpa >= 0.00 AND cgpa <= 10.00),
    tenth_percentage NUMERIC(5, 2) CHECK (tenth_percentage IS NULL OR (tenth_percentage >= 0.00 AND tenth_percentage <= 100.00)),
    twelfth_percentage NUMERIC(5, 2) CHECK (twelfth_percentage IS NULL OR (twelfth_percentage >= 0.00 AND twelfth_percentage <= 100.00)),
    active_backlogs INTEGER NOT NULL DEFAULT 0 CHECK (active_backlogs >= 0),
    total_backlogs INTEGER NOT NULL DEFAULT 0 CHECK (total_backlogs >= 0),
    academic_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (academic_status IN ('ACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED')),
    skills TEXT[] NOT NULL DEFAULT '{}',
    resume_url TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_students_tenant_enrollment UNIQUE (tenant_id, enrollment_number),
    CONSTRAINT uq_students_tenant_email UNIQUE (tenant_id, email),
    CONSTRAINT uq_students_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_students_department FOREIGN KEY (tenant_id, department_id) REFERENCES public.departments(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_students_tenant ON public.students(tenant_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_dept ON public.students(tenant_id, department_id);
CREATE INDEX IF NOT EXISTS idx_students_grad_year ON public.students(tenant_id, graduation_year);
CREATE INDEX IF NOT EXISTS idx_students_academic_status ON public.students(tenant_id, academic_status);
CREATE INDEX IF NOT EXISTS idx_students_archived ON public.students(tenant_id, is_archived);

-- 5. Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    website TEXT,
    industry VARCHAR(128),
    contact_person VARCHAR(128),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(32),
    internal_notes TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_companies_tenant_name UNIQUE (tenant_id, normalized_name),
    CONSTRAINT uq_companies_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON public.companies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_companies_archived ON public.companies(tenant_id, is_archived);

-- 6. Recruitment Drives Table
CREATE TABLE IF NOT EXISTS public.recruitment_drives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    academic_year_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    role_title VARCHAR(255) NOT NULL,
    recruitment_type VARCHAR(32) NOT NULL DEFAULT 'FULL_TIME' CHECK (recruitment_type IN ('FULL_TIME', 'INTERNSHIP', 'INTERN_TO_FTE')),
    job_description TEXT,
    location VARCHAR(128),
    compensation_range VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED')),
    registration_start TIMESTAMPTZ,
    registration_deadline TIMESTAMPTZ,
    cancellation_reason TEXT,
    internal_notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_registration_dates CHECK (
        registration_deadline IS NULL OR registration_start IS NULL OR registration_start <= registration_deadline
    ),
    CONSTRAINT uq_drives_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_drives_company FOREIGN KEY (tenant_id, company_id) REFERENCES public.companies(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_drives_academic_year FOREIGN KEY (tenant_id, academic_year_id) REFERENCES public.academic_years(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_drives_tenant ON public.recruitment_drives(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drives_company ON public.recruitment_drives(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_drives_academic_year ON public.recruitment_drives(tenant_id, academic_year_id);
CREATE INDEX IF NOT EXISTS idx_drives_status ON public.recruitment_drives(tenant_id, status);

-- 7. Drive Eligibility Criteria Table
CREATE TABLE IF NOT EXISTS public.drive_eligibility_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL,
    min_cgpa NUMERIC(4, 2) NOT NULL DEFAULT 0.00 CHECK (min_cgpa >= 0.00 AND min_cgpa <= 10.00),
    min_tenth_percentage NUMERIC(5, 2) CHECK (min_tenth_percentage IS NULL OR (min_tenth_percentage >= 0.00 AND min_tenth_percentage <= 100.00)),
    min_twelfth_percentage NUMERIC(5, 2) CHECK (min_twelfth_percentage IS NULL OR (min_twelfth_percentage >= 0.00 AND min_twelfth_percentage <= 100.00)),
    max_active_backlogs INTEGER NOT NULL DEFAULT 0 CHECK (max_active_backlogs >= 0),
    max_total_backlogs INTEGER CHECK (max_total_backlogs IS NULL OR max_total_backlogs >= 0),
    allowed_departments UUID[] NOT NULL DEFAULT '{}',
    allowed_graduation_years INTEGER[] NOT NULL DEFAULT '{}',
    allowed_degrees TEXT[] NOT NULL DEFAULT '{}',
    allowed_academic_statuses TEXT[] NOT NULL DEFAULT '{"ACTIVE"}',
    criteria_version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_drive_criteria UNIQUE (drive_id),
    CONSTRAINT uq_drive_criteria_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_criteria_drive FOREIGN KEY (tenant_id, drive_id) REFERENCES public.recruitment_drives(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_criteria_drive ON public.drive_eligibility_criteria(drive_id);
CREATE INDEX IF NOT EXISTS idx_criteria_tenant ON public.drive_eligibility_criteria(tenant_id);

-- 8. Drive Stages Table
CREATE TABLE IF NOT EXISTS public.drive_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL,
    name VARCHAR(128) NOT NULL,
    stage_type VARCHAR(32) NOT NULL CHECK (stage_type IN ('REGISTRATION', 'ONLINE_TEST', 'CODING_TEST', 'GROUP_DISCUSSION', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_SELECTION')),
    stage_order INTEGER NOT NULL CHECK (stage_order >= 1),
    description TEXT,
    scheduled_at TIMESTAMPTZ,
    is_student_visible BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_drive_stage_order UNIQUE (drive_id, stage_order),
    CONSTRAINT uq_drive_stages_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_stages_drive FOREIGN KEY (tenant_id, drive_id) REFERENCES public.recruitment_drives(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_stages_drive ON public.drive_stages(drive_id);
CREATE INDEX IF NOT EXISTS idx_stages_tenant ON public.drive_stages(tenant_id);

-- 9. Drive Applications (Candidate Registration & Participation) Table
CREATE TABLE IF NOT EXISTS public.drive_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL,
    student_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'WITHDRAWN', 'IN_PROCESS', 'REJECTED', 'OFFER_EXTENDED', 'OFFER_ACCEPTED', 'OFFER_DECLINED')),
    eligibility_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    current_stage_id UUID,
    registration_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    withdrawn_at TIMESTAMPTZ,
    withdrawn_reason TEXT,
    registered_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_drive_student_application UNIQUE (drive_id, student_id),
    CONSTRAINT uq_applications_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_applications_drive FOREIGN KEY (tenant_id, drive_id) REFERENCES public.recruitment_drives(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_applications_student FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_applications_stage FOREIGN KEY (tenant_id, current_stage_id) REFERENCES public.drive_stages(tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_applications_drive ON public.drive_applications(drive_id);
CREATE INDEX IF NOT EXISTS idx_applications_student ON public.drive_applications(student_id);
CREATE INDEX IF NOT EXISTS idx_applications_tenant ON public.drive_applications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.drive_applications(tenant_id, status);

-- 10. Candidate Stage Results Table
CREATE TABLE IF NOT EXISTS public.candidate_stage_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    application_id UUID NOT NULL,
    stage_id UUID NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SCHEDULED', 'PASSED', 'FAILED', 'SKIPPED', 'ON_HOLD')),
    score NUMERIC(6, 2),
    student_feedback TEXT,
    internal_notes TEXT,
    evaluated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    evaluated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_application_stage_result UNIQUE (application_id, stage_id),
    CONSTRAINT uq_stage_results_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_results_application FOREIGN KEY (tenant_id, application_id) REFERENCES public.drive_applications(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_results_stage FOREIGN KEY (tenant_id, stage_id) REFERENCES public.drive_stages(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_results_app ON public.candidate_stage_results(application_id);
CREATE INDEX IF NOT EXISTS idx_results_stage ON public.candidate_stage_results(stage_id);
CREATE INDEX IF NOT EXISTS idx_results_tenant ON public.candidate_stage_results(tenant_id);

-- 11. Placement Offers & Outcomes Table
CREATE TABLE IF NOT EXISTS public.placement_offers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL,
    drive_id UUID NOT NULL,
    application_id UUID NOT NULL,
    offer_type VARCHAR(32) NOT NULL DEFAULT 'FULL_TIME' CHECK (offer_type IN ('FULL_TIME', 'INTERNSHIP', 'INTERN_TO_FTE')),
    compensation_amount NUMERIC(12, 2),
    compensation_details TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'OFFERED' CHECK (status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'RESCINDED')),
    offered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decision_at TIMESTAMPTZ,
    joining_date DATE,
    is_verified BOOLEAN NOT NULL DEFAULT true,
    internal_notes TEXT,
    recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_offer_application UNIQUE (application_id),
    CONSTRAINT uq_offers_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_offers_student FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_offers_drive FOREIGN KEY (tenant_id, drive_id) REFERENCES public.recruitment_drives(tenant_id, id) ON DELETE RESTRICT,
    CONSTRAINT fk_offers_application FOREIGN KEY (tenant_id, application_id) REFERENCES public.drive_applications(tenant_id, id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_offers_student ON public.placement_offers(student_id);
CREATE INDEX IF NOT EXISTS idx_offers_drive ON public.placement_offers(drive_id);
CREATE INDEX IF NOT EXISTS idx_offers_tenant ON public.placement_offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offers_status ON public.placement_offers(tenant_id, status);

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- ==============================================================================

-- Enable and Force RLS on all Phase 04 tables
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years FORCE ROW LEVEL SECURITY;

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students FORCE ROW LEVEL SECURITY;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.recruitment_drives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_drives FORCE ROW LEVEL SECURITY;

ALTER TABLE public.drive_eligibility_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_eligibility_criteria FORCE ROW LEVEL SECURITY;

ALTER TABLE public.drive_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_stages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.drive_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_applications FORCE ROW LEVEL SECURITY;

ALTER TABLE public.candidate_stage_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_stage_results FORCE ROW LEVEL SECURITY;

ALTER TABLE public.placement_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_offers FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Academic Years Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "academic_years_select_policy" ON public.academic_years
    FOR SELECT TO authenticated
    USING (public.is_active_tenant_member(tenant_id) OR public.is_platform_admin());

CREATE POLICY "academic_years_insert_policy" ON public.academic_years
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "academic_years_update_policy" ON public.academic_years
    FOR UPDATE TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "academic_years_delete_policy" ON public.academic_years
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Departments Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "departments_select_policy" ON public.departments
    FOR SELECT TO authenticated
    USING (public.is_active_tenant_member(tenant_id) OR public.is_platform_admin());

CREATE POLICY "departments_insert_policy" ON public.departments
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "departments_update_policy" ON public.departments
    FOR UPDATE TO authenticated
    USING (public.is_tenant_admin(tenant_id))
    WITH CHECK (public.is_tenant_admin(tenant_id));

CREATE POLICY "departments_delete_policy" ON public.departments
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Students Policies
-- ------------------------------------------------------------------------------
-- Staff can see all students; a student can only see their own profile
CREATE POLICY "students_select_policy" ON public.students
    FOR SELECT TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND user_id = auth.uid()) OR
        public.is_platform_admin()
    );

CREATE POLICY "students_insert_policy" ON public.students
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "students_update_policy" ON public.students
    FOR UPDATE TO authenticated
    USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "students_delete_policy" ON public.students
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Companies Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "companies_select_policy" ON public.companies
    FOR SELECT TO authenticated
    USING (public.is_active_tenant_member(tenant_id) OR public.is_platform_admin());

CREATE POLICY "companies_insert_policy" ON public.companies
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "companies_update_policy" ON public.companies
    FOR UPDATE TO authenticated
    USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "companies_delete_policy" ON public.companies
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Recruitment Drives Policies
-- ------------------------------------------------------------------------------
-- Staff can see all drives (including drafts); Students can only see published/active drives
CREATE POLICY "drives_select_policy" ON public.recruitment_drives
    FOR SELECT TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND status IN ('PUBLISHED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED')) OR
        public.is_platform_admin()
    );

CREATE POLICY "drives_insert_policy" ON public.recruitment_drives
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "drives_update_policy" ON public.recruitment_drives
    FOR UPDATE TO authenticated
    USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "drives_delete_policy" ON public.recruitment_drives
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Drive Eligibility Criteria Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "criteria_select_policy" ON public.drive_eligibility_criteria
    FOR SELECT TO authenticated
    USING (public.is_active_tenant_member(tenant_id) OR public.is_platform_admin());

CREATE POLICY "criteria_insert_policy" ON public.drive_eligibility_criteria
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "criteria_update_policy" ON public.drive_eligibility_criteria
    FOR UPDATE TO authenticated
    USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "criteria_delete_policy" ON public.drive_eligibility_criteria
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Drive Stages Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "stages_select_policy" ON public.drive_stages
    FOR SELECT TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND is_student_visible = true) OR
        public.is_platform_admin()
    );

CREATE POLICY "stages_insert_policy" ON public.drive_stages
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "stages_update_policy" ON public.drive_stages
    FOR UPDATE TO authenticated
    USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "stages_delete_policy" ON public.drive_stages
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Drive Applications Policies
-- ------------------------------------------------------------------------------
-- Staff can view all; Student can view and register only their own application
CREATE POLICY "applications_select_policy" ON public.drive_applications
    FOR SELECT TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "applications_insert_policy" ON public.drive_applications
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "applications_update_policy" ON public.drive_applications
    FOR UPDATE TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        ))
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "applications_delete_policy" ON public.drive_applications
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Candidate Stage Results Policies
-- ------------------------------------------------------------------------------
-- Staff can see all results (including internal notes).
-- Students can only see results for their own application if the stage is visible.
CREATE POLICY "stage_results_select_policy" ON public.candidate_stage_results
    FOR SELECT TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND application_id IN (
            SELECT da.id 
            FROM public.drive_applications da
            JOIN public.students s ON s.id = da.student_id
            JOIN public.drive_stages st ON st.id = candidate_stage_results.stage_id
            WHERE s.user_id = auth.uid() AND st.is_student_visible = true
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "stage_results_insert_policy" ON public.candidate_stage_results
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "stage_results_update_policy" ON public.candidate_stage_results
    FOR UPDATE TO authenticated
    USING (public.is_tenant_staff(tenant_id))
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "stage_results_delete_policy" ON public.candidate_stage_results
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));

-- ------------------------------------------------------------------------------
-- Placement Offers & Outcomes Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "offers_select_policy" ON public.placement_offers
    FOR SELECT TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "offers_insert_policy" ON public.placement_offers
    FOR INSERT TO authenticated
    WITH CHECK (public.is_tenant_staff(tenant_id));

CREATE POLICY "offers_update_policy" ON public.placement_offers
    FOR UPDATE TO authenticated
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        ))
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        ))
    );

CREATE POLICY "offers_delete_policy" ON public.placement_offers
    FOR DELETE TO authenticated
    USING (public.is_tenant_admin(tenant_id));
