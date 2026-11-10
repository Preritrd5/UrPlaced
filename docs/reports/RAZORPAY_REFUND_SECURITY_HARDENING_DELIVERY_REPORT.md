# URPLACED — RAZORPAY REFUND WORKFLOW & SIMULATED PAYMENT SECURITY HARDENING DELIVERY REPORT
**Document Reference:** `docs/reports/RAZORPAY_REFUND_SECURITY_HARDENING_DELIVERY_REPORT.md`  
**Execution Timestamp:** 2026-11-10T20:44:30+05:30  
**Environment:** Next.js 15 App Router | React 19 | Razorpay SDK | Vitest 3.2.7 | PostgreSQL / Supabase  

---

## A. Executive Summary

An audit and security hardening of the UrPlaced platform billing refund architecture was conducted to address two critical concerns:
1. **Issue 1 (Simulated Payment Stderr Noise):** Test 8 of `src/test/sa08-super-admin-refund-workflow-and-security.test.ts` logged expected mock gateway 400 responses (`{ statusCode: 400, error: { description: 'The id provided does not exist' } }`) using `console.error` rather than structured informational diagnostics.
2. **Issue 2 (Production Refund Security & State Integrity):** In dev/test environments, any payment returning HTTP 400 or "does not exist" previously fell back to generating an administrative simulated reversal (`rfnd_sim_...`), risking accidental conversion of genuine customer payment rejections into simulated reversals if misconfigured.

**Key Hardening Completed:**
- Established an authoritative, server-side trusted payment classifier (`classifyPayment`) that categorizes invoices as `GENUINE`, `SIMULATED`, `OFFLINE`, or `AMBIGUOUS`.
- Enforced fail-closed security: Ambiguous or unverified records immediately throw and abort without gateway calls or test reversals.
- Genuine Razorpay payments never enter the administrative test-reversal fallback. Gateway errors (HTTP 400, 401, 403, 404, 429, 500, timeouts) log operational errors and throw explicit errors while preserving database invoice and subscription states untouched.
- Simulated payments log structured `console.info` on expected gateway not-found responses, eliminating test runner stderr noise while recording distinct `ADMINISTRATIVE_TEST_REVERSAL` audit and database entries.
- Expanded `sa08-super-admin-refund-workflow-and-security.test.ts` to 37 total tests (28 comprehensive security scenarios covering simulated payments, genuine payment protections, role authorization, cross-tenant isolation, idempotency, and audit trails + 9 baseline billing scenarios). 100% of tests pass.

---

## B. Root-Cause Analysis

### Source Location
- **File:** `src/modules/billing/services/refund-service.ts`
- **Method:** `RefundService.issueRefund(params)`

### Diagnostic Breakdown
1. **Why the gateway returned the reported error:**
   In test scenarios verifying non-existent payment IDs, the mocked Razorpay SDK client simulates Razorpay's API response for invalid IDs:
   `{ statusCode: 400, error: { description: "The id provided does not exist" } }`.
2. **Why the fallback ran:**
   The legacy implementation relied on a broad environment check (`process.env.NODE_ENV !== "production"`) rather than server-persisted invoice metadata. When the gateway rejected the ID, the service caught the error and branched into test-reversal creation for all payments regardless of whether they were simulated or genuine.
3. **Defective Logging Severity:**
   Before branching into the test reversal, the service executed `console.error("[Refund Service] Gateway refund call failed:", refundErr)`. For an expected test scenario, logging at `error` level was misleading and polluted CI/test output.

---

## C. Payment Classification Architecture

To eliminate reliance on client headers or environment variables, payment classification is derived strictly from server-side trusted database fields:

```typescript
export type PaymentClassification = "GENUINE" | "SIMULATED" | "OFFLINE" | "AMBIGUOUS";

export function classifyPayment(invoice: any, tx?: any): PaymentClassification {
  if (!invoice) return "AMBIGUOUS";

  // 1. Explicit Simulated / Demo (server-persisted boolean or method)
  if (
    invoice.is_demo === true ||
    invoice.payment_method === "SIMULATED" ||
    invoice.payment_method === "TEST" ||
    invoice.payment_classification === "SIMULATED" ||
    invoice.notes?.includes("[SIMULATED_PAYMENT]") ||
    tx?.gateway === "SIMULATED" ||
    tx?.is_demo === true
  ) {
    return "SIMULATED";
  }

  // 2. Explicit Offline / Manual
  if (
    invoice.payment_method === "BANK_TRANSFER" ||
    invoice.payment_method === "OFFLINE" ||
    invoice.payment_method === "MANUAL"
  ) {
    return "OFFLINE";
  }

  // 3. Genuine Razorpay Gateway Payment
  const paymentId =
    invoice.razorpay_payment_id ||
    (invoice.notes && invoice.notes.match(/pay_[A-Za-z0-9_]+/)?.[0]) ||
    tx?.payment_id;

  if (
    (invoice.payment_method === "RAZORPAY" || tx?.gateway === "RAZORPAY" || (paymentId && paymentId.startsWith("pay_"))) &&
    invoice.is_demo !== true &&
    invoice.payment_method !== "UNKNOWN"
  ) {
    if (
      paymentId &&
      (paymentId.startsWith("pay_sim_") ||
        paymentId.startsWith("pay_mock_") ||
        paymentId.startsWith("pay_demo_") ||
        paymentId.startsWith("pay_test_"))
    ) {
      return "SIMULATED";
    }
    return "GENUINE";
  }

  return "AMBIGUOUS";
}
```

