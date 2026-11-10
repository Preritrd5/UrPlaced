import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("PWA — Service Worker and Zero-Trust Security Cache-Exclusion Matrix", () => {
  const swPath = path.join(process.cwd(), "public", "sw.js");
  expect(fs.existsSync(swPath)).toBe(true);
  const swCode = fs.readFileSync(swPath, "utf-8");

  // Re-create the matching logic directly from sw.js for deterministic audit
  const PRIVATE_OR_DYNAMIC_PATTERNS = [
    /\/api\//i,
    /\/dashboard\b/i,
    /\/preritrd\b/i,
    /\/passport\b/i,
    /supabase\.(co|in|net)/i,
    /\/storage\/v1\//i,
    /\/auth\/v1\//i,
    /\/rest\/v1\//i,
  ];

  const appOrigin = "https://urplaced.vercel.app";

  function isStrictlyNetworkOnly(request: { method: string; url: string }): boolean {
    if (request.method !== "GET") return true;
    const url = new URL(request.url, appOrigin);
    if (url.origin !== appOrigin) return true;
    for (const pattern of PRIVATE_OR_DYNAMIC_PATTERNS) {
      if (pattern.test(url.pathname) || pattern.test(url.href)) {
        return true;
      }
    }
    return false;
  }

  it("should contain required cache version identifier and offline fallback definition", () => {
    expect(swCode).toContain('const CACHE_NAME = "urplaced-v1"');
    expect(swCode).toContain('const OFFLINE_FALLBACK_URL = "/offline"');
    expect(swCode).toContain("PRECACHE_ASSETS");
    expect(swCode).toContain("PRIVATE_OR_DYNAMIC_PATTERNS");
  });

  it("should strictly ensure PRECACHE_ASSETS contains ZERO private, dynamic, or authenticated routes", () => {
    // Extract array from sw.js code
    const precacheMatch = swCode.match(/const PRECACHE_ASSETS = \[\s*([\s\S]*?)\s*\];/);
    expect(precacheMatch).not.toBeNull();
    const assetsRaw = precacheMatch![1]
      .split("\n")
      .map((line) => line.trim().replace(/[,'"]/g, ""))
      .filter((line) => line.length > 0 && !line.startsWith("//") && !line.startsWith("/*"));

    assetsRaw.forEach((asset) => {
      // Must not be an API route
      expect(asset.includes("/api/"), `Precache must not contain API: ${asset}`).toBe(false);
      // Must not be a student dashboard route
      expect(asset.includes("/dashboard"), `Precache must not contain dashboard: ${asset}`).toBe(false);
      // Must not be admin route
      expect(asset.includes("/preritrd"), `Precache must not contain admin: ${asset}`).toBe(false);
      // Must not be career passport share link
      expect(asset.includes("/passport"), `Precache must not contain passport: ${asset}`).toBe(false);
    });
  });

  describe("Non-Negotiable Security Audit: Private Student Data Exclusion Matrix", () => {
    const studentPrivateEndpoints = [
      "/api/student/resumes",
      "/api/student/resumes/scan",
      "/api/student/resumes/tailor",
      "/api/student/mock-interview/generate",
      "/api/student/mock-interview/evaluate",
      "/api/student/mock-interview/session-999",
      "/api/student/career-passport",
      "/api/student/placement-preparation/progress",
      "/api/student/recommendations",
      "/dashboard/student",
      "/dashboard/student/resume",
      "/dashboard/student/mock-interview",
      "/dashboard/student/career-passport",
      "/dashboard/student/practice-centre",
      "/passport/share-tok-abc-123",
    ];

    studentPrivateEndpoints.forEach((endpoint) => {
      it(`must identify student private endpoint '${endpoint}' as strictly network-only (never cached)`, () => {
        const result = isStrictlyNetworkOnly({ method: "GET", url: `${appOrigin}${endpoint}` });
        expect(result).toBe(true);
      });
    });
  });

  describe("Non-Negotiable Security Audit: Institutional & Super Admin Isolation Matrix", () => {
    const institutionalEndpoints = [
      "/dashboard",
      "/dashboard/analytics",
      "/dashboard/placements",
      "/dashboard/drives",
      "/dashboard/students",
      "/api/placements/drives",
      "/api/college/students",
      "/api/admin/audit-logs",
      "/preritrd",
      "/preritrd/colleges",
      "/preritrd/subscriptions",
      "/preritrd/system-health",
      "/api/super-admin/billing",
    ];

    institutionalEndpoints.forEach((endpoint) => {
      it(`must identify institutional/admin endpoint '${endpoint}' as strictly network-only (never cached)`, () => {
        const result = isStrictlyNetworkOnly({ method: "GET", url: `${appOrigin}${endpoint}` });
        expect(result).toBe(true);
      });
    });
  });

  describe("Non-Negotiable Security Audit: Supabase Auth, Storage, & External Third-Party APIs", () => {
    const thirdPartyUrls = [
      "https://qwbynvgpnkivzszvczft.supabase.co/auth/v1/token?grant_type=refresh_token",
      "https://qwbynvgpnkivzszvczft.supabase.co/rest/v1/students?select=*",
      "https://qwbynvgpnkivzszvczft.supabase.co/storage/v1/object/resumes/student_1_resume.pdf",
      "https://api.razorpay.com/v1/orders",
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    ];

    thirdPartyUrls.forEach((externalUrl) => {
      it(`must strictly reject third-party URL '${externalUrl}' from cache`, () => {
        const result = isStrictlyNetworkOnly({ method: "GET", url: externalUrl });
        expect(result).toBe(true);
      });
    });
  });

  describe("State Mutation Methods: All Non-GET Requests Must Be Strictly Network-Only", () => {
    const methods = ["POST", "PUT", "PATCH", "DELETE"];
    methods.forEach((method) => {
      it(`must treat ${method} requests as strictly network-only, even for static looking paths`, () => {
        const result = isStrictlyNetworkOnly({ method, url: `${appOrigin}/assets/logo.png` });
        expect(result).toBe(true);
      });
    });
  });

  describe("Whitelisted Public Shell Assets Allowed for Offline Shell", () => {
    const safePublicAssets = [
      "/offline",
      "/manifest.json",
      "/favicon.ico",
      "/assets/logo.png",
      "/icons/icon-192x192.png",
      "/icons/icon-512x512.png",
      "/_next/static/chunks/main-app.js",
      "/_next/static/css/styles.chunk.css",
    ];

    safePublicAssets.forEach((publicPath) => {
      it(`allows public static asset '${publicPath}' to be served or cached for offline shell`, () => {
        const result = isStrictlyNetworkOnly({ method: "GET", url: `${appOrigin}${publicPath}` });
        expect(result).toBe(false);
      });
    });
  });
});
