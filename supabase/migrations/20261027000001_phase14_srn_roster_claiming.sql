-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 14 Migration: Secure SRN-Based Student Roster Claiming & 1:1 Account Binding
-- ==============================================================================

-- 1. Additive Column: claimed_at on public.students
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'students'
          AND column_name = 'claimed_at'
    ) THEN
        ALTER TABLE public.students ADD COLUMN claimed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Partial Unique Index: uq_students_user_id
-- Guarantees that at most one student roster record can be bound to any given Auth account
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_user_id
ON public.students (user_id)
WHERE user_id IS NOT NULL;

-- 3. Fast Normalized Identifier Index: idx_students_normalized_enrollment
-- Supports case-insensitive, whitespace-trimmed deterministic SRN lookups
CREATE INDEX IF NOT EXISTS idx_students_normalized_enrollment
ON public.students (UPPER(TRIM(enrollment_number)));

-- 4. Secure Transactional Function: claim_student_roster
-- Atomically matches an eligible unclaimed roster record by normalized SRN,
-- locks the record against concurrent claims, associates it with the authenticated Student account,
-- and establishes the student's institutional membership in tenant_memberships.
CREATE OR REPLACE FUNCTION public.claim_student_roster(
    p_srn TEXT,
    p_user_id UUID
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
SET search_path = public, auth
AS $$
DECLARE
    v_clean_srn TEXT;
    v_match_count INTEGER;
    v_already_claimed_count INTEGER;
    v_target_student RECORD;
    v_user_existing_claim RECORD;
BEGIN
    -- 1. Validate inputs
    v_clean_srn := TRIM(p_srn);
    IF v_clean_srn IS NULL OR v_clean_srn = '' THEN
        RETURN QUERY SELECT false, 'INVALID_SRN'::TEXT, 'Student Registration Number (SRN) cannot be empty.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    IF p_user_id IS NULL THEN
        RETURN QUERY SELECT false, 'INVALID_USER'::TEXT, 'Authenticated user ID is required.'::TEXT, NULL::UUID, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- 2. Enforce 1:1 Account-to-Roster Invariant:
    -- Check if this user account has already claimed another roster record
    SELECT s.id, s.tenant_id, s.enrollment_number
    INTO v_user_existing_claim
    FROM public.students s
    WHERE s.user_id = p_user_id
    LIMIT 1;

    IF v_user_existing_claim.id IS NOT NULL THEN
        RETURN QUERY SELECT false, 'USER_ALREADY_HAS_ROSTER'::TEXT, 'This account is already linked to student record ' || v_user_existing_claim.enrollment_number || '.'::TEXT, v_user_existing_claim.id, v_user_existing_claim.tenant_id, v_user_existing_claim.enrollment_number;
        RETURN;
    END IF;

    -- 3. Check if this SRN is already claimed by any account
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

    -- 5. Lock and claim the single unambiguous roster record
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

    -- 6. Execute atomic claim on the roster record
    -- NOTE: Academic attributes, full_name, and email are strictly preserved unchanged
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

    -- 7. Establish College Membership in tenant_memberships
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
    SET role = 'STUDENT',
        status = 'ACTIVE',
        updated_at = now();

    -- 8. Return success payload
    RETURN QUERY SELECT
        true,
        'CLAIMED_SUCCESSFULLY'::TEXT,
        'Roster record successfully claimed and linked to student account.'::TEXT,
        v_target_student.id,
        v_target_student.tenant_id,
        v_target_student.enrollment_number;
END;
$$;

-- 5. Restrict Execution Permissions
-- Deny public / anonymous execution; only authenticated users and service_role may execute
REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_student_roster(TEXT, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_student_roster(TEXT, UUID) TO service_role;
