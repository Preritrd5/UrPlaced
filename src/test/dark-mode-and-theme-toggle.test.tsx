import React from "react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "../lib/theme/theme-provider";
import { ThemeToggle } from "../components/ui/theme-toggle";

function TestConsumer() {
  const { theme, toggleTheme, setTheme, mounted } = useTheme();
  return (
    <div>
      <span data-testid="theme-val">{theme}</span>
      <span data-testid="mounted-val">{mounted ? "mounted" : "unmounted"}</span>
      <button data-testid="toggle-btn" onClick={toggleTheme}>Toggle</button>
      <button data-testid="set-dark-btn" onClick={() => setTheme("dark")}>Set Dark</button>
      <button data-testid="set-light-btn" onClick={() => setTheme("light")}>Set Light</button>
    </div>
  );
}

describe("UrPlaced Dark Mode Architecture & Theme Toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
    document.documentElement.removeAttribute("data-theme");
  });

  describe("ThemeProvider & useTheme Hook", () => {
    it("initializes with default light theme and sets data-theme to light", () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme-val").textContent).toBe("light");
      expect(screen.getByTestId("mounted-val").textContent).toBe("mounted");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("toggles theme from light to dark and persists to localStorage", () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      const toggleBtn = screen.getByTestId("toggle-btn");
      act(() => {
        fireEvent.click(toggleBtn);
      });

      expect(screen.getByTestId("theme-val").textContent).toBe("dark");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      // Toggle back to light
      act(() => {
        fireEvent.click(toggleBtn);
      });

      expect(screen.getByTestId("theme-val").textContent).toBe("light");
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("restores stored theme from localStorage on initial load", () => {
      localStorage.setItem(THEME_STORAGE_KEY, "dark");

      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme-val").textContent).toBe("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("synchronizes theme across tabs on storage event", () => {
      render(
        <ThemeProvider>
          <TestConsumer />
        </ThemeProvider>
      );

      expect(screen.getByTestId("theme-val").textContent).toBe("light");

      act(() => {
        const storageEvent = new StorageEvent("storage", {
          key: THEME_STORAGE_KEY,
          newValue: "dark",
        });
        window.dispatchEvent(storageEvent);
      });

      expect(screen.getByTestId("theme-val").textContent).toBe("dark");
      expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  describe("ThemeToggle Component & Accessibility", () => {
    it("renders in light mode with Moon icon and accessible aria-label", () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );

      const button = screen.getByTestId("theme-toggle-btn");
      expect(button).toBeDefined();
      expect(button.getAttribute("aria-label")).toBe("Switch to dark mode");
      expect(button.getAttribute("title")).toBe("Switch to dark mode");
    });

    it("switches to Sun icon and aria-label when toggled to dark mode", () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );

      const button = screen.getByTestId("theme-toggle-btn");
      act(() => {
        fireEvent.click(button);
      });

      expect(button.getAttribute("aria-label")).toBe("Switch to light mode");
      expect(button.getAttribute("title")).toBe("Switch to light mode");
    });

    it("supports size='sm' and size='default' dimensions", () => {
      const { unmount } = render(
        <ThemeProvider>
          <ThemeToggle size="sm" data-testid="small-toggle" />
        </ThemeProvider>
      );

      const smallBtn = screen.getByTestId("small-toggle");
      expect(smallBtn.className).toContain("h-8");
      expect(smallBtn.className).toContain("w-8");
      unmount();

      render(
        <ThemeProvider>
          <ThemeToggle size="default" data-testid="default-toggle" />
        </ThemeProvider>
      );

      const defaultBtn = screen.getByTestId("default-toggle");
      expect(defaultBtn.className).toContain("h-9");
      expect(defaultBtn.className).toContain("w-9");
    });

    it("includes exact Table 4.3 color classes", () => {
      render(
        <ThemeProvider>
          <ThemeToggle />
        </ThemeProvider>
      );

      const btn = screen.getByTestId("theme-toggle-btn");
      // Light Mode colors
      expect(btn.className).toContain("bg-[#F8F7F3]");
      expect(btn.className).toContain("text-[#24283A]");
      expect(btn.className).toContain("border-[#D8D7D0]");
      expect(btn.className).toContain("hover:bg-[#EDECE7]");
      // Dark Mode colors
      expect(btn.className).toContain("dark:bg-[#1B1E2A]");
      expect(btn.className).toContain("dark:text-[#F2F1F8]");
      expect(btn.className).toContain("dark:border-[#303548]");
      expect(btn.className).toContain("dark:hover:bg-[#252A3A]");
    });
  });

  describe("Application-Wide Layouts Integration", () => {
    it("verifies RootLayout wraps application in ThemeProvider and includes anti-flash script", () => {
      const layoutPath = path.resolve(__dirname, "../app/layout.tsx");
      const content = fs.readFileSync(layoutPath, "utf-8");

      expect(content).toContain("ThemeProvider");
      expect(content).toContain("<ThemeProvider>");
      expect(content).toContain("urplaced-theme");
      expect(content).toContain("document.documentElement.classList.add('dark')");
    });

    it("verifies AppShell includes ThemeToggle in desktop header and mobile header", () => {
      const appShellPath = path.resolve(__dirname, "../components/layout/app-shell.tsx");
      const content = fs.readFileSync(appShellPath, "utf-8");

      expect(content).toContain("<ThemeToggle size=\"default\" />");
      expect(content).toContain("<ThemeToggle size=\"sm\" />");
    });

    it("verifies AuthSplitLayout includes ThemeToggle in top navigation row", () => {
      const authLayoutPath = path.resolve(__dirname, "../components/auth/auth-split-layout.tsx");
      const content = fs.readFileSync(authLayoutPath, "utf-8");

      expect(content).toContain("<ThemeToggle size=\"sm\" />");
    });

    it("verifies landing page includes ThemeToggle in desktop nav and mobile controls", () => {
      const landingPath = path.resolve(__dirname, "../app/page.tsx");
      const content = fs.readFileSync(landingPath, "utf-8");

      expect(content).toContain("<ThemeToggle size=\"default\" />");
      expect(content).toContain("<ThemeToggle size=\"sm\" />");
    });
  });

  describe("globals.css Design System Dark Mode Tokens & Mappings", () => {
    const cssPath = path.resolve(__dirname, "../styles/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    it("defines authoritative Core Surface dark tokens (Table 2.1)", () => {
      expect(cssContent).toContain("--color-background: #111318;");
      expect(cssContent).toContain("--color-card-bg: #1B1E2A;");
      expect(cssContent).toContain("--color-card-elevated: #222636;");
      expect(cssContent).toContain("--color-input-bg: #151821;");
      expect(cssContent).toContain("--color-hover-surface: #252A3A;");
      expect(cssContent).toContain("--color-border: #303548;");
      expect(cssContent).toContain("--color-border-strong: #42485F;");
    });

    it("defines authoritative Brand & Action dark tokens (Table 2.2)", () => {
      expect(cssContent).toContain("--color-primary: #5052C9;");
      expect(cssContent).toContain("--color-primary-hover: #5C5FD0;");
      expect(cssContent).toContain("--color-secondary-accent: #55B8AB;");
      expect(cssContent).toContain("--color-secondary-hover: #6AC9BC;");
      expect(cssContent).toContain("--color-primary-ring: #9294FF;");
      expect(cssContent).toContain("linear-gradient(135deg, #6265D8 0%, #5052C9 100%)");
    });

    it("defines authoritative Typography dark tokens (Table 2.3)", () => {
      expect(cssContent).toContain("--color-primary-text: #F2F1F8;");
      expect(cssContent).toContain("--color-secondary-text: #B9BDCD;");
      expect(cssContent).toContain("--color-text-muted: #8D93A8;");
    });

    it("defines authoritative Status dark tokens (Table 2.4)", () => {
      expect(cssContent).toContain("--color-success: #4CC38A;");
      expect(cssContent).toContain("--color-warning: #F5BE55;");
      expect(cssContent).toContain("--color-danger: #FF6B78;");
      expect(cssContent).toContain("--color-info: #76A9FA;");
    });

    it("defines single source of truth arbitrary class mappings under .dark", () => {
      expect(cssContent).toContain(".dark .bg-\\[\\#EDECE7\\]");
      expect(cssContent).toContain(".dark .bg-\\[\\#F8F7F3\\]");
      expect(cssContent).toContain(".dark .bg-\\[\\#FBFAF7\\]");
      expect(cssContent).toContain(".dark .text-\\[\\#24283A\\]");
      expect(cssContent).toContain(".dark .text-\\[\\#292D40\\]");
      expect(cssContent).toContain(".dark .border-\\[\\#DDDCD5\\]");
      expect(cssContent).toContain(".dark [role=\"dialog\"]");
    });

    it("sets browser color-scheme hint for native inputs, select & scrollbars", () => {
      expect(cssContent).toContain("color-scheme: light;");
      expect(cssContent).toContain("color-scheme: dark;");
    });
  });
});
