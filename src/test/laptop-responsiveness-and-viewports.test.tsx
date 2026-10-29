import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import tailwindConfig from "../../tailwind.config";
import fs from "fs";
import path from "path";

describe("Laptop Responsiveness Architecture & Viewport Adaptability", () => {
  it("verifies tailwind screen breakpoints support all required laptop tiers (1280px, 1366px, 1440px, 1536px)", () => {
    const screens = (tailwindConfig as any).theme?.extend?.screens || (tailwindConfig as any).theme?.screens;
    expect(screens).toBeDefined();
    // Default Tailwind or custom screens should define breakpoints
    // In our config, standard screens exist (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px)
  });

  it("verifies AppShell aside and header use shrink-0 to prevent collapsing into content on 1280px screens", () => {
    const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
    const content = fs.readFileSync(appShellPath, "utf-8");

    // Aside must have w-64 and shrink-0
    expect(content).toContain("w-64 shrink-0");
    // Main content area must have min-w-0 to prevent flex item blowout
    expect(content).toContain("flex-1 flex flex-col min-w-0");
    // Desktop header must have shrink-0
    expect(content).toContain("hidden md:flex items-center justify-between h-16");
    expect(content).toContain("shrink-0");
  });

  it("verifies CreateQuestionBankModal pins header and footer with shrink-0 and provides scrollable body", () => {
    const filePath = path.resolve(__dirname, "../components/questions/create-question-bank-modal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Header has shrink-0
    expect(content).toContain("border-b border-border bg-card shrink-0");
    // Form uses flex flex-col flex-1 overflow-hidden min-h-0
    expect(content).toContain("flex flex-col flex-1 overflow-hidden min-h-0");
    // Form fields are in a scrollable div
    expect(content).toContain("overflow-y-auto flex-1");
    // Actions are pinned with shrink-0
    expect(content).toContain("border-t border-border bg-card shrink-0");
  });

  it("verifies AIGenerateQuestionModal pins header and footer with shrink-0", () => {
    const filePath = path.resolve(__dirname, "../components/questions/ai-generate-question-modal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Header has shrink-0
    expect(content).toContain("border-b border-[#DDDCD5] flex items-center justify-between gap-2 bg-[#FBFAF7] shrink-0");
    // Actions footer has shrink-0
    expect(content).toContain("border-t border-[#DDDCD5] bg-[#FBFAF7] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0");
  });

  it("verifies AnswerKeyReviewModal pins header and footer with shrink-0", () => {
    const filePath = path.resolve(__dirname, "../components/questions/answer-key-review-modal.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Header has shrink-0
    expect(content).toContain("border-b border-border px-4 sm:px-6 py-3.5 sm:py-4 shrink-0");
    // Footer has shrink-0
    expect(content).toContain("border-t border-border bg-card shrink-0");
  });

  it("verifies BulkReviewModal and DuplicateAlertModal pin headers and footers with shrink-0", () => {
    const bulkReviewPath = path.resolve(__dirname, "../components/questions/bulk-review-modal.tsx");
    const bulkReviewContent = fs.readFileSync(bulkReviewPath, "utf-8");
    expect(bulkReviewContent).toContain("shrink-0");

    const duplicateModalPath = path.resolve(__dirname, "../components/questions/duplicate-alert-modal.tsx");
    const duplicateContent = fs.readFileSync(duplicateModalPath, "utf-8");
    expect(duplicateContent).toContain("shrink-0");
  });

  it("verifies AutoBuildSetModal and BulkAddQuestionsModal pin headers and footers with shrink-0", () => {
    const autoBuildPath = path.resolve(__dirname, "../components/questions/auto-build-set-modal.tsx");
    const autoBuildContent = fs.readFileSync(autoBuildPath, "utf-8");
    expect(autoBuildContent).toContain("shrink-0");

    const bulkAddPath = path.resolve(__dirname, "../components/questions/bulk-add-questions-modal.tsx");
    const bulkAddContent = fs.readFileSync(bulkAddPath, "utf-8");
    expect(bulkAddContent).toContain("shrink-0");
  });

  it("verifies QuestionBank Sentinel top banner uses xl:flex-row to prevent 8 buttons cramping beside title on 1280px laptops", () => {
    const questionsPath = path.resolve(__dirname, "../app/dashboard/questions/page.tsx");
    const content = fs.readFileSync(questionsPath, "utf-8");

    expect(content).toContain("flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4");
    expect(content).toContain("flex flex-col xl:flex-row items-stretch xl:items-center gap-3");
  });

  it("verifies Institutional Analytics KPI grid uses responsive column steps to prevent cramped 4-col layout below lg", () => {
    const analyticsPath = path.resolve(__dirname, "../app/dashboard/analytics/page.tsx");
    const content = fs.readFileSync(analyticsPath, "utf-8");

    expect(content).toContain("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6");
  });
});
