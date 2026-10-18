# Phase 03 — Multi-College Tenant Isolation Architecture

This document specifies the multi-tenant isolation strategy, PostgreSQL Row Level Security (RLS) enforcement, server-authoritative context resolution, and defense-in-depth security model implemented in **UrPlaced**.

---

## 1. Defense-in-Depth Isolation Model

Tenant isolation in UrPlaced is launch-blocking and implemented across three distinct, mutually reinforcing security layers:

```
[ Incoming Request ]
         │
         ▼
┌────────────────────────────────────────────────────────┐
│ Layer 1: Edge & HTTP Middleware Guard                  │
│ • Validates Supabase JWT auth cookie                   │
│ • Protects /admin and /dashboard route prefixes        │
│ • Blocks unauthenticated or suspended sessions         │
└────────────────────────────────┬───────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────┐
│ Layer 2: Application Service & Policy Engine (`can()`) │
│ • Resolves active tenant from authenticated membership │
│ • Validates tenant status (ACTIVE vs SUSPENDED)        │
│ • Verifies role permission and resource ownership      │
└────────────────────────────────┬───────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────┐
│ Layer 3: Database Kernel RLS Policies (PostgreSQL)     │
│ • Tables enforced with FORCE ROW LEVEL SECURITY        │
│ • Evaluates auth.uid() against membership records      │
│ • Bypasses impossible even if application layer errs   │
└────────────────────────────────────────────────────────┘
```

---

## 2. Server-Authoritative Tenant Context Resolution

A critical security principle in UrPlaced is: **Never trust client-supplied tenant identifiers without cryptographic server validation.**

### Context Derivation Flow:
1. **Authentication Verification:** The server extracts the authenticated session from the secure, HTTP-only cookie using `@supabase/ssr` (`auth.uid()`).
2. **Membership Resolution:** The server queries `tenant_memberships` filtered strictly by `user_id = auth.uid()` and `status = 'ACTIVE'`.
3. **Workspace Cookie Validation:** If the client passes an `active_tenant_id` cookie (e.g., when a user belongs to multiple colleges), the server verifies that the user possesses a verified, active membership for that specific tenant ID.
4. **Fallback / Defaulting:** If no active workspace cookie is present, the server defaults to the user's first active membership. If no active memberships exist, the user is redirected to `/auth/access-denied`.
5. **Suspension Lockdown:** If the tenant's `status` in `tenants` is `'SUSPENDED'` or `'ARCHIVED'`, the application blocks all workspace interactions and routes the user to `/auth/tenant-suspended`.

---

## 3. PostgreSQL Row Level Security (RLS) Architecture

All database tables created in Phase 03 have Row Level Security enabled and explicitly forced via:
```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;
```
Forcing RLS guarantees that even table owners cannot bypass policies when querying through the Supabase client.

### 3.1 Non-Recursive Security Definer Helpers
To prevent infinite recursion during RLS policy evaluation (e.g., querying `tenant_memberships` while evaluating a policy on `tenant_memberships`), helper functions are defined as `SECURITY DEFINER` with fixed, immutable `search_path`:

```sql
-- Check if the current user is a global platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

-- Returns set of active tenant IDs for the authenticated user
CREATE OR REPLACE FUNCTION get_user_active_tenants()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT tenant_id 
  FROM tenant_memberships 
  WHERE user_id = auth.uid() 
    AND status = 'ACTIVE';
$$;

-- Validates active membership for a specific tenant
CREATE OR REPLACE FUNCTION is_active_tenant_member(lookup_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM tenant_memberships 
    WHERE tenant_id = lookup_tenant_id 
      AND user_id = auth.uid() 
      AND status = 'ACTIVE'
  );
$$;
```

---

## 4. Protected Table Inventory & Policy Matrix

| Table Name | Description | Read Policy | Write / Insert Policy | Update / Delete Policy |
| :--- | :--- | :--- | :--- | :--- |
| `tenants` | College workspaces | Members of active tenant OR Platform Super Admins | Platform Super Admins only | Platform Super Admins OR College Super Admin (settings only) |
| `profiles` | User identity & super admin flag | Public authenticated view of names/avatars; full profile self or Super Admin | Handled by trigger `on_auth_user_created` | User self (profile details only; cannot modify `is_platform_admin`) |
| `tenant_memberships` | User-to-college associations with roles and statuses | Tenant members view peers in same tenant; Super Admins view all | College Super Admins within own tenant; Super Admins globally | College Super Admins (cannot modify own role or super admin status); Super Admins |
| `invitations` | Pending onboarding invitations | College Super Admin (within tenant) or Super Admin | College Super Admin (within tenant) or Super Admin | College Super Admin (cancel); token consumption via service-role API route |
| `audit_logs` | Append-only system audit events | Super Admin (global) or College Super Admin (`tenant_id` match) | Authenticated or Service Role insert only | **DENIED FOR ALL** (No updates or deletes permitted under any circumstances) |

---

## 5. Prevention of Multi-Tenant Leakage Vectors

### 5.1 Insecure Direct Object References (IDOR)
- **Vector:** An attacker intercepts an API call or URL and replaces `tenant_id="college-a"` with `tenant_id="college-b"`.
- **Mitigation:** Database RLS queries `tenant_id IN (SELECT get_user_active_tenants())`. The query returns zero rows if the caller is not an active member of `college-b`, preventing unauthorized data retrieval or mutation.

### 5.2 Header Spoofing
- **Vector:** An attacker injects custom headers like `X-Tenant-ID: xyz`.
- **Mitigation:** The application completely ignores unauthenticated client headers for tenancy determination. Tenant context is derived strictly from verified JWT tokens stored in encrypted cookies.

### 5.3 Token Replay & Harvest
- **Vector:** An attacker attempts to reuse an expired invitation token or scrape invitations.
- **Mitigation:** Plaintext tokens are never stored in the database. Tokens are hashed with SHA-256 upon issuance. Token acceptance executes as an atomic single-use transaction that transitions status to `'ACCEPTED'`, rendering replay attempts ineffective.
