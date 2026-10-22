-- ====================================================================
-- UrPlaced Database Schema Migration: Phase 10 - User Profiles & Settings
-- Safe, backward-compatible extension to public.profiles table
-- ====================================================================

-- 1. Add optional contact, location, bio, and preferences fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location VARCHAR(128);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;

-- 2. Ensure RLS is active on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Authenticated users can view their own profile and profiles within authorized tenants
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'users_can_update_own_profile'
    ) THEN
        CREATE POLICY users_can_update_own_profile ON public.profiles
            FOR UPDATE
            USING (auth.uid() = id)
            WITH CHECK (auth.uid() = id);
    END IF;
END
$$;
