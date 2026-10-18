import { describe, it, expect } from "vitest";
import { normalizeSlug } from "@/modules/tenancy/services/tenant-service";

describe("Tenant Service Utilities", () => {
  it("normalizes institution slugs correctly", () => {
    expect(normalizeSlug("Apex Institute of Technology")).toBe("apex-institute-of-technology");
    expect(normalizeSlug("  PES University - South Campus  ")).toBe("pes-university---south-campus".replace(/-+/g, "-"));
    expect(normalizeSlug("Special @#$ Characters!")).toBe("special-characters");
  });
});
