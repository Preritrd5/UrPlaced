# Phase 04: Schema Architecture & Multi-Tenant RLS Specification

## 1. Architectural Philosophy: Database-Enforced Tenant Isolation

In multi-college placement platforms, cross-tenant data contamination is a fatal vulnerability. To prevent accidental or malicious cross-tenant references, the UrPlaced database schema does not rely solely on application-level filtering or single-column foreign keys.

Instead, we employ the **Composite Foreign Key Pattern**:
- Every primary entity defines a compound unique constraint: `UNIQUE (tenant_id, id)`.
- Every child relation references both `(tenant_id, <parent>_id)`.
- If an attacker or bug attempts to associate a recruitment drive belonging to College A with a company or student record belonging to College B, the PostgreSQL engine rejects the transaction immediately with a foreign key violation before any row is written.

---

## 2. Table Inventory

All tables are created in `supabase/migrations/20261018000002_phase04_college_placement.sql`.

### 2.1 Academic Structure
1. **`academic_years`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `name` (TEXT, e.g., '2025-2026'), `start_date` (DATE), `end_date` (DATE), `status` (TEXT: `UPCOMING`, `ACTIVE`, `COMPLETED`), `created_at`, `updated_at`.
   - Constraints: `UNIQUE (tenant_id, name)`, `UNIQUE (tenant_id, id)`.
2. **`departments`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `name` (TEXT, e.g., 'Computer Science & Engineering'), `code` (TEXT, e.g., 'CSE'), `degree` (TEXT, e.g., 'B.Tech'), `status` (TEXT: `ACTIVE`, `INACTIVE`), `created_at`, `updated_at`.
   - Constraints: `UNIQUE (tenant_id, code)`, `UNIQUE (tenant_id, id)`.

### 2.2 Student Management
3. **`students`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `user_id` (UUID, nullable for unlinked profiles), `academic_year_id` (UUID), `department_id` (UUID), `roll_number` (TEXT), `registration_number` (TEXT), `first_name` (TEXT), `last_name` (TEXT), `email` (TEXT), `phone` (TEXT), `gender` (TEXT), `cgpa` (NUMERIC), `tenth_percentage` (NUMERIC), `twelfth_percentage` (NUMERIC), `active_backlogs` (INTEGER), `history_of_backlogs` (INTEGER), `graduation_year` (INTEGER), `placement_status` (TEXT: `NOT_PLACED`, `PLACED`, `OPTED_OUT`), `status` (TEXT: `ACTIVE`, `SUSPENDED`, `ALUMNI`), `created_at`, `updated_at`.
   - Foreign Keys:
     - `FOREIGN KEY (tenant_id, academic_year_id) REFERENCES academic_years(tenant_id, id)`
     - `FOREIGN KEY (tenant_id, department_id) REFERENCES departments(tenant_id, id)`
   - Constraints: `UNIQUE (tenant_id, roll_number)`, `UNIQUE (tenant_id, email)`, `UNIQUE (tenant_id, id)`.

### 2.3 Company Directory
4. **`companies`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `name` (TEXT), `normalized_name` (TEXT), `website` (TEXT), `industry` (TEXT), `tier` (TEXT: `TIER_1`, `TIER_2`, `TIER_3`, `STARTUP`), `status` (TEXT: `ACTIVE`, `INACTIVE`), `contact_person` (TEXT), `contact_email` (TEXT), `contact_phone` (TEXT), `notes` (TEXT), `created_at`, `updated_at`.
   - Constraints: `UNIQUE (tenant_id, normalized_name)`, `UNIQUE (tenant_id, id)`.

