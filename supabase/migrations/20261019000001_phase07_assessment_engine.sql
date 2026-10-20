-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 07 Migration: Assessment Engine & Student Preparation Schema & RLS
-- ==============================================================================

-- 1. Assessments Table (Authoring, rules, time limits, scoring & release policies)
CREATE TABLE IF NOT EXISTS public.assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    description TEXT,
    purpose VARCHAR(64) NOT NULL DEFAULT 'ASSESSMENT' CHECK (purpose IN (
        'ASSESSMENT',
        'PRACTICE',
        'DIAGNOSTIC',
        'COMPANY_PREP',
        'INTERVIEW'
    )),
    question_set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE RESTRICT,
    set_version_id INTEGER NOT NULL DEFAULT 1,
    drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE SET NULL,
    time_limit_minutes INTEGER,
    allowed_attempts INTEGER NOT NULL DEFAULT 1,
    review_policy VARCHAR(32) NOT NULL DEFAULT 'IMMEDIATE' CHECK (review_policy IN (
        'IMMEDIATE',
        'AFTER_DEADLINE',
        'NEVER'
    )),
    release_policy VARCHAR(32) NOT NULL DEFAULT 'IMMEDIATE' CHECK (release_policy IN (
        'IMMEDIATE',
        'AFTER_DEADLINE',
        'MANUAL_STAFF_RELEASE'
    )),
    shuffle_questions BOOLEAN NOT NULL DEFAULT false,
    pass_percentage NUMERIC(5, 2) NOT NULL DEFAULT 60.00,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'PUBLISHED',
        'ARCHIVED'
    )),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assessments_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_assessments_tenant ON public.assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessments_status ON public.assessments(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_assessments_purpose ON public.assessments(tenant_id, purpose);
CREATE INDEX IF NOT EXISTS idx_assessments_set ON public.assessments(question_set_id);
CREATE INDEX IF NOT EXISTS idx_assessments_drive ON public.assessments(drive_id);

-- 2. Assessment Assignments Table (Cohort or individual student assignment windows)
CREATE TABLE IF NOT EXISTS public.assessment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    cohort_name VARCHAR(128),
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    max_attempts_override INTEGER,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE',
        'COMPLETED',
        'REVOKED'
    )),
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assessment_assignments_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_assessment_assignments_tenant ON public.assessment_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_assessment ON public.assessment_assignments(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_student ON public.assessment_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_assignments_status ON public.assessment_assignments(tenant_id, status);

-- 3. Assessment Attempts Table (Authoritative attempt state machine & timer tracking)
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.assessment_assignments(id) ON DELETE SET NULL,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN (
        'NOT_STARTED',
        'IN_PROGRESS',
        'SUBMITTED',
        'EXPIRED',
        'SCORING',
        'SCORED',
        'RESULT_RELEASED'
    )),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    total_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    earned_points NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    score_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    is_passed BOOLEAN NOT NULL DEFAULT false,
    scoring_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (scoring_status IN (
        'PENDING',
        'PROVISIONAL',
        'FINAL'
    )),
    client_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assessment_attempts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_attempt_student_number UNIQUE (assessment_id, student_id, attempt_number)
);

