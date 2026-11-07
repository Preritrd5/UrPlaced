import React from "react";
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

describe("UrPlaced Modal Alignment & Viewport Presentation Audit", () => {
  it("verifies globals.css enforces modal elevation, header/sidebar de-elevation, and short-viewport scroll", () => {
    const cssPath = path.resolve(__dirname, "../styles/globals.css");
    const css = fs.readFileSync(cssPath, "utf-8");

    // Must elevate modals to z-index: 100
    expect(css).toContain("z-index: 100 !important;");
    // Must de-elevate header and aside to z-index: 10 when modal is active
    expect(css).toContain("body:has(.fixed.inset-0) header");
    expect(css).toContain("body:has([role=\"dialog\"]) header");
    expect(css).toContain("body:has([data-radix-portal]) header");
    expect(css).toContain("z-index: 10 !important;");

    // Must support overflow-y auto for short viewports
    expect(css).toContain("overflow-y: auto !important;");
    expect(css).toContain("margin-top: auto;");
    expect(css).toContain("margin-bottom: auto;");

    // Must remove Windows scrollbar buttons
    expect(css).toContain("::-webkit-scrollbar-button");
    expect(css).toContain("display: none !important;");
  });

  it("verifies Change Subscription Plan modal preserves switch-label alignment parity", () => {
    const subPagePath = path.resolve(__dirname, "../app/preritrd/(protected)/subscriptions/page.tsx");
    const subContent = fs.readFileSync(subPagePath, "utf-8");

    // preserveLimits switch row must use consistent justify-between container with label on left and switch on right
    expect(subContent).toContain('htmlFor="preserveLimits"');
    expect(subContent).toMatch(
      /<div className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border\/40">[\s\S]*?<label htmlFor="preserveLimits"[\s\S]*?<Switch[\s\S]*?id="preserveLimits"/
    );
  });

  it("verifies AI Mistake Analysis Modal has overflow-y-auto and my-auto for short screens", () => {
    const modalPath = path.resolve(__dirname, "../components/mistakes/ai-mistake-analysis-modal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    expect(modalContent).toContain("overflow-y-auto");
    expect(modalContent).toContain("my-auto");
  });

  it("verifies Assessment Blueprint Dialog maintains close-button clearance and viewport bounds", () => {
    const pagePath = path.resolve(__dirname, "../app/dashboard/assessments/page.tsx");
    const pageContent = fs.readFileSync(pagePath, "utf-8");

    // Must have pr-12 on DialogHeader so title doesn't collide with close button
    expect(pageContent).toContain("pr-12");
    // Must have max-h-[calc(100dvh-2.5rem)] for clean breathing margin
    expect(pageContent).toContain("max-h-[calc(100dvh-2.5rem)]");
  });

  it("verifies Review & Verify Answer Key modal option IDs do not collide with option text", () => {
    const modalPath = path.resolve(__dirname, "../components/questions/answer-key-review-modal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");

    // Must NOT have fixed "w-5" without shrink-0 on opt.id container which causes text overlap with multi-char IDs like OPT_1
    expect(modalContent).not.toMatch(/<span className="[^"]*(?<!min-)w-5[^"]*">\s*\{opt\.id\}\./);
    expect(modalContent).toContain("shrink-0 min-w-5");
  });

  it("verifies all modal overlays across dashboard billing, question banks, and admin pages use overflow-y-auto and my-auto", () => {
    const filesToCheck = [
      "../app/dashboard/billing/page.tsx",
      "../components/questions/create-question-bank-modal.tsx",
      "../components/questions/ai-generate-question-modal.tsx",
      "../components/questions/auto-build-set-modal.tsx",
      "../components/questions/bulk-add-questions-modal.tsx",
      "../components/questions/bulk-review-modal.tsx",
      "../components/questions/answer-key-review-modal.tsx",
      "../components/questions/duplicate-alert-modal.tsx",
      "../app/dashboard/profile/page.tsx",
      "../app/preritrd/(protected)/colleges/page.tsx",
      "../app/preritrd/(protected)/billing/page.tsx",
      "../app/preritrd/(protected)/accounts/page.tsx",
      "../app/preritrd/(protected)/audit-logs/page.tsx",
      "../app/dashboard/questions/sets/page.tsx",
      "../app/dashboard/drives/[id]/pipeline/page.tsx",
      "../app/dashboard/mistakes/page.tsx",
      "../app/dashboard/student/mistakes/page.tsx",
      "../app/dashboard/student/mistakes/[targetId]/page.tsx",
      "../components/companies/company-detail-actions.tsx",
    ];

    for (const relativePath of filesToCheck) {
      const filePath = path.resolve(__dirname, relativePath);
      const content = fs.readFileSync(filePath, "utf-8");

      // Verify that no modal overlay contains "overflow-hidden"
      const backdropMatches = content.match(/className="[^"]*fixed inset-0[^"]*"/g) || [];
      expect(backdropMatches.length).toBeGreaterThan(0);

      for (const backdrop of backdropMatches) {
        expect(backdrop).not.toContain("overflow-hidden");
        expect(backdrop).toContain("overflow-y-auto");
      }

      // Verify that the inner card or container has my-auto for vertical centering without clipping
      expect(content).toContain("my-auto");
    }
  });

  it("verifies zero modal overlays in src/ use overflow-hidden", () => {
    function scanDir(dir: string): string[] {
      const results: string[] = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".next") {
          results.push(...scanDir(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith(".tsx") || entry.name.endsWith(".jsx"))) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const srcDir = path.resolve(__dirname, "..");
    const sourceFiles = scanDir(srcDir);
    const violatingFiles: string[] = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const backdropMatches = content.match(/className="[^"]*fixed inset-0[^"]*overflow-hidden[^"]*"/g) || [];
      if (backdropMatches.length > 0) {
        violatingFiles.push(file);
      }
    }

    expect(violatingFiles).toEqual([]);
  });
});
