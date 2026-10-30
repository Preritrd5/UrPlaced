BEGIN;
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-1111-1111-111111111114', 'student1@sapthagiri.edu.in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, is_platform_admin)
VALUES ('11111111-1111-1111-1111-111111111114', 'student1@sapthagiri.edu.in', 'SapStudent One', false)
ON CONFLICT (id) DO UPDATE SET is_platform_admin = false;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

UPDATE public.profiles SET is_platform_admin = true WHERE id = '11111111-1111-1111-1111-111111111114';

ROLLBACK;
