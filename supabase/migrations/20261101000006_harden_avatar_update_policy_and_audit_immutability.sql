-- ==============================================================================
-- UrPlaced Migration: Harden Avatar Storage UPDATE Policy & Audit Immutability
--
-- 1. Explicitly defines WITH CHECK on storage.objects FOR UPDATE for 'avatars'
--    guaranteeing that users can only replace their own avatars and cannot
--    overwrite or reassign objects to another user's folder.
-- 2. Strictly revokes UPDATE, DELETE, and TRUNCATE privileges on public.audit_logs
--    from authenticated, anon, and public roles at the SQL engine level.
-- ==============================================================================

-- 1. Storage avatar UPDATE policy with explicit USING and WITH CHECK
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[2] = auth.uid()::text
    )
)
WITH CHECK (
    bucket_id = 'avatars' 
    AND (
        (storage.foldername(name))[1] = auth.uid()::text
        OR (storage.foldername(name))[2] = auth.uid()::text
    )
);

-- 2. Audit Log Immutability: Revoke destructive DML from client roles
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, public;
