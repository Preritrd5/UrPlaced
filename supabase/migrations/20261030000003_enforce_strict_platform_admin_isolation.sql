-- ==============================================================================
-- UrPlaced Migration: Phase 20 — Strict Platform Admin Isolation & Private Storage
-- 
-- 1. ENFORCE STRICT OPTION A FOR PLATFORM SUPER ADMIN:
--    Platform Super Admin manages platform infrastructure and college registrations,
--    but NEVER accesses private college-owned operational data, student records,
--    assessments, attempts, questions, or staff directories.
--    Removes `OR public.is_platform_admin()` from all college-owned tables.
--
-- 2. SECURE STORAGE ISOLATION:
--    Ensures storage objects cannot be listed or accessed cross-college or by
--    Platform Super Admin.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Redefine Helper Functions to Exclude Platform Admin from College Operations
--    and fix PostgreSQL argument shadowing (qualifying function arguments)
-- ------------------------------------------------------------------------------

-- In Phase 04, is_tenant_staff previously had: OR public.is_platform_admin(user_id)
-- Corrected: Only genuine active members of the tenant with staff roles qualify as tenant staff.
-- Qualified with function name to prevent column name shadowing.
CREATE OR REPLACE FUNCTION public.is_tenant_staff(target_tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.tenant_id = is_tenant_staff.target_tenant_id
      AND tm.user_id = is_tenant_staff.user_id
      AND tm.role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER')
      AND tm.status = 'ACTIVE'
      AND t.status = 'ACTIVE'
  );
$$;

-- In Phase 03, is_tenant_admin previously had: OR public.is_platform_admin(user_id)
-- Corrected: Only genuine active PLACEMENT_HEAD members of that specific tenant qualify.
-- Qualified with function name to prevent column name shadowing.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.tenant_id = is_tenant_admin.target_tenant_id
      AND tm.user_id = is_tenant_admin.user_id
      AND tm.role = 'PLACEMENT_HEAD'
      AND tm.status = 'ACTIVE'
      AND t.status = 'ACTIVE'
  );
$$;

-- In Phase 03, is_active_tenant_member had tm.user_id = user_id which was shadowed by the column name.
-- Corrected: Qualified with function name to ensure strict member check.
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(target_tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.tenant_id = is_active_tenant_member.target_tenant_id
      AND tm.user_id = is_active_tenant_member.user_id
      AND tm.status = 'ACTIVE'
      AND t.status = 'ACTIVE'
  );
$$;

-- In Phase 03, get_user_active_tenants had tm.user_id = user_id which was shadowed by the column name.
CREATE OR REPLACE FUNCTION public.get_user_active_tenants(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(tenant_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = get_user_active_tenants.user_id
    AND tm.status = 'ACTIVE'
    AND t.status = 'ACTIVE';
$$;

-- ------------------------------------------------------------------------------
-- 2. Strip Platform Admin from Tenant Memberships Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS memberships_select_policy ON public.tenant_memberships;
CREATE POLICY memberships_select_policy ON public.tenant_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(tenant_id, auth.uid())
  );

DROP POLICY IF EXISTS memberships_insert_policy ON public.tenant_memberships;
CREATE POLICY memberships_insert_policy ON public.tenant_memberships
  FOR INSERT
  WITH CHECK (
    public.is_tenant_admin(tenant_id, auth.uid())
  );

DROP POLICY IF EXISTS memberships_update_policy ON public.tenant_memberships;
CREATE POLICY memberships_update_policy ON public.tenant_memberships
  FOR UPDATE
  USING (
    public.is_tenant_admin(tenant_id, auth.uid())
  )
  WITH CHECK (
    public.is_tenant_admin(tenant_id, auth.uid())
  );

DROP POLICY IF EXISTS memberships_delete_policy ON public.tenant_memberships;
CREATE POLICY memberships_delete_policy ON public.tenant_memberships
  FOR DELETE
  USING (
    public.is_tenant_admin(tenant_id, auth.uid())
  );

-- ------------------------------------------------------------------------------
-- 3. Strip Platform Admin from Students & Academic Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "students_select_policy" ON public.students;
CREATE POLICY "students_select_policy" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "academic_years_select_policy" ON public.academic_years;
CREATE POLICY "academic_years_select_policy" ON public.academic_years
  FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS "departments_select_policy" ON public.departments;
CREATE POLICY "departments_select_policy" ON public.departments
  FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS "companies_select_policy" ON public.companies;
CREATE POLICY "companies_select_policy" ON public.companies
  FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS "drives_select_policy" ON public.recruitment_drives;
CREATE POLICY "drives_select_policy" ON public.recruitment_drives
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND status IN ('PUBLISHED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED'))
  );

