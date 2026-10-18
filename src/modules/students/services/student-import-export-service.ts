/**
 * Student CSV Import & Export Service
 * Provides robust CSV parsing, pre-commit validation, collision detection,
 * batch insertion, and formula-injection-safe export.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { DepartmentService } from "@/modules/academic/services/department-service";
import type { Database } from "@/types/database";

export type StudentInsert = Database["public"]["Tables"]["students"]["Insert"];

export interface CSVValidationError {
  rowNumber: number;
  field: string;
  reason: string;
}

export interface ParsedStudentRow {
  rowNumber: number;
  enrollmentNumber: string;
  fullName: string;
  email: string;
  phone?: string;
  departmentCode: string;
  graduationYear: number;
  degree: string;
  cgpa: number;
  tenthPercentage?: number;
  twelfthPercentage?: number;
  activeBacklogs: number;
  totalBacklogs: number;
  skills: string[];
}

export interface ImportPreviewResult {
  totalRows: number;
  validCount: number;
  errorCount: number;
  duplicateCount: number;
  validRows: ParsedStudentRow[];
  errors: CSVValidationError[];
  duplicateIdentifiers: { field: "enrollment" | "email"; value: string; rowNumber: number }[];
}

export class StudentImportExportService {
  /**
   * Escape potential CSV formula injection for spreadsheet applications (Excel, Calc, Sheets)
   */
  static escapeFormula(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // If string starts with =, +, -, @, or tab/carriage return, prepend single quote
    if (/^[=+\-@\t\r]/.test(str)) {
      return `'${str}`;
    }
    return str;
  }

  /**
   * Generates a standard CSV template for student bulk import
   */
  static getCSVTemplate(): string {
    const headers = [
      "enrollment_number",
      "full_name",
      "email",
      "phone",
      "department_code",
      "graduation_year",
      "degree",
      "cgpa",
      "tenth_percentage",
      "twelfth_percentage",
      "active_backlogs",
      "total_backlogs",
      "skills",
    ];

    const sampleRow = [
      "EN2026001",
      "Aditi Sharma",
      "aditi.sharma@college.edu",
      "9876543210",
      "CSE",
      "2026",
      "B.Tech",
      "8.75",
      "92.5",
      "89.0",
      "0",
      "0",
      "Java;Python;SQL;Spring Boot",
    ];

    return `${headers.join(",")}\n${sampleRow.join(",")}\n`;
  }

  /**
   * Parse CSV string safely into rows, respecting quotes
   */
  static parseCSVRows(csvContent: string): string[][] {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0);
    const rows: string[][] = [];

    for (const line of lines) {
      const row: string[] = [];
      let inQuotes = false;
      let currentValue = "";

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          row.push(currentValue.trim());
          currentValue = "";
        } else {
          currentValue += char;
        }
      }
      row.push(currentValue.trim());
      rows.push(row);
    }

    return rows;
  }

  /**
   * Validate and preview CSV upload before committing
   */
  static async validateAndPreview(
    tenantId: string,
    csvContent: string
  ): Promise<ImportPreviewResult> {
    const rawRows = this.parseCSVRows(csvContent);

    if (rawRows.length < 2) {
      throw new Error("CSV file must contain a header row and at least one data row.");
    }

    const header = rawRows[0].map((h) => h.toLowerCase().trim().replace(/['"]/g, ""));
    const dataRows = rawRows.slice(1);

    // Fetch existing tenant departments
    const departments = await DepartmentService.listByTenant(tenantId);
    const deptMap = new Map<string, string>(); // code -> id
    departments.forEach((d) => deptMap.set(d.code.toUpperCase(), d.id));

    // Fetch existing tenant students for collision detection
    const supabase = createAdminClient();
    const { data: existingStudents } = await supabase
      .from("students")
      .select("enrollment_number, email")
      .eq("tenant_id", tenantId);

    const existingEnrollments = new Set(existingStudents?.map((s) => s.enrollment_number.toLowerCase()) || []);
    const existingEmails = new Set(existingStudents?.map((s) => s.email.toLowerCase()) || []);

    const errors: CSVValidationError[] = [];
    const duplicateIdentifiers: { field: "enrollment" | "email"; value: string; rowNumber: number }[] = [];
    const validRows: ParsedStudentRow[] = [];

    const seenFileEnrollments = new Set<string>();
    const seenFileEmails = new Set<string>();

    const getColIndex = (col: string) => header.indexOf(col);

    const idxEnroll = getColIndex("enrollment_number");
    const idxName = getColIndex("full_name");
    const idxEmail = getColIndex("email");
    const idxPhone = getColIndex("phone");
    const idxDept = getColIndex("department_code");
    const idxGradYear = getColIndex("graduation_year");
    const idxDegree = getColIndex("degree");
    const idxCgpa = getColIndex("cgpa");
    const idxTenth = getColIndex("tenth_percentage");
    const idxTwelfth = getColIndex("twelfth_percentage");
    const idxActiveBacklogs = getColIndex("active_backlogs");
    const idxTotalBacklogs = getColIndex("total_backlogs");
    const idxSkills = getColIndex("skills");

    if (idxEnroll === -1 || idxName === -1 || idxEmail === -1 || idxDept === -1 || idxCgpa === -1) {
      throw new Error(
        "Missing required CSV columns. Ensure enrollment_number, full_name, email, department_code, and cgpa are present."
      );
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNumber = i + 2; // 1-indexed, skipping header
      let rowValid = true;

      const enroll = (row[idxEnroll] || "").trim();
      const name = (row[idxName] || "").trim();
      const email = (row[idxEmail] || "").trim().toLowerCase();
      const phone = idxPhone !== -1 ? (row[idxPhone] || "").trim() : undefined;
      const deptCode = (row[idxDept] || "").trim().toUpperCase();
      const gradYearRaw = idxGradYear !== -1 ? row[idxGradYear] : "2026";
      const degree = idxDegree !== -1 && row[idxDegree] ? row[idxDegree].trim() : "B.Tech";
      const cgpaRaw = row[idxCgpa] || "";
      const tenthRaw = idxTenth !== -1 ? row[idxTenth] : "";
      const twelfthRaw = idxTwelfth !== -1 ? row[idxTwelfth] : "";
      const activeBacklogsRaw = idxActiveBacklogs !== -1 ? row[idxActiveBacklogs] : "0";
      const totalBacklogsRaw = idxTotalBacklogs !== -1 ? row[idxTotalBacklogs] : "0";
      const skillsRaw = idxSkills !== -1 ? row[idxSkills] : "";

      // 1. Enrollment Validation
      if (!enroll) {
        errors.push({ rowNumber, field: "enrollment_number", reason: "Enrollment number is required." });
        rowValid = false;
      } else if (seenFileEnrollments.has(enroll.toLowerCase())) {
        duplicateIdentifiers.push({ field: "enrollment", value: enroll, rowNumber });
        errors.push({ rowNumber, field: "enrollment_number", reason: "Duplicate enrollment number in CSV." });
        rowValid = false;
      } else if (existingEnrollments.has(enroll.toLowerCase())) {
        duplicateIdentifiers.push({ field: "enrollment", value: enroll, rowNumber });
        errors.push({ rowNumber, field: "enrollment_number", reason: "Enrollment number already exists in this college." });
        rowValid = false;
      } else {
        seenFileEnrollments.add(enroll.toLowerCase());
      }

      // 2. Name Validation
      if (!name) {
        errors.push({ rowNumber, field: "full_name", reason: "Full name is required." });
        rowValid = false;
      }

      // 3. Email Validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        errors.push({ rowNumber, field: "email", reason: "Valid institutional email is required." });
        rowValid = false;
      } else if (seenFileEmails.has(email)) {
        duplicateIdentifiers.push({ field: "email", value: email, rowNumber });
        errors.push({ rowNumber, field: "email", reason: "Duplicate email address in CSV." });
        rowValid = false;
      } else if (existingEmails.has(email)) {
        duplicateIdentifiers.push({ field: "email", value: email, rowNumber });
        errors.push({ rowNumber, field: "email", reason: "Email already exists in this college." });
        rowValid = false;
      } else {
        seenFileEmails.add(email);
      }

      // 4. Department Code Validation
      if (!deptCode || !deptMap.has(deptCode)) {
        errors.push({
          rowNumber,
          field: "department_code",
          reason: `Department code '${deptCode}' not found. Available: ${Array.from(deptMap.keys()).join(", ")}`,
        });
        rowValid = false;
      }

      // 5. Graduation Year Validation
      const gradYear = parseInt(gradYearRaw, 10);
      if (isNaN(gradYear) || gradYear < 2000 || gradYear > 2050) {
        errors.push({ rowNumber, field: "graduation_year", reason: "Graduation year must be between 2000 and 2050." });
        rowValid = false;
      }

      // 6. CGPA Validation
      const cgpa = parseFloat(cgpaRaw);
      if (isNaN(cgpa) || cgpa < 0 || cgpa > 10) {
        errors.push({ rowNumber, field: "cgpa", reason: "CGPA must be a valid number between 0.00 and 10.00." });
        rowValid = false;
      }

      // 7. Tenth & Twelfth Percentages (optional)
      let tenth: number | undefined = undefined;
      if (tenthRaw && tenthRaw.trim()) {
        const val = parseFloat(tenthRaw);
        if (isNaN(val) || val < 0 || val > 100) {
          errors.push({ rowNumber, field: "tenth_percentage", reason: "10th percentage must be between 0 and 100." });
          rowValid = false;
        } else {
          tenth = val;
        }
      }

      let twelfth: number | undefined = undefined;
      if (twelfthRaw && twelfthRaw.trim()) {
        const val = parseFloat(twelfthRaw);
        if (isNaN(val) || val < 0 || val > 100) {
          errors.push({ rowNumber, field: "twelfth_percentage", reason: "12th percentage must be between 0 and 100." });
          rowValid = false;
        } else {
          twelfth = val;
        }
      }

      // 8. Backlog Validations
      const activeBacklogs = parseInt(activeBacklogsRaw, 10);
      if (isNaN(activeBacklogs) || activeBacklogs < 0) {
        errors.push({ rowNumber, field: "active_backlogs", reason: "Active backlogs must be 0 or greater." });
        rowValid = false;
      }

      const totalBacklogs = parseInt(totalBacklogsRaw, 10);
      if (isNaN(totalBacklogs) || totalBacklogs < 0) {
        errors.push({ rowNumber, field: "total_backlogs", reason: "Total backlogs must be 0 or greater." });
        rowValid = false;
      }

      // 9. Skills
      const skills = skillsRaw
        ? skillsRaw
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      if (rowValid) {
        validRows.push({
          rowNumber,
          enrollmentNumber: enroll,
          fullName: name,
          email,
          phone: phone || undefined,
          departmentCode: deptCode,
          graduationYear: gradYear,
          degree,
          cgpa,
          tenthPercentage: tenth,
          twelfthPercentage: twelfth,
          activeBacklogs,
          totalBacklogs,
          skills,
        });
      }
    }

    return {
      totalRows: dataRows.length,
      validCount: validRows.length,
      errorCount: errors.length,
      duplicateCount: duplicateIdentifiers.length,
      validRows,
      errors,
      duplicateIdentifiers,
    };
  }

  /**
   * Commit validated rows into database
   */
  static async commitImport(
    tenantId: string,
    validRows: ParsedStudentRow[]
  ): Promise<{ importedCount: number; errors: string[] }> {
    if (validRows.length === 0) {
      return { importedCount: 0, errors: ["No valid rows to import."] };
    }

    const departments = await DepartmentService.listByTenant(tenantId);
    const deptMap = new Map<string, string>();
    departments.forEach((d) => deptMap.set(d.code.toUpperCase(), d.id));

    const recordsToInsert: StudentInsert[] = validRows.map((r) => ({
      tenant_id: tenantId,
      enrollment_number: r.enrollmentNumber,
      full_name: r.fullName,
      email: r.email,
      phone: r.phone || null,
      department_id: deptMap.get(r.departmentCode)!,
      graduation_year: r.graduationYear,
      degree: r.degree,
      cgpa: r.cgpa,
      tenth_percentage: r.tenthPercentage ?? null,
      twelfth_percentage: r.twelfthPercentage ?? null,
      active_backlogs: r.activeBacklogs,
      total_backlogs: r.totalBacklogs,
      skills: r.skills,
      academic_status: "ACTIVE",
      is_archived: false,
    }));

    const supabase = createAdminClient();
    // Bounded batch insertion (e.g. 100 rows per batch)
    const BATCH_SIZE = 100;
    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < recordsToInsert.length; i += BATCH_SIZE) {
      const batch = recordsToInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.from("students").insert(batch);

      if (error) {
        errors.push(`Batch ${i / BATCH_SIZE + 1} failed: ${error.message}`);
      } else {
        importedCount += batch.length;
      }
    }

    return { importedCount, errors };
  }

  /**
   * Securely export students to CSV, sanitizing formulas against injection
   */
  static generateExportCSV(
    students: Array<any>
  ): string {
    const headers = [
      "Enrollment Number",
      "Full Name",
      "Email",
      "Phone",
      "Department",
      "Graduation Year",
      "Degree",
      "CGPA",
      "10th %",
      "12th %",
      "Active Backlogs",
      "Total Backlogs",
      "Skills",
      "Academic Status",
    ];

    const rows = students.map((s) => {
      return [
        this.escapeFormula(s.enrollment_number),
        this.escapeFormula(s.full_name),
        this.escapeFormula(s.email),
        this.escapeFormula(s.phone || ""),
        this.escapeFormula(s.department?.name || s.department?.code || ""),
        this.escapeFormula(s.graduation_year),
        this.escapeFormula(s.degree),
        this.escapeFormula(s.cgpa),
        this.escapeFormula(s.tenth_percentage ?? ""),
        this.escapeFormula(s.twelfth_percentage ?? ""),
        this.escapeFormula(s.active_backlogs),
        this.escapeFormula(s.total_backlogs),
        this.escapeFormula((s.skills || []).join("; ")),
        this.escapeFormula(s.academic_status),
      ]
        .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
        .join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }
}
