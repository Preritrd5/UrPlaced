# Phase 04: Student CSV Import & Export Specification

## 1. Overview

The student directory supports batch intake of student cohorts via standard CSV files and real-time filtered export. Bulk operations are implemented in `src/modules/students/services/student-import-export-service.ts`.

---

## 2. CSV Schema Format

The CSV template expects the following standard header columns:

```csv
Roll Number,First Name,Last Name,Email,Phone,Department Code,Graduation Year,CGPA,10th Percentage,12th Percentage,Active Backlogs,History of Backlogs,Gender
```

### 2.1 Field Constraints & Normalization

| Field Name | Type / Format | Required | Rules & Validation |
| :--- | :--- | :--- | :--- |
| `Roll Number` | String | Yes | Trimmed, unique per tenant. Non-empty. |
| `First Name` | String | Yes | Trimmed, non-empty. |
| `Last Name` | String | No | Trimmed string. |
| `Email` | String (Email) | Yes | Trimmed, converted to lowercase, valid email regex (`^[^\s@]+@[^\s@]+\.[^\s@]+$`). |
| `Phone` | String | No | Trimmed. |
| `Department Code` | String | Yes | Case-insensitive match against tenant's registered `departments(code)`. |
| `Graduation Year` | Integer | Yes | Range: 2000 – 2100. |
| `CGPA` | Decimal | Yes | Range: 0.0 – 10.0. Parsed to 2 decimal places. |
| `10th Percentage` | Decimal | No | Range: 0.0 – 100.0. |
| `12th Percentage` | Decimal | No | Range: 0.0 – 100.0. |
| `Active Backlogs` | Integer | No | Defaults to 0 if blank. Non-negative integer. |
| `History of Backlogs`| Integer | No | Defaults to 0 if blank. Non-negative integer. |
| `Gender` | String | No | `MALE`, `FEMALE`, `OTHER`, or blank. |

---

## 3. Pre-Commit Validation & Collision Handling

When an administrator uploads a CSV, `StudentImportExportService.validateImport()` performs dry-run verification:

1. **Department Resolution:** Looks up all departments within the tenant by `code`. If a department code is unrecognized, row is flagged as invalid.
2. **In-File Duplicate Detection:** Detects duplicate `roll_number` or `email` entries within the uploaded CSV itself.
3. **Database Collision Detection:** Checks existing records in `public.students` within the current tenant for duplicate `roll_number` or `email`.
4. **Collision Action:**
   - Previews collisions with explicit row numbers.
   - Allows user confirmation to proceed with inserting only non-colliding valid rows or aborting.

---

## 4. Security & Formula Injection (CSV Injection) Mitigation

Spreadsheet processors (Microsoft Excel, LibreOffice Calc, Google Sheets) execute dynamic formulas when cell values begin with certain characters.

### 4.1 Vulnerability Vector
An attacker or malicious student with roll number or name `=cmd|'/C calc'!A0` or `+SUM(1,1)` could trigger code execution or exfiltrate data when a placement coordinator exports the directory.

### 4.2 Sanitization Implementation
`StudentImportExportService.escapeFormula()` inspects all string fields prior to CSV export:
```typescript
public static escapeFormula(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`; // Prefix with single quote to force text literal interpretation
  }
  return str;
}
```
All exported fields are wrapped in quotation marks with internal quotes escaped as `""`.
