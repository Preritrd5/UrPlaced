-- ==============================================================================
-- UrPlaced Migration: Phase 11 — Durable Avatar Storage Persistence & Security
-- Ensures the 'avatars' storage bucket exists with proper public read access
-- and strict user-scoped write/delete RLS policies.
-- ==============================================================================

-- 1. Create the 'avatars' storage bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true,
    2097152, -- 2MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- 2. Storage Objects RLS Policies
-- Enable RLS on storage.objects (default in Supabase, ensured here)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 2.1 Allow public read access to avatar images
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public avatars are viewable by everyone'
    ) THEN
        CREATE POLICY "Public avatars are viewable by everyone"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars');
    END IF;
END $$;

-- 2.2 Allow authenticated users to upload only to their own directory: avatars/<userId>/...
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can upload their own avatar'
    ) THEN
        CREATE POLICY "Users can upload their own avatar"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (
            bucket_id = 'avatars' 
            AND (
                (storage.foldername(name))[1] = auth.uid()::text
                OR (storage.foldername(name))[2] = auth.uid()::text
            )
        );
    END IF;
END $$;

-- 2.3 Allow authenticated users to update only their own avatar files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can update their own avatar'
    ) THEN
        CREATE POLICY "Users can update their own avatar"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (
            bucket_id = 'avatars' 
            AND (
                (storage.foldername(name))[1] = auth.uid()::text
                OR (storage.foldername(name))[2] = auth.uid()::text
            )
        );
    END IF;
END $$;

-- 2.4 Allow authenticated users to delete only their own avatar files
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users can delete their own avatar'
    ) THEN
        CREATE POLICY "Users can delete their own avatar"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (
            bucket_id = 'avatars' 
            AND (
                (storage.foldername(name))[1] = auth.uid()::text
                OR (storage.foldername(name))[2] = auth.uid()::text
            )
        );
    END IF;
END $$;
