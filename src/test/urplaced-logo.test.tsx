import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import fs from "fs";
import path from "path";
import { UrPlacedLogo } from "@/components/ui/urplaced-logo";
import { metadata } from "@/app/layout";

describe("UrPlaced Logo & Brand Consistency Suite", () => {
  describe("1. Static Asset Integrity", () => {
    it("ensures public/assets/logo.png exists and is non-empty", () => {
      const filePath = path.join(process.cwd(), "public", "assets", "logo.png");
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000);
    });

    it("ensures public/assets/urplaced-logo.png exists as brand backup", () => {
      const filePath = path.join(process.cwd(), "public", "assets", "urplaced-logo.png");
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(1000);
    });

    it("ensures public/favicon.ico exists and contains valid icon data", () => {
      const filePath = path.join(process.cwd(), "public", "favicon.ico");
      expect(fs.existsSync(filePath)).toBe(true);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(100);
    });

    it("verifies root layout metadata defines correct favicon and icon links", () => {
      expect(metadata).toBeDefined();
      expect(metadata.icons).toBeDefined();
      const icons = metadata.icons as any;
      expect(icons.icon).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ url: "/assets/logo.png" }),
          expect.objectContaining({ url: "/favicon.ico" }),
        ])
      );
      expect(icons.shortcut).toBe("/favicon.ico");
      expect(icons.apple).toBe("/assets/logo.png");
    });
  });

  describe("2. UrPlacedLogo Component Presentation & Containment", () => {
    it("renders image pointing to the official logo asset with proper accessibility", () => {
      render(<UrPlacedLogo data-testid="test-logo" />);
      const container = screen.getByTestId("test-logo");
      expect(container).toBeInTheDocument();

      const img = container.querySelector("img");
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute("alt", "UrPlaced");
      expect(img?.getAttribute("src")).toContain("logo.png");
      expect(img).toHaveClass("object-contain");
    });

    it("applies responsive sizing tokens without distorting geometry", () => {
      const { rerender } = render(<UrPlacedLogo size="sm" data-testid="size-logo" />);
      let container = screen.getByTestId("size-logo");
      expect(container).toHaveClass("h-8");
      expect(container).toHaveClass("w-8");

      rerender(<UrPlacedLogo size="md" data-testid="size-logo" />);
      container = screen.getByTestId("size-logo");
      expect(container).toHaveClass("h-9");
      expect(container).toHaveClass("w-9");

      rerender(<UrPlacedLogo size="lg" data-testid="size-logo" />);
      container = screen.getByTestId("size-logo");
      expect(container).toHaveClass("h-11");
      expect(container).toHaveClass("w-11");

      rerender(<UrPlacedLogo size="xl" data-testid="size-logo" />);
      container = screen.getByTestId("size-logo");
      expect(container).toHaveClass("h-14");
      expect(container).toHaveClass("w-14");
    });

    it("preserves custom classNames such as hover scale effects", () => {
      render(
        <UrPlacedLogo
          size="lg"
          className="group-hover:scale-105 transition-transform"
          data-testid="styled-logo"
        />
      );
      const container = screen.getByTestId("styled-logo");
      expect(container).toHaveClass("group-hover:scale-105");
      expect(container).toHaveClass("transition-transform");
    });
  });
});
