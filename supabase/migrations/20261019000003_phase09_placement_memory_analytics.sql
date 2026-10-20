-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 09 Migration: Placement Memory, Analytics & Improvement Schema & RLS
-- ==============================================================================

-- 1. Historical Recruitment Records Table (Institutional Memory of Drives & Requirements)
CREATE TABLE IF NOT EXISTS public.historical_recruitment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    role_title VARCHAR(255) NOT NULL,
    recruitment_year VARCHAR(32) NOT NULL,
    recruitment_cycle VARCHAR(64) NOT NULL,
    historical_drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE SET NULL,
    source_id UUID REFERENCES public.recruitment_sources(id) ON DELETE SET NULL,
    record_type VARCHAR(64) NOT NULL DEFAULT 'COLLEGE_CONFIRMED' CHECK (record_type IN (
        'OFFICIAL_NOTICE',
        'COLLEGE_CONFIRMED',
        'VERIFIED_REPORT',
        'CANDIDATE_REPORTED',
        'QUESTION_SET_REFERENCE',
        'SUPERSEDED'
    )),
    reliability_label VARCHAR(64) NOT NULL DEFAULT 'COLLEGE_CONFIRMED' CHECK (reliability_label IN (
        'OFFICIAL_CONFIRMED',
        'VERIFIED_HISTORICAL',
        'CANDIDATE_REPORTED',
        'INFERRED_GUIDANCE',
        'DISPUTED',
        'SUPERSEDED'
    )),
    process_summary TEXT,
    eligibility_criteria_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    confirmed_rounds JSONB NOT NULL DEFAULT '[]'::jsonb,
    reported_rounds JSONB NOT NULL DEFAULT '[]'::jsonb,
    relevant_question_set_id UUID REFERENCES public.question_sets(id) ON DELETE SET NULL,
    verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED' CHECK (verification_status IN (
        'DRAFT',
        'PENDING_REVIEW',
        'VERIFIED',
        'REJECTED',
        'SUPERSEDED',
        'ARCHIVED'
    )),
    source_date TIMESTAMPTZ,
    last_verified_at TIMESTAMPTZ DEFAULT now(),
    is_superseded BOOLEAN NOT NULL DEFAULT false,
    superseded_by UUID REFERENCES public.historical_recruitment_records(id) ON DELETE SET NULL,
    sharing_scope VARCHAR(32) NOT NULL DEFAULT 'COLLEGE_PRIVATE' CHECK (sharing_scope IN (
        'COLLEGE_PRIVATE',
        'GLOBAL_SHARED'
    )),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_historical_records_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_hist_records_tenant ON public.historical_recruitment_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hist_records_company ON public.historical_recruitment_records(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_hist_records_year ON public.historical_recruitment_records(tenant_id, recruitment_year);
CREATE INDEX IF NOT EXISTS idx_hist_records_scope ON public.historical_recruitment_records(sharing_scope);

-- 2. Historical Drive Comparisons Table (Current vs Historical Drive Evaluation)
CREATE TABLE IF NOT EXISTS public.historical_drive_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    current_drive_id UUID NOT NULL REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    historical_record_id UUID NOT NULL REFERENCES public.historical_recruitment_records(id) ON DELETE CASCADE,
    matching_basis VARCHAR(64) NOT NULL CHECK (matching_basis IN (
        'SAME_COMPANY_AND_ROLE',
        'SAME_COMPANY_DIFFERENT_ROLE',
        'ROLE_FAMILY_MATCH',
        'MANUAL_COMPARISON'
    )),
    shared_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
    differing_attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
    unknown_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    conflicts JSONB NOT NULL DEFAULT '[]'::jsonb,
    comparability_status VARCHAR(32) NOT NULL DEFAULT 'PARTIALLY_COMPARABLE' CHECK (comparability_status IN (
        'HIGHLY_COMPARABLE',
        'PARTIALLY_COMPARABLE',
        'LIMITED_EVIDENCE',
        'INCOMPATIBLE'
    )),
    limitations_disclaimer TEXT NOT NULL,
    generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_drive_comparisons_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_drive_comp_tenant ON public.historical_drive_comparisons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_drive_comp_current ON public.historical_drive_comparisons(tenant_id, current_drive_id);
CREATE INDEX IF NOT EXISTS idx_drive_comp_historical ON public.historical_drive_comparisons(tenant_id, historical_record_id);

-- 3. Experience Report Moderation Logs Table (Audit trail for candidate reports)
CREATE TABLE IF NOT EXISTS public.experience_report_moderation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    report_id UUID NOT NULL REFERENCES public.recruitment_experience_reports(id) ON DELETE CASCADE,
    previous_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    moderated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    moderation_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_report_mod_logs_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_report_mod_tenant ON public.experience_report_moderation_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_report_mod_report ON public.experience_report_moderation_logs(report_id);

-- 4. Training Sessions Table (Workshops, Diagnostics, Prep Sessions)
CREATE TABLE IF NOT EXISTS public.training_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    skill_id UUID REFERENCES public.canonical_skills(id) ON DELETE SET NULL,
    topic VARCHAR(255) NOT NULL,
    trainer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_date TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    baseline_assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
    follow_up_assessment_id UUID REFERENCES public.assessments(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_training_sessions_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_training_sessions_tenant ON public.training_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_skill ON public.training_sessions(tenant_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_date ON public.training_sessions(tenant_id, session_date);

-- 5. Training Attendance Table (Enrollment vs Actual Attendance)
CREATE TABLE IF NOT EXISTS public.training_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    enrollment_status VARCHAR(32) NOT NULL DEFAULT 'ENROLLED' CHECK (enrollment_status IN (
        'ENROLLED',
        'WAITLISTED',
        'DROPPED'
    )),
    attendance_status VARCHAR(32) NOT NULL DEFAULT 'ABSENT' CHECK (attendance_status IN (
        'ATTENDED',
        'ABSENT',
        'EXCUSED'
    )),
    pre_score NUMERIC(5,2),
    post_score NUMERIC(5,2),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_training_attendance UNIQUE (tenant_id, session_id, student_id),
    CONSTRAINT uq_training_attendance_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_training_att_tenant ON public.training_attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_training_att_session ON public.training_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_training_att_student ON public.training_attendance(tenant_id, student_id);

-- 6. Training Before/After Comparisons Table (Measured deltas with causation disclaimers)
CREATE TABLE IF NOT EXISTS public.training_before_after_comparisons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.canonical_skills(id) ON DELETE SET NULL,
    baseline_assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    follow_up_assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    eligible_students_count INTEGER NOT NULL DEFAULT 0,
    paired_students_count INTEGER NOT NULL DEFAULT 0,
    baseline_avg_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    followup_avg_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    absolute_delta NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    relative_percentage_delta NUMERIC(6,2),
    limitations_disclaimer TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_before_after_comp_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_before_after_tenant ON public.training_before_after_comparisons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_before_after_session ON public.training_before_after_comparisons(session_id);

-- 7. Analytics Export Jobs Table (CSV exports with formula escaping)
CREATE TABLE IF NOT EXISTS public.analytics_export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    report_type VARCHAR(64) NOT NULL CHECK (report_type IN (
        'HISTORICAL_DRIVES',
        'CANDIDATE_REPORTS',
        'DRIVE_COMPARISONS',
        'STUDENT_PERFORMANCE',
        'COHORT_SKILL_GAPS',
        'TRAINING_BEFORE_AFTER',
        'PLACEMENT_OUTCOMES'
    )),
    filter_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'COMPLETED',
        'FAILED'
    )),
    record_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    CONSTRAINT uq_analytics_export_jobs_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_tenant ON public.analytics_export_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON public.analytics_export_jobs(tenant_id, status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.historical_recruitment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_recruitment_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.historical_drive_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historical_drive_comparisons FORCE ROW LEVEL SECURITY;

ALTER TABLE public.experience_report_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_report_moderation_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attendance FORCE ROW LEVEL SECURITY;

ALTER TABLE public.training_before_after_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_before_after_comparisons FORCE ROW LEVEL SECURITY;

ALTER TABLE public.analytics_export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_export_jobs FORCE ROW LEVEL SECURITY;

-- 1. Policies for historical_recruitment_records
CREATE POLICY "Super admins have full access to historical records"
    ON public.historical_recruitment_records
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_platform_admin = true));

