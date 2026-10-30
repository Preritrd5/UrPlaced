### 1. `academic_years`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `name` | `VARCHAR(64)` | NOT NULL | `—` | UNIQUE;  |
| `start_date` | `DATE` | NOT NULL | `—` | — |
| `end_date` | `DATE` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'PLANNED'` | CHECK: `status IN ('PLANNED', 'ACTIVE', 'ARCHIVED')`;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_academic_years_tenant` on `(tenant_id)`
- `idx_academic_years_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"academic_years_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"academic_years_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"academic_years_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"academic_years_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 2. `ai_drivefit_evaluations`

- **Migration Source:** `20261025000001_phase12_ai_intelligence_persistence.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `user_id` | `UUID` | NOT NULL | `—` | FK -> `auth.users(id)` ON DELETE CASCADE;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE CASCADE;  |
| `overall_fit_score` | `INTEGER` | NOT NULL | `0` | CHECK: `overall_fit_score BETWEEN 0 AND 100`;  |
| `eligibility_status` | `VARCHAR(32)` | NOT NULL | `'UNKNOWN'` | — |
| `eligibility_details` | `JSONB` | NOT NULL | `—` | — |
| `skill_match_analysis` | `JSONB` | NOT NULL | `—` | — |
| `preparation_roadmap` | `JSONB` | NOT NULL | `—` | — |
| `recommended_question_ids` | `UUID` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_ai_drivefit_user_drive` on `(user_id, drive_id, created_at DESC)`

**RLS Policies (1):**
- **"Students can view and create own drivefit evaluations"** — Action: `ALL` | Role: `PUBLIC`

---

### 3. `ai_mistake_analyses`

- **Migration Source:** `20261025000001_phase12_ai_intelligence_persistence.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `user_id` | `UUID` | NOT NULL | `—` | FK -> `auth.users(id)` ON DELETE CASCADE;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `summary` | `TEXT` | NOT NULL | `—` | — |
| `identified_gaps` | `JSONB` | NOT NULL | `—` | — |
| `recommended_actions` | `JSONB` | NOT NULL | `—` | — |
| `recommended_question_ids` | `UUID` | NOT NULL | `—` | — |
| `total_mistakes_analyzed` | `INTEGER` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_ai_mistakes_user_created` on `(user_id, created_at DESC)`

**RLS Policies (1):**
- **"Students can view own mistake analyses"** — Action: `ALL` | Role: `PUBLIC`

---

### 4. `ai_tutor_conversations`

- **Migration Source:** `20261025000001_phase12_ai_intelligence_persistence.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `user_id` | `UUID` | NOT NULL | `—` | FK -> `auth.users(id)` ON DELETE CASCADE;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `topic` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `question_id` | `UUID` | NULL | `—` | FK -> `questions(id)` ON DELETE SET NULL;  |
| `messages` | `JSONB` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_ai_tutor_user_updated` on `(user_id, updated_at DESC)`
- `idx_ai_tutor_question` on `(question_id)`

**RLS Policies (1):**
- **"Users can manage own tutor conversations"** — Action: `ALL` | Role: `PUBLIC`

---

### 5. `ai_usage_logs`

- **Migration Source:** `20261025000001_phase12_ai_intelligence_persistence.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `user_id` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `feature` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `model` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `prompt_tokens` | `INTEGER` | NOT NULL | `—` | — |
| `completion_tokens` | `INTEGER` | NOT NULL | `—` | — |
| `total_tokens` | `INTEGER` | NOT NULL | `—` | — |
| `duration_ms` | `INTEGER` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'SUCCESS'` | — |
| `error_message` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_ai_usage_tenant_user` on `(tenant_id, user_id)`
- `idx_ai_usage_feature_status` on `(feature, status)`
- `idx_ai_usage_created_at` on `(created_at DESC)`

**RLS Policies (3):**
- **"Users can read own AI usage logs"** — Action: `SELECT` | Role: `PUBLIC`
- **"Tenant staff can view aggregate tenant AI logs"** — Action: `SELECT` | Role: `PUBLIC`
- **"Service role can insert AI usage logs"** — Action: `INSERT` | Role: `PUBLIC`

---

### 6. `analytics_export_jobs`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `requested_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `report_type` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `filter_payload` | `JSONB` | NOT NULL | `—` | — |
| `file_name` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `file_path` | `VARCHAR(512)` | NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'PENDING'` | — |
| `record_count` | `INTEGER` | NOT NULL | `—` | — |
| `error_message` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `completed_at` | `TIMESTAMPTZ` | NULL | `—` | — |

**Indexes:**
- `idx_export_jobs_tenant` on `(tenant_id)`
- `idx_export_jobs_status` on `(tenant_id, status)`

**RLS Policies (1):**
- **"Users can view and manage their own export jobs"** — Action: `ALL` | Role: `authenticated`

---

### 7. `assessment_assignments`

- **Migration Source:** `20261019000001_phase07_assessment_engine.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `assessment_id` | `UUID` | NOT NULL | `—` | FK -> `assessments(id)` ON DELETE CASCADE;  |
| `student_id` | `UUID` | NULL | `—` | FK -> `students(id)` ON DELETE CASCADE;  |
| `cohort_name` | `VARCHAR(128)` | NULL | `—` | — |
| `window_start` | `TIMESTAMPTZ` | NULL | `—` | — |
| `window_end` | `TIMESTAMPTZ` | NULL | `—` | — |
| `max_attempts_override` | `INTEGER` | NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | — |
| `assigned_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_assessment_assignments_tenant` on `(tenant_id)`
- `idx_assessment_assignments_assessment` on `(assessment_id)`
- `idx_assessment_assignments_student` on `(student_id)`
- `idx_assessment_assignments_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"p07_assignments_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p07_assignments_insert"** — Action: `INSERT` | Role: `PUBLIC`
- **"p07_assignments_update"** — Action: `UPDATE` | Role: `PUBLIC`
- **"p07_assignments_delete"** — Action: `DELETE` | Role: `PUBLIC`

---

### 8. `assessment_attempts`

- **Migration Source:** `20261019000001_phase07_assessment_engine.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `assessment_id` | `UUID` | NOT NULL | `—` | FK -> `assessments(id)` ON DELETE CASCADE; UNIQUE;  |
| `assignment_id` | `UUID` | NULL | `—` | FK -> `assessment_assignments(id)` ON DELETE SET NULL;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE; UNIQUE;  |
| `attempt_number` | `INTEGER` | NOT NULL | `—` | UNIQUE;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'IN_PROGRESS'` | — |
| `started_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `expires_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `submitted_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `total_points` | `NUMERIC(8, 2)` | NOT NULL | `—` | — |
| `earned_points` | `NUMERIC(8, 2)` | NOT NULL | `—` | — |
| `score_percentage` | `NUMERIC(5, 2)` | NOT NULL | `—` | — |
| `is_passed` | `BOOLEAN` | NOT NULL | `—` | — |
| `scoring_status` | `VARCHAR(32)` | NOT NULL | `'PENDING'` | — |
| `client_meta` | `JSONB` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_assessment_attempts_tenant` on `(tenant_id)`
- `idx_assessment_attempts_student` on `(tenant_id, student_id)`
- `idx_assessment_attempts_assessment` on `(assessment_id)`
- `idx_assessment_attempts_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"p07_attempts_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p07_attempts_insert"** — Action: `INSERT` | Role: `PUBLIC`
- **"p07_attempts_update"** — Action: `UPDATE` | Role: `PUBLIC`
- **"p07_attempts_delete"** — Action: `DELETE` | Role: `PUBLIC`

---

### 9. `assessments`

