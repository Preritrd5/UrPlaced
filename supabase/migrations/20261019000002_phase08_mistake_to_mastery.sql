-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 08 Migration: Mistake Bank & Mistake-to-Mastery Engine Schema & RLS
-- ==============================================================================

-- 1. Mistake Review Targets Table (Deduplicated primary review items per student & question/skill)
CREATE TABLE IF NOT EXISTS public.mistake_review_targets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE RESTRICT,
    skill_id UUID REFERENCES public.canonical_skills(id) ON DELETE SET NULL,
    primary_reason VARCHAR(32) NOT NULL CHECK (primary_reason IN (
        'INCORRECT_ANSWER',
        'SKIPPED_UNANSWERED',
        'STUDENT_FLAGGED',
        'CORRECT_REVIEW_LATER',
        'CONTENT_DEFECT_SUSPECTED'
    )),
    status VARCHAR(32) NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK (status IN (
        'NEEDS_REVIEW',
        'PRACTISING',
        'REVISION_DUE',
        'IMPROVING',
        'PROVISIONAL_MASTERY',
        'MASTERY_DEMONSTRATED',
        'CONTENT_DEFECT_SUSPECTED',
        'RESOLVED_DISMISSED',
        'CONTENT_INVALIDATED'
    )),
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    revision_stage INTEGER NOT NULL DEFAULT 1,
    last_reviewed_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    student_reflection TEXT,
    student_reason_category VARCHAR(32) CHECK (student_reason_category IN (
        'CONCEPT_NOT_UNDERSTOOD',
        'FORMULA_FACT_FORGOTTEN',
        'CALCULATION_MISTAKE',
        'MISREAD_QUESTION',
        'TIME_PRESSURE',
        'GUESSED',
        'CONFUSED_CHOICES',
        'CARELESS_ERROR',
        'NOT_SURE',
        'OTHER'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_review_target_student_question UNIQUE (tenant_id, student_id, question_id, version_id),
    CONSTRAINT uq_review_targets_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_review_targets_tenant ON public.mistake_review_targets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_targets_student ON public.mistake_review_targets(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_review_targets_skill ON public.mistake_review_targets(tenant_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_review_targets_status ON public.mistake_review_targets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_review_targets_due ON public.mistake_review_targets(tenant_id, student_id, next_due_at);
CREATE INDEX IF NOT EXISTS idx_review_targets_reason ON public.mistake_review_targets(tenant_id, primary_reason);

-- 2. Mistake Occurrences Table (Every historical observation across attempts)
CREATE TABLE IF NOT EXISTS public.mistake_occurrences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.mistake_review_targets(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    response_id UUID REFERENCES public.attempt_responses(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE RESTRICT,
    capture_reason VARCHAR(32) NOT NULL CHECK (capture_reason IN (
        'INCORRECT_ANSWER',
        'SKIPPED_UNANSWERED',
        'STUDENT_FLAGGED',
        'CORRECT_REVIEW_LATER',
        'MANUAL_SCORE_INCORRECT'
    )),
    submitted_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    points_awarded NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mistake_occurrences_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_occurrence_attempt_question UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_mistake_occurrences_tenant ON public.mistake_occurrences(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mistake_occurrences_target ON public.mistake_occurrences(target_id);
CREATE INDEX IF NOT EXISTS idx_mistake_occurrences_student ON public.mistake_occurrences(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_mistake_occurrences_attempt ON public.mistake_occurrences(attempt_id);

-- 3. Review Sessions Table (Activity log when student reviews explanations or reschedules)
CREATE TABLE IF NOT EXISTS public.review_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.mistake_review_targets(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    action_type VARCHAR(32) NOT NULL CHECK (action_type IN (
        'EXPLANATION_VIEWED',
        'REFLECTION_SAVED',
        'PRACTICE_STARTED',
        'REVISION_RESCHEDULED',
        'TARGET_DISMISSED'
    )),
    notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_review_sessions_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_review_sessions_tenant ON public.review_sessions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_target ON public.review_sessions(target_id);
CREATE INDEX IF NOT EXISTS idx_review_sessions_student ON public.review_sessions(tenant_id, student_id);

-- 4. Mastery Evidence Records Table (Independent evidence from new questions)
CREATE TABLE IF NOT EXISTS public.mastery_evidence_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.canonical_skills(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.mistake_review_targets(id) ON DELETE SET NULL,
    evidence_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    evidence_version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE RESTRICT,
    attempt_id UUID REFERENCES public.assessment_attempts(id) ON DELETE SET NULL,
    is_new_question BOOLEAN NOT NULL DEFAULT true,
    is_correct BOOLEAN NOT NULL,
    points_earned NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    difficulty VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    validity_status VARCHAR(32) NOT NULL DEFAULT 'VALID' CHECK (validity_status IN (
        'VALID',
        'INVALIDATED_DEFECT',
        'EXPIRED',
        'SUPERSEDED'
    )),
    invalidation_reason TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_mastery_evidence_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_mastery_evidence_tenant ON public.mastery_evidence_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mastery_evidence_student ON public.mastery_evidence_records(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_mastery_evidence_skill ON public.mastery_evidence_records(tenant_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_mastery_evidence_validity ON public.mastery_evidence_records(tenant_id, validity_status);

-- 5. Student Skill Mastery Table (Aggregated proficiency per student per canonical skill)
CREATE TABLE IF NOT EXISTS public.student_skill_mastery (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.canonical_skills(id) ON DELETE CASCADE,
    mastery_status VARCHAR(32) NOT NULL DEFAULT 'NEEDS_REVIEW' CHECK (mastery_status IN (
        'UNASSESSED',
        'NEEDS_REVIEW',
        'PRACTISING',
        'IMPROVING',
        'PROVISIONAL_MASTERY',
        'MASTERY_DEMONSTRATED',
        'NEEDS_REASSESSMENT'
    )),
    total_mistakes_count INTEGER NOT NULL DEFAULT 0,
    active_review_count INTEGER NOT NULL DEFAULT 0,
    independent_correct_count INTEGER NOT NULL DEFAULT 0,
    independent_attempts_count INTEGER NOT NULL DEFAULT 0,
    accuracy_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    last_evidence_at TIMESTAMPTZ,
    policy_version VARCHAR(16) NOT NULL DEFAULT 'v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_student_skill_mastery UNIQUE (tenant_id, student_id, skill_id),
    CONSTRAINT uq_skill_mastery_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_student_skill_mastery_tenant ON public.student_skill_mastery(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_mastery_student ON public.student_skill_mastery(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_student_skill_mastery_status ON public.student_skill_mastery(tenant_id, mastery_status);

-- 6. Question Defect Reports Table (Feedback & defect resolution workflow)
CREATE TABLE IF NOT EXISTS public.question_defect_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE RESTRICT,
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    defect_type VARCHAR(32) NOT NULL CHECK (defect_type IN (
        'INCORRECT_ANSWER_KEY',
        'AMBIGUOUS_PROMPT',
        'MISSING_INVALID_OPTION',
        'ERRONEOUS_EXPLANATION',
        'BROKEN_RUNNER_CONFIG',
        'WRONG_SKILL_MAPPING',
        'OTHER'
    )),
    description TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'CONFIRMED_DEFECT',
        'FALSE_ALARM',
        'RESOLVED'
    )),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_defect_reports_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_defect_reports_tenant ON public.question_defect_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_defect_reports_question ON public.question_defect_reports(question_id);
CREATE INDEX IF NOT EXISTS idx_defect_reports_status ON public.question_defect_reports(tenant_id, status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable and force RLS on all 6 tables
ALTER TABLE public.mistake_review_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistake_review_targets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.mistake_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mistake_occurrences FORCE ROW LEVEL SECURITY;

ALTER TABLE public.review_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.mastery_evidence_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mastery_evidence_records FORCE ROW LEVEL SECURITY;

ALTER TABLE public.student_skill_mastery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_skill_mastery FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_defect_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_defect_reports FORCE ROW LEVEL SECURITY;

-- 1. mistake_review_targets Policies
CREATE POLICY "p08_targets_select"
    ON public.mistake_review_targets FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_targets_write"
    ON public.mistake_review_targets FOR ALL
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

-- 2. mistake_occurrences Policies
CREATE POLICY "p08_occurrences_select"
    ON public.mistake_occurrences FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_occurrences_write"
    ON public.mistake_occurrences FOR ALL
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

-- 3. review_sessions Policies
CREATE POLICY "p08_sessions_select"
    ON public.review_sessions FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_sessions_write"
    ON public.review_sessions FOR ALL
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

-- 4. mastery_evidence_records Policies
CREATE POLICY "p08_evidence_select"
    ON public.mastery_evidence_records FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_evidence_write"
    ON public.mastery_evidence_records FOR ALL
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

-- 5. student_skill_mastery Policies
CREATE POLICY "p08_mastery_select"
    ON public.student_skill_mastery FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND student_id IN (
            SELECT id FROM public.students WHERE user_id = auth.uid()
        )) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_mastery_write"
    ON public.student_skill_mastery FOR ALL
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

-- 6. question_defect_reports Policies
CREATE POLICY "p08_defects_select"
    ON public.question_defect_reports FOR SELECT
    USING (
        public.is_tenant_staff(tenant_id) OR
        (public.is_active_tenant_member(tenant_id) AND reported_by = auth.uid()) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_defects_insert"
    ON public.question_defect_reports FOR INSERT
    WITH CHECK (
        public.is_active_tenant_member(tenant_id) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_defects_manage"
    ON public.question_defect_reports FOR UPDATE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    )
    WITH CHECK (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );

CREATE POLICY "p08_defects_delete"
    ON public.question_defect_reports FOR DELETE
    USING (
        public.is_tenant_staff(tenant_id) OR
        public.is_platform_admin()
    );