DROP POLICY IF EXISTS "criteria_select_policy" ON public.drive_eligibility_criteria;
CREATE POLICY "criteria_select_policy" ON public.drive_eligibility_criteria
  FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS "stages_select_policy" ON public.drive_stages;
CREATE POLICY "stages_select_policy" ON public.drive_stages
  FOR SELECT TO authenticated
  USING (public.is_active_tenant_member(tenant_id));

DROP POLICY IF EXISTS "applications_select_policy" ON public.drive_applications;
CREATE POLICY "applications_select_policy" ON public.drive_applications
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "stage_results_select_policy" ON public.candidate_stage_results;
CREATE POLICY "stage_results_select_policy" ON public.candidate_stage_results
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND application_id IN (
      SELECT da.id 
      FROM public.drive_applications da
      JOIN public.students s ON s.id = da.student_id
      JOIN public.drive_stages st ON st.id = candidate_stage_results.stage_id
      WHERE s.user_id = auth.uid() AND st.is_student_visible = true
    ))
  );

DROP POLICY IF EXISTS "offers_select_policy" ON public.placement_offers;
CREATE POLICY "offers_select_policy" ON public.placement_offers
  FOR SELECT TO authenticated
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  );

-- ------------------------------------------------------------------------------
-- 4. Strip Platform Admin from Assessment Engine Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "p07_assessments_select" ON public.assessments;
CREATE POLICY "p07_assessments_select" ON public.assessments
  FOR SELECT
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND status = 'PUBLISHED')
  );

DROP POLICY IF EXISTS "p07_assessments_insert" ON public.assessments;
CREATE POLICY "p07_assessments_insert" ON public.assessments
  FOR INSERT
  WITH CHECK (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_assessments_update" ON public.assessments;
CREATE POLICY "p07_assessments_update" ON public.assessments
  FOR UPDATE
  USING (public.is_tenant_staff(tenant_id))
  WITH CHECK (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_assessments_delete" ON public.assessments;
CREATE POLICY "p07_assessments_delete" ON public.assessments
  FOR DELETE
  USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_assignments_select" ON public.assessment_assignments;
CREATE POLICY "p07_assignments_select" ON public.assessment_assignments
  FOR SELECT
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "p07_assignments_insert" ON public.assessment_assignments;
CREATE POLICY "p07_assignments_insert" ON public.assessment_assignments
  FOR INSERT
  WITH CHECK (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_assignments_update" ON public.assessment_assignments;
CREATE POLICY "p07_assignments_update" ON public.assessment_assignments
  FOR UPDATE
  USING (public.is_tenant_staff(tenant_id))
  WITH CHECK (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_assignments_delete" ON public.assessment_assignments;
CREATE POLICY "p07_assignments_delete" ON public.assessment_assignments
  FOR DELETE
  USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_attempts_select" ON public.assessment_attempts;
CREATE POLICY "p07_attempts_select" ON public.assessment_attempts
  FOR SELECT
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "p07_attempts_insert" ON public.assessment_attempts;
CREATE POLICY "p07_attempts_insert" ON public.assessment_attempts
  FOR INSERT
  WITH CHECK (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "p07_attempts_update" ON public.assessment_attempts;
CREATE POLICY "p07_attempts_update" ON public.assessment_attempts
  FOR UPDATE
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  )
  WITH CHECK (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND student_id IN (
      SELECT id FROM public.students WHERE user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "p07_attempts_delete" ON public.assessment_attempts;
CREATE POLICY "p07_attempts_delete" ON public.assessment_attempts
  FOR DELETE
  USING (public.is_tenant_staff(tenant_id));

DROP POLICY IF EXISTS "p07_responses_select" ON public.attempt_responses;
CREATE POLICY "p07_responses_select" ON public.attempt_responses
  FOR SELECT
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
      SELECT id FROM public.assessment_attempts WHERE student_id IN (
        SELECT id FROM public.students WHERE user_id = auth.uid()
      )
    ))
  );

DROP POLICY IF EXISTS "p07_responses_insert" ON public.attempt_responses;
CREATE POLICY "p07_responses_insert" ON public.attempt_responses
  FOR INSERT
  WITH CHECK (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
      SELECT id FROM public.assessment_attempts WHERE student_id IN (
        SELECT id FROM public.students WHERE user_id = auth.uid()
      )
    ))
  );

DROP POLICY IF EXISTS "p07_responses_update" ON public.attempt_responses;
CREATE POLICY "p07_responses_update" ON public.attempt_responses
  FOR UPDATE
  USING (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
      SELECT id FROM public.assessment_attempts WHERE student_id IN (
        SELECT id FROM public.students WHERE user_id = auth.uid()
      )
    ))
  )
  WITH CHECK (
    public.is_tenant_staff(tenant_id) OR
    (public.is_active_tenant_member(tenant_id) AND attempt_id IN (
      SELECT id FROM public.assessment_attempts WHERE student_id IN (
        SELECT id FROM public.students WHERE user_id = auth.uid()
      )
    ))
  );

