-- ==============================================================================
-- UrPlaced Migration: Phase 03 — Global Placement Preparation System
-- 
-- 1. placement_practice_questions: Categorized practice questions (Aptitude, Reasoning, Verbal, Technical)
-- 2. placement_practice_attempts: Server-authoritative student practice test attempts & scores
-- 3. placement_practice_responses: Individual question responses, correctness, and review flags
-- 4. company_profiles: Structured employer preparation profiles (TCS, Infosys, Wipro, Amazon, Google, etc.)
-- 5. company_roles: Target job roles and required skill criteria per company
-- 6. company_prep_tracks: Structured round-by-round preparation modules & tracks
-- 7. student_company_prep_progress: Student progress tracking and saved company tracks
-- 8. student_learning_recommendations: Evidence-backed personalized learning recommendations
-- 9. Composite foreign keys linking child records to (tenant_id, student_id) in public.students
-- 10. Extend ai_usage_logs constraint for PRACTICE_CENTRE and COMPANY_PREPARATION
-- ==============================================================================

-- 1. Placement Practice Questions Table
CREATE TABLE IF NOT EXISTS public.placement_practice_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'QUANTITATIVE_APTITUDE', 'LOGICAL_REASONING', 'VERBAL_ABILITY', 'TECHNICAL_PREPARATION'
    )),
    topic VARCHAR(128) NOT NULL,
    difficulty VARCHAR(32) NOT NULL DEFAULT 'INTERMEDIATE' CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    question_type VARCHAR(32) NOT NULL DEFAULT 'MCQ_SINGLE' CHECK (question_type IN (
        'MCQ_SINGLE', 'MCQ_MULTIPLE', 'SHORT_TEXT', 'PROBLEM_SOLVING'
    )),
    question_text TEXT NOT NULL,
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    correct_answer JSONB NOT NULL,
    explanation TEXT NOT NULL,
    solving_approach TEXT,
    recommended_time_seconds INTEGER NOT NULL DEFAULT 60,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_published BOOLEAN NOT NULL DEFAULT true,
    is_global BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_practice_questions_cat_topic ON public.placement_practice_questions(category, topic);
CREATE INDEX IF NOT EXISTS idx_practice_questions_difficulty ON public.placement_practice_questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_practice_questions_tenant ON public.placement_practice_questions(tenant_id);

ALTER TABLE public.placement_practice_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_practice_questions FORCE ROW LEVEL SECURITY;

-- Questions RLS
CREATE POLICY "Anyone authenticated can view published practice questions"
    ON public.placement_practice_questions
    FOR SELECT
    USING (
        is_published = true AND (
            is_global = true OR
            tenant_id IS NULL OR
            EXISTS (
                SELECT 1 FROM public.tenant_memberships tm
                WHERE tm.tenant_id = placement_practice_questions.tenant_id
                  AND tm.user_id = auth.uid()
                  AND tm.status = 'ACTIVE'
            )
        )
    );

CREATE POLICY "Tenant staff can manage tenant practice questions"
    ON public.placement_practice_questions
    FOR ALL
    USING (
        tenant_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = placement_practice_questions.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    )
    WITH CHECK (
        tenant_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = placement_practice_questions.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 2. Placement Practice Attempts Table
CREATE TABLE IF NOT EXISTS public.placement_practice_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    practice_mode VARCHAR(32) NOT NULL CHECK (practice_mode IN (
        'TOPIC_PRACTICE', 'TIMED_PRACTICE', 'FULL_MOCK', 'REVISION_PRACTICE'
    )),
    category VARCHAR(64),
    topic VARCHAR(128),
    difficulty VARCHAR(32),
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0,
    incorrect_count INTEGER NOT NULL DEFAULT 0,
    unanswered_count INTEGER NOT NULL DEFAULT 0,
    score_percentage INTEGER NOT NULL DEFAULT 0 CHECK (score_percentage BETWEEN 0 AND 100),
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    time_limit_seconds INTEGER,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN (
        'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'TIMED_OUT'
    )),
    results_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_practice_attempts_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_practice_attempts_student_composite FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_student ON public.placement_practice_attempts(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_attempts_tenant_student ON public.placement_practice_attempts(tenant_id, student_id, practice_mode);

ALTER TABLE public.placement_practice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_practice_attempts FORCE ROW LEVEL SECURITY;

-- Attempts RLS: Students SELECT and DELETE own; Server manages writes
CREATE POLICY "Students view own practice attempts"
    ON public.placement_practice_attempts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = placement_practice_attempts.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = placement_practice_attempts.tenant_id
        )
    );

