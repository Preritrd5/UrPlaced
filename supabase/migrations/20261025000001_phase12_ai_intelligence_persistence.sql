-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 12 Migration: AI Intelligence Layer Persistence, Usage Logging & RLS
-- ==============================================================================

-- 1. AI Usage & Audit Logs Table
-- Enforces auditing, token tracking, latency monitoring, and rate limiting verification
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    feature VARCHAR(64) NOT NULL CHECK (feature IN (
        'STUDY_TUTOR',
        'QUESTION_INTELLIGENCE',
        'MISTAKE_MASTERY',
        'DRIVEFIT',
        'PLACEMENT_INTELLIGENCE'
    )),
    model VARCHAR(64) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SUCCESS' CHECK (status IN (
        'SUCCESS',
        'ERROR',
        'RATE_LIMITED',
        'SAFETY_BLOCKED'
    )),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant_user ON public.ai_usage_logs(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_feature_status ON public.ai_usage_logs(feature, status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON public.ai_usage_logs(created_at DESC);

-- Enable RLS for ai_usage_logs
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own AI usage logs"
    ON public.ai_usage_logs
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Tenant staff can view aggregate tenant AI logs"
    ON public.ai_usage_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = ai_usage_logs.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.status = 'ACTIVE'
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF')
        )
    );

CREATE POLICY "Service role can insert AI usage logs"
    ON public.ai_usage_logs
    FOR INSERT
    WITH CHECK (true);

-- 2. AI Tutor Conversations Table
-- Persists contextual study conversations between students and the AI Tutor
CREATE TABLE IF NOT EXISTS public.ai_tutor_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    topic VARCHAR(128) NOT NULL DEFAULT 'General Placement Prep',
    question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
    messages JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_tutor_user_updated ON public.ai_tutor_conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_question ON public.ai_tutor_conversations(question_id);

-- Enable RLS for ai_tutor_conversations
ALTER TABLE public.ai_tutor_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tutor conversations"
    ON public.ai_tutor_conversations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. AI Mistake Analyses Table
-- Persists diagnostic insights, knowledge gap breakdowns, and targeted practice recommendations
CREATE TABLE IF NOT EXISTS public.ai_mistake_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    summary TEXT NOT NULL,
    identified_gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_question_ids UUID[] NOT NULL DEFAULT '{}',
    total_mistakes_analyzed INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_mistakes_user_created ON public.ai_mistake_analyses(user_id, created_at DESC);

-- Enable RLS for ai_mistake_analyses
ALTER TABLE public.ai_mistake_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own mistake analyses"
    ON public.ai_mistake_analyses
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 4. AI DriveFit Evaluations Table
-- Stores student-specific company drive preparation evaluations, eligibility checks, and roadmaps
CREATE TABLE IF NOT EXISTS public.ai_drivefit_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    overall_fit_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_fit_score BETWEEN 0 AND 100),
    eligibility_status VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN' CHECK (eligibility_status IN (
        'ELIGIBLE',
        'INELIGIBLE',
        'CONDITIONAL',
        'UNKNOWN'
    )),
    eligibility_details JSONB NOT NULL DEFAULT '{}'::jsonb,
    skill_match_analysis JSONB NOT NULL DEFAULT '[]'::jsonb,
    preparation_roadmap JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommended_question_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_ai_drivefit_user_drive ON public.ai_drivefit_evaluations(user_id, drive_id, created_at DESC);

-- Enable RLS for ai_drivefit_evaluations
ALTER TABLE public.ai_drivefit_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view and create own drivefit evaluations"
    ON public.ai_drivefit_evaluations
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
