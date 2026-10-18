# Phase 05: Requirement-to-Skill Mapping & Coverage Calculation

## 1. Requirement-to-Skill Mapping Architecture

DriveFit avoids presenting generic, boilerplate preparation advice for every company. Instead, each verified requirement is mapped to canonical curriculum skills using `SkillMappingService`:

### 1.1 Canonical Taxonomy (`canonical_skills`)
- **Aptitude:** `QUANTITATIVE_APTITUDE`, `LOGICAL_REASONING`, `VERBAL_ABILITY`.
- **Core Computer Science:** `PROGRAMMING_FUNDAMENTALS`, `DATA_STRUCTURES_ALGORITHMS`, `DATABASE_MANAGEMENT`, `OPERATING_SYSTEMS`, `COMPUTER_NETWORKS`, `OBJECT_ORIENTED_PROGRAMMING`, `SYSTEM_DESIGN`.
- **Interpersonal & Behavioral:** `BEHAVIORAL_HR`.
- **Core Engineering:** `CORE_ENGINEERING`.

### 1.2 Mapping Properties
- `importance`: `MANDATORY` (core evaluated), `PREFERRED`, `RECOMMENDED`.
- `mapping_rationale`: Human-authored or verified explanation explaining *why* this skill is essential for the specific drive (e.g., "Critical for Round 1 section 2 coding challenges").
- `mapping_origin`: `HUMAN_AUTHORED`, `AI_SUGGESTED`, `VERIFIED`.

---

## 2. Deterministic Requirement Coverage Formula

Requirement Coverage measures how well the placement cell has mapped a drive's documented requirements to study resources.

### 2.1 Formal Definition

$$\text{Requirement Coverage (\%)} = \left\lfloor \frac{\text{Requirements with Verified Skill Mapping AND Available Practice Resource}}{\text{Total Active Drive Requirements}} \times 100 \right\rfloor$$

Where:
- **Denominator ($D$):** Count of active (non-superseded) requirements recorded for this drive. If $D = 0$, coverage is $0\%$.
- **Numerator ($N$):** Count of requirements that have at least one verified mapping to a canonical skill that has at least one active practice resource in `practice_resources`.

### 2.2 Crucial Invariant: Coverage $\neq$ Selection Probability

> [!CAUTION]
> **Anti-Deception Rule:**
> DriveFit strictly distinguishes between:
> 1. **Requirement Coverage:** Proportion of drive requirements supported by curriculum materials.
> 2. **Preparation Activity:** Student tasks completed or in progress.
> 3. **Performance Evidence:** Scored assessment results on validated tests.
> 4. **Mastery:** Demonstrated competence under verified grading criteria.
>
> The platform never claims a student has an "85% chance of selection" or "guaranteed placement". All coverage statistics are explicitly labeled as curriculum readiness.
