# Phase 03 — Threat Model & Known Risks

This document defines the security architecture threat model, analyzed attack surfaces, threat vectors, mitigations, and residual risks for **UrPlaced**.

---

## 1. System Assets & Sensitivity Classification

| Asset Category | Data Elements | Sensitivity | Impact of Compromise |
| :--- | :--- | :--- | :--- |
| **User Identity & PII** | Full name, institutional email, phone, enrollment numbers, resumes | High / Confidential | Regulatory violation (FERPA/GDPR/DPDP), identity theft, student privacy breach |
| **Authentication Credentials** | Password hashes, refresh tokens, session cookies | Critical | Account takeover, impersonation |
| **Tenancy & Membership Data** | Tenant IDs, user roles, institutional affiliations, invitation records | Critical | Cross-tenant data breach, vertical/horizontal privilege escalation |
| **Placement & Drive Records** | Company hiring criteria, compensation bands, eligibility status, interview schedules | High / Commercial | Commercial confidentiality breach, unfair recruitment advantage |
| **Assessment & Mistake Data** | Question banks, test submissions, mistake bank logs, scoring telemetry | High | Academic integrity loss, leakage of intellectual property |
| **Audit Trails** | Actor IDs, action codes, IP addresses, timestamped state transitions | High / Compliance | Inability to audit security incidents, forensic blindness |

---

## 2. Trust Boundaries & Attack Surfaces

```
[ Public Internet / Untrusted Client ]
               │
      (1) TLS / HTTP Barrier
               ▼
[ Next.js Middleware & Route Handlers ]  <─── Public routes (/auth/*) & Protected routes (/dashboard/*)
               │
      (2) Server Execution Boundary
               ▼
[ Domain Application Services ]          <─── Policy Engine (`can()`), Invitation Service, Audit Logger
               │
      (3) Database Connection Barrier
               ▼
[ PostgreSQL / Supabase RLS Kernel ]    <─── Forced Row Level Security, SECURITY DEFINER helpers
```

### Trust Boundary Analysis:
1. **Boundary 1 (Client to Middleware):** Public untrusted network. Untrusted inputs (headers, cookies, query parameters). All user input must be sanitized and validated.
2. **Boundary 2 (Middleware to Application Layer):** Authenticated boundary. Session tokens verified by Supabase Auth cryptographic verification. Context is enriched with verified identity.
3. **Boundary 3 (Application to Database):** Kernel security boundary. Protected tables enforce RLS using `auth.uid()`. Database rejects unauthorized operations regardless of application-layer bypass attempts.

---

## 3. Threat Vectors & Countermeasures

### 3.1 Insecure Direct Object Reference (IDOR) & Cross-Tenant Data Leak
- **Threat:** A student or staff member from "College A" modifies request parameters (e.g., `tenant_id` or `student_id`) to view or edit student data from "College B".
- **Mitigation:** 
  1. The application policy engine verifies `ctx.activeTenantId === resource.tenantId`.
  2. PostgreSQL RLS policies enforce `tenant_id IN (SELECT get_user_active_tenants())`. Even if application code omitted a tenant filter, the database returns zero rows.

### 3.2 Invitation Token Theft & Replay
- **Threat:** An attacker intercepts or guesses an invitation token and claims an administrative or student account.
- **Mitigation:**
  1. Cryptographically secure 256-bit random tokens are generated (`crypto.randomBytes(32)`).
  2. Tokens are hashed using SHA-256 before storage; raw tokens are never persisted in the database.
  3. Acceptance is an atomic transaction checking `status = 'PENDING'` and `expires_at > NOW()`, immediately marking the token as `ACCEPTED`. Replay attempts fail.

### 3.3 Vertical Privilege Escalation
- **Threat:** A standard placement coordinator attempts to invite a Super Admin or promote their own account to `COLLEGE_SUPER_ADMIN`.
- **Mitigation:**
  1. Role modification endpoints enforce role-hierarchy boundaries in [`policy-engine.ts`](file:///c:/Users/Ananya/UrPlaced/src/modules/identity-access/services/policy-engine.ts).
  2. Super Admin status is stored in `profiles.is_platform_admin`, which cannot be modified by any tenant-scoped user via RLS.

### 3.4 User Enumeration via Auth Endpoints
- **Threat:** An attacker queries the sign-in or forgot-password endpoints to harvest valid institutional email addresses.
- **Mitigation:**
  1. Generic error messages ("Invalid email or password") returned during sign-in.
  2. The forgot-password endpoint returns an identical success message ("If an account exists with this email, a reset link has been dispatched") regardless of whether the email is registered.

### 3.5 Audit Trail Tampering
- **Threat:** A malicious administrator deletes or modifies audit logs to hide unauthorized actions.
- **Mitigation:**
  1. `audit_logs` table has RLS policies explicitly forbidding `UPDATE` and `DELETE` for all roles including administrators.
  2. Sensitive fields (passwords, tokens, authorization headers) are automatically scrubbed by recursive redaction before persistence.

---

## 4. Known Risks & Roadmap Mitigations

| Risk | Severity | Description | Current Status / Phase | Planned Long-Term Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **DDoS / Rate Limiting** | Medium | Repeated requests to auth or invitation endpoints could cause resource starvation. | Mitigated partially by Supabase default rate limits. | Implement Redis/Upstash edge rate limiting in Phase 04. |
| **Email Spoofing (Dev Sink)** | Low | Development uses an in-memory/logger email adapter. | Development only. | Connect production Resend/SES adapter with strict DKIM/SPF domain verification in deployment. |
| **Multi-Factor Auth (MFA)** | Medium | Single-factor password auth without mandatory TOTP for College Super Admins. | Password + secure email verification in V1.0. | Implement Supabase MFA (TOTP/WebAuthn) for administrative roles in future release. |
| **Session Invalidation on Role Revoke** | Medium | If a user is demoted, their existing JWT session remains valid until normal token expiration. | Middleware checks membership status dynamically on navigation. | Implement realtime token revocation / Supabase Admin session termination upon membership suspension. |
