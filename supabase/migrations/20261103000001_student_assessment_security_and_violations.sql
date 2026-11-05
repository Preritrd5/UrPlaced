-- ==============================================================================
-- UrPlaced: Student Assessment Security, Fullscreen Enforcement & Violations Audit
-- Migration: 20261103000001_student_assessment_security_and_violations.sql
-- ==============================================================================
-- 1. Adds submission_reason, violation_count, and is_fullscreen_enforced to assessment_attempts
-- 2. Creates assessment_violations immutable audit table
-- 3. Configures Strict Option A tenant isolation and student RLS policies
-- ==============================================================================

-- 1. Extend assessment_attempts
ALTER TABLE public.assessment_attempts 
    ADD COLUMN IF NOT EXISTS submission_reason VARCHAR(64) DEFAULT 'MANUAL';

ALTER TABLE public.assessment_attempts 
    ADD COLUMN IF NOT EXISTS violation_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.assessment_attempts 
    ADD COLUMN IF NOT EXISTS is_fullscreen_enforced BOOLEAN NOT NULL DEFAULT true;

-- 2. Create assessment_violations audit log table
CREATE TABLE IF NOT EXISTS public.assessment_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    attempt_id UUID NOT NULL REFERENCES public.assessment_attempts(id) ON DELETE CASCADE,
    assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    violation_type VARCHAR(64) NOT NULL CHECK (violation_type IN (
        'TAB_SWITCH',
        'DOCUMENT_HIDDEN',
        'WINDOW_FOCUS_LOST',
        'WINDOW_BLUR',
        'FULLSCREEN_EXIT',
        'NAVIGATION_AWAY',
        'PAGE_HIDDEN',
        'DEVTOOLS_ATTEMPT',
        'COPY_PASTE_ATTEMPT',
        'OTHER_CONFIGURED_VIOLATION'
    )),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    triggered_submission BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_assessment_violations_tenant_id UNIQUE (tenant_id, id)
);

-- Indexes for efficient lookups & reporting
CREATE INDEX IF NOT EXISTS idx_assessment_violations_attempt 
    ON public.assessment_violations (attempt_id);

CREATE INDEX IF NOT EXISTS idx_assessment_violations_assessment 
    ON public.assessment_violations (tenant_id, assessment_id);

CREATE INDEX IF NOT EXISTS idx_assessment_violations_student 
    ON public.assessment_violations (tenant_id, student_id);

CREATE INDEX IF NOT EXISTS idx_assessment_violations_type 
    ON public.assessment_violations (violation_type);

-- Enable & force RLS
ALTER TABLE public.assessment_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_violations FORCE ROW LEVEL SECURITY;

-- Policy 1: Authenticated students can insert violations for their own active attempt
CREATE POLICY "students_insert_own_violations" ON public.assessment_violations
    FOR INSERT
    TO authenticated
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM public.students WHERE user_id = auth.uid() AND id = student_id LIMIT 1)
        AND student_id = (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
        AND EXISTS (
            SELECT 1 FROM public.assessment_attempts 
            WHERE id = attempt_id 
            AND student_id = assessment_violations.student_id 
            AND status = 'IN_PROGRESS'
        )
    );

-- Policy 2: Authenticated students can view their own violation history
CREATE POLICY "students_select_own_violations" ON public.assessment_violations
    FOR SELECT
    TO authenticated
    USING (
        student_id = (SELECT id FROM public.students WHERE user_id = auth.uid() LIMIT 1)
    );

-- Policy 3: College staff (Placement Head, Placement Staff, Trainer) of the same tenant can view violations
CREATE POLICY "staff_select_tenant_violations" ON public.assessment_violations
    FOR SELECT
    TO authenticated
    USING (
        tenant_id IN (
            SELECT tenant_id FROM public.tenant_memberships
            WHERE user_id = auth.uid()
            AND role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
        )
    );

-- Strict Option A: Platform Super Admin role does NOT receive access to institutional assessment records.
