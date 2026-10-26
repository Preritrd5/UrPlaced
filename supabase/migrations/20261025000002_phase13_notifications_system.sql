-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 13 Migration: Persistent Real-Time Notification & Announcement System Schema & RLS
-- ==============================================================================

-- 1. Notification Announcements Table (Institutional Broadcasts)
CREATE TABLE IF NOT EXISTS public.notification_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    college_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
    audience_type VARCHAR(32) NOT NULL CHECK (audience_type IN ('ALL_STUDENTS', 'SELECTED_STUDENTS', 'DEPARTMENT')),
    audience_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
    action_url VARCHAR(512),
    status VARCHAR(32) NOT NULL DEFAULT 'SENT' CHECK (status IN ('DRAFT', 'SENT', 'CANCELLED')),
    recipient_count INTEGER NOT NULL DEFAULT 0 CHECK (recipient_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_announcement_title_len CHECK (char_length(title) > 0 AND char_length(title) <= 255),
    CONSTRAINT chk_announcement_body_len CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
    CONSTRAINT chk_announcement_action_url CHECK (action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%'))
);

CREATE INDEX IF NOT EXISTS idx_announcements_college_created 
    ON public.notification_announcements(college_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_announcements_created_by 
    ON public.notification_announcements(created_by);

ALTER TABLE public.notification_announcements ENABLE ROW LEVEL SECURITY;

-- 1.1 SELECT: Active tenant staff can view announcements for their college
CREATE POLICY announcements_select_tenant_staff ON public.notification_announcements
    FOR SELECT
    TO authenticated
    USING (
        public.is_active_tenant_member(college_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

-- 1.2 INSERT: Placement Heads & Platform Admins can create announcements
CREATE POLICY announcements_insert_tenant_admin ON public.notification_announcements
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_tenant_admin(college_id, auth.uid())
        OR public.is_platform_admin(auth.uid())
    );

-- 2. Notifications Table (Recipient Inbox)
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    announcement_id UUID REFERENCES public.notification_announcements(id) ON DELETE SET NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'SYSTEM_EVENT',
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    action_url VARCHAR(512),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    deduplication_key VARCHAR(128),
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_notification_title_len CHECK (char_length(title) > 0 AND char_length(title) <= 255),
    CONSTRAINT chk_notification_body_len CHECK (char_length(body) > 0 AND char_length(body) <= 2000),
    CONSTRAINT chk_notification_type_len CHECK (char_length(type) > 0 AND char_length(type) <= 64),
    CONSTRAINT chk_notification_action_url CHECK (action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%'))
);

-- 3. Performance & Retrieval Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
    ON public.notifications(recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
    ON public.notifications(recipient_user_id, created_at DESC) 
    WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_college 
    ON public.notifications(college_id);

CREATE INDEX IF NOT EXISTS idx_notifications_announcement 
    ON public.notifications(announcement_id)
    WHERE announcement_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_recipient_dedup 
    ON public.notifications(recipient_user_id, deduplication_key) 
    WHERE deduplication_key IS NOT NULL;

-- 4. Row-Level Security (RLS) for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4.1 SELECT Policy: Recipients can only read notifications explicitly addressed to them
CREATE POLICY notifications_select_recipient ON public.notifications
    FOR SELECT
    TO authenticated
    USING (recipient_user_id = auth.uid());

-- 4.2 UPDATE Policy: Recipients can only update read status of their own notifications
CREATE POLICY notifications_update_read_at ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

-- 4.3 DELETE Policy: Recipients can dismiss/delete their own notifications
CREATE POLICY notifications_delete_recipient ON public.notifications
    FOR DELETE
    TO authenticated
    USING (recipient_user_id = auth.uid());

-- 5. Immutable Attributes Guard Trigger
CREATE OR REPLACE FUNCTION public.check_notification_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (auth.role() = 'authenticated') THEN
        IF (OLD.recipient_user_id != NEW.recipient_user_id OR
            OLD.college_id IS DISTINCT FROM NEW.college_id OR
            OLD.actor_user_id IS DISTINCT FROM NEW.actor_user_id OR
            OLD.announcement_id IS DISTINCT FROM NEW.announcement_id OR
            OLD.source != NEW.source OR
            OLD.type != NEW.type OR
            OLD.title != NEW.title OR
            OLD.body != NEW.body OR
            OLD.action_url IS DISTINCT FROM NEW.action_url OR
            OLD.metadata != NEW.metadata OR
            OLD.deduplication_key IS DISTINCT FROM NEW.deduplication_key OR
            OLD.created_at != NEW.created_at) THEN
            RAISE EXCEPTION 'Forbidden: Notification content and routing attributes are immutable.';
        END IF;
        NEW.updated_at = now();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notifications_protect_fields ON public.notifications;
CREATE TRIGGER trg_notifications_protect_fields
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.check_notification_update();

-- 6. Enable Supabase Realtime Publication (Idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'notifications'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
