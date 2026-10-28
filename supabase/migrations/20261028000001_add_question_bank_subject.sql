-- ==============================================================================
-- UrPlaced: Multi-College Placement Preparation & Management SaaS
-- Migration: Add dedicated subject column to question_banks for Subject-wise Organization
-- ==============================================================================

-- 1. Add subject column to question_banks (nullable for backward compatibility)
ALTER TABLE public.question_banks 
ADD COLUMN IF NOT EXISTS subject VARCHAR(128);

-- 2. Create index for efficient subject-wise querying and filtering per tenant
CREATE INDEX IF NOT EXISTS idx_question_banks_subject 
ON public.question_banks(tenant_id, subject);

-- 3. Backfill existing question banks where subject is null:
-- Fallback safely to the bank's existing name
UPDATE public.question_banks
SET subject = name
WHERE subject IS NULL AND name IS NOT NULL;
