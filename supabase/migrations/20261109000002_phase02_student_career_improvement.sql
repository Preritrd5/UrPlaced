-- ==============================================================================
-- UrPlaced Migration: Phase 02 — Global Student Career Improvement System
-- 
-- 1. student_skill_gap_analyses: Personalized role & drive skill gap intelligence
-- 2. student_skill_progress: Evidence-backed skill milestone & practice tracking
-- 3. student_career_passports: Student-controlled professional digital portfolio
-- 4. career_passport_shares: Cryptographically secure, revocable public share tokens
-- 5. student_mock_interview_sessions: Multi-mode interactive mock interview state
-- 6. student_mock_interview_messages: One-question-at-a-time turns, evaluations & rubrics
-- 7. Update ai_usage_logs feature constraint for Phase 02 capabilities
-- ==============================================================================

-- 1. Student Skill Gap Analyses Table
CREATE TABLE IF NOT EXISTS public.student_skill_gap_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    target_role VARCHAR(255) NOT NULL,
    target_drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE SET NULL,
    custom_job_description TEXT,
    overall_readiness_score INTEGER NOT NULL CHECK (overall_readiness_score BETWEEN 0 AND 100),
    summary TEXT NOT NULL,
    market_context TEXT,
    matched_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_required_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_preferred_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    skills_with_insufficient_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    learning_roadmap JSONB NOT NULL DEFAULT '[]'::jsonb,
    profile_snapshot_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_skill_gap_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_skill_gap_student ON public.student_skill_gap_analyses(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_gap_tenant ON public.student_skill_gap_analyses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_skill_gap_drive ON public.student_skill_gap_analyses(target_drive_id);

ALTER TABLE public.student_skill_gap_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skill_gap_analyses FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own skill gap analyses"
    ON public.student_skill_gap_analyses
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_gap_analyses.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_gap_analyses.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_gap_analyses.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_gap_analyses.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student skill gap analyses"
    ON public.student_skill_gap_analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_skill_gap_analyses.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 2. Student Skill Progress Tracking Table
CREATE TABLE IF NOT EXISTS public.student_skill_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    skill_name VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN (
        'NOT_STARTED', 'IN_PROGRESS', 'PRACTICED', 'EVIDENCE_SUBMITTED', 'ASSESSMENT_SUPPORTED', 'VERIFIED'
    )),
    target_role VARCHAR(255),
    evidence_links JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_student_skill_progress UNIQUE (student_id, skill_name),
    CONSTRAINT uq_skill_progress_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_skill_progress_student ON public.student_skill_progress(student_id, status);
CREATE INDEX IF NOT EXISTS idx_skill_progress_tenant ON public.student_skill_progress(tenant_id);

ALTER TABLE public.student_skill_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skill_progress FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own skill progress"
    ON public.student_skill_progress
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_progress.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_progress.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student skill progress"
    ON public.student_skill_progress
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_skill_progress.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 3. Student Career Passports Table
CREATE TABLE IF NOT EXISTS public.student_career_passports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    visibility VARCHAR(32) NOT NULL DEFAULT 'PRIVATE' CHECK (visibility IN ('PRIVATE', 'COLLEGE_VISIBLE', 'SHAREABLE')),
    headline VARCHAR(255),
    summary TEXT,
    career_interests TEXT[] NOT NULL DEFAULT '{}',
    preferred_roles TEXT[] NOT NULL DEFAULT '{}',
    included_sections JSONB NOT NULL DEFAULT '{
        "show_cgpa": false,
        "show_phone": false,
        "show_email": true,
        "show_education": true,
        "show_skills": true,
        "show_projects": true,
        "show_experience": true,
        "show_certifications": true,
        "show_achievements": true
    }'::jsonb,
    custom_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    custom_certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    published_snapshot JSONB,
    published_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_career_passport_student UNIQUE (tenant_id, student_id),
    CONSTRAINT uq_career_passport_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_career_passports_student ON public.student_career_passports(student_id);
CREATE INDEX IF NOT EXISTS idx_career_passports_tenant ON public.student_career_passports(tenant_id);

