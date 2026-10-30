-- ==============================================================================
-- UrPlaced Database Migration: 20261030000004
-- Title: Privilege Escalation Prevention, Audit Log Integrity & Strict RLS Hardening
-- Scope:
--   1. Protect profiles.is_platform_admin against privilege escalation (Triggers + Column Grants + Policy Lockdown)
--   2. Enforce Strict Option A across all remaining Phase 7-9 college tables (Mastery, Mistakes, Behavioral, Practice, Defects, Historical Records)
--   3. Secure audit_logs INSERT policy to prevent event forging
--   4. Enable FORCE ROW LEVEL SECURITY on all remaining tables
--   5. Remove Platform Admin bypass from public.invitations
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE: PRIVILEGE ESCALATION SAFEGUARDS
-- ------------------------------------------------------------------------------

-- 1.1 Revoke column-level write permissions on is_platform_admin from public roles
REVOKE UPDATE (is_platform_admin) ON public.profiles FROM authenticated, anon;
REVOKE INSERT (is_platform_admin) ON public.profiles FROM authenticated, anon;

-- 1.2 Drop permissive and redundant update policies
DROP POLICY IF EXISTS "users_can_update_own_profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

-- 1.3 Strict SELECT policy: Users can see own profile OR active members of same tenant
CREATE POLICY "profiles_select_policy" ON public.profiles
FOR SELECT TO authenticated
USING (
    auth.uid() = id
    OR EXISTS (
        SELECT 1
        FROM public.tenant_memberships tm1
        JOIN public.tenant_memberships tm2 ON tm1.tenant_id = tm2.tenant_id
        WHERE tm1.user_id = auth.uid()
          AND tm2.user_id = profiles.id
          AND tm1.status = 'ACTIVE'
          AND tm2.status = 'ACTIVE'
    )
);

-- 1.4 Strict INSERT policy: Only insert own profile, strictly is_platform_admin = false
CREATE POLICY "profiles_insert_policy" ON public.profiles
FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = id
    AND is_platform_admin = false
);

-- 1.5 Strict UPDATE policy: Only update own profile (escalation blocked via trigger & column revokes)
CREATE POLICY "profiles_update_policy" ON public.profiles
FOR UPDATE TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 1.6 Protective Trigger: Block any UPDATE attempting to escalate is_platform_admin
CREATE OR REPLACE FUNCTION public.protect_platform_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_platform_admin IS DISTINCT FROM OLD.is_platform_admin THEN
        IF auth.uid() IS NOT NULL OR session_user IN ('authenticated', 'anon') OR current_user IN ('authenticated', 'anon') THEN
            RAISE EXCEPTION 'Privilege escalation violation: Authenticated users cannot modify platform admin privileges'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_platform_admin_escalation ON public.profiles;
CREATE TRIGGER trg_protect_platform_admin_escalation
BEFORE UPDATE OF is_platform_admin ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_platform_admin_escalation();

-- 1.7 Protective Trigger: Block any INSERT attempting to set is_platform_admin = true
CREATE OR REPLACE FUNCTION public.protect_platform_admin_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_platform_admin = true THEN
        IF auth.uid() IS NOT NULL OR session_user IN ('authenticated', 'anon') OR current_user IN ('authenticated', 'anon') THEN
            RAISE EXCEPTION 'Privilege escalation violation: Authenticated users cannot self-provision platform admin privileges'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_platform_admin_insert ON public.profiles;
CREATE TRIGGER trg_protect_platform_admin_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_platform_admin_insert();

-- 1.8 Harden handle_new_user() trigger: strictly set is_platform_admin = false on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_platform_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    false -- Hardcoded false: Super Admin accounts can only be provisioned server-side
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. STRICT OPTION A: EXCISE PLATFORM ADMIN ACCESS FROM COLLEGE-OWNED TABLES
-- ------------------------------------------------------------------------------

-- 2.1 mastery_evidence_records
DROP POLICY IF EXISTS "p08_evidence_select" ON public.mastery_evidence_records;
DROP POLICY IF EXISTS "p08_evidence_write" ON public.mastery_evidence_records;

CREATE POLICY "p08_evidence_select" ON public.mastery_evidence_records
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p08_evidence_write" ON public.mastery_evidence_records
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.2 mistake_occurrences
DROP POLICY IF EXISTS "p08_occurrences_select" ON public.mistake_occurrences;
DROP POLICY IF EXISTS "p08_occurrences_write" ON public.mistake_occurrences;

CREATE POLICY "p08_occurrences_select" ON public.mistake_occurrences
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p08_occurrences_write" ON public.mistake_occurrences
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.3 mistake_review_targets
DROP POLICY IF EXISTS "p08_targets_select" ON public.mistake_review_targets;
DROP POLICY IF EXISTS "p08_targets_write" ON public.mistake_review_targets;

CREATE POLICY "p08_targets_select" ON public.mistake_review_targets
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p08_targets_write" ON public.mistake_review_targets
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.4 preparation_practice_sessions
DROP POLICY IF EXISTS "p07_practice_select" ON public.preparation_practice_sessions;
DROP POLICY IF EXISTS "p07_practice_write" ON public.preparation_practice_sessions;

