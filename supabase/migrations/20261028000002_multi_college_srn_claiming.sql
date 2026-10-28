-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 17 Migration: Multi-College SRN Signup, Roster Claiming & Tenant Resolution
-- ==============================================================================
-- Under public.students, the uniqueness constraint is:
--   CONSTRAINT uq_students_tenant_enrollment UNIQUE (tenant_id, enrollment_number)
-- This allows different colleges to legitimately have students with identical SRNs.
--
-- The previous procedure:
--   public.claim_student_roster(p_srn, p_user_id, p_full_name, p_email)
-- performed a global check:
--   SELECT COUNT(*) ... WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn) AND s.user_id IS NOT NULL
-- without tenant scoping. If College A claimed an SRN, any student in College B
-- with the same SRN was rejected as ALREADY_CLAIMED, even though College B had
-- an active, unclaimed roster record.
--
-- This migration updates public.claim_student_roster to:
-- 1. Accept an optional p_tenant_id parameter (default NULL).
-- 2. When p_tenant_id IS NOT NULL, isolate claiming strictly to that college.
-- 3. When p_tenant_id IS NULL:
--    - If distinct matching tenants > 1, fail safely with AMBIGUOUS_SRN.
--    - If distinct matching tenants = 1, claim that institution's record.
-- 4. Preserve all data-preservation, role-conflict, and suspended-membership guards.
-- ==============================================================================

