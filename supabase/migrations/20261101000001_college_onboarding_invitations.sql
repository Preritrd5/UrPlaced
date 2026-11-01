-- ==============================================================================
-- UrPlaced Migration: Phase SA-03 — College Onboarding Invitations Architecture
-- 
-- Structures:
--   1. public.college_onboarding_invitations (Dedicated institutional invitations)
--   2. Strict Row Level Security: Restricted to Platform Super Admin
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.college_onboarding_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL DEFAULT 'Placement Head',
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '72 hours'),
    redeemed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    delivery_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_college_invites_tenant_id ON public.college_onboarding_invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_college_invites_email ON public.college_onboarding_invitations(email);
CREATE INDEX IF NOT EXISTS idx_college_invites_status ON public.college_onboarding_invitations(status);
CREATE INDEX IF NOT EXISTS idx_college_invites_token_hash ON public.college_onboarding_invitations(token_hash);

ALTER TABLE public.college_onboarding_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_onboarding_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY "college_invitations_select_policy" ON public.college_onboarding_invitations
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "college_invitations_write_policy" ON public.college_onboarding_invitations
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));
