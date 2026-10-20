# UrPlaced — Phase 09: Analytics Metric Catalogue & Calculation Standards

## 1. Principles of Truth in Measurement
Every statistic reported in **UrPlaced** conforms to strict standards of mathematical truth:
1. **Zero Hallucinated Numbers:** No decorative percentages, simulated chances of placement, or fabricated cohort trends.
2. **Documented Denominators:** Every rate states its exact mathematical numerator and denominator.
3. **Graceful Insufficient Data Handling:** When records are absent or below sample thresholds, the platform returns documented `null` or `"INSUFFICIENT_DATA"`.

---

## 2. Institutional Placement Metric Catalogue

### 2.1 Unique Placed Students
- **Definition:** The count of unique student individuals who have either accepted an official offer or had an offer extended and verified.
- **Formula:**
  $$\text{Unique Placed Students} = |\ \{ s \in \text{Students} \mid \exists c \in \text{Candidates}(s): c.\text{status} \in \{\text{'HIRED'}, \text{'OFFER\_EXTENDED'}\} \} \ |$$
- **Distinction:** Differs strictly from total offers because a single candidate may hold multiple offers.

### 2.2 Verified Placement Rate (%)
- **Definition:** Percentage of eligible, participating cohort students who have secured at least one offer.
- **Formula:**
  $$\text{Placement Rate} = \begin{cases} \left(\frac{\text{Unique Placed Students}}{\text{Total Registered Eligible Students}}\right) \times 100 & \text{if Denominator} > 0 \\ \text{null (Insufficient Data)} & \text{if Denominator} = 0 \end{cases}$$

### 2.3 Multiple Offer Distribution
- **Formula:**
  $$\text{Average Offers Per Placed Student} = \frac{\text{Total Offers Extended}}{\text{Unique Placed Students}}$$

---

## 3. Assessment & Preparation Metrics

### 3.1 Assessment Completion Rate (%)
- **Formula:**
  $$\text{Completion Rate} = \left(\frac{\text{Completed Submissions}}{\text{Total Assigned Assessments}}\right) \times 100$$

### 3.2 Cohort Average Score (%)
- **Formula:** Arithmetic mean of percentage scores across all submitted, graded attempts in the tenant cohort.

### 3.3 Mistake-to-Mastery Resolution Rate (%)
- **Formula:**
  $$\text{Resolution Rate} = \left(\frac{\text{Targets in 'MASTERED' State}}{\text{Total Captured Mistake Targets}}\right) \times 100$$

---

## 4. Cohort Topic Weakness Heatmap
Calculated across all question attempt responses:
- **Accuracy Rate per Topic:**
  $$\text{Accuracy}_{\text{topic}} = \left(\frac{\text{Correct Attempts}_{\text{topic}}}{\text{Total Attempts}_{\text{topic}}}\right) \times 100$$
- **Severity Bands:**
  - **Critical Weakness:** Accuracy $< 50\%$
  - **Moderate Weakness:** $50\% \le \text{Accuracy} < 70\%$
  - **Competent:** $70\% \le \text{Accuracy} < 85\%$
  - **Strong:** $\text{Accuracy} \ge 85\%$

---

## 5. Secure CSV Export & Formula Injection Prevention
- **Threat Model (CWE-1236):** Spreadsheet applications evaluate expressions starting with `=`, `+`, `-`, `@`, `\t`, `\r` as executable macros or dynamic data exchange (DDE) formulas.
- **Mitigation:**
  `ExportService.sanitizeCell()` checks for dangerous initial characters and prepends an apostrophe (`'`), neutralizing formula execution in Excel, LibreOffice, and Google Sheets while preserving readable text.
