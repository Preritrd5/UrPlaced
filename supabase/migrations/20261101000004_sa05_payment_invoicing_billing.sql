-- ==============================================================================
-- UrPlaced Migration: Phase SA-05 — Payment Gateway, Invoicing & Billing
-- All 7 Workstreams & All 21 Approved Decisions
-- 
-- Structures:
--   1. Create public.refunds (full & partial refunds, Q10 subscription action)
--   2. Create public.credit_notes (accounting adjustments linked to refunds)
--   3. Create public.recurring_mandates (mandate consent & recurring subscriptions)
--   4. Create public.subscription_renewal_retries (Day 1, 3, 5 retries & grace period)
--   5. Create public.billing_notifications_log (idempotent reminder delivery records)
--   6. Create public.payment_discrepancies (15-min & daily reconciliation audits)
--   7. Extend public.tenants with billing contact, address, and GSTIN
--   8. Extend public.college_subscriptions with billing mode, cancellation, & mandate state
--   9. Extend public.platform_invoices with tax configuration, GSTIN, & refunded balances
--  10. Strict Row Level Security policies (tenant isolation & admin authorization)
-- ==============================================================================

-- 1. Extend tenants table
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS billing_contact_name VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS billing_contact_email VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS billing_contact_phone VARCHAR(64) NULL,
ADD COLUMN IF NOT EXISTS billing_address TEXT NULL,
ADD COLUMN IF NOT EXISTS gstin VARCHAR(32) NULL;

-- 2. Extend college_subscriptions table
ALTER TABLE public.college_subscriptions
ADD COLUMN IF NOT EXISTS billing_mode VARCHAR(32) NOT NULL DEFAULT 'MANUAL' CHECK (billing_mode IN ('MANUAL', 'AUTOMATIC')),
ADD COLUMN IF NOT EXISTS pending_billing_mode VARCHAR(32) NULL CHECK (pending_billing_mode IN ('MANUAL', 'AUTOMATIC')),
ADD COLUMN IF NOT EXISTS billing_mode_effective_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT NULL,
ADD COLUMN IF NOT EXISTS mandate_id VARCHAR(128) NULL,
ADD COLUMN IF NOT EXISTS renewal_retry_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_college_subs_billing_mode ON public.college_subscriptions(billing_mode);
CREATE INDEX IF NOT EXISTS idx_college_subs_cancel_period ON public.college_subscriptions(cancel_at_period_end);

-- 3. Extend platform_invoices table
ALTER TABLE public.platform_invoices
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS tax_type VARCHAR(16) NOT NULL DEFAULT 'GST',
ADD COLUMN IF NOT EXISTS tax_snapshot JSONB NULL,
ADD COLUMN IF NOT EXISTS college_gstin VARCHAR(32) NULL,
ADD COLUMN IF NOT EXISTS billing_address TEXT NULL,
ADD COLUMN IF NOT EXISTS refunded_amount_inr NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS pdf_url TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_platform_invoices_tenant_status ON public.platform_invoices(tenant_id, status);

-- 4. Create public.refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id VARCHAR(128) UNIQUE NOT NULL, -- Razorpay refund id (rfnd_xxx) or manual ref
    payment_id VARCHAR(128) NOT NULL REFERENCES public.payment_transactions(payment_id) ON DELETE RESTRICT,
    order_id VARCHAR(128) NOT NULL REFERENCES public.payment_orders(order_id) ON DELETE RESTRICT,
    invoice_id UUID NOT NULL REFERENCES public.platform_invoices(id) ON DELETE RESTRICT,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    amount_paise BIGINT NOT NULL CHECK (amount_paise > 0),
    amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr > 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    reason TEXT NOT NULL,
    -- Q10: Explicit subscription action decoupled from refund
    subscription_action VARCHAR(32) NOT NULL DEFAULT 'KEEP_ACTIVE' CHECK (subscription_action IN ('KEEP_ACTIVE', 'CANCEL_IMMEDIATELY', 'CANCEL_AT_PERIOD_END')),
    gateway VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    gateway_response JSONB NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_tenant ON public.refunds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice ON public.refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON public.refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds(status);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds FORCE ROW LEVEL SECURITY;

CREATE POLICY "refunds_select_policy" ON public.refunds
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
);

CREATE POLICY "refunds_write_policy" ON public.refunds
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 5. Create public.credit_notes table
CREATE TABLE IF NOT EXISTS public.credit_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    credit_note_number VARCHAR(64) UNIQUE NOT NULL,
    invoice_id UUID NOT NULL REFERENCES public.platform_invoices(id) ON DELETE RESTRICT,
    refund_id UUID REFERENCES public.refunds(id) ON DELETE SET NULL,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    amount_inr NUMERIC(12, 2) NOT NULL CHECK (amount_inr > 0),
    tax_inr NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_inr NUMERIC(12, 2) NOT NULL CHECK (total_inr > 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    reason TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_tenant ON public.credit_notes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice ON public.credit_notes(invoice_id);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_notes FORCE ROW LEVEL SECURITY;

CREATE POLICY "credit_notes_select_policy" ON public.credit_notes
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
);

CREATE POLICY "credit_notes_write_policy" ON public.credit_notes
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 6. Create public.recurring_mandates table (Q4, Q11, Q30)
CREATE TABLE IF NOT EXISTS public.recurring_mandates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    subscription_id UUID NOT NULL REFERENCES public.college_subscriptions(id) ON DELETE CASCADE,
    gateway_subscription_id VARCHAR(128) UNIQUE NULL, -- Razorpay sub_xxx
    customer_id VARCHAR(128) NULL,                    -- Razorpay cust_xxx
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'AUTHENTICATED', 'ACTIVE', 'PAUSED', 'HALTED', 'CANCELLED', 'COMPLETED', 'EXPIRED')),
    billing_interval VARCHAR(32) NOT NULL DEFAULT 'ANNUAL',
    amount_paise BIGINT NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'INR',
    -- Explicit consent evidence
    consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    consent_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    consent_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_cancellation_at TIMESTAMPTZ NULL,
    canceled_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_tenant_active_mandate UNIQUE (tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_recurring_mandates_tenant ON public.recurring_mandates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_recurring_mandates_status ON public.recurring_mandates(status);

ALTER TABLE public.recurring_mandates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_mandates FORCE ROW LEVEL SECURITY;

CREATE POLICY "recurring_mandates_select_policy" ON public.recurring_mandates
FOR SELECT TO authenticated
USING (
    public.is_platform_admin(auth.uid())
    OR tenant_id IN (SELECT tenant_id FROM public.get_user_active_tenants(auth.uid()))
);

CREATE POLICY "recurring_mandates_write_policy" ON public.recurring_mandates
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 7. Create public.subscription_renewal_retries table (Q17, Q34, Q35)
CREATE TABLE IF NOT EXISTS public.subscription_renewal_retries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.college_subscriptions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
    attempt_number INTEGER NOT NULL CHECK (attempt_number BETWEEN 1 AND 5),
    scheduled_at TIMESTAMPTZ NOT NULL,
    attempted_at TIMESTAMPTZ NULL,
    payment_reference VARCHAR(128) NULL,
    amount_paise BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    error_code VARCHAR(64) NULL,
    error_message TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renewal_retries_sub ON public.subscription_renewal_retries(subscription_id);
CREATE INDEX IF NOT EXISTS idx_renewal_retries_status ON public.subscription_renewal_retries(status);

ALTER TABLE public.subscription_renewal_retries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_renewal_retries FORCE ROW LEVEL SECURITY;

CREATE POLICY "renewal_retries_select_policy" ON public.subscription_renewal_retries
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "renewal_retries_write_policy" ON public.subscription_renewal_retries
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 8. Create public.billing_notifications_log table (Q12, Q13, Q37, Q38)
CREATE TABLE IF NOT EXISTS public.billing_notifications_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    notification_type VARCHAR(64) NOT NULL, -- MANUAL_7_DAY, MANUAL_3_DAY, MANUAL_1_DAY, DUE_DATE, POST_EXPIRY, PRE_COLLECTION, RENEWAL_SUCCESS, RENEWAL_FAILED, RETRY_WARNING, GRACE_EXPIRY
    channel VARCHAR(32) NOT NULL DEFAULT 'EMAIL' CHECK (channel IN ('EMAIL', 'IN_APP')),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL, -- prevents duplicate dispatch for milestone
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status VARCHAR(32) NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'FAILED')),
    metadata JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_billing_notif_tenant ON public.billing_notifications_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_billing_notif_key ON public.billing_notifications_log(idempotency_key);

ALTER TABLE public.billing_notifications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_notifications_log FORCE ROW LEVEL SECURITY;

