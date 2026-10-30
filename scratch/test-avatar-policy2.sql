BEGIN;
INSERT INTO public.tenants (id, name, slug, status)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Sapthagiri College', 'sapthagiri', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000002', 'ABC Institute', 'abc-tech', 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE';

INSERT INTO auth.users (id, email)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'head@sapthagiri.edu.in'),
    ('11111111-1111-1111-1111-111111111112', 'staff@sapthagiri.edu.in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tenant_memberships (tenant_id, user_id, role, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'PLACEMENT_HEAD', 'ACTIVE'),
    ('00000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111112', 'PLACEMENT_STAFF', 'ACTIVE')
ON CONFLICT (tenant_id, user_id) DO UPDATE SET status = 'ACTIVE';

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', false) ON CONFLICT (id) DO UPDATE SET public = false;

-- Delete any existing test object
DELETE FROM storage.objects WHERE bucket_id = 'avatars' AND name = '11111111-1111-1111-1111-111111111111/avatar.png';

-- Head uploads avatar
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';
INSERT INTO storage.objects (bucket_id, name, owner) 
VALUES ('avatars', '11111111-1111-1111-1111-111111111111/avatar.png', auth.uid());

-- Staff tries to select
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111112';
SELECT name, bucket_id FROM storage.objects WHERE bucket_id = 'avatars';

ROLLBACK;
