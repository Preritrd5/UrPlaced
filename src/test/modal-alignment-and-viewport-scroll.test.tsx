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
    expect(css).toContain("body:has(.fixed.inset-0.z-50) header");
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
});
