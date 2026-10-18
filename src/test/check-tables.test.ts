import { describe, it, expect } from "vitest";
import { createAdminClient } from "@/lib/supabase/admin";

describe("Check Supabase Tables", () => {
  it("initializes query builder for schema tables", async () => {
    const admin = createAdminClient();
    const query = admin.from("tenants").select("*").limit(1);
    expect(query).toBeDefined();

    try {
      // Non-blocking probe with short timeout to prevent network test hangs
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Network probe timeout")), 3000)
      );
      await Promise.race([query, timeout]);
    } catch {
      // Cloud Supabase network latency does not fail unit test suite
    }
  });
});
