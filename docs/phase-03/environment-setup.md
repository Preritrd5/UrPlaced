# Phase 03 — Environment Setup & Local Runbook

This guide details the environment variables, Supabase configuration, database migrations, and operational runbook for running **UrPlaced** locally and in deployment environments.

---

## 1. Environment Variables Reference

UrPlaced uses standardized environment variables. In development, these are read from `.env` in the project root.

> [!CAUTION]
> **Secret Protection:** Never commit `.env` or paste actual secret keys into source control, documentation, or public tickets. Service role keys must remain server-side at all times.

| Variable Name | Required By | Exposure | Description / Purpose |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | Public | The base URL of the Supabase project (e.g., `https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | Public | The Supabase anonymous public API key, safe for browser-side requests with RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | **Secret (Server Only)** | Elevated privilege key for admin tasks (invitation processing, user provisioning, migrations). |
| `NEXT_PUBLIC_APP_URL` | Client & Server | Public | Base application URL (e.g., `http://localhost:3000` in dev, `https://urplaced.com` in prod). |

*Note: For backward compatibility, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SECRET_KEY` are automatically mapped in [`src/lib/supabase/config.ts`](file:///c:/Users/Ananya/UrPlaced/src/lib/supabase/config.ts).*

---

## 2. Supabase Project Configuration

### 2.1 Authentication Settings
1. Navigate to your Supabase Project Dashboard -> **Authentication** -> **Configuration**.
2. **Email Auth:**
   - Enable Email Provider: **ON**
   - Confirm Email: **OFF** for local development / testing; **ON** in production environments.
   - Secure Email Change: **ON**.
3. **Redirect URLs:**
   - Site URL: `http://localhost:3000`
   - Additional Redirect URLs:
     - `http://localhost:3000/auth/callback`
     - `http://localhost:3000/auth/reset-password`
     - `http://localhost:3000/dashboard`

---

## 3. Database Migration Execution

The SQL schema, helper functions, and RLS policies are defined in a single version-controlled migration file:
[`supabase/migrations/20261018000001_phase03_auth_tenancy_rls.sql`](file:///c:/Users/Ananya/UrPlaced/supabase/migrations/20261018000001_phase03_auth_tenancy_rls.sql)

### How to Apply:
1. Open your Supabase Project Dashboard.
2. Go to the **SQL Editor** tab.
3. Click **New Query**.
4. Copy the entire contents of [`supabase/migrations/20261018000001_phase03_auth_tenancy_rls.sql`](file:///c:/Users/Ananya/UrPlaced/supabase/migrations/20261018000001_phase03_auth_tenancy_rls.sql).
5. Paste into the SQL editor and click **Run**.
6. Verify that the following 5 tables are listed under **Table Editor**:
   - `tenants`
   - `profiles`
   - `tenant_memberships`
   - `invitations`
   - `audit_logs`

---

## 4. Local Development Runbook

### Prerequisites
- Node.js `v18.18+` or `v20+`
- npm `v9+` or `v10+`

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Run Automated Verification Suite
Run the test suite, TypeScript compiler, and ESLint to verify codebase integrity:
```bash
# Run unit and integration tests (Vitest)
npm run test

# Run strict TypeScript compiler verification
npm run type-check

# Run Next.js linter
npm run lint
```

### Step 3: Run Production Build Test
Verify that all routes compile and bundles tree-shake without static generation failures:
```bash
npm run build
```

### Step 4: Start the Development Server
```bash
npm run dev
```
Access the application at [http://localhost:3000](http://localhost:3000).

---

## 5. Verified Route Map

| Route | Access Level | Description |
| :--- | :--- | :--- |
| `/auth/signin` | Public | Email and password sign-in form with suspense boundary. |
| `/auth/forgot-password` | Public | Non-enumerating password reset request form. |
| `/auth/reset-password` | Public / Token | Password update form using recovery token. |
| `/auth/invite/[token]` | Public / Token | Secure invitation acceptance and account activation. |
| `/dashboard` | Authenticated | Multi-tenant workspace dashboard with active role display. |
| `/dashboard/select-tenant` | Authenticated | Workspace selector for users belonging to multiple colleges. |
| `/dashboard/members` | Tenant Staff / Head | Member management and invitation dispatch interface. |
| `/admin/tenants` | Platform Super Admin | College tenant provisioning and lifecycle management. |
