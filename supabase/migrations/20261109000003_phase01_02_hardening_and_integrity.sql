-- ==============================================================================
-- UrPlaced Migration: Phase 01 & Phase 02 — Hardening, Integrity & RLS Tightening
-- 
-- 1. Align canonical staff roles ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
-- 2. Restrict direct client-side writes on server-derived evaluation tables:
--    - resume_scans (Students SELECT & DELETE own; server admin conducts writes)
--    - student_drive_matches (Students SELECT own; server admin computes matches)
--    - student_skill_gap_analyses (Students SELECT & DELETE own; server admin computes gaps)
--    - student_mock_interview_sessions (Students SELECT & DELETE own; server admin conducts turns)
--    - student_mock_interview_messages (Students SELECT & DELETE own; server admin conducts evaluations)
-- 3. Protect student_skill_progress against unauthorized self-verification
-- 4. Clean and strict ai_usage_logs feature constraint across all 10 AI features
-- 5. Performance composite indexing for multi-tenant query optimization
-- ==============================================================================

-- 1. Correct Staff Roles in Phase 01 & Phase 02 Policies

-- 1.1 student_career_profiles
DROP POLICY IF EXISTS "Tenant staff can view student career profiles" ON public.student_career_profiles;
CREATE POLICY "Tenant staff can view student career profiles"
    ON public.student_career_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_career_profiles.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 1.2 student_resumes
DROP POLICY IF EXISTS "Tenant staff can view student resumes" ON public.student_resumes;
CREATE POLICY "Tenant staff can view student resumes"
    ON public.student_resumes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_resumes.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 1.3 resume_scans (Staff View)
DROP POLICY IF EXISTS "Tenant staff can view student resume scans" ON public.resume_scans;
CREATE POLICY "Tenant staff can view student resume scans"
    ON public.resume_scans
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = resume_scans.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 1.4 student_skill_gap_analyses (Staff View)
DROP POLICY IF EXISTS "Tenant staff can view student skill gap analyses" ON public.student_skill_gap_analyses;
CREATE POLICY "Tenant staff can view student skill gap analyses"
    ON public.student_skill_gap_analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_skill_gap_analyses.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 1.5 student_skill_progress (Staff View & Staff Verification)
DROP POLICY IF EXISTS "Tenant staff can view student skill progress" ON public.student_skill_progress;
CREATE POLICY "Tenant staff can view student skill progress"
    ON public.student_skill_progress
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_skill_progress.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

DROP POLICY IF EXISTS "Tenant staff can verify student skill progress" ON public.student_skill_progress;
CREATE POLICY "Tenant staff can verify student skill progress"
    ON public.student_skill_progress
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_skill_progress.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_skill_progress.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 1.6 student_career_passports (Staff View)
DROP POLICY IF EXISTS "Tenant staff can view student career passports" ON public.student_career_passports;
CREATE POLICY "Tenant staff can view student career passports"
    ON public.student_career_passports
    FOR SELECT
    USING (
        student_career_passports.visibility IN ('COLLEGE_VISIBLE', 'SHAREABLE')
        AND EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_career_passports.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 1.7 student_mock_interview_sessions (Staff View)
DROP POLICY IF EXISTS "Tenant staff can view student mock interview sessions" ON public.student_mock_interview_sessions;
CREATE POLICY "Tenant staff can view student mock interview sessions"
    ON public.student_mock_interview_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_mock_interview_sessions.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );


-- 2. Restrict Direct Client Writes on Server-Derived Evaluation Tables
-- Prevents student tampering with AI/system diagnostic scores via client-side PostgREST calls

-- 2.1 resume_scans
DROP POLICY IF EXISTS "Students manage own resume scans" ON public.resume_scans;

CREATE POLICY "Students view own resume scans"
    ON public.resume_scans
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = resume_scans.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = resume_scans.tenant_id
        )
    );

CREATE POLICY "Students delete own resume scans"
    ON public.resume_scans
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = resume_scans.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = resume_scans.tenant_id
        )
    );

-- 2.2 student_drive_matches
DROP POLICY IF EXISTS "Students view own placement matches" ON public.student_drive_matches;

CREATE POLICY "Students view own placement matches"
    ON public.student_drive_matches
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_drive_matches.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_drive_matches.tenant_id
        )
    );

-- 2.3 student_skill_gap_analyses
DROP POLICY IF EXISTS "Students manage own skill gap analyses" ON public.student_skill_gap_analyses;

CREATE POLICY "Students view own skill gap analyses"
    ON public.student_skill_gap_analyses
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_gap_analyses.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_gap_analyses.tenant_id
        )
    );

CREATE POLICY "Students delete own skill gap analyses"
    ON public.student_skill_gap_analyses
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_gap_analyses.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_gap_analyses.tenant_id
        )
    );

-- 2.4 student_mock_interview_sessions
DROP POLICY IF EXISTS "Students manage own mock interview sessions" ON public.student_mock_interview_sessions;

CREATE POLICY "Students view own mock interview sessions"
    ON public.student_mock_interview_sessions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_sessions.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_sessions.tenant_id
        )
    );

CREATE POLICY "Students delete own mock interview sessions"
    ON public.student_mock_interview_sessions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_sessions.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_sessions.tenant_id
        )
    );

-- 2.5 student_mock_interview_messages
DROP POLICY IF EXISTS "Students manage own mock interview messages" ON public.student_mock_interview_messages;

CREATE POLICY "Students view own mock interview messages"
    ON public.student_mock_interview_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_mock_interview_messages.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_mock_interview_messages.tenant_id
        )
    );


-- 3. Hardened Student Skill Progress Policies (No Student Self-Verification)
DROP POLICY IF EXISTS "Students manage own skill progress" ON public.student_skill_progress;

CREATE POLICY "Students view own skill progress"
    ON public.student_skill_progress
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_progress.tenant_id
        )
    );

CREATE POLICY "Students insert own unverified skill progress"
    ON public.student_skill_progress
    FOR INSERT
    WITH CHECK (
        status <> 'VERIFIED'
        AND verified_at IS NULL
        AND verified_by IS NULL
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_progress.tenant_id
        )
    );

CREATE POLICY "Students update own unverified skill progress"
    ON public.student_skill_progress
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_progress.tenant_id
        )
    )
    WITH CHECK (
        status <> 'VERIFIED'
        AND verified_at IS NULL
        AND verified_by IS NULL
        AND EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_skill_progress.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_skill_progress.tenant_id
        )
    );


-- 4. Clean ai_usage_logs Constraint Across All 10 Features (No exception swallowing)
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


-- 5. Multi-Tenant Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_mock_messages_tenant_student ON public.student_mock_interview_messages(tenant_id, student_id, session_id);
CREATE INDEX IF NOT EXISTS idx_skill_gap_tenant_student ON public.student_skill_gap_analyses(tenant_id, student_id, target_role);
CREATE INDEX IF NOT EXISTS idx_drive_matches_tenant_student ON public.student_drive_matches(tenant_id, student_id, drive_id);
