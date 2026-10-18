import { describe, it, expect } from "vitest";
import { CompanyService } from "@/modules/companies/services/company-service";

describe("Company Service", () => {
  describe("Name Normalization for Duplicate Prevention", () => {
    it("normalizes company names by converting to lowercase and stripping punctuation and spaces", () => {
      expect(CompanyService.normalizeName("Amazon India Pvt. Ltd.")).toBe("amazonindiapvtltd");
      expect(CompanyService.normalizeName("Google, Inc.")).toBe("googleinc");
      expect(CompanyService.normalizeName("  Microsoft  ")).toBe("microsoft");
      expect(CompanyService.normalizeName("J.P. Morgan & Chase")).toBe("jpmorganchase");
    });

    it("treats minor spacing and capitalization differences as identical normalized keys", () => {
      const key1 = CompanyService.normalizeName("Tata Consultancy Services");
      const key2 = CompanyService.normalizeName("TATA CONSULTANCY SERVICES");
      const key3 = CompanyService.normalizeName("  tata   consultancy   services  ");
      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });
});
