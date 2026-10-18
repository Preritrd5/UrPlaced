-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Phase 03 Migration: Authentication, Profiles, Tenancy, Memberships & RLS
-- ==============================================================================

-- 1. Tenants Table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(64) UNIQUE NOT NULL,
    primary_domain VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')),
    student_seat_limit INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for tenant lookups
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON public.tenants(status);

-- 2. User Profiles Table (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL DEFAULT '',
    is_platform_admin BOOLEAN NOT NULL DEFAULT false,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- 3. Tenant Memberships Table
CREATE TABLE IF NOT EXISTS public.tenant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER', 'STUDENT')),
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_user_membership UNIQUE (tenant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant_id ON public.tenant_memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.tenant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_status ON public.tenant_memberships(status);

-- 4. Invitations Table
CREATE TABLE IF NOT EXISTS public.invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(32) NOT NULL CHECK (role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER', 'STUDENT', 'SUPER_ADMIN')),
    permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    token_hash VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_token_hash ON public.invitations(token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON public.invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON public.invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON public.invitations(status);

-- 5. Append-Only Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(64) NOT NULL,
    before_state JSONB,
    after_state JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON public.audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);

-- ==============================================================================
-- Security Definer Helpers (Avoid Recursive RLS)
-- ==============================================================================

-- Check if user is Platform Super Admin
CREATE OR REPLACE FUNCTION public.is_platform_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.profiles WHERE id = user_id),
    false
  );
$$;

-- Get list of active tenant IDs for user
CREATE OR REPLACE FUNCTION public.get_user_active_tenants(user_id UUID DEFAULT auth.uid())
RETURNS TABLE(tenant_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tm.tenant_id
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = user_id
    AND tm.status = 'ACTIVE'
    AND t.status = 'ACTIVE';
$$;

-- Check if user is an active member of specific tenant
CREATE OR REPLACE FUNCTION public.is_active_tenant_member(target_tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.tenant_id = target_tenant_id
      AND tm.user_id = user_id
      AND tm.status = 'ACTIVE'
      AND t.status = 'ACTIVE'
  );
$$;

-- Check if user is tenant admin (Placement Head) or Platform Admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(target_tenant_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN public.tenants t ON t.id = tm.tenant_id
    WHERE tm.tenant_id = target_tenant_id
      AND tm.user_id = user_id
      AND tm.role = 'PLACEMENT_HEAD'
      AND tm.status = 'ACTIVE'
      AND t.status = 'ACTIVE'
  ) OR public.is_platform_admin(user_id);
$$;

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- ==============================================================================

-- Enable and FORCE RLS on all tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- Tenants Policies
-- ------------------------------------------------------------------------------
CREATE POLICY tenants_select_policy ON public.tenants
  FOR SELECT
  USING (
    public.is_platform_admin(auth.uid())
    OR id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
  );

CREATE POLICY tenants_insert_policy ON public.tenants
  FOR INSERT
  WITH CHECK (
    public.is_platform_admin(auth.uid())
  );

CREATE POLICY tenants_update_policy ON public.tenants
  FOR UPDATE
  USING (
    public.is_platform_admin(auth.uid())
    OR (public.is_tenant_admin(id, auth.uid()) AND status = 'ACTIVE')
  )
  WITH CHECK (
    public.is_platform_admin(auth.uid())
    OR (public.is_tenant_admin(id, auth.uid()) AND status = 'ACTIVE')
  );

CREATE POLICY tenants_delete_policy ON public.tenants
  FOR DELETE
  USING (
    public.is_platform_admin(auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Profiles Policies
-- ------------------------------------------------------------------------------
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.tenant_memberships tm1
      JOIN public.tenant_memberships tm2 ON tm1.tenant_id = tm2.tenant_id
      WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
        AND tm1.status = 'ACTIVE' AND tm2.status = 'ACTIVE'
    )
  );

CREATE POLICY profiles_insert_policy ON public.profiles
  FOR INSERT
  WITH CHECK (
    auth.uid() = id OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE
  USING (
    auth.uid() = id OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    -- Normal users cannot elevate themselves to platform admin
    (auth.uid() = id AND is_platform_admin = (SELECT is_platform_admin FROM public.profiles WHERE id = auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Tenant Memberships Policies
-- ------------------------------------------------------------------------------
CREATE POLICY memberships_select_policy ON public.tenant_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY memberships_insert_policy ON public.tenant_memberships
  FOR INSERT
  WITH CHECK (
    public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY memberships_update_policy ON public.tenant_memberships
  FOR UPDATE
  USING (
    public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY memberships_delete_policy ON public.tenant_memberships
  FOR DELETE
  USING (
    public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Invitations Policies
-- ------------------------------------------------------------------------------
CREATE POLICY invitations_select_policy ON public.invitations
  FOR SELECT
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    OR public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY invitations_insert_policy ON public.invitations
  FOR INSERT
  WITH CHECK (
    (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY invitations_update_policy ON public.invitations
  FOR UPDATE
  USING (
    public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.is_tenant_admin(tenant_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- ------------------------------------------------------------------------------
-- Audit Logs Policies (Append-Only)
-- ------------------------------------------------------------------------------
CREATE POLICY audit_logs_select_policy ON public.audit_logs
  FOR SELECT
  USING (
    (tenant_id IS NOT NULL AND public.is_tenant_admin(tenant_id, auth.uid()))
    OR public.is_platform_admin(auth.uid())
  );

CREATE POLICY audit_logs_insert_policy ON public.audit_logs
  FOR INSERT
  WITH CHECK (
    true -- System and authenticated actions may append audit entries
  );

-- Prevent any UPDATE or DELETE on audit_logs
-- No UPDATE or DELETE policies are created -> PostgreSQL default-deny protects audit history

-- ==============================================================================
-- Automatic User Profile Trigger
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_platform_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'is_platform_admin')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = CASE WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name ELSE public.profiles.full_name END;
  RETURN NEW;
END;
$$;

-- Trigger firing on auth.users creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