CREATE INDEX IF NOT EXISTS idx_assessment_attempts_tenant ON public.assessment_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_student ON public.assessment_attempts(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_assessment ON public.assessment_attempts(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_attempts_status ON public.assessment_attempts(tenant_id, status);

-- 4. Attempt Responses Table (Granular autosaved answers with sequence concurrency control)
CREATE TABLE IF NOT EXISTS public.attempt_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE RESTRICT,
    response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    save_sequence INTEGER NOT NULL DEFAULT 1,
    is_flagged BOOLEAN NOT NULL DEFAULT false,
    is_answered BOOLEAN NOT NULL DEFAULT false,
    points_awarded NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    is_correct BOOLEAN,
    scoring_status VARCHAR(32) NOT NULL DEFAULT 'UNSCORED' CHECK (scoring_status IN (
        'UNSCORED',
        'AUTOMATICALLY_SCORED',
        'MANUAL_REVIEW_REQUIRED',
        'REVIEWED'
    )),
    manual_notes TEXT,
    last_saved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_attempt_responses_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_attempt_responses_tenant ON public.attempt_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attempt_responses_attempt ON public.attempt_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_attempt_responses_question ON public.attempt_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_responses_scoring ON public.attempt_responses(attempt_id, scoring_status);

-- 5. Preparation Practice Sessions Table (Untimed, lightweight learning clicks)
CREATE TABLE IF NOT EXISTS public.preparation_practice_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES public.canonical_skills(id) ON DELETE SET NULL,
    topic VARCHAR(128),
    questions_practiced INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_prep_practice_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_prep_practice_tenant ON public.preparation_practice_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prep_practice_student ON public.preparation_practice_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_prep_practice_skill ON public.preparation_practice_sessions(skill_id);

-- 6. Student Behavioral Responses Table (HR interview & GD reflection drafts)
CREATE TABLE IF NOT EXISTS public.student_behavioral_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    prompt TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'HR_INTERVIEW' CHECK (category IN (
        'HR_INTERVIEW',
        'GROUP_DISCUSSION',
        'SITUATIONAL'
    )),
    response_text TEXT NOT NULL,
    self_reflection TEXT,
    key_learnings TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_behavioral_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_student_behavioral_tenant ON public.student_behavioral_responses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_behavioral_student ON public.student_behavioral_responses(student_id);
CREATE INDEX IF NOT EXISTS idx_student_behavioral_category ON public.student_behavioral_responses(tenant_id, category);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable and force RLS on all 6 tables
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.assessment_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_assignments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_attempts FORCE ROW LEVEL SECURITY;

ALTER TABLE public.attempt_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attempt_responses FORCE ROW LEVEL SECURITY;

ALTER TABLE public.preparation_practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparation_practice_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.student_behavioral_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_behavioral_responses FORCE ROW LEVEL SECURITY;

-- 1. Assessments Policies
CREATE POLICY "p07_assessments_select"
    ON public.assessments FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND status = 'PUBLISHED') OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_assessments_insert"
    ON public.assessments FOR INSERT
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_assessments_update"
    ON public.assessments FOR UPDATE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_assessments_delete"
    ON public.assessments FOR DELETE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

-- 2. Assessment Assignments Policies
CREATE POLICY "p07_assignments_select"
    ON public.assessment_assignments FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND (
            student_id IS NULL OR
            student_id IN (SELECT id FROM public.students WHERE user_id = auth.uid())
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_assignments_insert"
    ON public.assessment_assignments FOR INSERT
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_assignments_update"
    ON public.assessment_assignments FOR UPDATE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_assignments_delete"
    ON public.assessment_assignments FOR DELETE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

-- 3. Assessment Attempts Policies
CREATE POLICY "p07_attempts_select"
    ON public.assessment_attempts FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_attempts_insert"
    ON public.assessment_attempts FOR INSERT
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_attempts_update"
    ON public.assessment_attempts FOR UPDATE
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_attempts_delete"
    ON public.assessment_attempts FOR DELETE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

-- 4. Attempt Responses Policies
CREATE POLICY "p07_responses_select"
    ON public.attempt_responses FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
            SELECT id FROM public.assessment_attempts WHERE student_id IN (
                SELECT id FROM public.students WHERE user_id = auth.uid()
            )
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_responses_insert"
    ON public.attempt_responses FOR INSERT
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
            SELECT id FROM public.assessment_attempts WHERE student_id IN (
                SELECT id FROM public.students WHERE user_id = auth.uid()
            )
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_responses_update"
    ON public.attempt_responses FOR UPDATE
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
            SELECT id FROM public.assessment_attempts WHERE student_id IN (
                SELECT id FROM public.students WHERE user_id = auth.uid()
            )
        )) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
            SELECT id FROM public.assessment_attempts WHERE student_id IN (
                SELECT id FROM public.students WHERE user_id = auth.uid()
            )
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_responses_delete"
    ON public.attempt_responses FOR DELETE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

-- 5. Preparation Practice Sessions Policies
CREATE POLICY "p07_practice_select"
    ON public.preparation_practice_sessions FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_practice_write"
    ON public.preparation_practice_sessions FOR ALL
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

-- 6. Student Behavioral Responses Policies
CREATE POLICY "p07_behavioral_select"
    ON public.student_behavioral_responses FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p07_behavioral_write"
    ON public.student_behavioral_responses FOR ALL
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );
