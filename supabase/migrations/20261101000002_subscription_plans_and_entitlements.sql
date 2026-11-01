-- ==============================================================================
-- UrPlaced Migration: Phase SA-04 — Subscription Plans, Entitlements & Versioning
-- 
-- Structures:
--   1. Extend public.subscription_plans with versioning, lifecycle status, display order,
--      structured limits, and feature entitlements.
--   2. Extend public.college_subscriptions with plan_version, entitlements_snapshot,
--      and pending plan change columns (pending_plan_id, pending_plan_version, etc.)
--      to protect existing subscribers against unexpected silent plan modifications.
--   3. Ensure public.college_subscriptions status permits 'PENDING_PAYMENT'.
--   4. Seed starter templates as DRAFT configurations awaiting commercial approval.
--   5. Backfill valid frozen snapshots for all legacy subscriptions.
-- ==============================================================================

-- 1. Extend subscription_plans
ALTER TABLE public.subscription_plans
ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
ADD COLUMN IF NOT EXISTS currency VARCHAR(8) NOT NULL DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(32) NOT NULL DEFAULT 'ANNUAL',
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS limits JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS entitlements JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Add check constraint for status if not present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_subscription_plans_status'
    ) THEN
        ALTER TABLE public.subscription_plans
        ADD CONSTRAINT chk_subscription_plans_status
        CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
    END IF;
END $$;

-- 2. Extend college_subscriptions with versioning, snapshot, and pending plan change columns
ALTER TABLE public.college_subscriptions
ADD COLUMN IF NOT EXISTS plan_version INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS entitlements_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS pending_plan_id VARCHAR(64) NULL,
ADD COLUMN IF NOT EXISTS pending_plan_version INTEGER NULL,
ADD COLUMN IF NOT EXISTS plan_change_scheduled_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS plan_change_effective_at TIMESTAMPTZ NULL;

-- Ensure status check includes PENDING_PAYMENT
DO $$
BEGIN
    -- Drop old check constraint if it exists and create updated one
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'college_subscriptions_status_check'
    ) THEN
        ALTER TABLE public.college_subscriptions DROP CONSTRAINT college_subscriptions_status_check;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_college_subscriptions_status_sa04'
    ) THEN
        ALTER TABLE public.college_subscriptions
        ADD CONSTRAINT chk_college_subscriptions_status_sa04
        CHECK (status IN ('ACTIVE', 'PENDING_PAYMENT', 'TRIALING', 'PAST_DUE', 'CANCELED', 'EXPIRED'));
    END IF;
END $$;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_status ON public.subscription_plans(status);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_order ON public.subscription_plans(display_order);
CREATE INDEX IF NOT EXISTS idx_college_subs_plan_version ON public.college_subscriptions(plan_id, plan_version);
CREATE INDEX IF NOT EXISTS idx_college_subs_pending_plan ON public.college_subscriptions(pending_plan_id);

-- 4. Seed / Update standard template plans with structured limits and feature entitlements
-- Note: Set to 'DRAFT' template status. Administrators can review, adjust commercials, and publish.
UPDATE public.subscription_plans
SET
    display_order = 1,
    status = 'DRAFT',
    currency = 'INR',
    billing_interval = 'ANNUAL',
    discount_percentage = 0.00,
    version = 1,
    limits = '{
        "max_students": 500,
        "max_staff": 5,
        "max_drives": 10,
        "max_storage_gb": 20,
        "max_assessments": 25,
        "ai_tokens_monthly": 50000
    }'::jsonb,
    entitlements = '{
        "core_drives_management": true,
        "student_roster_directory": true,
        "company_management": true,
        "standard_assessments": true,
        "subject_question_banks": true,
        "custom_question_sets": false,
        "drivefit_evaluator": false,
        "mistake_to_mastery": false,
        "placement_memory_analytics": false,
        "automated_eligibility_engine": false,
        "ai_question_generator": false,
        "ai_tutor_assistant": false,
        "ai_evaluation_pipeline": false,
        "department_hierarchy": false,
        "audit_data_export_hub": false,
        "dedicated_sla_liaison": false
    }'::jsonb
WHERE id = 'starter';

UPDATE public.subscription_plans
SET
    display_order = 2,
    status = 'DRAFT',
    currency = 'INR',
    billing_interval = 'ANNUAL',
    discount_percentage = 10.00,
    version = 1,
    limits = '{
        "max_students": 2500,
        "max_staff": 20,
        "max_drives": 50,
        "max_storage_gb": 100,
        "max_assessments": 200,
        "ai_tokens_monthly": 500000
    }'::jsonb,
    entitlements = '{
        "core_drives_management": true,
        "student_roster_directory": true,
        "company_management": true,
        "standard_assessments": true,
        "subject_question_banks": true,
        "custom_question_sets": true,
        "drivefit_evaluator": true,
        "mistake_to_mastery": true,
        "placement_memory_analytics": true,
        "automated_eligibility_engine": true,
        "ai_question_generator": true,
        "ai_tutor_assistant": true,
        "ai_evaluation_pipeline": false,
        "department_hierarchy": false,
        "audit_data_export_hub": true,
        "dedicated_sla_liaison": false
    }'::jsonb
WHERE id = 'growth';

UPDATE public.subscription_plans
SET
    display_order = 3,
    status = 'DRAFT',
    currency = 'INR',
    billing_interval = 'ANNUAL',
    discount_percentage = 15.00,
    version = 1,
    limits = '{
        "max_students": 10000,
        "max_staff": 100,
        "max_drives": null,
        "max_storage_gb": 500,
        "max_assessments": null,
        "ai_tokens_monthly": null
    }'::jsonb,
    entitlements = '{
        "core_drives_management": true,
        "student_roster_directory": true,
        "company_management": true,
        "standard_assessments": true,
        "subject_question_banks": true,
        "custom_question_sets": true,
        "drivefit_evaluator": true,
        "mistake_to_mastery": true,
        "placement_memory_analytics": true,
        "automated_eligibility_engine": true,
        "ai_question_generator": true,
        "ai_tutor_assistant": true,
        "ai_evaluation_pipeline": true,
        "department_hierarchy": true,
        "audit_data_export_hub": true,
        "dedicated_sla_liaison": true
    }'::jsonb
WHERE id = 'enterprise';

-- 5. Backfill entitlements_snapshot for existing college subscriptions
-- Ensures legacy subscriptions without a frozen snapshot receive an immutable snapshot
-- based on their assigned plan at version 1 rather than relying on mutable live plan rows.
UPDATE public.college_subscriptions cs
SET
    plan_version = COALESCE(sp.version, 1),
    entitlements_snapshot = jsonb_build_object(
        'planId', sp.id,
        'planName', sp.name,
        'planVersion', COALESCE(sp.version, 1),
        'priceInr', sp.price_inr,
        'billingCycle', sp.billing_cycle,
        'limits', sp.limits,
        'entitlements', sp.entitlements,
        'snapshotAt', COALESCE(cs.created_at, NOW())
    )
FROM public.subscription_plans sp
WHERE cs.plan_id = sp.id
  AND (cs.entitlements_snapshot IS NULL OR cs.entitlements_snapshot = '{}'::jsonb OR cs.entitlements_snapshot->'entitlements' IS NULL);
