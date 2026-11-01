-- ==============================================================================
-- UrPlaced Migration: Storage Real Ownership & Audit Insert-Integrity Hardening
--
-- 1. storage.objects:
--    - Enforces true owner identity check (owner = auth.uid() OR owner_id = auth.uid()::text)
--    - Constrains folder structure to legitimate avatar formats:
--        Format 1: <auth.uid()>/<filename>
--        Format 2: avatars/<auth.uid()>/<filename>
--    - Strictly prevents folder spoofing where caller's ID is nested in segment 2
--      under an arbitrary user's directory.
--    - Hardens INSERT, UPDATE, DELETE, and SELECT policies together.
--
-- 2. public.audit_logs:
--    - Revokes direct INSERT, UPDATE, DELETE, TRUNCATE from authenticated, anon, public.
--    - Revokes UPDATE, DELETE, TRUNCATE from service_role.
--    - Drops audit_logs_insert_policy so no client can directly write audit records.
--    - Preserves service_role INSERT and SELECT for server-side trusted logging.
--    - Preserves audit_logs_select_policy for tenant & platform admin visibility (Strict Option A).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PART 1: STORAGE AVATAR REAL OWNERSHIP & PATH INTEGRITY
-- ------------------------------------------------------------------------------

-- Helper function to extract legitimate user ID from avatar path
CREATE OR REPLACE FUNCTION public.extract_avatar_user_id(path text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE 
        WHEN (storage.foldername(path))[1] = 'avatars' THEN (storage.foldername(path))[2]
        ELSE (storage.foldername(path))[1]
    END;
$$;

-- Drop existing avatar policies on storage.objects
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "avatars_select_policy" ON storage.objects;

-- 1. INSERT: User must own the object AND path must match legitimate user folder
CREATE POLICY "avatars_insert_ownership_policy"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (
        owner = auth.uid()
        OR owner_id = (auth.uid())::text
    )
    AND (
        -- Format 1: <userId>/<filename>
        (
            (storage.foldername(name))[1] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 1
        )
        OR
        -- Format 2: avatars/<userId>/<filename>
        (
            (storage.foldername(name))[1] = 'avatars'
            AND (storage.foldername(name))[2] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 2
        )
    )
);

-- 2. UPDATE: User must own the existing object, own the new object, and both paths must match caller
CREATE POLICY "avatars_update_ownership_policy"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (
        owner = auth.uid()
        OR owner_id = (auth.uid())::text
    )
    AND (
        (
            (storage.foldername(name))[1] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 1
        )
        OR
        (
            (storage.foldername(name))[1] = 'avatars'
            AND (storage.foldername(name))[2] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 2
        )
    )
)
WITH CHECK (
    bucket_id = 'avatars'
    AND (
        owner = auth.uid()
        OR owner_id = (auth.uid())::text
    )
    AND (
        (
            (storage.foldername(name))[1] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 1
        )
        OR
        (
            (storage.foldername(name))[1] = 'avatars'
            AND (storage.foldername(name))[2] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 2
        )
    )
);

-- 3. DELETE: User must own the object AND path must match caller
CREATE POLICY "avatars_delete_ownership_policy"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (
        owner = auth.uid()
        OR owner_id = (auth.uid())::text
    )
    AND (
        (
            (storage.foldername(name))[1] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 1
        )
        OR
        (
            (storage.foldername(name))[1] = 'avatars'
            AND (storage.foldername(name))[2] = (auth.uid())::text
            AND array_length(storage.foldername(name), 1) = 2
        )
    )
);

-- 4. SELECT: User can view own avatar OR active colleague in same college
CREATE POLICY "avatars_select_ownership_policy"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (
        (owner = auth.uid() OR owner_id = (auth.uid())::text)
        OR public.can_view_user_avatar(public.extract_avatar_user_id(name), auth.uid())
    )
);

-- ------------------------------------------------------------------------------
-- PART 2: AUDIT LOG PRIVILEGE & INSERT-INTEGRITY HARDENING
-- ------------------------------------------------------------------------------

-- Revoke client-side DML on audit_logs completely
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, public;

-- Revoke destructive DML on audit_logs from service_role (service_role can only INSERT & SELECT)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM service_role;

-- Drop client insert policy
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
