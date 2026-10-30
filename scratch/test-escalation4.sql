BEGIN;
INSERT INTO auth.users (id, email)
VALUES ('11111111-1111-1111-1111-111111111114', 'student1@sapthagiri.edu.in')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles (id, email, full_name, is_platform_admin)
VALUES ('11111111-1111-1111-1111-111111111114', 'student1@sapthagiri.edu.in', 'SapStudent One', false)
ON CONFLICT (id) DO UPDATE SET is_platform_admin = false;

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

GRANT UPDATE ON public.profiles TO authenticated;

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111114';

-- 1. Normal bio update: Should SUCCEED
UPDATE public.profiles SET bio = 'Student Bio' WHERE id = '11111111-1111-1111-1111-111111111114';
SELECT bio FROM public.profiles WHERE id = '11111111-1111-1111-1111-111111111114';

-- 2. Privilege escalation attempt: Should THROW EXCEPTION
UPDATE public.profiles SET is_platform_admin = true WHERE id = '11111111-1111-1111-1111-111111111114';

ROLLBACK;
