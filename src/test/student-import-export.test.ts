import { describe, it, expect } from "vitest";
import { StudentImportExportService } from "@/modules/students/services/student-import-export-service";

describe("Student Import & Export Service", () => {
  describe("CSV Formula Injection Protection", () => {
    it("escapes formula-leading characters (=, +, -, @, tab) with a leading single quote", () => {
      expect(StudentImportExportService.escapeFormula("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(StudentImportExportService.escapeFormula("+12345")).toBe("'+12345");
      expect(StudentImportExportService.escapeFormula("-500")).toBe("'-500");
      expect(StudentImportExportService.escapeFormula("@admin")).toBe("'@admin");
      expect(StudentImportExportService.escapeFormula("\tcmd")).toBe("'\tcmd");
    });

    it("leaves safe strings and numbers unmodified", () => {
      expect(StudentImportExportService.escapeFormula("Ananya Roy")).toBe("Ananya Roy");
      expect(StudentImportExportService.escapeFormula("EN2026042")).toBe("EN2026042");
      expect(StudentImportExportService.escapeFormula(8.75)).toBe("8.75");
    });
  });

  describe("CSV Row Parser", () => {
    it("parses CSV rows with commas inside quotes correctly", () => {
      const csv = 'col1,col2,"col3, with comma",col4\nval1,val2,"quoted, value",val4';
      const rows = StudentImportExportService.parseCSVRows(csv);
      expect(rows.length).toBe(2);
      expect(rows[1][2]).toBe("quoted, value");
      expect(rows[1][3]).toBe("val4");
    });
  });

  describe("CSV Template", () => {
    it("provides standard header columns and sample data row", () => {
      const template = StudentImportExportService.getCSVTemplate();
      expect(template.includes("enrollment_number")).toBe(true);
      expect(template.includes("full_name")).toBe(true);
      expect(template.includes("email")).toBe(true);
      expect(template.includes("cgpa")).toBe(true);
    });
  });
});
