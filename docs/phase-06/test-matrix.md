# QuestionBank Sentinel Test Matrix

## 1. Test Suite Coverage Summary

| Test File | Test Cases | Scope / Verification |
| :--- | :--- | :--- |
| `src/test/question-validator.test.ts` | 11 | Structural and quality checks for `SINGLE_CHOICE`, `MULTIPLE_SELECT`, `NUMERIC`, `SHORT_ANSWER`, and `CODING` problems. |
| `src/test/duplicate-detector.test.ts` | 5 | Deterministic SHA-256 fingerprinting, option permutation invariance, exact matches, near-duplicate Jaccard similarity, and distinct question isolation. |
| `src/test/import-service.test.ts` | 6 | Spreadsheet formula injection defense (`=, +, -, @, \t`), RFC 4180 CSV parsing with multiline quotes and commas, CSV template generation, pre-commit row validation. |
| `src/test/question-security-masking.test.ts` | 4 | Student answer-key omission, coding hidden test case stripping, and Scoped RBAC policy engine permissions verification. |
| **All Previous Phase Test Suites** | 71 | Auth, Tenancy, Placements, Eligibility Engine, DriveFit, SSRF Protection, AI Extraction, UI Components. |
| **Total Test Suite** | **97** | **100% Passing (24 of 24 test files)** |

---

## 2. Key Assertions Verified

- **MCQ Invariants**: Requires at least 2 options with stable IDs; answer key must reference valid option ID; duplicate options generate warnings.
- **Multi-Select Invariants**: Validates non-empty `correct_option_ids` array and cross-references against provided choices.
- **Numeric Invariants**: Rejects non-numeric answers and negative tolerances.
- **Coding Problem Invariants**: Requires at least 1 test case; warns if public examples or hidden verification test cases are absent.
- **Formula Injection Defense**: Neutralizes `=cmd`, `@SUM`, `-`, `+`, and `\t` with single-quote escaping prior to row parsing.
- **Security Sanitization**: Completely strips `answer_key` and `explanation` from API responses for student queries; hides private coding test cases.
- **Policy Engine RBAC**: Confirms `PLACEMENT_HEAD` and `PLACEMENT_STAFF` hold full management permissions, while `STUDENT` is restricted to reading published sets.