### Ambiguous Payment Handling
If an invoice has `payment_method: "UNKNOWN"` or conflicting metadata:
- Classification resolves to `AMBIGUOUS`.
- Execution halts immediately.
- Audit event `REFUND_REJECTED_AMBIGUOUS_PAYMENT` is written to `audit_logs`.
- HTTP 400 error is thrown. No gateway calls or reversals are attempted.

---

## D. Refund State Transitions

### Behavioral Matrix

| Payment Classification | Gateway Result | State Transition & Output | Stderr Noise |
|---|---|---|---|
| **Explicit Simulated** | Gateway ID not found | Records `ADMINISTRATIVE_TEST_REVERSAL`, issues `rfnd_sim_...`, invoice status `REFUNDED` | Clean (`console.info`) |
| **Explicit Simulated** | Unexpected 500 error | Fails closed; throws internal gateway error | Visible `console.error` |
| **Genuine Razorpay** | Gateway 200 OK | Records gateway refund ID, generates Credit Note, updates invoice | None |
| **Genuine Razorpay** | Gateway 400 rejection | Throws error; invoice remains `PAID`, no credit note, zero test reversal | Visible `console.error` |
| **Genuine Razorpay** | Gateway 401/403 auth fail | Throws gateway authentication failure; invoice remains `PAID` | Visible `console.error` |
| **Genuine Razorpay** | Gateway 404 / not found | Throws remote gateway not found; invoice remains `PAID` | Visible `console.error` |
| **Genuine Razorpay** | Gateway 429 rate limit | Throws rate limit notice; permits safe retry | Visible `console.error` |
| **Genuine Razorpay** | Gateway 500 server error | Throws reconciliation required; database state intact | Visible `console.error` |
| **Genuine Razorpay** | Network timeout | Throws timeout warning; prohibits blind retries | Visible `console.error` |
| **Ambiguous Record** | Any | Fails closed; throws security rejection | Visible audit log |

---

## E. Security, Authorization & Audit Integrity

1. **Role-Based Authorization:**
   `RefundService.issueRefund` enforces that only callers with role `SUPER_ADMIN` can execute platform refunds. Invocations with `callerRole: "STUDENT"` or `callerRole: "PLACEMENT_HEAD"` are rejected with HTTP 403 / `Unauthorized`.
2. **Tenant Boundary Isolation:**
   When `expectedTenantId` is supplied, the service validates that `invoice.tenant_id === expectedTenantId`. Cross-tenant requests immediately throw `Forbidden: Cross-tenant refund rejected`.
3. **Idempotency Protection:**
   The service accepts an `idempotencyKey`. Repeated calls with the identical key return the previously processed refund without duplicate gateway charges, credit notes, or database updates.
4. **Append-Only Audit Logs:**
   - Simulated reversals log `action: "ADMINISTRATIVE_TEST_REVERSAL"`.
   - Genuine gateway failures log `action: "GENUINE_REFUND_GATEWAY_FAILED"`.
   - Ambiguous rejections log `action: "REFUND_REJECTED_AMBIGUOUS_PAYMENT"`.

---

## F. Test Evidence

The hardened refund suite was executed via Vitest and verified against all 28 required security scenarios plus baseline suites:

| Test Group | Actual Result | Exit Code |
|---|---|---|
| Simulated-Payment Tests (Scenarios 1–8) | 8/8 passed (zero stderr noise) | `0` |
| Genuine-Payment Protection Tests (Scenarios 9–22) | 14/14 passed (strict fail-closed) | `0` |
| Authorization & Audit Tests (Scenarios 23–28) | 6/6 passed (RBAC & cross-tenant enforced) | `0` |
| Baseline Billing & Decoupled Q10 Tests (Scenarios 29–37) | 9/9 passed | `0` |
| **Focused Refund Suite Total (`sa08`)** | **37/37 tests passed** | **`0`** |
| Comprehensive Billing & Reconciliation (`sa05`) | 88/88 tests passed | `0` |
| PWA Service Worker & Cache Security | 47/47 tests passed | `0` |
| PWA Lifecycle & UI | 20/20 tests passed | `0` |
| Student Resumes API & Storage | 15/15 tests passed | `0` |
| Mock Interview Voice Input | 9/9 tests passed | `0` |
| TypeScript Compiler (`tsc --noEmit`) | 0 errors | `0` |
| ESLint (`next lint`) | 0 errors | `0` |
| Production Build (`next build`) | 69/69 routes compiled | `0` |

---

## G. Known Limitations

- **Live Gateway Credentials:** Razorpay API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) are configured in live deployment environments. Local test runs use verified SDK mocks matching live Razorpay error payloads and status codes.
- **Webhook Reversals:** Asynchronous refunds initiated directly in the Razorpay Merchant Dashboard trigger incoming webhooks handled via `/api/billing/webhook`.

---

## H. Final Status

**`COMPLETED — SIMULATED AND GENUINE REFUND PATHS SECURELY VERIFIED`**

Both Issue 1 (expected simulated payment diagnostic logging) and Issue 2 (strict fail-closed protection for genuine Razorpay payments) are completely resolved, hardened, and verified with all 37 test scenarios passing and zero production build issues.