CREATE POLICY "billing_notif_select_policy" ON public.billing_notifications_log
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "billing_notif_write_policy" ON public.billing_notifications_log
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 9. Create public.payment_discrepancies table (Q18, Q21, Q51, Q53)
CREATE TABLE IF NOT EXISTS public.payment_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    order_id VARCHAR(128) NULL,
    payment_id VARCHAR(128) NULL,
    invoice_id UUID REFERENCES public.platform_invoices(id) ON DELETE SET NULL,
    discrepancy_type VARCHAR(64) NOT NULL CHECK (discrepancy_type IN ('MISSING_WEBHOOK', 'AMOUNT_MISMATCH', 'STATUS_MISMATCH', 'CURRENCY_MISMATCH', 'UNEXPECTED_GATEWAY_RECORD')),
    gateway_status VARCHAR(64) NULL,
    local_status VARCHAR(64) NULL,
    suggested_action TEXT NULL,
    details JSONB NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolution_notes TEXT NULL,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_discrepancies_resolved ON public.payment_discrepancies(resolved);
CREATE INDEX IF NOT EXISTS idx_discrepancies_tenant ON public.payment_discrepancies(tenant_id);

ALTER TABLE public.payment_discrepancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_discrepancies FORCE ROW LEVEL SECURITY;

CREATE POLICY "discrepancies_select_policy" ON public.payment_discrepancies
FOR SELECT TO authenticated
USING (public.is_platform_admin(auth.uid()));

CREATE POLICY "discrepancies_write_policy" ON public.payment_discrepancies
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 10. Create public.platform_tax_rules table (Q19 Configurable GST Rules)
CREATE TABLE IF NOT EXISTS public.platform_tax_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name VARCHAR(128) NOT NULL,
    description TEXT NULL,
    tax_type VARCHAR(32) NOT NULL DEFAULT 'GST',
    sac_code VARCHAR(32) NOT NULL DEFAULT '9992',
    sac_heading VARCHAR(16) NULL DEFAULT '9992',
    classification_status VARCHAR(64) NOT NULL DEFAULT 'PROVISIONAL_PENDING_PROFESSIONAL_REVIEW',
    rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    cgst_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 9.00,
    sgst_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 9.00,
    igst_rate_percent NUMERIC(5, 2) NOT NULL DEFAULT 18.00,
    seller_state_code VARCHAR(8) NOT NULL DEFAULT '29', -- e.g. 29 for Karnataka
    is_exempt BOOLEAN NOT NULL DEFAULT FALSE,
    exemption_reason TEXT NULL,
    exemption_reference VARCHAR(128) NULL,
    exemption_validation_status VARCHAR(32) NOT NULL DEFAULT 'NOT_APPLICABLE' CHECK (exemption_validation_status IN ('VERIFIED', 'PENDING_VERIFICATION', 'REJECTED', 'NOT_APPLICABLE')),
    tax_professional_review_notes TEXT NULL,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    effective_to TIMESTAMPTZ NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tax_rules_active ON public.platform_tax_rules(is_active, effective_from);

ALTER TABLE public.platform_tax_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_tax_rules FORCE ROW LEVEL SECURITY;

CREATE POLICY "tax_rules_select_policy" ON public.platform_tax_rules
FOR SELECT TO authenticated
USING (TRUE);

CREATE POLICY "tax_rules_write_policy" ON public.platform_tax_rules
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

-- 11. Create public.billing_job_runs table (Q18, Q21 Scheduled Job History & Deduplication)
CREATE TABLE IF NOT EXISTS public.billing_job_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_name VARCHAR(64) NOT NULL, -- RECONCILE_15MIN, DAILY_SWEEP, RENEWAL_REMINDERS, RENEWAL_RETRIES
    status VARCHAR(32) NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'SUCCESS', 'FAILED')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ NULL,
    duration_ms INTEGER NULL,
    records_processed INTEGER NOT NULL DEFAULT 0,
    summary JSONB NULL,
    errors JSONB NULL,
    triggered_by VARCHAR(64) NOT NULL DEFAULT 'CRON_SCHEDULER',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_runs_name_status ON public.billing_job_runs(job_name, status, started_at);

ALTER TABLE public.billing_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_job_runs FORCE ROW LEVEL SECURITY;

CREATE POLICY "billing_job_runs_admin_policy" ON public.billing_job_runs
FOR ALL TO authenticated
USING (public.is_platform_admin(auth.uid()))
WITH CHECK (public.is_platform_admin(auth.uid()));

