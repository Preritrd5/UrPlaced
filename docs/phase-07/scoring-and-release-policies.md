# Scoring Engine & Result Release Policies

## 1. Deterministic Evaluation Rules

All candidate responses are scored on the server by loading frozen `question_versions` answer keys:

| Question Type | Evaluation Algorithm | Scoring Logic |
| :--- | :--- | :--- |
| **SINGLE_CHOICE** | Direct string match against `answer_key.correct_option` | Full positive points if match; negative deduction if mismatch; 0 if blank |
| **MULTIPLE_SELECT** | Sorted unique set equality against `answer_key.correct_options` | Full positive points if exact set match; negative deduction if partial or incorrect |
| **NUMERIC** | Absolute difference $\le \text{tolerance}$ against `answer_key.correct_value` | Full positive points if within tolerance; 0 otherwise |
| **SHORT_ANSWER** | Subjective text evaluation | Marked as `MANUAL_REVIEW_REQUIRED`; provisional 0 points until staff review |
| **CODING** | Test suite execution via `IsolatedRunnerBoundary` | Evaluates public + hidden test cases if runner configured; otherwise marked `MANUAL_REVIEW_REQUIRED` |

---

## 2. Result Release Policies

Placement staff configure one of three release policies on the assessment blueprint:

1. **`IMMEDIATE`**:
   - Result and detailed question breakdown are released to the candidate as soon as all automated scoring completes.
2. **`AFTER_DEADLINE`**:
   - Scores and answer keys remain completely hidden while the assignment window is active (`now() < window_end`).
   - Prevents candidate answer collusion across staggered taking times.
   - Automatically unlocks once the window ends.
3. **`MANUAL_STAFF_RELEASE`**:
   - Results remain masked until placement officers review scores and click **Release Results** in the placement portal.

---

## 3. Phase 08 Mistake Bank Contract

During attempt scoring, every question where the student submitted an answer that was scored incorrect is extracted into a structured data contract:

```typescript
export interface MistakeBankEntry {
  questionId: string;
  versionId: string;
  skillId: string | null;
  topicTags: string[];
  prompt: string;
  difficulty: string;
  studentAnswer: any;
  explanation: string | null;
}
```

This contract provides the exact foundation for Phase 08 to organize targeted re-practice, error category tagging, and automated spaced revision drills.
