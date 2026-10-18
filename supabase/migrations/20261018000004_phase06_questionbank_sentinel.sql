-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 06 Migration: Question Bank Management (QuestionBank Sentinel) Schema & RLS
-- ==============================================================================

-- 1. Question Banks Table (Bank / Category containers per college or shared)
CREATE TABLE IF NOT EXISTS public.question_banks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'CODING',
        'APTITUDE',
        'TECHNICAL_CORE',
        'BEHAVIORAL',
        'GENERAL',
        'COMPANY_SPECIFIC'
    )),
    sharing_policy VARCHAR(32) NOT NULL DEFAULT 'COLLEGE_PRIVATE' CHECK (sharing_policy IN (
        'COLLEGE_PRIVATE',
        'EXPLICITLY_SHARED',
        'GLOBAL_SHARED'
    )),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE',
        'ARCHIVED'
    )),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_question_banks_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_question_banks_tenant ON public.question_banks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_banks_category ON public.question_banks(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_question_banks_status ON public.question_banks(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_question_banks_sharing ON public.question_banks(sharing_policy);

-- 2. Questions Identity Table (Stable question entity with lifecycle status)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_id UUID NOT NULL REFERENCES public.question_banks(id) ON DELETE CASCADE,
    question_type VARCHAR(32) NOT NULL CHECK (question_type IN (
        'SINGLE_CHOICE',
        'MULTIPLE_SELECT',
        'NUMERIC',
        'SHORT_ANSWER',
        'CODING'
    )),
    current_version_id UUID,
    lifecycle_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (lifecycle_status IN (
        'DRAFT',
        'PENDING_REVIEW',
        'APPROVED',
        'PUBLISHED',
        'WITHDRAWN',
        'ARCHIVED'
    )),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_questions_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_questions_tenant ON public.questions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_questions_bank ON public.questions(tenant_id, bank_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON public.questions(tenant_id, question_type);
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions(tenant_id, lifecycle_status);

-- 3. Question Versions Table (Immutable question revision snapshots)
CREATE TABLE IF NOT EXISTS public.question_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    prompt TEXT NOT NULL,
    content_format VARCHAR(16) NOT NULL DEFAULT 'MARKDOWN' CHECK (content_format IN (
        'MARKDOWN',
        'HTML',
        'PLAIN'
    )),
    options JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_key JSONB NOT NULL DEFAULT '{}'::jsonb,
    explanation TEXT,
    difficulty VARCHAR(16) NOT NULL DEFAULT 'MEDIUM' CHECK (difficulty IN (
        'EASY',
        'MEDIUM',
        'HARD'
    )),
    skill_id UUID REFERENCES public.canonical_skills(id) ON DELETE SET NULL,
    topic_tags TEXT[] NOT NULL DEFAULT '{}',
    source_type VARCHAR(32) NOT NULL DEFAULT 'COLLEGE_AUTHORED' CHECK (source_type IN (
        'COLLEGE_AUTHORED',
        'PLATFORM_ORIGINAL',
        'OFFICIAL_COMPANY_PUBLIC',
        'LICENSED_THIRD_PARTY',
        'CANDIDATE_REPORTED',
        'AI_GENERATED'
    )),
    source_reference TEXT,
    license_type VARCHAR(32) NOT NULL DEFAULT 'PROPRIETARY' CHECK (license_type IN (
        'PROPRIETARY',
        'PUBLIC_DOMAIN',
        'PERMISSIVE',
        'CANDIDATE_SHARED',
        'RESTRICTED'
    )),
    review_status VARCHAR(32) NOT NULL DEFAULT 'UNREVIEWED' CHECK (review_status IN (
        'UNREVIEWED',
        'VERIFIED_CORRECT',
        'NEEDS_REVISION',
        'REJECTED'
    )),
    review_notes TEXT,
    fingerprint VARCHAR(64) NOT NULL,
    change_summary TEXT,
    published_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_question_versions_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_question_version_num UNIQUE (question_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_question_versions_tenant ON public.question_versions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_versions_question ON public.question_versions(question_id);
CREATE INDEX IF NOT EXISTS idx_question_versions_skill ON public.question_versions(skill_id);
CREATE INDEX IF NOT EXISTS idx_question_versions_fingerprint ON public.question_versions(tenant_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_question_versions_review ON public.question_versions(tenant_id, review_status);

-- Connect circular reference for current_version_id
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_questions_current_version'
    ) THEN
        ALTER TABLE public.questions
        ADD CONSTRAINT fk_questions_current_version
        FOREIGN KEY (current_version_id)
        REFERENCES public.question_versions(id)
        ON DELETE SET NULL;
    END IF;
END $$;

-- 4. Question Import Jobs Table (Batch CSV import tracker)
CREATE TABLE IF NOT EXISTS public.question_import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bank_id UUID REFERENCES public.question_banks(id) ON DELETE SET NULL,
    file_name VARCHAR(256) NOT NULL,
    total_rows INTEGER NOT NULL DEFAULT 0,
    valid_rows INTEGER NOT NULL DEFAULT 0,
    invalid_rows INTEGER NOT NULL DEFAULT 0,
    duplicate_rows INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'PREVIEWED' CHECK (status IN (
        'PREVIEWED',
        'COMMITTED',
        'FAILED',
        'CANCELLED'
    )),
    error_report JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    committed_at TIMESTAMPTZ,
    CONSTRAINT uq_import_jobs_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_tenant ON public.question_import_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON public.question_import_jobs(tenant_id, status);

-- 5. Duplicate Candidates Table (Exact & Near Duplicate detection pairs)
CREATE TABLE IF NOT EXISTS public.question_duplicate_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    matched_question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    similarity_score NUMERIC(5, 4) NOT NULL,
    detection_method VARCHAR(32) NOT NULL CHECK (detection_method IN (
        'EXACT_FINGERPRINT',
        'TEXT_SIMILARITY',
        'OPTION_OVERLAP'
    )),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN (
        'PENDING_REVIEW',
        'CONFIRMED_DUPLICATE',
        'FALSE_POSITIVE',
        'RESOLVED'
    )),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_dup_candidates_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_duplicate_pair UNIQUE (source_question_id, matched_question_id)
);

CREATE INDEX IF NOT EXISTS idx_dup_candidates_tenant ON public.question_duplicate_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_source ON public.question_duplicate_candidates(source_question_id);
CREATE INDEX IF NOT EXISTS idx_dup_candidates_status ON public.question_duplicate_candidates(tenant_id, status);

-- 6. Question Sets Table (Assessment / practice blueprints and snapshots)
CREATE TABLE IF NOT EXISTS public.question_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name VARCHAR(256) NOT NULL,
    description TEXT,
    purpose VARCHAR(64) NOT NULL DEFAULT 'ASSESSMENT' CHECK (purpose IN (
        'ASSESSMENT',
        'PRACTICE',
        'DIAGNOSTIC',
        'COMPANY_PREP',
        'INTERVIEW'
    )),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT',
        'PUBLISHED',
        'ARCHIVED'
    )),
    version_number INTEGER NOT NULL DEFAULT 1,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_question_sets_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_question_sets_tenant ON public.question_sets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_question_sets_status ON public.question_sets(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_question_sets_purpose ON public.question_sets(tenant_id, purpose);

-- 7. Question Set Items Table (Association to question + immutable version)
CREATE TABLE IF NOT EXISTS public.question_set_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    set_id UUID NOT NULL REFERENCES public.question_sets(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    version_id UUID NOT NULL REFERENCES public.question_versions(id) ON DELETE RESTRICT,
    sequence_order INTEGER NOT NULL DEFAULT 1,
    points NUMERIC(6, 2) NOT NULL DEFAULT 1.00,
    negative_points NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_set_items_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_set_item_question UNIQUE (set_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_set_items_set ON public.question_set_items(set_id);
CREATE INDEX IF NOT EXISTS idx_set_items_question ON public.question_set_items(question_id);
CREATE INDEX IF NOT EXISTS idx_set_items_version ON public.question_set_items(version_id);
CREATE INDEX IF NOT EXISTS idx_set_items_order ON public.question_set_items(set_id, sequence_order);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable and force RLS on all 7 tables
ALTER TABLE public.question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_banks FORCE ROW LEVEL SECURITY;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_import_jobs FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_duplicate_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_duplicate_candidates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_sets FORCE ROW LEVEL SECURITY;

ALTER TABLE public.question_set_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_set_items FORCE ROW LEVEL SECURITY;

-- 1. Question Banks Policies
CREATE POLICY p_q_banks_staff ON public.question_banks
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_q_banks_global_read ON public.question_banks
    FOR SELECT TO authenticated
    USING (
        sharing_policy = 'GLOBAL_SHARED'
        AND status = 'ACTIVE'
    );

CREATE POLICY p_q_banks_student_read ON public.question_banks
    FOR SELECT TO authenticated
    USING (
        status = 'ACTIVE'
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.tenant_id = question_banks.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- 2. Questions Policies
CREATE POLICY p_questions_staff ON public.questions
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_questions_global_read ON public.questions
    FOR SELECT TO authenticated
    USING (
        lifecycle_status = 'PUBLISHED'
        AND EXISTS (
            SELECT 1 FROM public.question_banks qb
            WHERE qb.id = questions.bank_id
              AND qb.sharing_policy = 'GLOBAL_SHARED'
              AND qb.status = 'ACTIVE'
        )
    );

CREATE POLICY p_questions_student_read ON public.questions
    FOR SELECT TO authenticated
    USING (
        lifecycle_status = 'PUBLISHED'
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.tenant_id = questions.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- 3. Question Versions Policies
CREATE POLICY p_q_versions_staff ON public.question_versions
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_q_versions_global_read ON public.question_versions
    FOR SELECT TO authenticated
    USING (
        published_at IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.questions q
            JOIN public.question_banks qb ON qb.id = q.bank_id
            WHERE q.id = question_versions.question_id
              AND q.lifecycle_status = 'PUBLISHED'
              AND qb.sharing_policy = 'GLOBAL_SHARED'
        )
    );

CREATE POLICY p_q_versions_student_read ON public.question_versions
    FOR SELECT TO authenticated
    USING (
        published_at IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM public.students s
            JOIN public.questions q ON q.id = question_versions.question_id
            WHERE s.tenant_id = question_versions.tenant_id
              AND s.user_id = auth.uid()
              AND q.lifecycle_status = 'PUBLISHED'
        )
    );

-- 4. Import Jobs Policies: Staff only
CREATE POLICY p_import_jobs_staff ON public.question_import_jobs
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

-- 5. Duplicate Candidates Policies: Staff only
CREATE POLICY p_dup_candidates_staff ON public.question_duplicate_candidates
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

-- 6. Question Sets Policies
CREATE POLICY p_q_sets_staff ON public.question_sets
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_q_sets_student_read ON public.question_sets
    FOR SELECT TO authenticated
    USING (
        status = 'PUBLISHED'
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.tenant_id = question_sets.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- 7. Question Set Items Policies
CREATE POLICY p_set_items_staff ON public.question_set_items
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_set_items_student_read ON public.question_set_items
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.question_sets qs
            JOIN public.students s ON s.tenant_id = qs.tenant_id
            WHERE qs.id = question_set_items.set_id
              AND qs.status = 'PUBLISHED'
              AND s.user_id = auth.uid()
        )
    );

-- ==============================================================================
-- AUDIT TRIGGER HELPER FOR QUESTION REVISIONS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.log_question_lifecycle_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    IF (OLD.lifecycle_status IS DISTINCT FROM NEW.lifecycle_status) THEN
        INSERT INTO public.audit_logs (
            tenant_id,
            actor_id,
            action,
            resource_type,
            resource_id,
            before_state,
            after_state
        ) VALUES (
            NEW.tenant_id,
            auth.uid(),
            'QUESTION_STATUS_CHANGE',
            'question',
            NEW.id::text,
            jsonb_build_object('status', OLD.lifecycle_status),
            jsonb_build_object('status', NEW.lifecycle_status)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_question_lifecycle ON public.questions;
CREATE TRIGGER trg_question_lifecycle
    AFTER UPDATE ON public.questions
    FOR EACH ROW
    EXECUTE FUNCTION public.log_question_lifecycle_change();
