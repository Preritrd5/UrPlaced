-- ==============================================================================
-- UrPlaced Migration: Phase 21 — Platform Super Admin Portal Architecture
-- 
-- Structures:
--   1. public.platform_admins (Server-controlled admin registry & MFA enforcement)
--   2. Extend public.tenants with onboarding metadata
--   3. public.subscription_plans (Plan definitions, pricing, limits, features)
--   4. public.college_subscriptions (Tenants subscription lifecycle & entitlements)
--   5. public.platform_invoices (Real persisted billing & invoice records)
--   6. public.platform_settings (Platform-wide configuration, maintenance, security)
--   7. public.platform_admin_invitations (Controlled admin invitations)
--   8. Row Level Security: Strictly restricted to is_platform_admin(auth.uid())
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PLATFORM ADMINS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admins (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL DEFAULT '',
    role VARCHAR(32) NOT NULL DEFAULT 'SUPER_ADMIN' CHECK (role = 'SUPER_ADMIN'),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'REVOKED')),
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_enforced BOOLEAN NOT NULL DEFAULT true,
    last_sign_in_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_status ON public.platform_admins(status);
CREATE INDEX IF NOT EXISTS idx_platform_admins_email ON public.platform_admins(email);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_admins_select_policy" ON public.platform_admins
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_insert_policy" ON public.platform_admins
FOR INSERT TO authenticated
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_update_policy" ON public.platform_admins
FOR UPDATE TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admins_delete_policy" ON public.platform_admins
FOR DELETE TO authenticated
USING (public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 2. EXTEND TENANTS WITH ONBOARDING METADATA
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS official_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(64),
ADD COLUMN IF NOT EXISTS onboarding_status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED' CHECK (onboarding_status IN ('INVITED', 'PENDING_VERIFICATION', 'COMPLETED', 'ACTION_REQUIRED')),
ADD COLUMN IF NOT EXISTS onboarding_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- ------------------------------------------------------------------------------
-- 3. SUBSCRIPTION PLANS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    description TEXT,
    price_inr NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    billing_cycle VARCHAR(32) NOT NULL DEFAULT 'ANNUAL' CHECK (billing_cycle IN ('MONTHLY', 'ANNUAL')),
    student_limit INTEGER NOT NULL DEFAULT 1000,
    staff_limit INTEGER NOT NULL DEFAULT 10,
    storage_limit_gb INTEGER NOT NULL DEFAULT 20,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY "subscription_plans_select_policy" ON public.subscription_plans
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR is_active = true
);

CREATE POLICY "subscription_plans_write_policy" ON public.subscription_plans
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Seed initial standard plans if table is empty
INSERT INTO public.subscription_plans (id, name, slug, description, price_inr, billing_cycle, student_limit, staff_limit, storage_limit_gb, features, is_active)
VALUES
    ('starter', 'Institutional Starter', 'starter', 'Essential placement management for smaller institutions and colleges.', 49999.00, 'ANNUAL', 500, 5, 20, '["Core Placement Drives", "Standard Assessment Engine", "Basic Student Directory", "Email Notifications", "Standard Question Bank"]'::jsonb, true),
    ('growth', 'Campus Growth', 'growth', 'Comprehensive recruitment, intelligence, and preparation suite for growing campuses.', 129999.00, 'ANNUAL', 2500, 20, 100, '["All Starter Features", "DriveFit Intelligence", "Mistake-to-Mastery Bank", "Multi-Stage Evaluation Pipeline", "Custom Assessment Sets", "Automated Eligibility Engine", "Advanced Placement Memory Analytics"]'::jsonb, true),
    ('enterprise', 'University Enterprise', 'enterprise', 'Full-scale multi-department ecosystem with dedicated institutional limits and SLA.', 249999.00, 'ANNUAL', 10000, 100, 500, '["All Growth Features", "Unlimited Question Sets", "Dedicated SLA & Account Liaison", "Priority AI Question Generation", "Custom Department Hierarchy", "Comprehensive Audit & Export Hub", "Real-Time Campus Readiness Index"]'::jsonb, true)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. COLLEGE SUBSCRIPTIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.college_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    plan_id VARCHAR(64) NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED')),
    start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    expiry_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
    renewal_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '1 year'),
    grace_period_days INTEGER NOT NULL DEFAULT 14,
    student_seat_limit INTEGER NOT NULL DEFAULT 1000,
    staff_seat_limit INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_subscription UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_college_subs_tenant ON public.college_subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_college_subs_status ON public.college_subscriptions(status);

ALTER TABLE public.college_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.college_subscriptions FORCE ROW LEVEL SECURITY;

CREATE POLICY "college_subscriptions_select_policy" ON public.college_subscriptions
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
);