- **Migration Source:** `20261019000001_phase07_assessment_engine.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `title` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `purpose` | `VARCHAR(64)` | NOT NULL | `'ASSESSMENT'` | — |
| `question_set_id` | `UUID` | NOT NULL | `—` | FK -> `question_sets(id)` ON DELETE RESTRICT;  |
| `set_version_id` | `INTEGER` | NOT NULL | `—` | — |
| `drive_id` | `UUID` | NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE SET NULL;  |
| `time_limit_minutes` | `INTEGER` | NULL | `—` | — |
| `allowed_attempts` | `INTEGER` | NOT NULL | `—` | — |
| `review_policy` | `VARCHAR(32)` | NOT NULL | `'IMMEDIATE'` | — |
| `release_policy` | `VARCHAR(32)` | NOT NULL | `'IMMEDIATE'` | — |
| `shuffle_questions` | `BOOLEAN` | NOT NULL | `—` | — |
| `pass_percentage` | `NUMERIC(5, 2)` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'DRAFT'` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_assessments_tenant` on `(tenant_id)`
- `idx_assessments_status` on `(tenant_id, status)`
- `idx_assessments_purpose` on `(tenant_id, purpose)`
- `idx_assessments_set` on `(question_set_id)`
- `idx_assessments_drive` on `(drive_id)`

**RLS Policies (4):**
- **"p07_assessments_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p07_assessments_insert"** — Action: `INSERT` | Role: `PUBLIC`
- **"p07_assessments_update"** — Action: `UPDATE` | Role: `PUBLIC`
- **"p07_assessments_delete"** — Action: `DELETE` | Role: `PUBLIC`

---

### 10. `attempt_responses`

- **Migration Source:** `20261019000001_phase07_assessment_engine.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `attempt_id` | `UUID` | NOT NULL | `—` | FK -> `assessment_attempts(id)` ON DELETE CASCADE; UNIQUE;  |
| `question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `version_id` | `UUID` | NOT NULL | `—` | FK -> `question_versions(id)` ON DELETE RESTRICT;  |
| `response_payload` | `JSONB` | NOT NULL | `—` | — |
| `save_sequence` | `INTEGER` | NOT NULL | `—` | — |
| `is_flagged` | `BOOLEAN` | NOT NULL | `—` | — |
| `is_answered` | `BOOLEAN` | NOT NULL | `—` | — |
| `points_awarded` | `NUMERIC(6, 2)` | NOT NULL | `—` | — |
| `is_correct` | `BOOLEAN` | NULL | `—` | — |
| `scoring_status` | `VARCHAR(32)` | NOT NULL | `'UNSCORED'` | — |
| `manual_notes` | `TEXT` | NULL | `—` | — |
| `last_saved_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_attempt_responses_tenant` on `(tenant_id)`
- `idx_attempt_responses_attempt` on `(attempt_id)`
- `idx_attempt_responses_question` on `(question_id)`
- `idx_attempt_responses_scoring` on `(attempt_id, scoring_status)`

**RLS Policies (4):**
- **"p07_responses_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p07_responses_insert"** — Action: `INSERT` | Role: `PUBLIC`
- **"p07_responses_update"** — Action: `UPDATE` | Role: `PUBLIC`
- **"p07_responses_delete"** — Action: `DELETE` | Role: `PUBLIC`

---

### 11. `audit_logs`

- **Migration Source:** `20261018000001_phase03_auth_tenancy_rls.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `BIGSERIAL` | NOT NULL | `—` | PRIMARY KEY;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE SET NULL;  |
| `actor_id` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `action` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `resource_type` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `resource_id` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `before_state` | `JSONB` | NULL | `—` | — |
| `after_state` | `JSONB` | NULL | `—` | — |
| `ip_address` | `TEXT` | NULL | `—` | — |
| `user_agent` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_audit_logs_tenant_id` on `(tenant_id)`
- `idx_audit_logs_actor_id` on `(actor_id)`
- `idx_audit_logs_action` on `(action)`
- `idx_audit_logs_created_at` on `(created_at)`

**RLS Policies (2):**
- **"audit_logs_select_policy"** — Action: `SELECT` | Role: `PUBLIC`
- **"audit_logs_insert_policy"** — Action: `INSERT` | Role: `PUBLIC`

---

### 12. `candidate_stage_results`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE; CHECK: `status IN ('PENDING', 'SCHEDULED', 'PASSED', 'FAILED', 'SKIPPED', 'ON_HOLD')`;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `application_id` | `UUID` | NOT NULL | `—` | FK -> `drive_applications(tenant_id, id)` ON DELETE CASCADE; UNIQUE;  |
| `stage_id` | `UUID` | NOT NULL | `—` | FK -> `drive_stages(tenant_id, id)` ON DELETE CASCADE; UNIQUE;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'PENDING'` | CHECK: `status IN ('PENDING', 'SCHEDULED', 'PASSED', 'FAILED', 'SKIPPED', 'ON_HOLD')`;  |
| `score` | `NUMERIC(6, 2)` | NULL | `—` | — |
| `student_feedback` | `TEXT` | NULL | `—` | — |
| `internal_notes` | `TEXT` | NULL | `—` | — |
| `evaluated_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `evaluated_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_results_app` on `(application_id)`
- `idx_results_stage` on `(stage_id)`
- `idx_results_tenant` on `(tenant_id)`

**RLS Policies (4):**
- **"stage_results_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"stage_results_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"stage_results_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"stage_results_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 13. `canonical_skills`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `None`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `name` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `normalized_name` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `category` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `tags` | `TEXT` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_canonical_skills_category` on `(category)`
- `idx_canonical_skills_normalized` on `(normalized_name)`

**RLS Policies (1):**
- **"p_canonical_skills_read"** — Action: `SELECT` | Role: `authenticated`

---

### 14. `companies`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `name` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `normalized_name` | `VARCHAR(255)` | NOT NULL | `—` | UNIQUE;  |
| `website` | `TEXT` | NULL | `—` | — |
| `industry` | `VARCHAR(128)` | NULL | `—` | — |
| `contact_person` | `VARCHAR(128)` | NULL | `—` | — |
| `contact_email` | `VARCHAR(255)` | NULL | `—` | — |
| `contact_phone` | `VARCHAR(32)` | NULL | `—` | — |
| `internal_notes` | `TEXT` | NULL | `—` | — |
| `is_archived` | `BOOLEAN` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_companies_tenant` on `(tenant_id)`
- `idx_companies_archived` on `(tenant_id, is_archived)`

**RLS Policies (4):**
- **"companies_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"companies_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"companies_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"companies_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 15. `departments`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `name` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `code` | `VARCHAR(32)` | NOT NULL | `—` | UNIQUE;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | CHECK: `status IN ('ACTIVE', 'INACTIVE')`;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_departments_tenant` on `(tenant_id)`

