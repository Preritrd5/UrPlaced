-- ==============================================================================
-- UrPlaced Migration: Phase 18 — Enforce Global Single-College Ownership
-- Architecture Invariant: ONE PERSON = ONE COLLEGE ONLY
-- Every individual (PLACEMENT_HEAD, PLACEMENT_STAFF, TRAINER, STUDENT) belongs
-- to exactly ONE college across the entire application.
-- ==============================================================================

-- 1. Enforce global single-college ownership on tenant_memberships
-- A user can belong to at most one institution platform-wide.
DO $$
BEGIN
    -- Ensure composite unique constraint on (tenant_id, user_id) exists for foreign keys and ON CONFLICT targets
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_tenant_memberships_tenant_user' 
        AND conrelid = 'public.tenant_memberships'::regclass
    ) THEN
        ALTER TABLE public.tenant_memberships ADD CONSTRAINT uq_tenant_memberships_tenant_user UNIQUE (tenant_id, user_id);
    END IF;

    -- Add global unique constraint on user_id if not already present
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uq_tenant_memberships_user_id' 
        AND conrelid = 'public.tenant_memberships'::regclass
    ) THEN
        ALTER TABLE public.tenant_memberships ADD CONSTRAINT uq_tenant_memberships_user_id UNIQUE (user_id);
    END IF;
END $$;

-- 2. Prevent concurrent pending invitations for the same email across different colleges
CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_single_pending_email
    ON public.invitations (LOWER(TRIM(email)))
    WHERE status = 'PENDING';

-- 3. Enforce single-college ownership for students
-- Ensure unique index on students(user_id) where user_id is not null
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_single_user_ownership
    ON public.students (user_id)
    WHERE user_id IS NOT NULL;

-- 4. Cross-Table Student Ownership Consistency Enforcement
-- Guarantees that a student's `public.students` record and their authenticated
-- `public.tenant_memberships` record always reference the exact same college (tenant_id).

-- 4a. Composite Foreign Key Constraint
-- Matches when user_id is NOT NULL. When user_id is NULL (unclaimed roster records),
-- standard PostgreSQL MATCH SIMPLE satisfies the constraint automatically.
-- DEFERRABLE INITIALLY DEFERRED allows multi-statement procedures (like claim_student_roster)
-- to execute updates and inserts in atomic order and validates at transaction commit.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_students_membership_tenant_consistency'
        AND conrelid = 'public.students'::regclass
    ) THEN
        ALTER TABLE public.students
            ADD CONSTRAINT fk_students_membership_tenant_consistency
            FOREIGN KEY (tenant_id, user_id)
            REFERENCES public.tenant_memberships (tenant_id, user_id)
            ON DELETE SET NULL (user_id)
            DEFERRABLE INITIALLY DEFERRED;
    END IF;
END $$;

-- 4b. Strict Cross-Table Consistency Triggers
CREATE OR REPLACE FUNCTION public.check_student_membership_tenant_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Check when public.students is inserted or updated with a claimed user_id
    IF TG_TABLE_NAME = 'students' THEN
        IF NEW.user_id IS NOT NULL THEN
            IF EXISTS (
                SELECT 1 FROM public.tenant_memberships tm
                WHERE tm.user_id = NEW.user_id
                  AND tm.tenant_id != NEW.tenant_id
            ) THEN
                RAISE EXCEPTION 'Cross-college student ownership violation: student record college (%) does not match membership college for user %',
                    NEW.tenant_id, NEW.user_id;
            END IF;
        END IF;
    END IF;

    -- Check when public.tenant_memberships is inserted or updated
    IF TG_TABLE_NAME = 'tenant_memberships' THEN
        IF EXISTS (
            SELECT 1 FROM public.students s
            WHERE s.user_id = NEW.user_id
              AND s.tenant_id != NEW.tenant_id
        ) THEN
            RAISE EXCEPTION 'Cross-college student ownership violation: membership college (%) does not match student record college for user %',
                NEW.tenant_id, NEW.user_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_tenant_consistency ON public.students;
CREATE TRIGGER trg_student_tenant_consistency
    BEFORE INSERT OR UPDATE OF tenant_id, user_id ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.check_student_membership_tenant_consistency();

DROP TRIGGER IF EXISTS trg_membership_tenant_consistency ON public.tenant_memberships;
CREATE TRIGGER trg_membership_tenant_consistency
    BEFORE INSERT OR UPDATE OF tenant_id, user_id ON public.tenant_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.check_student_membership_tenant_consistency();