DROP POLICY IF EXISTS "p07_responses_delete" ON public.attempt_responses;
CREATE POLICY "p07_responses_delete" ON public.attempt_responses
  FOR DELETE
  USING (public.is_tenant_staff(tenant_id));

-- ------------------------------------------------------------------------------
-- 5. Strip Platform Admin from Notifications System Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "announcements_select_tenant_staff" ON public.notification_announcements;
DROP POLICY IF EXISTS "p13_announcements_select" ON public.notification_announcements;
CREATE POLICY "announcements_select_tenant_staff" ON public.notification_announcements
  FOR SELECT TO authenticated
  USING (
    public.is_active_tenant_member(college_id, auth.uid())
  );

DROP POLICY IF EXISTS "announcements_insert_tenant_admin" ON public.notification_announcements;
DROP POLICY IF EXISTS "p13_announcements_insert" ON public.notification_announcements;
CREATE POLICY "announcements_insert_tenant_admin" ON public.notification_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_tenant_admin(college_id, auth.uid())
  );

-- ------------------------------------------------------------------------------
-- 6. Audit Logs: Strict Separation of Platform vs College Audit Events
-- ------------------------------------------------------------------------------
-- College Placement Heads can view audit logs for their own college.
-- Platform Super Admin can ONLY view platform-level events where tenant_id IS NULL.
-- Platform Super Admin CANNOT view private college-owned audit records.
DROP POLICY IF EXISTS audit_logs_select_policy ON public.audit_logs;
CREATE POLICY audit_logs_select_policy ON public.audit_logs
  FOR SELECT
  USING (
    (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR (tenant_id IS NULL AND public.is_platform_admin(auth.uid()))
  );

-- ------------------------------------------------------------------------------
-- 7. Storage Objects Isolation: Private Avatars Bucket & Strict Access Controls
-- ------------------------------------------------------------------------------
-- Change the 'avatars' storage bucket to private (public = false)
UPDATE storage.buckets
SET public = false
WHERE id = 'avatars';

-- Drop previous policies if they exist
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_policy" ON storage.objects;

-- Create private scoped select policy:
-- 1. Users can always read their own avatar: (storage.foldername(name))[1] = auth.uid()::text
-- 2. Authenticated users within the same college can view member avatars
-- 3. Cross-college access is DENIED
-- 4. Platform Super Admin is DENIED
CREATE POLICY "avatars_select_policy"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (
      -- Own avatar
      (storage.foldername(name))[1] = auth.uid()::text
      -- Same college member avatar (user exists in same tenant)
      OR EXISTS (
        SELECT 1
        FROM public.tenant_memberships tm_target
        JOIN public.tenant_memberships tm_caller ON tm_target.tenant_id = tm_caller.tenant_id
        WHERE tm_target.user_id::text = (storage.foldername(name))[1]
          AND tm_caller.user_id = auth.uid()
          AND tm_target.status = 'ACTIVE'
          AND tm_caller.status = 'ACTIVE'
      )
    )
  );

-- Reaffirm private user write policies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own avatar'
  ) THEN
    ALTER POLICY "Users can upload their own avatar" ON storage.objects
    TO authenticated
    WITH CHECK (
      bucket_id = 'avatars' 
      AND (storage.foldername(name))[1] = auth.uid()::text
    );
  END IF;
END $$;