**RLS Policies (4):**
- **"departments_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"departments_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"departments_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"departments_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 16. `drive_applications`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(tenant_id, id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(tenant_id, id)` ON DELETE RESTRICT; UNIQUE;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'REGISTERED'` | CHECK: `status IN ('REGISTERED', 'WITHDRAWN', 'IN_PROCESS', 'REJECTED', 'OFFER_EXTENDED', 'OFFER_ACCEPTED', 'OFFER_DECLINED')`;  |
| `eligibility_snapshot` | `JSONB` | NOT NULL | `—` | — |
| `current_stage_id` | `UUID` | NULL | `—` | FK -> `drive_stages(tenant_id, id)` ON DELETE SET NULL;  |
| `registration_date` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `withdrawn_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `withdrawn_reason` | `TEXT` | NULL | `—` | — |
| `registered_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_applications_drive` on `(drive_id)`
- `idx_applications_student` on `(student_id)`
- `idx_applications_tenant` on `(tenant_id)`
- `idx_applications_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"applications_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"applications_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"applications_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"applications_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 17. `drive_eligibility_criteria`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(tenant_id, id)` ON DELETE CASCADE; UNIQUE;  |
| `min_cgpa` | `NUMERIC(4, 2)` | NOT NULL | `0.00` | CHECK: `min_cgpa >= 0.00 AND min_cgpa <= 10.00`;  |
| `min_tenth_percentage` | `NUMERIC(5, 2)` | NULL | `—` | CHECK: `min_tenth_percentage IS NULL OR (min_tenth_percentage >= 0.00 AND min_tenth_percentage <= 100.00)`;  |
| `min_twelfth_percentage` | `NUMERIC(5, 2)` | NULL | `—` | CHECK: `min_twelfth_percentage IS NULL OR (min_twelfth_percentage >= 0.00 AND min_twelfth_percentage <= 100.00)`;  |
| `max_active_backlogs` | `INTEGER` | NOT NULL | `0` | CHECK: `max_active_backlogs >= 0`;  |
| `max_total_backlogs` | `INTEGER` | NULL | `—` | CHECK: `max_total_backlogs IS NULL OR max_total_backlogs >= 0`;  |
| `allowed_departments` | `UUID` | NOT NULL | `—` | — |
| `allowed_graduation_years` | `INTEGER` | NOT NULL | `—` | — |
| `allowed_degrees` | `TEXT` | NOT NULL | `—` | — |
| `allowed_academic_statuses` | `TEXT` | NOT NULL | `—` | — |
| `criteria_version` | `INTEGER` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_criteria_drive` on `(drive_id)`
- `idx_criteria_tenant` on `(tenant_id)`

**RLS Policies (4):**
- **"criteria_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"criteria_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"criteria_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"criteria_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 18. `drive_stages`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(tenant_id, id)` ON DELETE CASCADE; UNIQUE;  |
| `name` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `stage_type` | `VARCHAR(32)` | NOT NULL | `—` | CHECK: `stage_type IN ('REGISTRATION', 'ONLINE_TEST', 'CODING_TEST', 'GROUP_DISCUSSION', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'FINAL_SELECTION')`;  |
| `stage_order` | `INTEGER` | NOT NULL | `—` | UNIQUE; CHECK: `stage_order >= 1`;  |
| `description` | `TEXT` | NULL | `—` | — |
| `scheduled_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `is_student_visible` | `BOOLEAN` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_stages_drive` on `(drive_id)`
- `idx_stages_tenant` on `(tenant_id)`

**RLS Policies (4):**
- **"stages_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"stages_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"stages_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"stages_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 19. `experience_report_moderation_logs`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `report_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_experience_reports(id)` ON DELETE CASCADE;  |
| `previous_status` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `new_status` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `moderated_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `moderation_notes` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_report_mod_tenant` on `(tenant_id)`
- `idx_report_mod_report` on `(report_id)`

**RLS Policies (1):**
- **"Placement staff can view and create moderation logs"** — Action: `ALL` | Role: `authenticated`

---

### 20. `historical_drive_comparisons`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `current_drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE CASCADE;  |
| `historical_record_id` | `UUID` | NOT NULL | `—` | FK -> `historical_recruitment_records(id)` ON DELETE CASCADE;  |
| `matching_basis` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `shared_attributes` | `JSONB` | NOT NULL | `—` | — |
| `differing_attributes` | `JSONB` | NOT NULL | `—` | — |
| `unknown_fields` | `JSONB` | NOT NULL | `—` | — |
| `conflicts` | `JSONB` | NOT NULL | `—` | — |
| `comparability_status` | `VARCHAR(32)` | NOT NULL | `'PARTIALLY_COMPARABLE'` | — |
| `limitations_disclaimer` | `TEXT` | NOT NULL | `—` | — |
| `generated_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `generated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_drive_comp_tenant` on `(tenant_id)`
- `idx_drive_comp_current` on `(tenant_id, current_drive_id)`
- `idx_drive_comp_historical` on `(tenant_id, historical_record_id)`

**RLS Policies (3):**
- **"Super admins have full access to drive comparisons"** — Action: `ALL` | Role: `authenticated`
- **"Tenant members can view tenant drive comparisons"** — Action: `SELECT` | Role: `authenticated`
- **"Placement staff can manage drive comparisons"** — Action: `ALL` | Role: `authenticated`

---

### 21. `historical_recruitment_records`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `company_id` | `UUID` | NOT NULL | `—` | FK -> `companies(id)` ON DELETE CASCADE;  |
| `role_title` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `recruitment_year` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `recruitment_cycle` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `historical_drive_id` | `UUID` | NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE SET NULL;  |
| `source_id` | `UUID` | NULL | `—` | FK -> `recruitment_sources(id)` ON DELETE SET NULL;  |
| `record_type` | `VARCHAR(64)` | NOT NULL | `'COLLEGE_CONFIRMED'` | — |
| `reliability_label` | `VARCHAR(64)` | NOT NULL | `'COLLEGE_CONFIRMED'` | — |
| `process_summary` | `TEXT` | NULL | `—` | — |
| `eligibility_criteria_snapshot` | `JSONB` | NOT NULL | `—` | — |
| `confirmed_rounds` | `JSONB` | NOT NULL | `—` | — |
| `reported_rounds` | `JSONB` | NOT NULL | `—` | — |
| `relevant_question_set_id` | `UUID` | NULL | `—` | FK -> `question_sets(id)` ON DELETE SET NULL;  |
| `verification_status` | `VARCHAR(32)` | NOT NULL | `'VERIFIED'` | — |
| `source_date` | `TIMESTAMPTZ` | NULL | `—` | — |
| `last_verified_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `is_superseded` | `BOOLEAN` | NOT NULL | `—` | — |
| `superseded_by` | `UUID` | NULL | `—` | FK -> `historical_recruitment_records(id)` ON DELETE SET NULL;  |
| `sharing_scope` | `VARCHAR(32)` | NOT NULL | `'COLLEGE_PRIVATE'` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_hist_records_tenant` on `(tenant_id)`
- `idx_hist_records_company` on `(tenant_id, company_id)`
- `idx_hist_records_year` on `(tenant_id, recruitment_year)`
- `idx_hist_records_scope` on `(sharing_scope)`

**RLS Policies (3):**
- **"Super admins have full access to historical records"** — Action: `ALL` | Role: `authenticated`
- **"Tenant members can view college private or global shared historical records"** — Action: `SELECT` | Role: `authenticated`
- **"Placement staff can manage tenant historical records"** — Action: `ALL` | Role: `authenticated`

---

### 22. `invitations`

- **Migration Source:** `20261018000001_phase03_auth_tenancy_rls.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `email` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `role` | `VARCHAR(32)` | NOT NULL | `—` | CHECK: `role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER', 'STUDENT', 'SUPER_ADMIN')`;  |
| `permissions` | `JSONB` | NOT NULL | `—` | — |
| `token_hash` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'PENDING'` | CHECK: `status IN ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')`;  |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `accepted_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_invitations_token_hash` on `(token_hash)`
- `idx_invitations_email` on `(email)`
- `idx_invitations_tenant` on `(tenant_id)`
- `idx_invitations_status` on `(status)`

**RLS Policies (3):**
- **"invitations_select_policy"** — Action: `SELECT` | Role: `PUBLIC`
- **"invitations_insert_policy"** — Action: `INSERT` | Role: `PUBLIC`
- **"invitations_update_policy"** — Action: `UPDATE` | Role: `PUBLIC`

---

### 23. `mastery_evidence_records`

- **Migration Source:** `20261019000002_phase08_mistake_to_mastery.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE;  |
| `skill_id` | `UUID` | NOT NULL | `—` | FK -> `canonical_skills(id)` ON DELETE CASCADE;  |
| `target_id` | `UUID` | NULL | `—` | FK -> `mistake_review_targets(id)` ON DELETE SET NULL;  |
| `evidence_question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE;  |
| `evidence_version_id` | `UUID` | NOT NULL | `—` | FK -> `question_versions(id)` ON DELETE RESTRICT;  |
| `attempt_id` | `UUID` | NULL | `—` | FK -> `assessment_attempts(id)` ON DELETE SET NULL;  |
| `is_new_question` | `BOOLEAN` | NOT NULL | `—` | — |
| `is_correct` | `BOOLEAN` | NOT NULL | `—` | — |
| `points_earned` | `NUMERIC(6, 2)` | NOT NULL | `—` | — |
| `difficulty` | `VARCHAR(16)` | NOT NULL | `—` | — |
| `validity_status` | `VARCHAR(32)` | NOT NULL | `'VALID'` | — |
| `invalidation_reason` | `TEXT` | NULL | `—` | — |
| `recorded_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_mastery_evidence_tenant` on `(tenant_id)`
- `idx_mastery_evidence_student` on `(tenant_id, student_id)`
- `idx_mastery_evidence_skill` on `(tenant_id, skill_id)`
- `idx_mastery_evidence_validity` on `(tenant_id, validity_status)`

**RLS Policies (2):**
- **"p08_evidence_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p08_evidence_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 24. `mistake_occurrences`

- **Migration Source:** `20261019000002_phase08_mistake_to_mastery.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `target_id` | `UUID` | NOT NULL | `—` | FK -> `mistake_review_targets(id)` ON DELETE CASCADE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE;  |
| `attempt_id` | `UUID` | NOT NULL | `—` | FK -> `assessment_attempts(id)` ON DELETE CASCADE; UNIQUE;  |
| `response_id` | `UUID` | NULL | `—` | FK -> `attempt_responses(id)` ON DELETE CASCADE;  |
| `question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `version_id` | `UUID` | NOT NULL | `—` | FK -> `question_versions(id)` ON DELETE RESTRICT;  |
| `capture_reason` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `submitted_payload` | `JSONB` | NOT NULL | `—` | — |
| `points_awarded` | `NUMERIC(6, 2)` | NOT NULL | `—` | — |
| `occurred_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_mistake_occurrences_tenant` on `(tenant_id)`
- `idx_mistake_occurrences_target` on `(target_id)`
- `idx_mistake_occurrences_student` on `(tenant_id, student_id)`
- `idx_mistake_occurrences_attempt` on `(attempt_id)`

**RLS Policies (2):**
- **"p08_occurrences_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p08_occurrences_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 25. `mistake_review_targets`

- **Migration Source:** `20261019000002_phase08_mistake_to_mastery.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE; UNIQUE;  |
| `question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `version_id` | `UUID` | NOT NULL | `—` | FK -> `question_versions(id)` ON DELETE RESTRICT; UNIQUE;  |
| `skill_id` | `UUID` | NULL | `—` | FK -> `canonical_skills(id)` ON DELETE SET NULL;  |
| `primary_reason` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'NEEDS_REVIEW'` | — |
| `occurrence_count` | `INTEGER` | NOT NULL | `—` | — |
| `revision_stage` | `INTEGER` | NOT NULL | `—` | — |
| `last_reviewed_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `next_due_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `first_observed_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `last_observed_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `student_reflection` | `TEXT` | NULL | `—` | — |
| `student_reason_category` | `VARCHAR(32)` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_review_targets_tenant` on `(tenant_id)`
- `idx_review_targets_student` on `(tenant_id, student_id)`
- `idx_review_targets_skill` on `(tenant_id, skill_id)`
- `idx_review_targets_status` on `(tenant_id, status)`
- `idx_review_targets_due` on `(tenant_id, student_id, next_due_at)`
- `idx_review_targets_reason` on `(tenant_id, primary_reason)`

**RLS Policies (2):**
- **"p08_targets_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p08_targets_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 26. `notification_announcements`

- **Migration Source:** `20261025000002_phase13_notifications_system.sql`
- **Multi-Tenant Boundary:** `None`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `college_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `created_by` | `UUID` | NOT NULL | `—` | FK -> `auth.users(id)` ON DELETE CASCADE;  |
| `title` | `VARCHAR(255)` | NOT NULL | `—` | CHECK: `char_length(title) > 0 AND char_length(title) <= 255`;  |
| `body` | `TEXT` | NOT NULL | `—` | CHECK: `char_length(body) > 0 AND char_length(body) <= 2000`;  |
| `category` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `audience_type` | `VARCHAR(32)` | NOT NULL | `—` | CHECK: `audience_type IN ('ALL_STUDENTS', 'SELECTED_STUDENTS', 'DEPARTMENT')`;  |
| `audience_filter` | `JSONB` | NOT NULL | `—` | — |
| `action_url` | `VARCHAR(512)` | NULL | `—` | CHECK: `action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%')`;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'SENT'` | CHECK: `status IN ('DRAFT', 'SENT', 'CANCELLED')`;  |
| `recipient_count` | `INTEGER` | NOT NULL | `0` | CHECK: `recipient_count >= 0`;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `sent_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_announcements_college_created` on `(college_id, created_at DESC)`
- `idx_announcements_created_by` on `(created_by)`

**RLS Policies (2):**
- **"announcements_select_tenant_staff"** — Action: `SELECT` | Role: `authenticated`
- **"announcements_insert_tenant_admin"** — Action: `INSERT` | Role: `authenticated`

---

### 27. `notifications`

- **Migration Source:** `20261025000002_phase13_notifications_system.sql`
- **Multi-Tenant Boundary:** `None`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `recipient_user_id` | `UUID` | NOT NULL | `—` | FK -> `auth.users(id)` ON DELETE CASCADE;  |
| `college_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE SET NULL;  |
| `actor_user_id` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `announcement_id` | `UUID` | NULL | `—` | FK -> `notification_announcements(id)` ON DELETE SET NULL;  |
| `source` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `type` | `VARCHAR(64)` | NOT NULL | `—` | CHECK: `char_length(type) > 0 AND char_length(type) <= 64`;  |
| `title` | `VARCHAR(255)` | NOT NULL | `—` | CHECK: `char_length(title) > 0 AND char_length(title) <= 255`;  |
| `body` | `TEXT` | NOT NULL | `—` | CHECK: `char_length(body) > 0 AND char_length(body) <= 2000`;  |
| `action_url` | `VARCHAR(512)` | NULL | `—` | CHECK: `action_url IS NULL OR (action_url LIKE '/%' AND action_url NOT LIKE '//%')`;  |
| `metadata` | `JSONB` | NOT NULL | `—` | — |
| `deduplication_key` | `VARCHAR(128)` | NULL | `—` | — |
| `read_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_notifications_recipient_created` on `(recipient_user_id, created_at DESC)`
- `idx_notifications_recipient_unread` on `(recipient_user_id, created_at DESC)`
- `idx_notifications_college` on `(college_id)`
- `idx_notifications_announcement` on `(announcement_id)`
- `uq_notifications_recipient_dedup` on `(recipient_user_id, deduplication_key)` [UNIQUE]

**RLS Policies (3):**
- **"notifications_select_recipient"** — Action: `SELECT` | Role: `authenticated`
- **"notifications_update_read_at"** — Action: `UPDATE` | Role: `authenticated`
- **"notifications_delete_recipient"** — Action: `DELETE` | Role: `authenticated`

---

### 28. `placement_offers`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(tenant_id, id)` ON DELETE RESTRICT;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(tenant_id, id)` ON DELETE RESTRICT;  |
| `application_id` | `UUID` | NOT NULL | `—` | FK -> `drive_applications(tenant_id, id)` ON DELETE RESTRICT; UNIQUE;  |
| `offer_type` | `VARCHAR(32)` | NOT NULL | `'FULL_TIME'` | CHECK: `offer_type IN ('FULL_TIME', 'INTERNSHIP', 'INTERN_TO_FTE')`;  |
| `compensation_amount` | `NUMERIC(12, 2)` | NULL | `—` | — |
| `compensation_details` | `TEXT` | NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'OFFERED'` | CHECK: `status IN ('OFFERED', 'ACCEPTED', 'DECLINED', 'RESCINDED')`;  |
| `offered_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `decision_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `joining_date` | `DATE` | NULL | `—` | — |
| `is_verified` | `BOOLEAN` | NOT NULL | `—` | — |
| `internal_notes` | `TEXT` | NULL | `—` | — |
| `recorded_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_offers_student` on `(student_id)`
- `idx_offers_drive` on `(drive_id)`
- `idx_offers_tenant` on `(tenant_id)`
- `idx_offers_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"offers_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"offers_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"offers_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"offers_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 29. `practice_resources`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `tenant_id` | `UUID` | NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE;  |
| `skill_id` | `UUID` | NOT NULL | `—` | FK -> `canonical_skills(id)` ON DELETE CASCADE;  |
| `title` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `resource_type` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `content_class` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `url` | `TEXT` | NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `estimated_minutes` | `INTEGER` | NOT NULL | `—` | — |
| `is_active` | `BOOLEAN` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_practice_resources_skill` on `(skill_id)`
- `idx_practice_resources_tenant` on `(tenant_id)`

**RLS Policies (2):**
- **"p_practice_resources_read"** — Action: `SELECT` | Role: `authenticated`
- **"p_practice_resources_staff_write"** — Action: `ALL` | Role: `authenticated`

---

### 30. `preparation_practice_sessions`

- **Migration Source:** `20261019000001_phase07_assessment_engine.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE;  |
| `skill_id` | `UUID` | NULL | `—` | FK -> `canonical_skills(id)` ON DELETE SET NULL;  |
| `topic` | `VARCHAR(128)` | NULL | `—` | — |
| `questions_practiced` | `INTEGER` | NOT NULL | `—` | — |
| `correct_count` | `INTEGER` | NOT NULL | `—` | — |
| `time_spent_seconds` | `INTEGER` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_prep_practice_tenant` on `(tenant_id)`
- `idx_prep_practice_student` on `(student_id)`
- `idx_prep_practice_skill` on `(skill_id)`

**RLS Policies (2):**
- **"p07_practice_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p07_practice_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 31. `preparation_tasks`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `plan_id` | `UUID` | NOT NULL | `—` | FK -> `student_preparation_plans(id)` ON DELETE CASCADE;  |
| `requirement_id` | `UUID` | NULL | `—` | FK -> `recruitment_requirements(id)` ON DELETE SET NULL;  |
| `skill_id` | `UUID` | NOT NULL | `—` | FK -> `canonical_skills(id)` ON DELETE CASCADE;  |
| `resource_id` | `UUID` | NULL | `—` | FK -> `practice_resources(id)` ON DELETE SET NULL;  |
| `stage_id` | `UUID` | NULL | `—` | FK -> `drive_stages(id)` ON DELETE SET NULL;  |
| `title` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `activity_type` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `priority` | `VARCHAR(32)` | NOT NULL | `'MEDIUM'` | CHECK: `priority IN ('HIGH', 'MEDIUM', 'LOW')`;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'PLANNED'` | CHECK: `status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED')`;  |
| `recommendation_rationale` | `TEXT` | NULL | `—` | — |
| `due_date` | `DATE` | NULL | `—` | — |
| `estimated_minutes` | `INTEGER` | NOT NULL | `—` | — |
| `completed_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_prep_tasks_tenant_plan` on `(tenant_id, plan_id)`
- `idx_prep_tasks_status` on `(tenant_id, status)`

**RLS Policies (2):**
- **"p_prep_tasks_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_prep_tasks_student"** — Action: `ALL` | Role: `authenticated`

---

### 32. `profiles`

- **Migration Source:** `20261018000001_phase03_auth_tenancy_rls.sql`
- **Multi-Tenant Boundary:** `Global Platform Table (Linked to auth.users)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; FK -> `auth.users(id)` ON DELETE CASCADE;  |
| `email` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `full_name` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `is_platform_admin` | `BOOLEAN` | NOT NULL | `—` | — |
| `avatar_url` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_profiles_email` on `(email)`

**RLS Policies (4):**
- **"profiles_select_policy"** — Action: `SELECT` | Role: `PUBLIC`
- **"profiles_insert_policy"** — Action: `INSERT` | Role: `PUBLIC`
- **"profiles_update_policy"** — Action: `UPDATE` | Role: `PUBLIC`
- **"users_can_update_own_profile"** — Action: `UPDATE` | Role: `PUBLIC`

---

### 33. `question_banks`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `name` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `category` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `sharing_policy` | `VARCHAR(32)` | NOT NULL | `'COLLEGE_PRIVATE'` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_question_banks_tenant` on `(tenant_id)`
- `idx_question_banks_category` on `(tenant_id, category)`
- `idx_question_banks_status` on `(tenant_id, status)`
- `idx_question_banks_sharing` on `(sharing_policy)`
- `idx_question_banks_subject` on `(tenant_id, subject)`

**RLS Policies (3):**
- **"p_q_banks_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_q_banks_global_read"** — Action: `SELECT` | Role: `authenticated`
- **"p_q_banks_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 34. `question_defect_reports`

- **Migration Source:** `20261019000002_phase08_mistake_to_mastery.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE;  |
| `version_id` | `UUID` | NOT NULL | `—` | FK -> `question_versions(id)` ON DELETE RESTRICT;  |
| `reported_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `defect_type` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'PENDING'` | — |
| `reviewed_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `resolution_notes` | `TEXT` | NULL | `—` | — |
| `resolved_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_defect_reports_tenant` on `(tenant_id)`
- `idx_defect_reports_question` on `(question_id)`
- `idx_defect_reports_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"p08_defects_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p08_defects_insert"** — Action: `INSERT` | Role: `PUBLIC`
- **"p08_defects_manage"** — Action: `UPDATE` | Role: `PUBLIC`
- **"p08_defects_delete"** — Action: `DELETE` | Role: `PUBLIC`

---

### 35. `question_duplicate_candidates`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `source_question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `matched_question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `similarity_score` | `NUMERIC(5, 4)` | NOT NULL | `—` | — |
| `detection_method` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'PENDING_REVIEW'` | — |
| `reviewed_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `reviewed_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_dup_candidates_tenant` on `(tenant_id)`
- `idx_dup_candidates_source` on `(source_question_id)`
- `idx_dup_candidates_status` on `(tenant_id, status)`

**RLS Policies (1):**
- **"p_dup_candidates_staff"** — Action: `ALL` | Role: `authenticated`

---

### 36. `question_import_jobs`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (1 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `bank_id` | `UUID` | NULL | `—` | FK -> `question_banks(id)` ON DELETE SET NULL;  |
| `file_name` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `total_rows` | `INTEGER` | NOT NULL | `—` | — |
| `valid_rows` | `INTEGER` | NOT NULL | `—` | — |
| `invalid_rows` | `INTEGER` | NOT NULL | `—` | — |
| `duplicate_rows` | `INTEGER` | NOT NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'PREVIEWED'` | — |
| `error_report` | `JSONB` | NOT NULL | `—` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `committed_at` | `TIMESTAMPTZ` | NULL | `—` | — |

**Indexes:**
- `idx_import_jobs_tenant` on `(tenant_id)`
- `idx_import_jobs_status` on `(tenant_id, status)`

**RLS Policies (1):**
- **"p_import_jobs_staff"** — Action: `ALL` | Role: `authenticated`

---

### 37. `question_set_items`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `set_id` | `UUID` | NOT NULL | `—` | FK -> `question_sets(id)` ON DELETE CASCADE; UNIQUE;  |
| `question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `version_id` | `UUID` | NOT NULL | `—` | FK -> `question_versions(id)` ON DELETE RESTRICT;  |
| `sequence_order` | `INTEGER` | NOT NULL | `—` | — |
| `points` | `NUMERIC(6, 2)` | NOT NULL | `—` | — |
| `negative_points` | `NUMERIC(6, 2)` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_set_items_set` on `(set_id)`
- `idx_set_items_question` on `(question_id)`
- `idx_set_items_version` on `(version_id)`
- `idx_set_items_order` on `(set_id, sequence_order)`

**RLS Policies (2):**
- **"p_set_items_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_set_items_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 38. `question_sets`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `name` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `purpose` | `VARCHAR(64)` | NOT NULL | `'ASSESSMENT'` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'DRAFT'` | — |
| `version_number` | `INTEGER` | NOT NULL | `—` | — |
| `is_locked` | `BOOLEAN` | NOT NULL | `—` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_question_sets_tenant` on `(tenant_id)`
- `idx_question_sets_status` on `(tenant_id, status)`
- `idx_question_sets_purpose` on `(tenant_id, purpose)`

**RLS Policies (2):**
- **"p_q_sets_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_q_sets_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 39. `question_versions`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `question_id` | `UUID` | NOT NULL | `—` | FK -> `questions(id)` ON DELETE CASCADE; UNIQUE;  |
| `version_number` | `INTEGER` | NOT NULL | `—` | UNIQUE;  |
| `prompt` | `TEXT` | NOT NULL | `—` | — |
| `content_format` | `VARCHAR(16)` | NOT NULL | `'MARKDOWN'` | — |
| `options` | `JSONB` | NOT NULL | `—` | — |
| `answer_key` | `JSONB` | NOT NULL | `—` | — |
| `explanation` | `TEXT` | NULL | `—` | — |
| `difficulty` | `VARCHAR(16)` | NOT NULL | `'MEDIUM'` | — |
| `skill_id` | `UUID` | NULL | `—` | FK -> `canonical_skills(id)` ON DELETE SET NULL;  |
| `topic_tags` | `TEXT` | NOT NULL | `—` | — |
| `source_type` | `VARCHAR(32)` | NOT NULL | `'COLLEGE_AUTHORED'` | — |
| `source_reference` | `TEXT` | NULL | `—` | — |
| `license_type` | `VARCHAR(32)` | NOT NULL | `'PROPRIETARY'` | — |
| `review_status` | `VARCHAR(32)` | NOT NULL | `'UNREVIEWED'` | — |
| `review_notes` | `TEXT` | NULL | `—` | — |
| `fingerprint` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `change_summary` | `TEXT` | NULL | `—` | — |
| `published_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `reviewed_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_question_versions_tenant` on `(tenant_id)`
- `idx_question_versions_question` on `(question_id)`
- `idx_question_versions_skill` on `(skill_id)`
- `idx_question_versions_fingerprint` on `(tenant_id, fingerprint)`
- `idx_question_versions_review` on `(tenant_id, review_status)`

**RLS Policies (3):**
- **"p_q_versions_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_q_versions_global_read"** — Action: `SELECT` | Role: `authenticated`
- **"p_q_versions_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 40. `questions`

- **Migration Source:** `20261018000004_phase06_questionbank_sentinel.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `bank_id` | `UUID` | NOT NULL | `—` | FK -> `question_banks(id)` ON DELETE CASCADE;  |
| `question_type` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `current_version_id` | `UUID` | NULL | `—` | — |
| `lifecycle_status` | `VARCHAR(32)` | NOT NULL | `'DRAFT'` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_questions_tenant` on `(tenant_id)`
- `idx_questions_bank` on `(tenant_id, bank_id)`
- `idx_questions_type` on `(tenant_id, question_type)`
- `idx_questions_status` on `(tenant_id, lifecycle_status)`

**RLS Policies (3):**
- **"p_questions_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_questions_global_read"** — Action: `SELECT` | Role: `authenticated`
- **"p_questions_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 41. `recruitment_drives`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `company_id` | `UUID` | NOT NULL | `—` | FK -> `companies(tenant_id, id)` ON DELETE RESTRICT;  |
| `academic_year_id` | `UUID` | NOT NULL | `—` | FK -> `academic_years(tenant_id, id)` ON DELETE RESTRICT;  |
| `title` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `role_title` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `recruitment_type` | `VARCHAR(32)` | NOT NULL | `'FULL_TIME'` | CHECK: `recruitment_type IN ('FULL_TIME', 'INTERNSHIP', 'INTERN_TO_FTE')`;  |
| `job_description` | `TEXT` | NULL | `—` | — |
| `location` | `VARCHAR(128)` | NULL | `—` | — |
| `compensation_range` | `VARCHAR(128)` | NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'DRAFT'` | CHECK: `status IN ('DRAFT', 'PUBLISHED', 'REGISTRATION_OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ARCHIVED')`;  |
| `registration_start` | `TIMESTAMPTZ` | NULL | `—` | — |
| `registration_deadline` | `TIMESTAMPTZ` | NULL | `—` | — |
| `cancellation_reason` | `TEXT` | NULL | `—` | — |
| `internal_notes` | `TEXT` | NULL | `—` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `CONSTRAINT` | `chk_registration_dates` | NULL | `—` | — |
| `registration_deadline` | `IS` | NULL | `—` | — |

**Indexes:**
- `idx_drives_tenant` on `(tenant_id)`
- `idx_drives_company` on `(tenant_id, company_id)`
- `idx_drives_academic_year` on `(tenant_id, academic_year_id)`
- `idx_drives_status` on `(tenant_id, status)`

**RLS Policies (4):**
- **"drives_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"drives_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"drives_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"drives_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 42. `recruitment_experience_reports`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (3 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `company_id` | `UUID` | NOT NULL | `—` | FK -> `companies(id)` ON DELETE CASCADE;  |
| `drive_id` | `UUID` | NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE SET NULL;  |
| `academic_year_id` | `UUID` | NULL | `—` | FK -> `academic_years(id)` ON DELETE SET NULL;  |
| `role_title` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `recruitment_cycle` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `report_origin` | `VARCHAR(32)` | NOT NULL | `'CANDIDATE_REPORTED'` | CHECK: `report_origin IN ('CANDIDATE_REPORTED', 'COLLEGE_CONFIRMED')`;  |
| `rounds_described` | `JSONB` | NOT NULL | `—` | — |
| `key_topics` | `TEXT` | NOT NULL | `—` | — |
| `moderation_status` | `VARCHAR(32)` | NOT NULL | `'PENDING'` | CHECK: `moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')`;  |
| `is_anonymous` | `BOOLEAN` | NOT NULL | `—` | — |
| `student_id` | `UUID` | NULL | `—` | FK -> `students(id)` ON DELETE SET NULL;  |
| `verified_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ;  |
| `verified_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `notes` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_exp_reports_tenant_company` on `(tenant_id, company_id)`
- `idx_exp_reports_moderation` on `(tenant_id, moderation_status)`

**RLS Policies (3):**
- **"p_exp_reports_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_exp_reports_student_read"** — Action: `SELECT` | Role: `authenticated`
- **"p_exp_reports_student_insert"** — Action: `INSERT` | Role: `authenticated`

---

### 43. `recruitment_requirements`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE; CHECK: `evidence_level IN ('OFFICIAL', 'REPORTED', 'INFERRED', 'UNKNOWN')`;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `company_id` | `UUID` | NOT NULL | `—` | FK -> `companies(id)` ON DELETE CASCADE;  |
| `drive_id` | `UUID` | NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE CASCADE;  |
| `source_id` | `UUID` | NULL | `—` | FK -> `recruitment_sources(id)` ON DELETE CASCADE;  |
| `scope_level` | `VARCHAR(32)` | NOT NULL | `'DRIVE'` | CHECK: `scope_level IN ('COMPANY', 'ROLE', 'DRIVE')`;  |
| `category` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `title` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `structured_value` | `JSONB` | NULL | `—` | — |
| `source_excerpt` | `TEXT` | NULL | `—` | — |
| `evidence_level` | `VARCHAR(32)` | NOT NULL | `'INFERRED'` | CHECK: `evidence_level IN ('OFFICIAL', 'REPORTED', 'INFERRED', 'UNKNOWN')`;  |
| `verification_status` | `VARCHAR(32)` | NOT NULL | `'DRAFT'` | CHECK: `verification_status IN ('DRAFT', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED', 'SUPERSEDED')`;  |
| `is_published_to_students` | `BOOLEAN` | NOT NULL | `—` | — |
| `has_conflict` | `BOOLEAN` | NOT NULL | `—` | — |
| `conflict_details` | `JSONB` | NULL | `—` | — |
| `is_stale` | `BOOLEAN` | NOT NULL | `—` | — |
| `stale_reason` | `TEXT` | NULL | `—` | — |
| `verified_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ;  |
| `verified_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_recruitment_requirements_tenant` on `(tenant_id)`
- `idx_recruitment_requirements_drive` on `(tenant_id, drive_id)`
- `idx_recruitment_requirements_category` on `(tenant_id, category)`
- `idx_recruitment_requirements_published` on `(tenant_id, drive_id, is_published_to_students)`

**RLS Policies (2):**
- **"p_recruitment_requirements_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_recruitment_requirements_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 44. `recruitment_sources`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `company_id` | `UUID` | NOT NULL | `—` | FK -> `companies(id)` ON DELETE CASCADE;  |
| `drive_id` | `UUID` | NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE CASCADE;  |
| `title` | `VARCHAR(256)` | NOT NULL | `—` | — |
| `publisher` | `VARCHAR(128)` | NOT NULL | `—` | — |
| `source_type` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `canonical_url` | `TEXT` | NULL | `—` | — |
| `document_ref` | `TEXT` | NULL | `—` | — |
| `published_at` | `DATE` | NULL | `—` | — |
| `effective_at` | `DATE` | NULL | `—` | — |
| `collected_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `last_checked_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `verification_status` | `VARCHAR(32)` | NOT NULL | `'PENDING_REVIEW'` | — |
| `access_classification` | `VARCHAR(32)` | NOT NULL | `'TENANT_CONFIDENTIAL'` | — |
| `raw_content` | `TEXT` | NULL | `—` | — |
| `excerpt` | `TEXT` | NULL | `—` | — |
| `created_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ;  |
| `reviewed_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ;  |
| `reviewed_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `review_notes` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_recruitment_sources_tenant` on `(tenant_id)`
- `idx_recruitment_sources_company` on `(tenant_id, company_id)`
- `idx_recruitment_sources_drive` on `(tenant_id, drive_id)`
- `idx_recruitment_sources_status` on `(tenant_id, verification_status)`

**RLS Policies (2):**
- **"p_recruitment_sources_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_recruitment_sources_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 45. `requirement_skill_mappings`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE; CHECK: `evidence_level IN ('OFFICIAL', 'REPORTED', 'INFERRED')`;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE CASCADE; UNIQUE;  |
| `requirement_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_requirements(id)` ON DELETE CASCADE; UNIQUE;  |
| `skill_id` | `UUID` | NOT NULL | `—` | FK -> `canonical_skills(id)` ON DELETE CASCADE; UNIQUE;  |
| `importance` | `VARCHAR(32)` | NOT NULL | `'RECOMMENDED'` | CHECK: `importance IN ('MANDATORY', 'PREFERRED', 'RECOMMENDED')`;  |
| `mapping_rationale` | `TEXT` | NOT NULL | `—` | — |
| `mapping_origin` | `VARCHAR(32)` | NOT NULL | `'HUMAN_AUTHORED'` | CHECK: `mapping_origin IN ('HUMAN_AUTHORED', 'AI_SUGGESTED', 'VERIFIED')`;  |
| `verification_status` | `VARCHAR(32)` | NOT NULL | `'PENDING_REVIEW'` | CHECK: `verification_status IN ('PENDING_REVIEW', 'VERIFIED', 'REJECTED')`;  |
| `evidence_level` | `VARCHAR(32)` | NOT NULL | `'INFERRED'` | CHECK: `evidence_level IN ('OFFICIAL', 'REPORTED', 'INFERRED')`;  |
| `verified_by` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ;  |
| `verified_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_req_skill_mappings_drive` on `(tenant_id, drive_id)`
- `idx_req_skill_mappings_skill` on `(skill_id)`

**RLS Policies (2):**
- **"p_req_skill_mappings_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_req_skill_mappings_student_read"** — Action: `SELECT` | Role: `authenticated`

---

### 46. `review_sessions`

- **Migration Source:** `20261019000002_phase08_mistake_to_mastery.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `target_id` | `UUID` | NOT NULL | `—` | FK -> `mistake_review_targets(id)` ON DELETE CASCADE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE;  |
| `action_type` | `VARCHAR(32)` | NOT NULL | `—` | — |
| `notes` | `TEXT` | NULL | `—` | — |
| `metadata` | `JSONB` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_review_sessions_tenant` on `(tenant_id)`
- `idx_review_sessions_target` on `(target_id)`
- `idx_review_sessions_student` on `(tenant_id, student_id)`

**RLS Policies (2):**
- **"p08_sessions_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p08_sessions_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 47. `student_behavioral_responses`

- **Migration Source:** `20261019000001_phase07_assessment_engine.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE;  |
| `prompt` | `TEXT` | NOT NULL | `—` | — |
| `category` | `VARCHAR(64)` | NOT NULL | `'HR_INTERVIEW'` | — |
| `response_text` | `TEXT` | NOT NULL | `—` | — |
| `self_reflection` | `TEXT` | NULL | `—` | — |
| `key_learnings` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_student_behavioral_tenant` on `(tenant_id)`
- `idx_student_behavioral_student` on `(student_id)`
- `idx_student_behavioral_category` on `(tenant_id, category)`

**RLS Policies (2):**
- **"p07_behavioral_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p07_behavioral_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 48. `student_preparation_plans`

- **Migration Source:** `20261018000003_phase05_recruitment_intelligence_drivefit.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE; UNIQUE;  |
| `drive_id` | `UUID` | NOT NULL | `—` | FK -> `recruitment_drives(id)` ON DELETE CASCADE; UNIQUE;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | CHECK: `status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')`;  |
| `target_completion_date` | `DATE` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_prep_plans_tenant_student` on `(tenant_id, student_id)`
- `idx_prep_plans_drive` on `(tenant_id, drive_id)`

**RLS Policies (2):**
- **"p_prep_plans_staff"** — Action: `ALL` | Role: `authenticated`
- **"p_prep_plans_student"** — Action: `ALL` | Role: `authenticated`

---

### 49. `student_skill_mastery`

- **Migration Source:** `20261019000002_phase08_mistake_to_mastery.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE; UNIQUE;  |
| `skill_id` | `UUID` | NOT NULL | `—` | FK -> `canonical_skills(id)` ON DELETE CASCADE; UNIQUE;  |
| `mastery_status` | `VARCHAR(32)` | NOT NULL | `'NEEDS_REVIEW'` | — |
| `total_mistakes_count` | `INTEGER` | NOT NULL | `—` | — |
| `active_review_count` | `INTEGER` | NOT NULL | `—` | — |
| `independent_correct_count` | `INTEGER` | NOT NULL | `—` | — |
| `independent_attempts_count` | `INTEGER` | NOT NULL | `—` | — |
| `accuracy_percentage` | `NUMERIC(5, 2)` | NOT NULL | `—` | — |
| `last_evidence_at` | `TIMESTAMPTZ` | NULL | `—` | — |
| `policy_version` | `VARCHAR(16)` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_student_skill_mastery_tenant` on `(tenant_id)`
- `idx_student_skill_mastery_student` on `(tenant_id, student_id)`
- `idx_student_skill_mastery_status` on `(tenant_id, mastery_status)`

**RLS Policies (2):**
- **"p08_mastery_select"** — Action: `SELECT` | Role: `PUBLIC`
- **"p08_mastery_write"** — Action: `ALL` | Role: `PUBLIC`

---

### 50. `students`

- **Migration Source:** `20261018000002_phase04_college_placement.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `user_id` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `enrollment_number` | `VARCHAR(64)` | NOT NULL | `—` | UNIQUE;  |
| `full_name` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `email` | `VARCHAR(255)` | NOT NULL | `—` | UNIQUE;  |
| `phone` | `VARCHAR(32)` | NULL | `—` | — |
| `department_id` | `UUID` | NOT NULL | `—` | FK -> `departments(tenant_id, id)` ON DELETE RESTRICT;  |
| `graduation_year` | `INTEGER` | NOT NULL | `—` | — |
| `degree` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `cgpa` | `NUMERIC(4, 2)` | NOT NULL | `—` | CHECK: `cgpa >= 0.00 AND cgpa <= 10.00`;  |
| `tenth_percentage` | `NUMERIC(5, 2)` | NULL | `—` | CHECK: `tenth_percentage IS NULL OR (tenth_percentage >= 0.00 AND tenth_percentage <= 100.00)`;  |
| `twelfth_percentage` | `NUMERIC(5, 2)` | NULL | `—` | CHECK: `twelfth_percentage IS NULL OR (twelfth_percentage >= 0.00 AND twelfth_percentage <= 100.00)`;  |
| `active_backlogs` | `INTEGER` | NOT NULL | `0` | CHECK: `active_backlogs >= 0`;  |
| `total_backlogs` | `INTEGER` | NOT NULL | `0` | CHECK: `total_backlogs >= 0`;  |
| `academic_status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | CHECK: `academic_status IN ('ACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED')`;  |
| `skills` | `TEXT` | NOT NULL | `—` | — |
| `resume_url` | `TEXT` | NULL | `—` | — |
| `is_archived` | `BOOLEAN` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_students_tenant` on `(tenant_id)`
- `idx_students_user_id` on `(user_id)`
- `idx_students_dept` on `(tenant_id, department_id)`
- `idx_students_grad_year` on `(tenant_id, graduation_year)`
- `idx_students_academic_status` on `(tenant_id, academic_status)`
- `idx_students_archived` on `(tenant_id, is_archived)`
- `uq_students_user_id` on `(user_id)` [UNIQUE]
- `idx_students_normalized_enrollment` on `(UPPER(TRIM(enrollment_number)`

**RLS Policies (4):**
- **"students_select_policy"** — Action: `SELECT` | Role: `authenticated`
- **"students_insert_policy"** — Action: `INSERT` | Role: `authenticated`
- **"students_update_policy"** — Action: `UPDATE` | Role: `authenticated`
- **"students_delete_policy"** — Action: `DELETE` | Role: `authenticated`

---

### 51. `tenant_memberships`

- **Migration Source:** `20261018000001_phase03_auth_tenancy_rls.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `user_id` | `UUID` | NOT NULL | `—` | FK -> `auth.users(id)` ON DELETE CASCADE; UNIQUE;  |
| `role` | `VARCHAR(32)` | NOT NULL | `—` | CHECK: `role IN ('PLACEMENT_HEAD', 'PLACEMENT_STAFF', 'TRAINER', 'STUDENT')`;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | CHECK: `status IN ('ACTIVE', 'SUSPENDED', 'REVOKED')`;  |
| `permissions` | `JSONB` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_memberships_tenant_id` on `(tenant_id)`
- `idx_memberships_user_id` on `(user_id)`
- `idx_memberships_status` on `(status)`

**RLS Policies (4):**
- **"memberships_select_policy"** — Action: `SELECT` | Role: `PUBLIC`
- **"memberships_insert_policy"** — Action: `INSERT` | Role: `PUBLIC`
- **"memberships_update_policy"** — Action: `UPDATE` | Role: `PUBLIC`
- **"memberships_delete_policy"** — Action: `DELETE` | Role: `PUBLIC`

---

### 52. `tenants`

- **Migration Source:** `20261018000001_phase03_auth_tenancy_rls.sql`
- **Multi-Tenant Boundary:** `id (Tenant Root)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (4 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY;  |
| `name` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `slug` | `VARCHAR(64)` | NOT NULL | `—` | — |
| `primary_domain` | `VARCHAR(128)` | NULL | `—` | — |
| `status` | `VARCHAR(32)` | NOT NULL | `'ACTIVE'` | CHECK: `status IN ('PENDING_SETUP', 'ACTIVE', 'SUSPENDED', 'ARCHIVED')`;  |
| `student_seat_limit` | `INTEGER` | NOT NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_tenants_slug` on `(slug)`
- `idx_tenants_status` on `(status)`

**RLS Policies (4):**
- **"tenants_select_policy"** — Action: `SELECT` | Role: `PUBLIC`
- **"tenants_insert_policy"** — Action: `INSERT` | Role: `PUBLIC`
- **"tenants_update_policy"** — Action: `UPDATE` | Role: `PUBLIC`
- **"tenants_delete_policy"** — Action: `DELETE` | Role: `PUBLIC`

---

### 53. `training_attendance`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `session_id` | `UUID` | NOT NULL | `—` | FK -> `training_sessions(id)` ON DELETE CASCADE; UNIQUE;  |
| `student_id` | `UUID` | NOT NULL | `—` | FK -> `students(id)` ON DELETE CASCADE; UNIQUE;  |
| `enrollment_status` | `VARCHAR(32)` | NOT NULL | `'ENROLLED'` | — |
| `attendance_status` | `VARCHAR(32)` | NOT NULL | `'ABSENT'` | — |
| `pre_score` | `NUMERIC(5,2)` | NULL | `—` | — |
| `post_score` | `NUMERIC(5,2)` | NULL | `—` | — |
| `notes` | `TEXT` | NULL | `—` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_training_att_tenant` on `(tenant_id)`
- `idx_training_att_session` on `(session_id)`
- `idx_training_att_student` on `(tenant_id, student_id)`

**RLS Policies (2):**
- **"Students can view their own training attendance"** — Action: `SELECT` | Role: `authenticated`
- **"Staff and trainers can manage training attendance"** — Action: `ALL` | Role: `authenticated`

---

### 54. `training_before_after_comparisons`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `session_id` | `UUID` | NOT NULL | `—` | FK -> `training_sessions(id)` ON DELETE CASCADE;  |
| `skill_id` | `UUID` | NULL | `—` | FK -> `canonical_skills(id)` ON DELETE SET NULL;  |
| `baseline_assessment_id` | `UUID` | NOT NULL | `—` | FK -> `assessments(id)` ON DELETE CASCADE;  |
| `follow_up_assessment_id` | `UUID` | NOT NULL | `—` | FK -> `assessments(id)` ON DELETE CASCADE;  |
| `eligible_students_count` | `INTEGER` | NOT NULL | `—` | — |
| `paired_students_count` | `INTEGER` | NOT NULL | `—` | — |
| `baseline_avg_score` | `NUMERIC(5,2)` | NOT NULL | `—` | — |
| `followup_avg_score` | `NUMERIC(5,2)` | NOT NULL | `—` | — |
| `absolute_delta` | `NUMERIC(5,2)` | NOT NULL | `—` | — |
| `relative_percentage_delta` | `NUMERIC(6,2)` | NULL | `—` | — |
| `limitations_disclaimer` | `TEXT` | NOT NULL | `—` | — |
| `generated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_before_after_tenant` on `(tenant_id)`
- `idx_before_after_session` on `(session_id)`

**RLS Policies (2):**
- **"Tenant members can view before-after comparisons"** — Action: `SELECT` | Role: `authenticated`
- **"Staff and trainers can manage before-after comparisons"** — Action: `ALL` | Role: `authenticated`

---

### 55. `training_sessions`

- **Migration Source:** `20261019000003_phase09_placement_memory_analytics.sql`
- **Multi-Tenant Boundary:** `tenant_id (Scoped)`
- **Row Level Security (RLS):** ✅ Forced / Enabled (2 Policies Defined)
- **Primary Key:** `id`

| Column | Data Type | Nullable | Default | Constraints / Foreign Keys |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `UUID` | NOT NULL | `—` | PRIMARY KEY; UNIQUE;  |
| `tenant_id` | `UUID` | NOT NULL | `—` | FK -> `tenants(id)` ON DELETE CASCADE; UNIQUE;  |
| `title` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `description` | `TEXT` | NULL | `—` | — |
| `skill_id` | `UUID` | NULL | `—` | FK -> `canonical_skills(id)` ON DELETE SET NULL;  |
| `topic` | `VARCHAR(255)` | NOT NULL | `—` | — |
| `trainer_id` | `UUID` | NULL | `—` | FK -> `auth.users(id)` ON DELETE SET NULL;  |
| `session_date` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `duration_minutes` | `INTEGER` | NOT NULL | `—` | — |
| `baseline_assessment_id` | `UUID` | NULL | `—` | FK -> `assessments(id)` ON DELETE SET NULL;  |
| `follow_up_assessment_id` | `UUID` | NULL | `—` | FK -> `assessments(id)` ON DELETE SET NULL;  |
| `status` | `VARCHAR(32)` | NOT NULL | `'SCHEDULED'` | — |
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `—` | — |

**Indexes:**
- `idx_training_sessions_tenant` on `(tenant_id)`
- `idx_training_sessions_skill` on `(tenant_id, skill_id)`
- `idx_training_sessions_date` on `(tenant_id, session_date)`

**RLS Policies (2):**
- **"Tenant members can view training sessions"** — Action: `SELECT` | Role: `authenticated`
- **"Staff and trainers can manage training sessions"** — Action: `ALL` | Role: `authenticated`

---

