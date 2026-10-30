-- ==============================================================================
-- UrPlaced Migration: Phase 19 — Correct Student Composite Foreign Key & Role Consistency
-- 1. Correct composite foreign key on students(tenant_id, user_id) to use
--    PostgreSQL 15+ syntax: ON DELETE SET NULL (user_id) so that only user_id
--    is cleared and students.tenant_id remains untouched.
-- 2. Add BEFORE DELETE trigger on tenant_memberships to explicitly decouple
--    claimed student records while preserving college roster ownership.
-- 3. Enforce strict role consistency: student records can ONLY be linked to
--    memberships with role = 'STUDENT'. Administrative/staff roles are blocked.
-- ==============================================================================

-- 1. Replace composite foreign key with column-specific ON DELETE SET NULL (user_id)
DO $$
BEGIN
    -- Drop old constraint if present
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_students_membership_tenant_consistency'
        AND conrelid = 'public.students'::regclass
    ) THEN
        ALTER TABLE public.students DROP CONSTRAINT fk_students_membership_tenant_consistency;
    END IF;

    -- Add corrected constraint specifying (user_id) as the target of SET NULL
    ALTER TABLE public.students
        ADD CONSTRAINT fk_students_membership_tenant_consistency
        FOREIGN KEY (tenant_id, user_id)
        REFERENCES public.tenant_memberships (tenant_id, user_id)
        ON DELETE SET NULL (user_id)
        DEFERRABLE INITIALLY DEFERRED;
END $$;

-- 2. Explicit Deletion Trigger on tenant_memberships
-- Ensures that when a membership is deleted, the student roster row is cleanly
-- unlinked (user_id = NULL, claimed_at = NULL) while preserving its tenant_id.
CREATE OR REPLACE FUNCTION public.handle_student_membership_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE public.students
    SET user_id = NULL,
        claimed_at = NULL,
        updated_at = now()
    WHERE user_id = OLD.user_id
      AND tenant_id = OLD.tenant_id;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_membership_deletion ON public.tenant_memberships;
CREATE TRIGGER trg_student_membership_deletion
    BEFORE DELETE ON public.tenant_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_student_membership_deletion();

-- 3. Enforce Student Role Consistency & College Boundary
CREATE OR REPLACE FUNCTION public.check_student_membership_consistency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_membership RECORD;
    v_student RECORD;
BEGIN
    -- Check when public.students is inserted or updated with a claimed user_id
    IF TG_TABLE_NAME = 'students' THEN
        IF NEW.user_id IS NOT NULL THEN
            SELECT tm.tenant_id, tm.role, tm.status
            INTO v_membership
            FROM public.tenant_memberships tm
            WHERE tm.user_id = NEW.user_id;

            IF v_membership.tenant_id IS NOT NULL THEN
                -- 1. College matching verification
                IF v_membership.tenant_id != NEW.tenant_id THEN
                    RAISE EXCEPTION 'Cross-college student ownership violation: student record college (%) does not match membership college (%) for user %',
                        NEW.tenant_id, v_membership.tenant_id, NEW.user_id;
                END IF;

                -- 2. Role consistency verification: ONLY 'STUDENT' role can be linked to a student record
                IF v_membership.role != 'STUDENT' THEN
                    RAISE EXCEPTION 'Student role violation: Account with role % cannot be linked to a student roster record (user %)',
                        v_membership.role, NEW.user_id;
                END IF;
            END IF;
        END IF;
    END IF;

    -- Check when public.tenant_memberships is inserted or updated
    IF TG_TABLE_NAME = 'tenant_memberships' THEN
        SELECT s.id, s.tenant_id, s.enrollment_number
        INTO v_student
        FROM public.students s
        WHERE s.user_id = NEW.user_id;

        IF v_student.id IS NOT NULL THEN
            -- 1. College matching verification
            IF v_student.tenant_id != NEW.tenant_id THEN
                RAISE EXCEPTION 'Cross-college student ownership violation: membership college (%) does not match student record college (%) for user %',
                    NEW.tenant_id, v_student.tenant_id, NEW.user_id;
            END IF;

            -- 2. Role consistency verification: cannot assign non-STUDENT role to a claimed student account
            IF NEW.role != 'STUDENT' THEN
                RAISE EXCEPTION 'Student role violation: Membership with role % cannot be assigned to an account linked to student roster record % (user %)',
                    NEW.role, v_student.enrollment_number, NEW.user_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_student_tenant_consistency ON public.students;
CREATE TRIGGER trg_student_tenant_consistency
    BEFORE INSERT OR UPDATE OF tenant_id, user_id ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.check_student_membership_consistency();

DROP TRIGGER IF EXISTS trg_membership_tenant_consistency ON public.tenant_memberships;
CREATE TRIGGER trg_membership_tenant_consistency
    BEFORE INSERT OR UPDATE OF tenant_id, user_id, role ON public.tenant_memberships
    FOR EACH ROW
    EXECUTE FUNCTION public.check_student_membership_consistency();