-- Drop legacy overload signatures to prevent PostgreSQL RPC resolution ambiguity
DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID);
DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.claim_student_roster(
    p_srn TEXT,
    p_user_id UUID,
    p_full_name TEXT,
    p_email TEXT,
    p_tenant_id UUID DEFAULT NULL
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
#variable_conflict use_column
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
    -- 1. Preflight Validations: All core inputs must be non-empty and well-formed
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
            -- If tenant_id was specified, ensure it matches the user's existing claim's tenant
            IF p_tenant_id IS NOT NULL AND v_user_existing_claim.tenant_id != p_tenant_id THEN
                RETURN QUERY SELECT
                    false,
                    'TENANT_MISMATCH'::TEXT,
                    'This account is already associated with another college.'::TEXT,
                    v_user_existing_claim.id,
                    v_user_existing_claim.tenant_id,
                    v_user_existing_claim.enrollment_number::TEXT;
                RETURN;
            END IF;

            RETURN QUERY SELECT
                true,
                'CLAIMED_SUCCESSFULLY'::TEXT,
                'Roster record already linked to student account.'::TEXT,
                v_user_existing_claim.id,
                v_user_existing_claim.tenant_id,
                v_user_existing_claim.enrollment_number::TEXT;
            RETURN;
        ELSE
            -- User already linked to a DIFFERENT student record: reject strictly
            RETURN QUERY SELECT
                false,
                'USER_ALREADY_HAS_ROSTER'::TEXT,
                'This account is already linked to student record ' || v_user_existing_claim.enrollment_number || '.'::TEXT,
                v_user_existing_claim.id,
                v_user_existing_claim.tenant_id,
                v_user_existing_claim.enrollment_number::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 3. Tenant Scoped or Global Resolution & Locking
    IF p_tenant_id IS NOT NULL THEN
        -- Case A: Tenant context provided. Check only within the specified college.
        -- Check if already claimed in this college:
        SELECT COUNT(*)
        INTO v_already_claimed_count
        FROM public.students s
        WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
          AND s.tenant_id = p_tenant_id
          AND s.user_id IS NOT NULL;

        IF v_already_claimed_count > 0 THEN
            RETURN QUERY SELECT false, 'ALREADY_CLAIMED'::TEXT, 'This Student Registration Number (SRN) has already been claimed by a registered account in this college.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;

        -- Lock the target unclaimed record in this college
        SELECT s.id, s.tenant_id, s.enrollment_number
        INTO v_target_student
        FROM public.students s
        WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
          AND s.tenant_id = p_tenant_id
          AND s.user_id IS NULL
          AND s.is_archived = false
          AND s.academic_status = 'ACTIVE'
        LIMIT 1
        FOR UPDATE;

        IF v_target_student.id IS NULL THEN
            RETURN QUERY SELECT false, 'SRN_NOT_FOUND'::TEXT, 'No active, eligible student roster record found for the provided SRN in the selected college.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;
    ELSE
        -- Case B: No tenant context provided. Resolve globally with fail-closed ambiguity check.
        SELECT COUNT(DISTINCT s.tenant_id)
        INTO v_match_count
        FROM public.students s
        WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
          AND s.is_archived = false
          AND s.academic_status = 'ACTIVE';

        IF v_match_count = 0 THEN
            RETURN QUERY SELECT false, 'SRN_NOT_FOUND'::TEXT, 'No active, eligible student roster record found for the provided SRN.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        ELSIF v_match_count > 1 THEN
            -- Multiple colleges share this SRN: reject safely without selecting an arbitrary institution
            RETURN QUERY SELECT false, 'AMBIGUOUS_SRN'::TEXT, 'This SRN matches multiple institutional rosters. Please select your college.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;

        -- Single institution matches. Check if claimed in that institution:
        SELECT COUNT(*)
        INTO v_already_claimed_count
        FROM public.students s
        WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
          AND s.user_id IS NOT NULL;

        IF v_already_claimed_count > 0 THEN
            RETURN QUERY SELECT false, 'ALREADY_CLAIMED'::TEXT, 'This Student Registration Number (SRN) has already been claimed by a registered account.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;

        -- Lock the single unambiguous roster record
        SELECT s.id, s.tenant_id, s.enrollment_number
        INTO v_target_student
        FROM public.students s
        WHERE UPPER(TRIM(s.enrollment_number)) = UPPER(v_clean_srn)
          AND s.user_id IS NULL
          AND s.is_archived = false
          AND s.academic_status = 'ACTIVE'
        LIMIT 1
        FOR UPDATE;

        IF v_target_student.id IS NULL THEN
            RETURN QUERY SELECT false, 'SRN_NOT_FOUND'::TEXT, 'No active, eligible student roster record found for the provided SRN.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 4. Guard Against Overwriting Privileged Roles or Conflicting Memberships
    -- Multi-tenant membership safety: user may hold multiple rows across different tenants.
    
    -- 4a. Prioritized Guard: Check if the user holds an administrative or staff role in ANY institution
    -- Prevents an arbitrary STUDENT record in one tenant from masking an institutional role in another.
    SELECT tm.tenant_id, tm.role, tm.status
    INTO v_existing_membership
    FROM public.tenant_memberships tm
    WHERE tm.user_id = p_user_id
      AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
    LIMIT 1;

    IF v_existing_membership.tenant_id IS NOT NULL THEN
        RETURN QUERY SELECT false, 'ROLE_CONFLICT'::TEXT, 'This account already holds an administrative or staff role (' || v_existing_membership.role || ') and cannot claim a student roster record.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 4b. Check status of user's membership specifically within the TARGET institution
    SELECT tm.tenant_id, tm.role, tm.status
    INTO v_existing_membership
    FROM public.tenant_memberships tm
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id = v_target_student.tenant_id;

    IF v_existing_membership.tenant_id IS NOT NULL THEN
        -- Never un-suspend or reactivate banned memberships
        IF v_existing_membership.status IN ('SUSPENDED', 'REVOKED') THEN
            RETURN QUERY SELECT false, 'MEMBERSHIP_SUSPENDED'::TEXT, 'This user membership is suspended or revoked in this institution.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 4c. Check if the user already holds a membership in ANOTHER college
    SELECT tm.tenant_id, tm.role, tm.status
    INTO v_existing_membership
    FROM public.tenant_memberships tm
    WHERE tm.user_id = p_user_id
      AND tm.tenant_id != v_target_student.tenant_id
    LIMIT 1;

    IF v_existing_membership.tenant_id IS NOT NULL THEN
        RETURN QUERY SELECT false, 'TENANT_MISMATCH'::TEXT, 'This account is already associated with another college.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 5. Execute atomic claim on the roster record in a SINGLE statement
    -- CRITICAL DATA INTEGRITY:
    -- Official roster full_name, email, and academic attributes (cgpa, department_id,
    -- graduation_year, etc.) are strictly preserved untouched. Only user_id and claim
    -- timestamps are updated.
    UPDATE public.students AS st
    SET user_id = p_user_id,
        claimed_at = now(),
        updated_at = now()
    WHERE st.id = v_target_student.id
      AND st.user_id IS NULL;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 'CONCURRENT_CLAIM_CONFLICT'::TEXT, 'This student record was claimed concurrently by another request.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 6. Establish or update tenant membership safely
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

    -- 7. Return success payload
    RETURN QUERY SELECT
        true,
        'CLAIMED_SUCCESSFULLY'::TEXT,
        'Roster record successfully claimed and linked to student account.'::TEXT,
        v_target_student.id,
        v_target_student.tenant_id,
        v_target_student.enrollment_number::TEXT;
END;
$$;

-- Set Owner to postgres (if role exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
        ALTER FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) OWNER TO postgres;
    END IF;
END $$;

-- Secure Execution Grants
-- REVOKE from public and authenticated users to prevent direct client-side execution.
-- GRANT EXECUTE exclusively to service_role for secure server-side invocation.
REVOKE EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID, TEXT, TEXT, UUID) TO postgres;

-- Notify PostgREST to immediately reload schema cache
NOTIFY pgrst, 'reload schema';