ALTER TABLE public.student_career_passports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_career_passports FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own career passport"
    ON public.student_career_passports
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_career_passports.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_career_passports.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_career_passports.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_career_passports.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student career passports"
    ON public.student_career_passports
    FOR SELECT
    USING (
        student_career_passports.visibility IN ('COLLEGE_VISIBLE', 'SHAREABLE')
        AND EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_career_passports.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 4. Career Passport Secure Share Tokens Table
CREATE TABLE IF NOT EXISTS public.career_passport_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    passport_id UUID NOT NULL REFERENCES public.student_career_passports(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    label VARCHAR(128) NOT NULL DEFAULT 'Public Share Link',
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_passport_shares_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_passport_shares_token_hash ON public.career_passport_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_passport_shares_student ON public.career_passport_shares(student_id);

ALTER TABLE public.career_passport_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_passport_shares FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own passport share links"
    ON public.career_passport_shares
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = career_passport_shares.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = career_passport_shares.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = career_passport_shares.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = career_passport_shares.tenant_id
        )
    );

-- 5. AI Mock Interview Sessions Table
CREATE TABLE IF NOT EXISTS public.student_mock_interview_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    interview_type VARCHAR(32) NOT NULL CHECK (interview_type IN (
        'TECHNICAL', 'HR', 'BEHAVIOURAL', 'PROJECT_BASED', 'COMPANY_SPECIFIC'
    )),
    target_role VARCHAR(255) NOT NULL,
    difficulty VARCHAR(32) NOT NULL DEFAULT 'INTERMEDIATE' CHECK (difficulty IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED')),
    target_drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE SET NULL,
    total_questions INTEGER NOT NULL DEFAULT 4 CHECK (total_questions BETWEEN 1 AND 8),
    current_question_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED' CHECK (status IN (
        'CREATED', 'IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'FAILED'
    )),
    overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
    relevance_score INTEGER CHECK (relevance_score BETWEEN 0 AND 100),
    technical_accuracy_score INTEGER CHECK (technical_accuracy_score BETWEEN 0 AND 100),
    depth_score INTEGER CHECK (depth_score BETWEEN 0 AND 100),
    structure_score INTEGER CHECK (structure_score BETWEEN 0 AND 100),
    practical_reasoning_score INTEGER CHECK (practical_reasoning_score BETWEEN 0 AND 100),
    communication_score INTEGER CHECK (communication_score BETWEEN 0 AND 100),
    final_feedback_summary TEXT,
    strong_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    weak_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    technical_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_exercises JSONB NOT NULL DEFAULT '[]'::jsonb,
    suggested_next_level VARCHAR(32),
    model VARCHAR(64) NOT NULL DEFAULT 'gemini-2.5-flash-lite',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_mock_sessions_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_mock_sessions_student ON public.student_mock_interview_sessions(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mock_sessions_tenant ON public.student_mock_interview_sessions(tenant_id);

ALTER TABLE public.student_mock_interview_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mock_interview_sessions FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own mock interview sessions"
    ON public.student_mock_interview_sessions
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_sessions.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_sessions.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_sessions.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_sessions.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student mock interview sessions"
    ON public.student_mock_interview_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_mock_interview_sessions.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 6. AI Mock Interview Turns & Messages Table
CREATE TABLE IF NOT EXISTS public.student_mock_interview_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES public.student_mock_interview_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    question_index INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_category VARCHAR(64) NOT NULL DEFAULT 'TECHNICAL',
    is_follow_up BOOLEAN NOT NULL DEFAULT false,
    parent_message_id UUID REFERENCES public.student_mock_interview_messages(id) ON DELETE SET NULL,
    student_answer TEXT,
    answer_submitted_at TIMESTAMPTZ,
    evaluation JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_session_question_turn UNIQUE (session_id, question_index, is_follow_up),
    CONSTRAINT uq_mock_messages_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_mock_messages_session ON public.student_mock_interview_messages(session_id, question_index ASC);
CREATE INDEX IF NOT EXISTS idx_mock_messages_student ON public.student_mock_interview_messages(student_id);

ALTER TABLE public.student_mock_interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_mock_interview_messages FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own mock interview messages"
    ON public.student_mock_interview_messages
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_messages.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_messages.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_messages.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_messages.tenant_id
        )
    );

-- 7. Extend ai_usage_logs Feature Constraint
DO $$
BEGIN
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
            'CAREER_PASSPORT'
        ));
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
