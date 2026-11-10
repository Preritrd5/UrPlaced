import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import manifestFn from "@/app/manifest";
import { metadata, viewport } from "@/app/layout";

describe("PWA — Manifest, Metadata, and Brand Icon Inventory Verification", () => {
  const rootDir = process.cwd();
  const manifestJsonPath = path.join(rootDir, "public", "manifest.json");
  const iconsDir = path.join(rootDir, "public", "icons");

  it("should have a valid public/manifest.json conforming to W3C PWA standards", () => {
    expect(fs.existsSync(manifestJsonPath)).toBe(true);
    const content = fs.readFileSync(manifestJsonPath, "utf-8");
    const manifest = JSON.parse(content);

    expect(manifest.name).toContain("UrPlaced");
    expect(manifest.short_name).toBe("UrPlaced");
    expect(manifest.start_url).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.background_color).toBe("#EDECE7");
    expect(manifest.theme_color).toBe("#5052C9");
    expect(manifest.orientation).toBe("portrait-primary");
    expect(manifest.id).toBe("/");
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(4);

    // Verify 192 and 512 icons are present
    const sizes = manifest.icons.map((i: any) => i.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    // Verify maskable icons
    const maskableIcons = manifest.icons.filter((i: any) => i.purpose?.includes("maskable"));
    expect(maskableIcons.length).toBeGreaterThanOrEqual(1);

    // Verify shortcuts are present
    expect(Array.isArray(manifest.shortcuts)).toBe(true);
    expect(manifest.shortcuts.length).toBeGreaterThan(0);
    const shortcutUrls = manifest.shortcuts.map((s: any) => s.url);
    expect(shortcutUrls).toContain("/dashboard/student");
  });

  it("should export a valid Next.js MetadataRoute.Manifest from src/app/manifest.ts", () => {
    const generatedManifest = manifestFn();
    expect(generatedManifest.name).toBe("UrPlaced — Multi-College Placement Preparation & Management SaaS");
    expect(generatedManifest.short_name).toBe("UrPlaced");
    expect(generatedManifest.start_url).toBe("/");
    expect(generatedManifest.display).toBe("standalone");
    expect(generatedManifest.background_color).toBe("#EDECE7");
    expect(generatedManifest.theme_color).toBe("#5052C9");
    expect(Array.isArray(generatedManifest.icons)).toBe(true);
    expect(generatedManifest.icons?.length).toBeGreaterThanOrEqual(4);
  });

  it("should have all required icon asset files generated with non-zero byte size", () => {
    const expectedIconFiles = [
      "icon-48x48.png",
      "icon-72x72.png",
      "icon-96x96.png",
      "icon-128x128.png",
      "icon-144x144.png",
      "icon-192x192.png",
      "icon-384x384.png",
      "icon-512x512.png",
      "icon-maskable-192x192.png",
      "icon-maskable-512x512.png",
      "apple-touch-icon.png",
    ];

    expectedIconFiles.forEach((filename) => {
      const filePath = path.join(iconsDir, filename);
      expect(fs.existsSync(filePath), `Icon ${filename} must exist`).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size, `Icon ${filename} must not be empty`).toBeGreaterThan(100);
    });

    // Also root apple-touch-icon for iOS root crawlers
    const rootAppleTouch = path.join(rootDir, "public", "apple-touch-icon.png");
    expect(fs.existsSync(rootAppleTouch)).toBe(true);
    expect(fs.statSync(rootAppleTouch).size).toBeGreaterThan(100);
  });

  it("should export Next.js 15 viewport and metadata configuration supporting PWA standalone", () => {
    expect(viewport.themeColor).toEqual([
      { media: "(prefers-color-scheme: light)", color: "#EDECE7" },
      { media: "(prefers-color-scheme: dark)", color: "#24283A" },
    ]);
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);
    expect(viewport.viewportFit).toBe("cover");

    expect(metadata.manifest).toBe("/manifest.json");
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: "default",
      title: "UrPlaced",
    });
  });
});
