BEGIN;
INSERT INTO public.tenants (id, name, slug, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Sapthagiri College', 'sapthagiri', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000002', 'ABC Institute', 'abc-tech', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

INSERT INTO auth.users (id, email)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'head@sapthagiri.edu.in'),
    ('11111111-1111-1111-1111-111111111112', 'staff@sapthagiri.edu.in'),
    ('22222222-2222-2222-2222-222222222222', 'staff@abc.edu.in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'PLACEMENT_HEAD', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111112', 'PLACEMENT_STAFF', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'PLACEMENT_STAFF', 'ACTIVE')
ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE';

CREATE OR REPLACE FUNCTION public.can_view_user_avatar(target_user_id text, caller_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    IF target_user_id = caller_id::text THEN
        RETURN true;
    END IF;

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

-- Head uploads avatar
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
INSERT INTO storage.objects (bucket_id, name, owner) 
VALUES ('avatars', '11111111-1111-1111-1111-111111111111/avatar.png', auth.uid());

-- 1. Head can see own avatar
SELECT count(*) AS head_visible FROM storage.objects WHERE bucket_id = 'avatars';

-- 2. Sapthagiri Staff can see Sapthagiri Head avatar
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111112';
SELECT count(*) AS sap_staff_visible FROM storage.objects WHERE bucket_id = 'avatars';

-- 3. ABC Staff CANNOT see Sapthagiri Head avatar
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-2222-2222-222222222222';
SELECT count(*) AS abc_staff_visible FROM storage.objects WHERE bucket_id = 'avatars';

ROLLBACK;
