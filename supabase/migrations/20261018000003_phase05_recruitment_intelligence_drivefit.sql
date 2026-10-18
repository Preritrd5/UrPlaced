-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 05 Migration: Company Recruitment Intelligence (DriveFit) Schema & RLS
-- ==============================================================================

-- 1. Canonical Skills Taxonomy Table
CREATE TABLE IF NOT EXISTS public.canonical_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(128) NOT NULL UNIQUE,
    normalized_name VARCHAR(128) NOT NULL UNIQUE,
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'QUANTITATIVE_APTITUDE',
        'LOGICAL_REASONING',
        'VERBAL_ABILITY',
        'PROGRAMMING_FUNDAMENTALS',
        'DATA_STRUCTURES_ALGORITHMS',
        'DATABASE_MANAGEMENT',
        'OPERATING_SYSTEMS',
        'COMPUTER_NETWORKS',
        'OBJECT_ORIENTED_PROGRAMMING',
        'SYSTEM_DESIGN',
        'BEHAVIORAL_HR',
        'CORE_ENGINEERING',
        'OTHER'
    )),
    description TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_canonical_skills_category ON public.canonical_skills(category);
CREATE INDEX IF NOT EXISTS idx_canonical_skills_normalized ON public.canonical_skills(normalized_name);

-- 2. Practice Resources Table (Platform-wide or Tenant-custom)
CREATE TABLE IF NOT EXISTS public.practice_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.canonical_skills(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    resource_type VARCHAR(64) NOT NULL CHECK (resource_type IN (
        'OFFICIAL_GUIDE',
        'PRACTICE_SET',
        'SYLLABUS_OUTLINE',
        'INTERVIEW_CHECKLIST',
        'SAMPLE_QUESTIONS',
        'REVISION_NOTES'
    )),
    content_class VARCHAR(64) NOT NULL CHECK (content_class IN (
        'OFFICIAL_COMPANY_RESOURCE',
        'PREVIOUS_RECRUITMENT_QUESTIONS',
        'NEWLY_AUTHORED_PRACTICE'
    )),
    url TEXT,
    description TEXT,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_practice_resources_skill ON public.practice_resources(skill_id);
CREATE INDEX IF NOT EXISTS idx_practice_resources_tenant ON public.practice_resources(tenant_id);

-- 3. Recruitment Sources Table
CREATE TABLE IF NOT EXISTS public.recruitment_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    title VARCHAR(256) NOT NULL,
    publisher VARCHAR(128) NOT NULL,
    source_type VARCHAR(64) NOT NULL CHECK (source_type IN (
        'OFFICIAL_WEBSITE',
        'PLACEMENT_NOTICE',
        'OFFICIAL_JD',
        'STUDENT_REPORT',
        'HISTORICAL_REPORT',
        'MANUAL_ENTRY'
    )),
    canonical_url TEXT,
    document_ref TEXT,
    published_at DATE,
    effective_at DATE,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (verification_status IN (
        'PENDING_REVIEW',
        'VERIFIED',
        'REJECTED',
        'SUPERSEDED',
        'ARCHIVED'
    )),
    access_classification VARCHAR(32) NOT NULL DEFAULT 'TENANT_CONFIDENTIAL' CHECK (access_classification IN (
        'PUBLIC',
        'TENANT_CONFIDENTIAL',
        'RESTRICTED'
    )),
    raw_content TEXT,
    excerpt TEXT,
    created_by UUID REFERENCES auth.users(id),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_recruitment_sources_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_recruitment_sources_company_composite FOREIGN KEY (tenant_id, company_id) REFERENCES public.companies(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recruitment_sources_tenant ON public.recruitment_sources(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_sources_company ON public.recruitment_sources(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_sources_drive ON public.recruitment_sources(tenant_id, drive_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_sources_status ON public.recruitment_sources(tenant_id, verification_status);

-- 4. Recruitment Requirements Table (Structured Claims & Assertions)
CREATE TABLE IF NOT EXISTS public.recruitment_requirements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    source_id UUID REFERENCES public.recruitment_sources(id) ON DELETE CASCADE,
    scope_level VARCHAR(32) NOT NULL DEFAULT 'DRIVE' CHECK (scope_level IN ('COMPANY', 'ROLE', 'DRIVE')),
    category VARCHAR(64) NOT NULL CHECK (category IN (
        'ELIGIBILITY',
        'ROLE_RESPONSIBILITIES',
        'TECHNICAL_SKILL',
        'PROGRAMMING_LANGUAGE',
        'APTITUDE_TOPIC',
        'RECRUITMENT_PROCESS',
        'COMPENSATION_BENEFITS',
        'PREPARATION_TOPIC'
    )),
    title VARCHAR(256) NOT NULL,
    description TEXT,
    structured_value JSONB,
    source_excerpt TEXT,
    evidence_level VARCHAR(32) NOT NULL DEFAULT 'INFERRED' CHECK (evidence_level IN ('OFFICIAL', 'REPORTED', 'INFERRED', 'UNKNOWN')),
    verification_status VARCHAR(32) NOT NULL DEFAULT 'DRAFT' CHECK (verification_status IN ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUPERSEDED')),
    is_published_to_students BOOLEAN NOT NULL DEFAULT false,
    has_conflict BOOLEAN NOT NULL DEFAULT false,
    conflict_details JSONB,
    is_stale BOOLEAN NOT NULL DEFAULT false,
    stale_reason TEXT,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_recruitment_requirements_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_recruitment_requirements_company_composite FOREIGN KEY (tenant_id, company_id) REFERENCES public.companies(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_recruitment_requirements_tenant ON public.recruitment_requirements(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_requirements_drive ON public.recruitment_requirements(tenant_id, drive_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_requirements_category ON public.recruitment_requirements(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_recruitment_requirements_published ON public.recruitment_requirements(tenant_id, drive_id, is_published_to_students);

-- 5. Requirement-to-Skill Mappings Table
CREATE TABLE IF NOT EXISTS public.requirement_skill_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    requirement_id UUID NOT NULL REFERENCES public.recruitment_requirements(id) ON DELETE CASCADE,
    skill_id UUID NOT NULL REFERENCES public.canonical_skills(id) ON DELETE CASCADE,
    importance VARCHAR(32) NOT NULL DEFAULT 'RECOMMENDED' CHECK (importance IN ('MANDATORY', 'PREFERRED', 'RECOMMENDED')),
    mapping_rationale TEXT NOT NULL,
    mapping_origin VARCHAR(32) NOT NULL DEFAULT 'HUMAN_AUTHORED' CHECK (mapping_origin IN ('HUMAN_AUTHORED', 'AI_SUGGESTED', 'VERIFIED')),
    verification_status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (verification_status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')),
    evidence_level VARCHAR(32) NOT NULL DEFAULT 'INFERRED' CHECK (evidence_level IN ('OFFICIAL', 'REPORTED', 'INFERRED')),
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_req_skill_map_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_drive_req_skill UNIQUE (tenant_id, drive_id, requirement_id, skill_id)
);

CREATE INDEX IF NOT EXISTS idx_req_skill_mappings_drive ON public.requirement_skill_mappings(tenant_id, drive_id);
CREATE INDEX IF NOT EXISTS idx_req_skill_mappings_skill ON public.requirement_skill_mappings(skill_id);

-- 6. Student Preparation Plans Table
CREATE TABLE IF NOT EXISTS public.student_preparation_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    drive_id UUID NOT NULL REFERENCES public.recruitment_drives(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    target_completion_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_prep_plan_tenant_student_drive UNIQUE (tenant_id, student_id, drive_id),
    CONSTRAINT uq_prep_plan_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_prep_plan_student_composite FOREIGN KEY (tenant_id, student_id) REFERENCES public.students(tenant_id, id) ON DELETE CASCADE,
    CONSTRAINT fk_prep_plan_drive_composite FOREIGN KEY (tenant_id, drive_id) REFERENCES public.recruitment_drives(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prep_plans_tenant_student ON public.student_preparation_plans(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_prep_plans_drive ON public.student_preparation_plans(tenant_id, drive_id);

-- 7. Preparation Tasks Table
CREATE TABLE IF NOT EXISTS public.preparation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.student_preparation_plans(id) ON DELETE CASCADE,
    requirement_id UUID REFERENCES public.recruitment_requirements(id) ON DELETE SET NULL,
    skill_id UUID NOT NULL REFERENCES public.canonical_skills(id) ON DELETE CASCADE,
    resource_id UUID REFERENCES public.practice_resources(id) ON DELETE SET NULL,
    stage_id UUID REFERENCES public.drive_stages(id) ON DELETE SET NULL,
    title VARCHAR(256) NOT NULL,
    activity_type VARCHAR(64) NOT NULL CHECK (activity_type IN (
        'CONCEPT_REVIEW',
        'PRACTICE_DRILL',
        'MOCK_EXAM_PREPARATION',
        'CHECKLIST_ITEM'
    )),
    priority VARCHAR(32) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')),
    recommendation_rationale TEXT,
    due_date DATE,
    estimated_minutes INTEGER NOT NULL DEFAULT 30,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_prep_tasks_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_prep_tasks_plan_composite FOREIGN KEY (tenant_id, plan_id) REFERENCES public.student_preparation_plans(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prep_tasks_tenant_plan ON public.preparation_tasks(tenant_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_prep_tasks_status ON public.preparation_tasks(tenant_id, status);

-- 8. Historical Experience Reports Seam Table
CREATE TABLE IF NOT EXISTS public.recruitment_experience_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    drive_id UUID REFERENCES public.recruitment_drives(id) ON DELETE SET NULL,
    academic_year_id UUID REFERENCES public.academic_years(id) ON DELETE SET NULL,
    role_title VARCHAR(128) NOT NULL,
    recruitment_cycle VARCHAR(64) NOT NULL,
    report_origin VARCHAR(32) NOT NULL DEFAULT 'CANDIDATE_REPORTED' CHECK (report_origin IN ('CANDIDATE_REPORTED', 'COLLEGE_CONFIRMED')),
    rounds_described JSONB NOT NULL DEFAULT '[]',
    key_topics TEXT[] NOT NULL DEFAULT '{}',
    moderation_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    is_anonymous BOOLEAN NOT NULL DEFAULT true,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_exp_reports_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT fk_exp_reports_company_composite FOREIGN KEY (tenant_id, company_id) REFERENCES public.companies(tenant_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exp_reports_tenant_company ON public.recruitment_experience_reports(tenant_id, company_id);
CREATE INDEX IF NOT EXISTS idx_exp_reports_moderation ON public.recruitment_experience_reports(tenant_id, moderation_status);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable and force RLS on all 8 tables
ALTER TABLE public.canonical_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_skill_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_preparation_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preparation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_experience_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.canonical_skills FORCE ROW LEVEL SECURITY;
ALTER TABLE public.practice_resources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_requirements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.requirement_skill_mappings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.student_preparation_plans FORCE ROW LEVEL SECURITY;
ALTER TABLE public.preparation_tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recruitment_experience_reports FORCE ROW LEVEL SECURITY;

-- 1. Canonical Skills: Public read for authenticated users
CREATE POLICY p_canonical_skills_read ON public.canonical_skills
    FOR SELECT TO authenticated USING (true);

-- 2. Practice Resources: Public read for global or tenant-scoped
CREATE POLICY p_practice_resources_read ON public.practice_resources
    FOR SELECT TO authenticated
    USING (tenant_id IS NULL OR is_tenant_staff(tenant_id) OR EXISTS (
        SELECT 1 FROM public.students s WHERE s.tenant_id = practice_resources.tenant_id AND s.user_id = auth.uid()
    ));

CREATE POLICY p_practice_resources_staff_write ON public.practice_resources
    FOR ALL TO authenticated
    USING (tenant_id IS NOT NULL AND is_tenant_staff(tenant_id))
    WITH CHECK (tenant_id IS NOT NULL AND is_tenant_staff(tenant_id));

-- 3. Recruitment Sources: Staff full access, Student read only if PUBLIC and verified
CREATE POLICY p_recruitment_sources_staff ON public.recruitment_sources
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_recruitment_sources_student_read ON public.recruitment_sources
    FOR SELECT TO authenticated
    USING (
        access_classification = 'PUBLIC'
        AND verification_status = 'VERIFIED'
        AND EXISTS (
            SELECT 1 FROM public.students s WHERE s.tenant_id = recruitment_sources.tenant_id AND s.user_id = auth.uid()
        )
    );

-- 4. Recruitment Requirements: Staff full access, Student read if published & verified
CREATE POLICY p_recruitment_requirements_staff ON public.recruitment_requirements
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_recruitment_requirements_student_read ON public.recruitment_requirements
    FOR SELECT TO authenticated
    USING (
        is_published_to_students = true
        AND verification_status = 'VERIFIED'
        AND EXISTS (
            SELECT 1 FROM public.students s WHERE s.tenant_id = recruitment_requirements.tenant_id AND s.user_id = auth.uid()
        )
    );

-- 5. Requirement-to-Skill Mappings: Staff full access, Student read if drive requirements are accessible
CREATE POLICY p_req_skill_mappings_staff ON public.requirement_skill_mappings
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_req_skill_mappings_student_read ON public.requirement_skill_mappings
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s WHERE s.tenant_id = requirement_skill_mappings.tenant_id AND s.user_id = auth.uid()
        )
    );

-- 6. Student Preparation Plans: Staff can view; Students have full access to their own plan
CREATE POLICY p_prep_plans_staff ON public.student_preparation_plans
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_prep_plans_student ON public.student_preparation_plans
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_preparation_plans.student_id
              AND s.tenant_id = student_preparation_plans.tenant_id
              AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = student_preparation_plans.student_id
              AND s.tenant_id = student_preparation_plans.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- 7. Preparation Tasks: Staff can view; Students can update/read their own tasks
CREATE POLICY p_prep_tasks_staff ON public.preparation_tasks
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_prep_tasks_student ON public.preparation_tasks
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.student_preparation_plans p
            JOIN public.students s ON s.id = p.student_id
            WHERE p.id = preparation_tasks.plan_id
              AND p.tenant_id = preparation_tasks.tenant_id
              AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.student_preparation_plans p
            JOIN public.students s ON s.id = p.student_id
            WHERE p.id = preparation_tasks.plan_id
              AND p.tenant_id = preparation_tasks.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- 8. Experience Reports: Staff full access, Student submit own & read approved
CREATE POLICY p_exp_reports_staff ON public.recruitment_experience_reports
    FOR ALL TO authenticated
    USING (is_tenant_staff(tenant_id))
    WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY p_exp_reports_student_read ON public.recruitment_experience_reports
    FOR SELECT TO authenticated
    USING (
        moderation_status = 'APPROVED'
        AND EXISTS (
            SELECT 1 FROM public.students s WHERE s.tenant_id = recruitment_experience_reports.tenant_id AND s.user_id = auth.uid()
        )
    );

CREATE POLICY p_exp_reports_student_insert ON public.recruitment_experience_reports
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.id = recruitment_experience_reports.student_id
              AND s.tenant_id = recruitment_experience_reports.tenant_id
              AND s.user_id = auth.uid()
        )
    );

-- ==============================================================================
-- SEED DATA: Standard Canonical Skills Taxonomy & Common Practice Resources
-- ==============================================================================

INSERT INTO public.canonical_skills (name, normalized_name, category, description, tags)
VALUES
    ('Data Structures & Algorithms', 'dsa', 'DATA_STRUCTURES_ALGORITHMS', 'Core arrays, linked lists, trees, graphs, dynamic programming, and algorithmic problem solving.', ARRAY['arrays', 'trees', 'graphs', 'dp', 'algorithms']),
    ('Quantitative Aptitude', 'quantitative-aptitude', 'QUANTITATIVE_APTITUDE', 'Numerical calculations, percentages, profit & loss, time & work, permutations, and probability.', ARRAY['math', 'arithmetic', 'quant', 'speed-math']),
    ('Logical Reasoning', 'logical-reasoning', 'LOGICAL_REASONING', 'Deductive reasoning, seating arrangements, blood relations, syllogisms, and pattern recognition.', ARRAY['logic', 'puzzles', 'reasoning']),
    ('Verbal Ability & Reading Comprehension', 'verbal-ability', 'VERBAL_ABILITY', 'Grammar, vocabulary, reading comprehension, sentence completion, and communication clarity.', ARRAY['english', 'reading', 'vocabulary', 'grammar']),
    ('Database Management Systems (SQL)', 'dbms', 'DATABASE_MANAGEMENT', 'Relational database schema design, normalization, SQL queries, indexing, and ACID transactions.', ARRAY['sql', 'rdbms', 'indexes', 'transactions']),
    ('Operating Systems Fundamentals', 'operating-systems', 'OPERATING_SYSTEMS', 'Processes, threads, CPU scheduling, synchronization, deadlocks, and virtual memory.', ARRAY['os', 'concurrency', 'memory', 'threads']),
    ('Computer Networks', 'computer-networks', 'COMPUTER_NETWORKS', 'OSI/TCP-IP models, routing protocols, DNS, HTTP/HTTPS, TCP flow control, and network security.', ARRAY['networking', 'tcp-ip', 'http', 'protocols']),
    ('Object-Oriented Programming (OOP)', 'oop', 'OBJECT_ORIENTED_PROGRAMMING', 'Encapsulation, inheritance, polymorphism, abstraction, design patterns, and SOLID principles.', ARRAY['oop', 'design-patterns', 'classes', 'solid']),
    ('System Design & Architecture', 'system-design', 'SYSTEM_DESIGN', 'High-level architecture, scalability, load balancing, caching, microservices, and database partitioning.', ARRAY['architecture', 'scalability', 'microservices']),
    ('Behavioral & HR Interviewing', 'behavioral-hr', 'BEHAVIORAL_HR', 'STAR methodology, leadership principles, conflict resolution, career motivations, and situational questions.', ARRAY['behavioral', 'hr', 'star-method', 'soft-skills'])
ON CONFLICT (normalized_name) DO NOTHING;

-- Seed core practice resources linked to the canonical skills
INSERT INTO public.practice_resources (skill_id, title, resource_type, content_class, url, description, estimated_minutes)
SELECT 
    id, 
    'Core ' || name || ' Mastery Outline', 
    'SYLLABUS_OUTLINE', 
    'NEWLY_AUTHORED_PRACTICE', 
    null, 
    'Comprehensive syllabus breakdown and recommended key concepts for ' || name, 
    45
FROM public.canonical_skills
ON CONFLICT DO NOTHING;
