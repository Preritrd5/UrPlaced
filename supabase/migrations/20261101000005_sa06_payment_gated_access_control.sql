-- ==============================================================================
-- UrPlaced Migration: Phase SA-06 — Payment-Gated Access Control
-- 
-- Structures:
--   1. Extend public.college_subscriptions with temporary override metadata
--   2. Create public.subscription_access_denials (diagnostic security logs)
--   3. Create composite indexes for high-throughput subscription access evaluations
--   4. Strict Row Level Security policies for access governance
-- ==============================================================================

-- 1. Extend college_subscriptions with Super Admin override fields
ALTER TABLE public.college_subscriptions
ADD COLUMN IF NOT EXISTS temporary_override_until TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS override_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS override_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Create public.subscription_access_denials table for diagnostic security auditing
CREATE TABLE IF NOT EXISTS public.subscription_access_denials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.college_subscriptions(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    user_role VARCHAR(64) NOT NULL,
    feature_key VARCHAR(128) NULL,
    route_category VARCHAR(64) NOT NULL DEFAULT 'OPERATIONAL',
    decision VARCHAR(64) NOT NULL, -- e.g. DENY_PENDING_PAYMENT, DENY_EXPIRED, DENY_ENTITLEMENT
    reason_code VARCHAR(128) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Composite & Filtering Indexes
CREATE INDEX IF NOT EXISTS idx_college_subs_tenant_status 
ON public.college_subscriptions(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_college_subs_grace_period 
ON public.college_subscriptions(grace_period_ends_at);

CREATE INDEX IF NOT EXISTS idx_college_subs_override 
ON public.college_subscriptions(temporary_override_until);

CREATE INDEX IF NOT EXISTS idx_access_denials_tenant 
ON public.subscription_access_denials(tenant_id);

CREATE INDEX IF NOT EXISTS idx_access_denials_created_at 
ON public.subscription_access_denials(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_access_denials_decision 
ON public.subscription_access_denials(decision);

-- 4. Strict Row Level Security (RLS)
ALTER TABLE public.subscription_access_denials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_access_denials FORCE ROW LEVEL SECURITY;

CREATE POLICY "access_denials_select_policy" ON public.subscription_access_denials
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "access_denials_insert_policy" ON public.subscription_access_denials
FOR INSERT TO authenticated
WITH CHECK (true); -- Service role or backend security guard records denial events