CREATE POLICY "Tenant members can view college private or global shared historical records"
    ON public.historical_recruitment_records
    FOR SELECT
    TO authenticated
    USING (
        sharing_scope = 'GLOBAL_SHARED'
        OR
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = historical_recruitment_records.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
        )
    );

CREATE POLICY "Placement staff can manage tenant historical records"
    ON public.historical_recruitment_records
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = historical_recruitment_records.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = historical_recruitment_records.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- 2. Policies for historical_drive_comparisons
CREATE POLICY "Super admins have full access to drive comparisons"
    ON public.historical_drive_comparisons
    FOR ALL
    TO authenticated
    USING (EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.is_platform_admin = true));

CREATE POLICY "Tenant members can view tenant drive comparisons"
    ON public.historical_drive_comparisons
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = historical_drive_comparisons.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
        )
    );

CREATE POLICY "Placement staff can manage drive comparisons"
    ON public.historical_drive_comparisons
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = historical_drive_comparisons.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = historical_drive_comparisons.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- 3. Policies for experience_report_moderation_logs
CREATE POLICY "Placement staff can view and create moderation logs"
    ON public.experience_report_moderation_logs
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = experience_report_moderation_logs.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = experience_report_moderation_logs.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- 4. Policies for training_sessions
CREATE POLICY "Tenant members can view training sessions"
    ON public.training_sessions
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_sessions.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
        )
    );

CREATE POLICY "Staff and trainers can manage training sessions"
    ON public.training_sessions
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_sessions.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_sessions.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- 5. Policies for training_attendance
CREATE POLICY "Students can view their own training attendance"
    ON public.training_attendance
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students
            WHERE students.id = training_attendance.student_id
              AND students.tenant_id = training_attendance.tenant_id
              AND students.user_id = auth.uid()
        )
    );

CREATE POLICY "Staff and trainers can manage training attendance"
    ON public.training_attendance
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_attendance.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_attendance.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- 6. Policies for training_before_after_comparisons
CREATE POLICY "Tenant members can view before-after comparisons"
    ON public.training_before_after_comparisons
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_before_after_comparisons.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
        )
    );

CREATE POLICY "Staff and trainers can manage before-after comparisons"
    ON public.training_before_after_comparisons
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_before_after_comparisons.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = training_before_after_comparisons.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
              AND tenant_memberships.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- 7. Policies for analytics_export_jobs
CREATE POLICY "Users can view and manage their own export jobs"
    ON public.analytics_export_jobs
    FOR ALL
    TO authenticated
    USING (
        requested_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = analytics_export_jobs.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
        )
    )
    WITH CHECK (
        requested_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.tenant_memberships
            WHERE tenant_memberships.tenant_id = analytics_export_jobs.tenant_id
              AND tenant_memberships.user_id = auth.uid()
              AND tenant_memberships.status = 'ACTIVE'
        )
    );
