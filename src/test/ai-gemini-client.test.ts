import { describe, it, expect, beforeEach, vi } from "vitest";
import { GeminiClient, GeminiServiceError } from "@/modules/ai/gemini-client";
import { AIRateLimiter } from "@/modules/ai/ai-rate-limiter";

describe("Gemini AI Client & Rate Limiter Security Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    AIRateLimiter.resetForTest();
  });

  describe("1. Environment & API Key Sanitization", () => {
    it("throws MISSING_API_KEY error when GEMINI_API_KEY is not defined", () => {
      delete process.env.GEMINI_API_KEY;
      expect(() => GeminiClient.getSanitizedKey()).toThrowError(GeminiServiceError);
      expect(() => GeminiClient.getSanitizedKey()).toThrow(/GEMINI_API_KEY is not configured/);
    });

    it("throws INVALID_API_KEY if key is too short or malformed", () => {
      process.env.GEMINI_API_KEY = "short";
      expect(() => GeminiClient.getSanitizedKey()).toThrowError(/appears invalid or malformed/);
    });

    it("sanitizes keys wrapped in quotes or leading equals signs defensively", () => {
      process.env.GEMINI_API_KEY = ' ="AIzaSyTestingDefensiveSanitizationString12345" ';
      const sanitized = GeminiClient.getSanitizedKey();
      expect(sanitized).toBe("AIzaSyTestingDefensiveSanitizationString12345");
      expect(sanitized).not.toContain('"');
      expect(sanitized).not.toContain("=");
      expect(sanitized).not.toContain(" ");
    });

    it("blocks AI calls when AI_ENABLED is set to 'false' (Emergency Switch)", async () => {
      process.env.AI_ENABLED = "false";
      await expect(
        GeminiClient.generate({
          prompt: "test",
          feature: "STUDY_TUTOR",
        })
      ).rejects.toThrowError(/AI capabilities are temporarily disabled/);
    });
  });

  describe("2. AI Sliding-Window & Daily Rate Limiter", () => {
    it("allows student requests within normal thresholds", () => {
      const studentId = "student-123";
      const check = AIRateLimiter.checkLimit(studentId, "STUDENT");
      expect(check.allowed).toBe(true);
      expect(check.remaining).toBe(19); // 20 - 1
    });

    it("blocks student when 10-minute sliding window is exceeded (20 requests)", () => {
      const studentId = "student-quota-test";
      for (let i = 0; i < 20; i++) {
        const res = AIRateLimiter.checkLimit(studentId, "STUDENT");
        expect(res.allowed).toBe(true);
      }

      // 21st request must be rejected
      const blocked = AIRateLimiter.checkLimit(studentId, "STUDENT");
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.reason).toContain("Short-term AI rate limit exceeded");
      expect(blocked.resetInSeconds).toBeGreaterThan(0);
    });

    it("provides higher rate limits for institutional staff members (50 requests)", () => {
      const staffId = "staff-quota-test";
      for (let i = 0; i < 20; i++) {
        AIRateLimiter.checkLimit(staffId, "PLACEMENT_STAFF");
      }

      // 21st request for staff is still allowed
      const check21 = AIRateLimiter.checkLimit(staffId, "PLACEMENT_STAFF");
      expect(check21.allowed).toBe(true);
      expect(check21.remaining).toBe(29); // 50 - 21
    });
  });
});
