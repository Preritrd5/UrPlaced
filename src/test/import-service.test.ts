import { describe, it, expect } from "vitest";
import { ImportService } from "@/modules/question-bank/services/import-service";

describe("ImportService", () => {
  describe("CSV Formula Injection Defense", () => {
    it("neutralizes dangerous spreadsheet formula prefixes", () => {
      expect(ImportService.sanitizeCell("=cmd|' /C calc'!A0")).toBe("'=cmd|' /C calc'!A0");
      expect(ImportService.sanitizeCell("+12345")).toBe("'+12345");
      expect(ImportService.sanitizeCell("-SUM(A1:A10)")).toBe("'-SUM(A1:A10)");
      expect(ImportService.sanitizeCell("@SUM(A1:A10)")).toBe("'@SUM(A1:A10)");
      expect(ImportService.sanitizeCell("\tDANGEROUS")).toBe("'\tDANGEROUS");
    });

    it("leaves safe strings untouched", () => {
      expect(ImportService.sanitizeCell("Normal question text")).toBe("Normal question text");
      expect(ImportService.sanitizeCell("Option A")).toBe("Option A");
    });
  });

  describe("RFC 4180 CSV Parsing", () => {
    it("handles commas within quoted fields", () => {
      const csv = 'question_type,prompt,correct_answer\nSINGLE_CHOICE,"Given a graph G = (V, E), find cycles",opt_a';
      const lines = ImportService.parseCsvLines(csv);

      expect(lines).toHaveLength(2);
      expect(lines[1][1]).toBe("Given a graph G = (V, E), find cycles");
    });

    it("handles escaped quotes within fields", () => {
      const csv = 'question_type,prompt,correct_answer\nSINGLE_CHOICE,"He said ""hello world"" in Python",opt_a';
      const lines = ImportService.parseCsvLines(csv);

      expect(lines[1][1]).toBe('He said "hello world" in Python');
    });
  });

  describe("Pre-commit Preview Validation", () => {
    it("generates a valid CSV template", () => {
      const template = ImportService.generateCsvTemplate();
      expect(template).toContain("question_type,prompt,difficulty");
      expect(template).toContain("SINGLE_CHOICE");
    });

    it("correctly identifies valid and invalid rows without writing to database", async () => {
      const csv = [
        "question_type,prompt,difficulty,option_a,option_b,option_c,option_d,correct_answer,explanation",
        'SINGLE_CHOICE,"What is the time complexity of Quick Sort average case?",MEDIUM,"O(1)","O(log n)","O(n log n)","O(n^2)",opt_c,"Standard average runtime."',
        'INVALID_TYPE,"This question has an invalid type",MEDIUM,,,,"42",',
        'SINGLE_CHOICE,"Short",MEDIUM,"Yes","No",,opt_a,', // too short prompt
      ].join("\n");

      const preview = await ImportService.previewImport("tenant-123", "test.csv", csv, []);

      expect(preview.totalRows).toBe(3);
      expect(preview.validRows).toBe(1);
      expect(preview.invalidRows).toBe(2);
      expect(preview.rows[0].isValid).toBe(true);
      expect(preview.rows[1].isValid).toBe(false);
      expect(preview.rows[2].isValid).toBe(false);
    });
  });
});