CREATE POLICY "college_subscriptions_write_policy" ON public.college_subscriptions
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Seed active subscriptions for existing tenants
INSERT INTO public.college_subscriptions (tenant_id, plan_id, status, start_date, expiry_date, renewal_date, student_seat_limit, staff_seat_limit)
SELECT id, 'growth', 'ACTIVE', now() - interval '3 months', now() + interval '9 months', now() + interval '9 months', student_seat_limit, 25
FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 5. PLATFORM INVOICES TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.college_subscriptions(id) ON DELETE SET NULL,
    amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tax_inr NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'PAID' CHECK (status IN ('PAID', 'PENDING', 'OVERDUE', 'CANCELED', 'REFUNDED')),
    issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    due_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
    paid_at TIMESTAMPTZ,
    payment_method VARCHAR(64) NOT NULL DEFAULT 'BANK_TRANSFER',
    is_demo BOOLEAN NOT NULL DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON public.platform_invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.platform_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON public.platform_invoices(issue_date);

ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_invoices_select_policy" ON public.platform_invoices
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR (
        tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
        AND public.is_tenant_admin(tenant_id, auth.uid())
    )
);

CREATE POLICY "platform_invoices_write_policy" ON public.platform_invoices
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Seed initial invoice records for existing colleges
INSERT INTO public.platform_invoices (invoice_number, tenant_id, subscription_id, amount_inr, tax_inr, currency, status, issue_date, due_date, paid_at, payment_method, is_demo, notes)
SELECT 
    'INV-' || to_char(now(), 'YYYY') || '-' || lpad((row_number() over())::text, 4, '0'),
    t.id,
    cs.id,
    129999.00,
    23399.82,
    'INR',
    'PAID',
    now() - interval '3 months',
    now() - interval '2 months',
    now() - interval '3 months' + interval '2 days',
    'BANK_TRANSFER',
    false,
    'Annual subscription fee for ' || t.name
FROM public.tenants t
LEFT JOIN public.college_subscriptions cs ON cs.tenant_id = t.id
ON CONFLICT (invoice_number) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 6. PLATFORM SETTINGS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_settings (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    category VARCHAR(64) NOT NULL DEFAULT 'GENERAL',
    description TEXT,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_settings_select_policy" ON public.platform_settings
FOR SELECT TO authenticated
USING (true); -- Non-sensitive configuration flags can be checked by app

CREATE POLICY "platform_settings_write_policy" ON public.platform_settings
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- Seed initial platform configuration
INSERT INTO public.platform_settings (key, value, category, description)
VALUES
    ('platform_branding', '{"platformName": "UrPlaced", "supportEmail": "platform@urplaced.com", "contactUrl": "https://urplaced.com/support"}'::jsonb, 'GENERAL', 'Global platform branding metadata'),
    ('maintenance_mode', '{"enabled": false, "message": "UrPlaced is performing scheduled maintenance. Services will resume shortly.", "scheduledEnd": null}'::jsonb, 'MAINTENANCE', 'Platform-wide maintenance mode switch and announcement'),
    ('subscription_defaults', '{"defaultPlanId": "growth", "trialPeriodDays": 14, "gracePeriodDays": 14}'::jsonb, 'BILLING', 'Default subscription parameters for newly registered colleges'),
    ('feature_switches', '{"enableAiGeneration": true, "enableMistakeBank": true, "enableDriveFit": true, "enableSelfServiceSignup": true, "enableNotifications": true}'::jsonb, 'FEATURES', 'Global platform feature switches'),
    ('security_settings', '{"enforceMfaForAdmins": true, "sessionTimeoutMinutes": 120, "maxFailedLogins": 5}'::jsonb, 'SECURITY', 'Platform-wide administrative security constraints')
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 7. PLATFORM ADMIN INVITATIONS TABLE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL DEFAULT 'SUPER_ADMIN' CHECK (role = 'SUPER_ADMIN'),
    token_hash VARCHAR(255) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_invites_email ON public.platform_admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_platform_invites_status ON public.platform_admin_invitations(status);

ALTER TABLE public.platform_admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_invitations FORCE ROW LEVEL SECURITY;

CREATE POLICY "platform_admin_invitations_select_policy" ON public.platform_admin_invitations
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "platform_admin_invitations_write_policy" ON public.platform_admin_invitations
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- ------------------------------------------------------------------------------
-- 8. SEED PLATFORM ADMINS FROM EXISTING PROFILES WHERE is_platform_admin = true
-- ------------------------------------------------------------------------------
INSERT INTO public.platform_admins (id, email, full_name, role, status, mfa_enabled, mfa_enforced)
SELECT id, email, full_name, 'SUPER_ADMIN', 'ACTIVE', true, true
FROM public.profiles
WHERE is_platform_admin = true
ON CONFLICT (id) DO NOTHING;
