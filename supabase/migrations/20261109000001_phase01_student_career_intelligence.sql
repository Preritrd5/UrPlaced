-- ==============================================================================
-- UrPlaced Migration: Phase 01 — Global Student Career Intelligence System
-- 
-- 1. student_career_profiles: Comprehensive student career profile & completeness
-- 2. student_resumes: Multi-version private resume storage metadata
-- 3. resume_scans: Deep ATS diagnostic analysis & improvement history
-- 4. student_drive_matches: Smart placement drive matching & skills gap cache
-- 5. Private student-resumes storage bucket & RLS policies
-- 6. Extend ai_usage_logs for RESUME_SCAN and DRIVE_MATCH
-- ==============================================================================

-- 1. Student Career Profiles Table
CREATE TABLE IF NOT EXISTS public.student_career_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    headline VARCHAR(255),
    bio TEXT,
    location VARCHAR(255),
    linkedin_url TEXT,
    github_url TEXT,
    portfolio_url TEXT,
    technical_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    soft_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
    projects JSONB NOT NULL DEFAULT '[]'::jsonb,
    experience JSONB NOT NULL DEFAULT '[]'::jsonb,
    certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
    completeness_percentage INTEGER NOT NULL DEFAULT 0 CHECK (completeness_percentage BETWEEN 0 AND 100),
    completeness_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_career_profiles_student UNIQUE (tenant_id, student_id),
    CONSTRAINT uq_career_profiles_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_career_profiles_tenant ON public.student_career_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_career_profiles_student ON public.student_career_profiles(student_id);

ALTER TABLE public.student_career_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_career_profiles FORCE ROW LEVEL SECURITY;

-- Career Profiles RLS: Students can manage own profile; College staff can view
CREATE POLICY "Students manage own career profile"
    ON public.student_career_profiles
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_career_profiles.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_career_profiles.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_career_profiles.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_career_profiles.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student career profiles"
    ON public.student_career_profiles
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_career_profiles.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 2. Student Resumes Table
CREATE TABLE IF NOT EXISTS public.student_resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes INTEGER NOT NULL,
    file_type VARCHAR(16) NOT NULL CHECK (file_type IN ('pdf', 'docx')),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    parsed_text TEXT,
    parsing_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (parsing_status IN ('PENDING', 'PARSED', 'PARTIALLY_PARSED', 'FAILED')),
    parsing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_student_resumes_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_student_resumes_tenant ON public.student_resumes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_student_resumes_student ON public.student_resumes(student_id);
CREATE INDEX IF NOT EXISTS idx_student_resumes_primary ON public.student_resumes(student_id, is_primary);

ALTER TABLE public.student_resumes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_resumes FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own resumes"
    ON public.student_resumes
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_resumes.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_resumes.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_resumes.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_resumes.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student resumes"
    ON public.student_resumes
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = student_resumes.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 3. Resume Scans Table (ATS Intelligence & Diagnostic History)
CREATE TABLE IF NOT EXISTS public.resume_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    resume_id UUID NOT NULL REFERENCES public.student_resumes(id) ON DELETE CASCADE,
    target_drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE SET NULL,
    target_role VARCHAR(255),
    model VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
    overall_quality_score INTEGER NOT NULL CHECK (overall_quality_score BETWEEN 0 AND 100),
    parseability_score INTEGER NOT NULL CHECK (parseability_score BETWEEN 0 AND 100),
    content_quality_score INTEGER NOT NULL CHECK (content_quality_score BETWEEN 0 AND 100),
    skills_coverage_score INTEGER CHECK (skills_coverage_score BETWEEN 0 AND 100),
    match_score INTEGER CHECK (match_score BETWEEN 0 AND 100),
    analysis_summary TEXT NOT NULL,
    detected_sections TEXT[] NOT NULL DEFAULT '{}',
    missing_sections TEXT[] NOT NULL DEFAULT '{}',
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    skills_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    improvement_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
    limitations TEXT[] NOT NULL DEFAULT '{}',
    token_usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    processing_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_resume_scans_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_resume_scans_resume ON public.resume_scans(resume_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_scans_student ON public.resume_scans(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_scans_tenant ON public.resume_scans(tenant_id);

ALTER TABLE public.resume_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resume_scans FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own resume scans"
    ON public.resume_scans
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = resume_scans.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = resume_scans.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = resume_scans.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = resume_scans.tenant_id
        )
    );

CREATE POLICY "Tenant staff can view student resume scans"
    ON public.resume_scans
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.tenant_memberships tm
            WHERE tm.tenant_id = resume_scans.tenant_id
              AND tm.user_id = auth.uid()
              AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_OFFICER', 'STAFF', 'TRAINER')
              AND tm.status = 'ACTIVE'
        )
    );

-- 4. Smart Placement Drive Matches Cache Table
CREATE TABLE IF NOT EXISTS public.student_drive_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    resume_id UUID REFERENCES public.student_resumes(id) ON DELETE SET NULL,
    match_score INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    official_eligibility VARCHAR(32) NOT NULL DEFAULT 'UNKNOWN' CHECK (official_eligibility IN ('ELIGIBLE', 'INELIGIBLE', 'CONDITIONAL', 'UNKNOWN')),
    eligibility_reasons JSONB NOT NULL DEFAULT '{}'::jsonb,
    matched_skills TEXT[] NOT NULL DEFAULT '{}',
    missing_skills TEXT[] NOT NULL DEFAULT '{}',
    preferred_skills TEXT[] NOT NULL DEFAULT '{}',
    strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
    recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
    match_explanation TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    CONSTRAINT uq_student_drive_matches UNIQUE (student_id, drive_id),
    CONSTRAINT uq_student_drive_matches_tenant_id UNIQUE (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_student_drive_matches_student ON public.student_drive_matches(student_id, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_student_drive_matches_drive ON public.student_drive_matches(drive_id);
CREATE INDEX IF NOT EXISTS idx_student_drive_matches_tenant ON public.student_drive_matches(tenant_id);

ALTER TABLE public.student_drive_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_drive_matches FORCE ROW LEVEL SECURITY;

CREATE POLICY "Students view own placement matches"
    ON public.student_drive_matches
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_drive_matches.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_drive_matches.tenant_id
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_drive_matches.student_id
              AND s.user_id = auth.uid()
              AND s.tenant_id = student_drive_matches.tenant_id
        )
    );

-- 5. Storage Bucket Configuration for Private Resumes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'student-resumes',
    'student-resumes',
    false, -- Private bucket
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
