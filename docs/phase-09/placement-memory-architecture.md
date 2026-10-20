# UrPlaced — Phase 09: Placement Memory Architecture

## 1. Overview & Institutional Memory Mission
Placement preparation systems often suffer from fragmented, unverified company information—rumors from candidate chats, outdated test vendor formats, or unmoderated glassdoor-style claims. 
**QuestionBank Sentinel & Placement Memory** solves this by establishing a disciplined, evidence-based institutional memory system for college placement departments.

The central lifecycle is:
$$\text{Historical Recruitment Records} \to \text{Moderated Debriefs} \to \text{Drive Comparison} \to \text{Preparation \& Assessments} \to \text{Training Interventions} \to \text{Before/After Evaluation}$$

---

## 2. Provenance & Reliability Classification
Every recruitment record and candidate report in `historical_recruitment_records` carries strict provenance tracking and a single, explicit reliability label:

| Reliability Label | Definition & Authority | Default Visibility |
| :--- | :--- | :--- |
| `OFFICIAL_CONFIRMED` | Formally confirmed by company JD, official campus notice, or placement authority | All Students & Staff |
| `VERIFIED_HISTORICAL` | Multi-source validated previous-cycle recruitment pattern | All Students & Staff |
| `CANDIDATE_REPORTED` | Sourced from student candidate interview debriefs after staff moderation | Filtered / Verified |
| `INFERRED_GUIDANCE` | Derived pattern or role-family baseline suggestions | Labeled Guidance |
| `DISPUTED` | Flagged due to conflicting reports, vendor changes, or discrepancies | Warning Flagged |
| `SUPERSEDED` | Replaced by a more recent official pattern (with pointer to replacing ID) | Archived |

---

## 3. Candidate Debrief Moderation Queue
Students who appear in campus recruitment drives can submit real interview experiences, round descriptions, and topic distributions:
- **Anonymity Protection:** When `is_anonymous: true`, student name and roll number are masked (`"Anonymous Candidate"`, `"REDACTED"`) in all student-facing endpoints.
- **Audit Integrity:** Placement officers retain audit access to verify candidate authenticity.
- **Moderation Workflow:** All submissions enter status `PENDING`. Upon review, staff can approve with one-click promotion into `historical_recruitment_records`, with an immutable entry created in `experience_report_moderation_logs`.

---

## 4. Current vs Historical Drive Comparison Engine
When a current recruitment drive is scheduled, the comparison engine aligns it against historical benchmarks:
- **Matching Basis:**
  - `SAME_COMPANY_AND_ROLE`: Exact or substring match on company and role title.
  - `SAME_COMPANY_DIFFERENT_ROLE`: Same company, different functional role.
  - `ROLE_FAMILY_MATCH`: Cross-company benchmark for similar engineering roles.
- **Evidence Completeness & Unknown Fields:**
  - Any missing field in either current drive or historical record is explicitly flagged as `UNKNOWN` (e.g. `current_compensation_details_not_disclosed`).
  - No speculative or decorative percentages are generated.
- **Mandatory Limitations Disclaimer:**
  Every comparison screen and report displays the invariant disclaimer:
  > *"Historical drive patterns represent past hiring rounds and may not predict changes in current drive requirements. Differences in hiring volume, role level, or test vendor should be accounted for."*
