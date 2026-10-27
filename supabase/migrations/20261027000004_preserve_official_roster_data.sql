-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 15 Migration: Preserve Official Student Roster Data During SRN Claiming
-- ==============================================================================

-- 1. Ensure any legacy or previous signatures are dropped cleanly
DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID);
DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID, TEXT, TEXT);

-- 2. Hardened Canonical Transactional Procedure: claim_student_roster
--
-- CRITICAL DATA INTEGRITY ARCHITECTURE:
-- In UrPlaced's college placement-management system:
--   - public.students represents the authoritative institutional roster imported
--     by the Placement Head. It stores the student's official institutional name,
--     official college email, SRN (enrollment_number), department, degree, batch,
--     CGPA, percentages, backlogs, skills, and academic eligibility data.
--   - public.profiles represents the student's personal account profile created
--     during signup, containing the student's personal signup name and email.
--
-- THIS PROCEDURE:
--   - Atomically binds the authenticated Student account (p_user_id) to the
--     single matching, unclaimed, active roster record by normalized SRN.
--   - NEVER modifies public.students.full_name or public.students.email.
--   - Updates only legitimate claim/linkage attributes: user_id, claimed_at, updated_at.
--   - Preserves all academic records, institutional identifiers, and tenant associations.
--   - Safely handles same-account retries idempotently without modifying roster data.
--   - Strictly rejects attempts by an account to claim a second record or another student's record.
--   - Establishes tenant_memberships atomically within the same transaction.
--   - Enforces multi-tenant role protections (cannot overwrite or demote staff/admin roles).
--   - Uses row locking (FOR UPDATE) to prevent concurrent claim collisions.
--   - Uses SECURITY DEFINER with fixed search_path = public, pg_temp.
--   - Restricts execution strictly to trusted server-side service_role.
--
CREATE OR REPLACE FUNCTION public.claim_student_roster(
    p_srn TEXT,
    p_user_id UUID,
    p_full_name TEXT,
    p_email TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    code TEXT,
    message TEXT,
    student_id UUID,
    tenant_id UUID,
    enrollment_number TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_clean_srn TEXT;
    v_clean_name TEXT;
    v_clean_email TEXT;
    v_match_count INTEGER;
    v_already_claimed_count INTEGER;
    v_target_student RECORD;
    v_user_existing_claim RECORD;
    v_existing_membership RECORD;
BEGIN
    -- 1. Preflight Validations: All inputs must be non-empty and well-formed
    v_clean_srn := TRIM(p_srn);
    IF v_clean_srn IS NULL OR v_clean_srn = '' THEN
        RETURN QUERY SELECT false, 'INVALID_SRN'::TEXT, 'Student Registration Number (SRN) cannot be empty.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'INVALID_USER'::TEXT, 'Authenticated user ID is required.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    v_clean_name := NULLIF(TRIM(p_full_name), '');
    IF v_clean_name IS NULL OR v_clean_name = '' THEN
        RETURN QUERY SELECT false, 'INVALID_NAME'::TEXT, 'Full name is required to claim a student roster record.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    v_clean_email := NULLIF(LOWER(TRIM(p_email)), '');
    IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email NOT LIKE '%_@__%.__%' THEN
        RETURN QUERY SELECT false, 'INVALID_EMAIL'::TEXT, 'A valid email address is required to claim a student roster record.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 2. Separately Guarded Same-Account Retry Path
    -- Check if this authenticated user already holds a claimed student record
    SELECT s.id, s.tenant_id, s.enrollment_number, s.user_id, s.full_name, s.email
    INTO v_user_existing_claim
    FROM public.students s
    WHERE s.user_id = p_user_id
    LIMIT 1;

    IF v_user_existing_claim.id IS NOT NULL THEN
        -- If user already claimed this exact same SRN, confirm idempotently.
        -- CRITICAL: Roster full_name and email are NOT modified.
        IF UPPER(TRIM(v_user_existing_claim.enrollment_number)) = UPPER(v_clean_srn) THEN
            RETURN QUERY SELECT
                true,
                'CLAIMED_SUCCESSFULLY'::TEXT,
                'Roster record already linked to student account.'::TEXT,
                v_user_existing_claim.id,
                v_user_existing_claim.tenant_id,
                v_user_existing_claim.enrollment_number;
            RETURN;
        ELSE
            -- User already linked to a DIFFERENT student record: reject strictly
            RETURN QUERY SELECT
                false,
                'USER_ALREADY_HAS_ROSTER'::TEXT,
                'This account is already linked to student record ' || v_user_existing_claim.enrollment_number || '.'::TEXT,
                v_user_existing_claim.id,
                v_user_existing_claim.tenant_id,
                v_user_existing_claim.enrollment_number;
            RETURN;
        END IF;
    END IF;

    -- 3. Hijacking Protection: Check if this SRN is claimed by ANY OTHER account
    SELECT COUNT(*)
    INTO v_already_claimed_count
    FROM public.students s
    WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
      AND s.user_id IS NOT NULL;

    IF v_already_claimed_count > 0 THEN
        RETURN QUERY SELECT false, 'ALREADY_CLAIMED'::TEXT, 'This Student Registration Number (SRN) has already been claimed by a registered account.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 4. Find all eligible unclaimed matching records
    -- Must be unclaimed (user_id IS NULL), active (academic_status = 'ACTIVE'), and not archived
    SELECT COUNT(*)
    INTO v_match_count
    FROM public.students s
    WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
      AND s.user_id IS NULL
      AND s.is_archived = false
      AND s.academic_status = 'ACTIVE';

    IF v_match_count = 0 THEN
        RETURN QUERY SELECT false, 'SRN_NOT_FOUND'::TEXT, 'No active, eligible student roster record found for the provided SRN.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    ELSIF v_match_count > 1 THEN
        -- Ambiguous SRN match across colleges: reject safely without selecting an arbitrary institution
        RETURN QUERY SELECT false, 'AMBIGUOUS_SRN'::TEXT, 'This SRN matches multiple institutional rosters. Please contact your college placement cell.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 5. Lock the single unambiguous roster record
    SELECT s.id, s.tenant_id, s.enrollment_number
    INTO v_target_student
    FROM public.students s
    WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
      AND s.user_id IS NULL
      AND s.is_archived = false
      AND s.academic_status = 'ACTIVE'
    FOR UPDATE;

    IF v_target_student.id IS NULL THEN
        RETURN QUERY SELECT false, 'CLAIM_FAILED'::TEXT, 'Unable to lock roster record. Please try again.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 6. Guard Against Overwriting Privileged Roles or Conflicting Memberships
    SELECT tm.tenant_id, tm.role, tm.status
    INTO v_existing_membership
    FROM public.tenant_memberships tm
    WHERE tm.user_id = p_user_id
    LIMIT 1;

    IF v_existing_membership.tenant_id IS NOT NULL THEN
        -- Never overwrite or demote staff, placement officers, or admins
        IF v_existing_membership.role != 'STUDENT' THEN
            RETURN QUERY SELECT false, 'ROLE_CONFLICT'::TEXT, 'This account already holds an administrative or staff role (' || v_existing_membership.role || ') and cannot claim a student roster record.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;

        -- Never un-suspend or reactivate banned memberships
        IF v_existing_membership.status IN ('SUSPENDED', 'REVOKED') THEN
            RETURN QUERY SELECT false, 'MEMBERSHIP_SUSPENDED'::TEXT, 'This user membership is suspended or revoked in this institution.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;

        -- Never associate an account already belonging to another college
        IF v_existing_membership.tenant_id != v_target_student.tenant_id THEN
            RETURN QUERY SELECT false, 'TENANT_MISMATCH'::TEXT, 'This account is already associated with another college.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 7. Execute atomic claim on the roster record in a SINGLE statement
    -- CRITICAL DATA INTEGRITY:
    -- Official roster full_name, email, and academic attributes (cgpa, department_id,
    -- graduation_year, etc.) are strictly preserved untouched. Only user_id and claim
    -- timestamps are updated.
    UPDATE public.students
    SET user_id = p_user_id,
        claimed_at = now(),
        updated_at = now()
    WHERE id = v_target_student.id
      AND user_id IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'CONCURRENT_CLAIM_CONFLICT'::TEXT, 'This student record was claimed concurrently by another request.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 8. Establish or update tenant membership safely
    -- Will never overwrite a non-student role or reactivate suspended/revoked users
    INSERT INTO public.tenant_memberships (
        tenant_id,
        user_id,
        role,
        status,
        permissions
    )
    VALUES (
        v_target_student.tenant_id,
        p_user_id,
        'STUDENT',
        'ACTIVE',
        '[]'::jsonb
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET status = 'ACTIVE',
        updated_at = now()
    WHERE tenant_memberships.role = 'STUDENT'
      AND tenant_memberships.status != 'REVOKED'
      AND tenant_memberships.status != 'SUSPENDED';

    -- 9. Return success payload
    RETURN QUERY SELECT
        true,
        'CLAIMED_SUCCESSFULLY'::TEXT,
        'Roster record successfully claimed and linked to student account.'::TEXT,
        v_target_student.id,
        v_target_student.tenant_id,
        v_target_student.enrollment_number;
END;
$$;

-- 3. Set Owner to postgres (if role exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        ALTER FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) OWNER TO postgres;
    END IF;
END $$;

-- 4. Restrict Execution Permissions:
-- Deny public, anonymous, and authenticated execution from the browser.
-- Strictly restrict execution to the trusted server-side service_role.
REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT) TO service_role;