CREATE POLICY "p07_practice_select" ON public.preparation_practice_sessions
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p07_practice_write" ON public.preparation_practice_sessions
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.5 question_defect_reports
DROP POLICY IF EXISTS "p08_defects_select" ON public.question_defect_reports;
DROP POLICY IF EXISTS "p08_defects_insert" ON public.question_defect_reports;
DROP POLICY IF EXISTS "p08_defects_manage" ON public.question_defect_reports;
DROP POLICY IF EXISTS "p08_defects_delete" ON public.question_defect_reports;

CREATE POLICY "p08_defects_select" ON public.question_defect_reports
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND reported_by = auth.uid())
);

CREATE POLICY "p08_defects_insert" ON public.question_defect_reports
FOR INSERT TO authenticated
WITH CHECK (
    is_active_tenant_member(tenant_id)
    AND reported_by = auth.uid()
);

CREATE POLICY "p08_defects_manage" ON public.question_defect_reports
FOR UPDATE TO authenticated
USING (is_tenant_staff(tenant_id))
WITH CHECK (is_tenant_staff(tenant_id));

CREATE POLICY "p08_defects_delete" ON public.question_defect_reports
FOR DELETE TO authenticated
USING (is_tenant_staff(tenant_id));

-- 2.6 review_sessions
DROP POLICY IF EXISTS "p08_sessions_select" ON public.review_sessions;
DROP POLICY IF EXISTS "p08_sessions_write" ON public.review_sessions;

CREATE POLICY "p08_sessions_select" ON public.review_sessions
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p08_sessions_write" ON public.review_sessions
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.7 student_behavioral_responses
DROP POLICY IF EXISTS "p07_behavioral_select" ON public.student_behavioral_responses;
DROP POLICY IF EXISTS "p07_behavioral_write" ON public.student_behavioral_responses;

CREATE POLICY "p07_behavioral_select" ON public.student_behavioral_responses
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p07_behavioral_write" ON public.student_behavioral_responses
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.8 student_skill_mastery
DROP POLICY IF EXISTS "p08_mastery_select" ON public.student_skill_mastery;
DROP POLICY IF EXISTS "p08_mastery_write" ON public.student_skill_mastery;

CREATE POLICY "p08_mastery_select" ON public.student_skill_mastery
FOR SELECT TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

CREATE POLICY "p08_mastery_write" ON public.student_skill_mastery
FOR ALL TO authenticated
USING (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
)
WITH CHECK (
    is_tenant_staff(tenant_id)
    OR (is_active_tenant_member(tenant_id) AND student_id IN (
        SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    ))
);

-- 2.9 historical_drive_comparisons and historical_recruitment_records
DROP POLICY IF EXISTS "Super admins have full access to drive comparisons" ON public.historical_drive_comparisons;
DROP POLICY IF EXISTS "Super admins have full access to historical records" ON public.historical_recruitment_records;

-- 2.10 invitations: remove platform admin bypass
DROP POLICY IF EXISTS "invitations_select_policy" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update_policy" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert_policy" ON public.invitations;

CREATE POLICY "invitations_select_policy" ON public.invitations
FOR SELECT TO authenticated
USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR is_tenant_admin(tenant_id, auth.uid())
);

CREATE POLICY "invitations_insert_policy" ON public.invitations
FOR INSERT TO authenticated
WITH CHECK (
    is_tenant_admin(tenant_id, auth.uid())
);

CREATE POLICY "invitations_update_policy" ON public.invitations
FOR UPDATE TO authenticated
USING (
    is_tenant_admin(tenant_id, auth.uid())
)
WITH CHECK (
    is_tenant_admin(tenant_id, auth.uid())
);

-- ------------------------------------------------------------------------------
-- 3. AUDIT LOGS: SECURE INSERT POLICY TO PREVENT EVENT FORGING
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
    actor_id = auth.uid()
    AND (
        (tenant_id IS NOT NULL AND is_active_tenant_member(tenant_id, auth.uid()))
        OR (tenant_id IS NULL AND is_platform_admin(auth.uid()))
    )
);

-- ------------------------------------------------------------------------------
-- 4. ENABLE FORCE ROW LEVEL SECURITY ON REMAINING TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.ai_drivefit_evaluations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_mistake_analyses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_tutor_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notification_announcements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. AVATAR STORAGE: SECURE SAME-COLLEGE READ POLICY VIA SECURITY DEFINER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_user_avatar(target_user_id text, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Caller can always read their own avatar
    IF target_user_id = caller_id::text THEN
        RETURN true;
    END IF;

    -- 2. Caller and target must belong to the same active college
    RETURN EXISTS (
        SELECT 1
        FROM public.tenant_memberships tm_target
        JOIN public.tenant_memberships tm_caller ON tm_target.tenant_id = tm_caller.tenant_id
        WHERE tm_target.user_id = target_user_id::uuid
          AND tm_caller.user_id = caller_id
          AND tm_target.status = 'ACTIVE'
          AND tm_caller.status = 'ACTIVE'
    );
EXCEPTION WHEN OTHERS THEN
    RETURN false;
END;
$$;

DROP POLICY IF EXISTS "avatars_select_policy" ON storage.objects;
CREATE POLICY "avatars_select_policy" ON storage.objects
FOR SELECT TO authenticated
USING (
    bucket_id = 'avatars'
    AND public.can_view_user_avatar((storage.foldername(name))[1], auth.uid())
);