CREATE POLICY "Students delete own practice attempts"
    ON public.placement_practice_attempts
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = placement_practice_attempts.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = placement_practice_attempts.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student practice attempts"
    ON public.placement_practice_attempts
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = placement_practice_attempts.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 3. Placement Practice Responses Table
CREATE TABLE IF NOT EXISTS public.placement_practice_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.placement_practice_attempts(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.placement_practice_questions(id) ON DELETE CASCADE,
    student_answer JSONB,
    is_correct BOOLEAN NOT NULL DEFAULT false,
    is_marked_for_review BOOLEAN NOT NULL DEFAULT false,
    time_spent_seconds INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_practice_response_attempt_q UNIQUE (attempt_id, question_id),
    CONSTRAINT uq_practice_responses_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_practice_responses_student_composite FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_practice_responses_attempt ON public.placement_practice_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_practice_responses_student ON public.placement_practice_responses(student_id);

ALTER TABLE public.placement_practice_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.placement_practice_responses FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students view own practice responses"
    ON public.placement_practice_responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = placement_practice_responses.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = placement_practice_responses.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student practice responses"
    ON public.placement_practice_responses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = placement_practice_responses.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 4. Company Profiles Table
CREATE TABLE IF NOT EXISTS public.company_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    industry VARCHAR(128) NOT NULL,
    website_url TEXT,
    logo_url TEXT,
    hiring_workflow JSONB NOT NULL DEFAULT '[]'::jsonb,
    overview_notes TEXT,
    is_global BOOLEAN NOT NULL DEFAULT true,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_industry ON public.company_profiles(industry);
CREATE INDEX IF NOT EXISTS idx_company_profiles_slug ON public.company_profiles(slug);

ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view active company profiles"
    ON public.company_profiles
    FOR SELECT
    USING (
        is_active = true AND (
            is_global = true OR
            tenant_id IS NULL OR
            EXISTS (
                SELECT 1 FROM public.tenant_memberships tm
                WHERE tm.tenant_id = company_profiles.tenant_id
                  AND tm.user_id = auth.uid()
                  AND tm.status = 'ACTIVE'
            )
        )
    );

CREATE POLICY "Tenant staff can manage tenant company profiles"
    ON public.company_profiles
    FOR ALL
    USING (
        tenant_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = company_profiles.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    )
    WITH CHECK (
        tenant_id IS NOT NULL AND
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = company_profiles.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 5. Company Roles Table
CREATE TABLE IF NOT EXISTS public.company_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
    role_name VARCHAR(255) NOT NULL,
    role_slug VARCHAR(255) NOT NULL,
    description TEXT,
    required_skills TEXT[] NOT NULL DEFAULT '{}',
    preferred_skills TEXT[] NOT NULL DEFAULT '{}',
    eligibility_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_company_role UNIQUE (company_id, role_slug)
);

CREATE INDEX IF NOT EXISTS idx_company_roles_company ON public.company_roles(company_id);

ALTER TABLE public.company_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view company roles"
    ON public.company_roles
    FOR SELECT
    USING (true);


-- 6. Company Preparation Tracks Table
CREATE TABLE IF NOT EXISTS public.company_prep_tracks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
    role_id UUID REFERENCES public.company_roles(id) ON DELETE CASCADE,
    track_name VARCHAR(255) NOT NULL,
    description TEXT,
    modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_company_prep_tracks_company ON public.company_prep_tracks(company_id);

ALTER TABLE public.company_prep_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_prep_tracks FORCE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view company prep tracks"
    ON public.company_prep_tracks
    FOR SELECT
    USING (is_active = true);


-- 7. Student Company Preparation Progress Table
CREATE TABLE IF NOT EXISTS public.student_company_prep_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,
    track_id UUID REFERENCES public.company_prep_tracks(id) ON DELETE SET NULL,
    completed_module_ids TEXT[] NOT NULL DEFAULT '{}',
    overall_progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (overall_progress_percentage BETWEEN 0 AND 100),
    is_saved_for_later BOOLEAN NOT NULL DEFAULT false,
    last_practiced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_student_company_prep UNIQUE (student_id, company_id),
    CONSTRAINT uq_company_prep_progress_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_student_company_progress_student_composite FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_company_progress_student ON public.student_company_prep_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_company_progress_tenant_student ON public.student_company_prep_progress(tenant_id, student_id);

ALTER TABLE public.student_company_prep_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_company_prep_progress FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own company prep progress"
    ON public.student_company_prep_progress
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_company_prep_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_company_prep_progress.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_company_prep_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_company_prep_progress.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student company prep progress"
    ON public.student_company_prep_progress
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_company_prep_progress.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 8. Student Learning Recommendations Table
CREATE TABLE IF NOT EXISTS public.student_learning_recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'SKILL_IMPROVEMENT', 'PRACTICE_IMPROVEMENT', 'CAREER_PREPARATION', 'INTERVIEW_IMPROVEMENT'
    )),
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    supporting_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    reason_recommended TEXT NOT NULL,
    suggested_action TEXT NOT NULL,
    destination_route TEXT NOT NULL,
    expected_outcome TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'IN_PROGRESS', 'COMPLETED', 'DISMISSED'
    )),
    dismissal_reason TEXT,
    source_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_student_recommendations_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_learning_recommendations_student_composite FOREIGN KEY (tenant_id, student_id)
        REFERENCES public.students(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learning_recs_student ON public.student_learning_recommendations(student_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_learning_recs_tenant_student ON public.student_learning_recommendations(tenant_id, student_id);

ALTER TABLE public.student_learning_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_learning_recommendations FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students view own learning recommendations"
    ON public.student_learning_recommendations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_learning_recommendations.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_learning_recommendations.tenant_id
        )
    );

CREATE POLICY "Students update status of own learning recommendations"
    ON public.student_learning_recommendations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_learning_recommendations.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_learning_recommendations.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_learning_recommendations.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_learning_recommendations.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student learning recommendations"
    ON public.student_learning_recommendations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_learning_recommendations.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 9. Extend ai_usage_logs Feature Constraint for Phase 03
ALTER TABLE public.ai_usage_logs DROP CONSTRAINT IF EXISTS ai_usage_logs_feature_check;
ALTER TABLE public.ai_usage_logs ADD CONSTRAINT ai_usage_logs_feature_check
    CHECK (feature IN (
        'STUDY_TUTOR',
        'QUESTION_INTELLIGENCE',
        'MISTAKE_MASTERY',
        'DRIVEFIT',
        'PLACEMENT_INTELLIGENCE',
        'RESUME_SCAN',
        'DRIVE_MATCH',
        'SKILL_GAP_ANALYSIS',
        'MOCK_INTERVIEW',
        'CAREER_PASSPORT',
        'PRACTICE_CENTRE',
        'COMPANY_PREPARATION'
    ));
