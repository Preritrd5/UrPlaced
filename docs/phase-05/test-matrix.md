# Phase 05: Quality Assurance & Test Verification Matrix

## 1. Test Suite Summary

- **Phase 05 Unit Tests Added:**
  - `src/test/ssrf-protection.test.ts` (SSRF IP/protocol filtering and HTML stripping)
  - `src/test/ai-extraction.test.ts` (Grounded pattern extraction, CGPA/percentage, rounds)
  - `src/test/source-staleness.test.ts` (Source freshness and staleness evaluation)
  - `src/test/policy-engine-intelligence.test.ts` (DriveFit RBAC and cross-tenant isolation)
- **Total Test Files:** 18 test files
- **Total Tests:** 63+ tests
- **Framework:** Vitest (jsdom & Node environments)

---

## 2. Test Execution Matrix

| Test Suite / Module | Verification Focus | Test Cases |
| :--- | :--- | :--- |
| `src/test/ssrf-protection.test.ts` | Source Ingestion Security | - Blocks non-HTTP/HTTPS schemes (`file:`, `ftp:`, `gopher:`)<br>- Blocks loopback (`127.0.0.1`, `localhost`, `0.0.0.0`)<br>- Blocks cloud metadata (`169.254.169.254`)<br>- Blocks RFC 1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`)<br>- Allows valid public URLs<br>- Sanitizes HTML and strips scripts |
| `src/test/ai-extraction.test.ts` | Grounded Extraction Engine | - Accurately extracts CGPA criteria<br>- Accurately extracts percentage thresholds<br>- Extracts technical competencies without hallucination<br>- Detects explicitly stated rounds only<br>- Returns zero rounds when notice text does not state rounds |
| `src/test/source-staleness.test.ts` | Source Freshness | - Fresh source verified within 180 days is not stale<br>- Old source verified > 180 days ago flagged stale<br>- Superseded source flagged stale regardless of date |
| `src/test/policy-engine-intelligence.test.ts` | Multi-Tenant Authorization | - Placement Head has full source and publish permissions<br>- Student can read published DriveFit and manage own tasks<br>- Student cannot manage sources or publish claims<br>- Denies cross-tenant intelligence operations |
| Existing Suites (Phase 01–04) | Full Regression | - Eligibility engine, CSV import/export escaping, company normalization, academic year date checks, Supabase client |