### 2.4 Recruitment Drives & Pipeline
5. **`recruitment_drives`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `company_id` (UUID), `academic_year_id` (UUID), `title` (TEXT), `role_title` (TEXT), `recruitment_type` (TEXT: `FULL_TIME`, `INTERNSHIP`, `INTERN_PPO`), `job_description` (TEXT), `location` (TEXT), `compensation_range` (TEXT), `status` (TEXT: `DRAFT`, `PUBLISHED`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `registration_start` (TIMESTAMPTZ), `registration_deadline` (TIMESTAMPTZ), `internal_notes` (TEXT), `created_at`, `updated_at`.
   - Foreign Keys:
     - `FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)`
     - `FOREIGN KEY (tenant_id, academic_year_id) REFERENCES academic_years(tenant_id, id)`
   - Constraints: `UNIQUE (tenant_id, id)`.

6. **`drive_eligibility_criteria`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `drive_id` (UUID), `min_cgpa` (NUMERIC), `min_tenth_percentage` (NUMERIC), `min_twelfth_percentage` (NUMERIC), `max_active_backlogs` (INTEGER), `max_history_backlogs` (INTEGER), `allowed_graduation_years` (INTEGER ARRAY), `allowed_department_ids` (UUID ARRAY), `allow_placed_students` (BOOLEAN), `allow_opted_out_students` (BOOLEAN), `created_at`, `updated_at`.
   - Foreign Keys:
     - `FOREIGN KEY (tenant_id, drive_id) REFERENCES recruitment_drives(tenant_id, id) ON DELETE CASCADE`
   - Constraints: `UNIQUE (tenant_id, drive_id)`, `UNIQUE (tenant_id, id)`.

7. **`drive_stages`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `drive_id` (UUID), `name` (TEXT), `stage_type` (TEXT: `OA`, `ONLINE_TEST`, `TECHNICAL_INTERVIEW`, `HR_INTERVIEW`, `GD`, `FINAL_DECISION`), `sequence_order` (INTEGER), `is_elimination` (BOOLEAN), `scheduled_at` (TIMESTAMPTZ), `created_at`, `updated_at`.
   - Foreign Keys:
     - `FOREIGN KEY (tenant_id, drive_id) REFERENCES recruitment_drives(tenant_id, id) ON DELETE CASCADE`
   - Constraints: `UNIQUE (tenant_id, drive_id, sequence_order)`, `UNIQUE (tenant_id, id)`.

8. **`drive_applications`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `drive_id` (UUID), `student_id` (UUID), `eligibility_status` (TEXT: `ELIGIBLE`, `INELIGIBLE`, `EXEMPTED`, `FLAGGED`), `eligibility_reasons` (TEXT ARRAY), `application_status` (TEXT: `APPLIED`, `WITHDRAWN`, `SHORTLISTED`, `REJECTED`, `OFFERED`), `current_stage_id` (UUID), `applied_at` (TIMESTAMPTZ), `created_at`, `updated_at`.
   - Foreign Keys:
     - `FOREIGN KEY (tenant_id, drive_id) REFERENCES recruitment_drives(tenant_id, id) ON DELETE CASCADE`
     - `FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id) ON DELETE CASCADE`
   - Constraints: `UNIQUE (tenant_id, drive_id, student_id)`, `UNIQUE (tenant_id, id)`.

9. **`candidate_stage_results`**
   - Columns: `id` (UUID), `tenant_id` (UUID), `application_id` (UUID), `stage_id` (UUID), `status` (TEXT: `PENDING`, `QUALIFIED`, `DISQUALIFIED`, `ABSENT`), `score` (NUMERIC), `feedback` (TEXT), `evaluated_at` (TIMESTAMPTZ), `created_at`, `updated_at`.
   - Foreign Keys:
     - `FOREIGN KEY (tenant_id, application_id) REFERENCES drive_applications(tenant_id, id) ON DELETE CASCADE`
     - `FOREIGN KEY (tenant_id, stage_id) REFERENCES drive_stages(tenant_id, id) ON DELETE CASCADE`
   - Constraints: `UNIQUE (tenant_id, application_id, stage_id)`, `UNIQUE (tenant_id, id)`.

10. **`placement_offers`**
    - Columns: `id` (UUID), `tenant_id` (UUID), `drive_id` (UUID), `student_id` (UUID), `application_id` (UUID), `company_id` (UUID), `ctc_lpa` (NUMERIC), `base_salary_lpa` (NUMERIC), `stipend_monthly` (NUMERIC), `role_title` (TEXT), `offer_letter_url` (TEXT), `status` (TEXT: `OFFERED`, `ACCEPTED`, `REJECTED`, `REVOKED`), `accepted_at` (TIMESTAMPTZ), `rejected_at` (TIMESTAMPTZ), `created_at`, `updated_at`.
    - Foreign Keys:
      - `FOREIGN KEY (tenant_id, drive_id) REFERENCES recruitment_drives(tenant_id, id)`
      - `FOREIGN KEY (tenant_id, student_id) REFERENCES students(tenant_id, id)`
      - `FOREIGN KEY (tenant_id, application_id) REFERENCES drive_applications(tenant_id, id)`
      - `FOREIGN KEY (tenant_id, company_id) REFERENCES companies(tenant_id, id)`
    - Constraints: `UNIQUE (tenant_id, id)`.

---

## 3. Row-Level Security (RLS) Implementation

All 10 tables have Row Level Security enabled and forced:
```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
ALTER TABLE <table_name> FORCE ROW LEVEL SECURITY;
```

### 3.1 Security Helper Functions
Tenant staff membership is evaluated deterministically via a security-definer helper:
```sql
CREATE OR REPLACE FUNCTION public.is_tenant_staff(target_tenant_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE tenant_id = target_tenant_id
      AND user_id = $2
      AND role IN ('TENANT_ADMIN', 'PLACEMENT_OFFICER', 'COORDINATOR')
      AND status = 'ACTIVE'
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

### 3.2 Access Policies Matrix
- **Staff Access:** Tenant staff (`TENANT_ADMIN`, `PLACEMENT_OFFICER`, `COORDINATOR`) possess full `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions restricted strictly to their active tenant:
  `USING (is_tenant_staff(tenant_id, auth.uid()))` with `WITH CHECK (is_tenant_staff(tenant_id, auth.uid()))`.
- **Student Access:**
  - `students`: Students can view their own record (`user_id = auth.uid()`).
  - `recruitment_drives`: Students can view drives in their tenant once status is `PUBLISHED`, `REGISTRATION_OPEN`, `REGISTRATION_CLOSED`, `IN_PROGRESS`, or `COMPLETED`.
  - `drive_applications`: Students can view and insert their own applications (`student_id IN (SELECT id FROM students WHERE user_id = auth.uid())`).
  - `placement_offers`: Students can view offers extended to them and update their own acceptance status.
