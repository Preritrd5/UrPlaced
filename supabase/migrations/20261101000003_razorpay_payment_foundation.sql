-- ==============================================================================
-- UrPlaced Migration: Phase SA-05 Step 01 — Razorpay Payment Foundation
-- 
-- Structures:
--   1. Create public.payment_orders (server-side Razorpay order tracking)
--   2. Create public.payment_transactions (payment attempts, captures, and audits)
--   3. Create public.payment_webhook_events (idempotency & replay protection)
--   4. Extend public.platform_invoices with gateway tracking columns
--   5. Configure strict RLS policies: read-only for tenant members, platform admin writes only
-- ==============================================================================

-- 1. Extend platform_invoices with gateway tracking columns
ALTER TABLE public.platform_invoices
ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(128) NULL,
ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(128) NULL,
ADD COLUMN IF NOT EXISTS payment_gateway VARCHAR(32) NOT NULL DEFAULT 'MANUAL';

CREATE INDEX IF NOT EXISTS idx_platform_invoices_razorpay_order 
ON public.platform_invoices(razorpay_order_id);

CREATE INDEX IF NOT EXISTS idx_platform_invoices_razorpay_payment 
ON public.platform_invoices(razorpay_payment_id);

-- 2. Create public.payment_orders
CREATE TABLE IF NOT EXISTS public.payment_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(128) UNIQUE NOT NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES public.college_subscriptions(id) ON DELETE SET NULL,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'ATTEMPTED', 'PAID', 'EXPIRED', 'FAILED')),
    gateway VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    idempotency_key VARCHAR(128) UNIQUE NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_tenant ON public.payment_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_invoice ON public.payment_orders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_id ON public.payment_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_idempotency ON public.payment_orders(idempotency_key);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders FORCE ROW LEVEL SECURITY;

CREATE POLICY "payment_orders_select_policy" ON public.payment_orders
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
);

CREATE POLICY "payment_orders_write_policy" ON public.payment_orders
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 3. Create public.payment_transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id VARCHAR(128) UNIQUE NOT NULL,
    order_id VARCHAR(128) NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.platform_invoices(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL CHECK (status IN ('CAPTURED', 'AUTHORIZED', 'FAILED', 'REFUNDED')),
    method VARCHAR(32) NULL,
    gateway VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    gateway_signature VARCHAR(255) NULL,
    error_code VARCHAR(64) NULL,
    error_description TEXT NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'CHECKOUT_VERIFICATION' CHECK (source IN ('CHECKOUT_VERIFICATION', 'WEBHOOK', 'RECONCILIATION')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_tenant ON public.payment_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_invoice ON public.payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON public.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_id ON public.payment_transactions(payment_id);

ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions FORCE ROW LEVEL SECURITY;

CREATE POLICY "payment_transactions_select_policy" ON public.payment_transactions
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
);

CREATE POLICY "payment_transactions_write_policy" ON public.payment_transactions
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 4. Create public.payment_webhook_events
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(128) UNIQUE NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    gateway VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    status VARCHAR(32) NOT NULL DEFAULT 'PROCESSED' CHECK (status IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED')),
    order_id VARCHAR(128) NULL,
    payment_id VARCHAR(128) NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_event_id ON public.payment_webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_order_id ON public.payment_webhook_events(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_payment_id ON public.payment_webhook_events(payment_id);

ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_webhook_events FORCE ROW LEVEL SECURITY;

CREATE POLICY "payment_webhook_events_select_policy" ON public.payment_webhook_events
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "payment_webhook_events_write_policy" ON public.payment_webhook_events
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));
