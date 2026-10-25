import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonButton,
  SkeletonCard,
} from "./skeleton";

describe("Skeleton Primitives Suite", () => {
  it("renders base Skeleton with pulse animation and aria-hidden", () => {
    const { container } = render(<Skeleton data-testid="base-skeleton" className="h-4 w-20" />);
    const el = screen.getByTestId("base-skeleton");
    expect(el).toBeInTheDocument();
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el.className).toContain("animate-pulse");
    expect(el.className).toContain("bg-[rgba(36,40,58,0.08)]");
  });

  it("renders shimmer variant when requested", () => {
    const { container } = render(<Skeleton variant="shimmer" data-testid="shimmer-skeleton" />);
    const el = screen.getByTestId("shimmer-skeleton");
    expect(el.className).toContain("animate-shimmer");
  });

  it("renders SkeletonText with specified number of lines and staggered widths", () => {
    const { container } = render(<SkeletonText lines={3} lastLineWidth="w-1/2" data-testid="skeleton-text" />);
    const wrapper = screen.getByTestId("skeleton-text");
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
    const childSkeletons = wrapper.querySelectorAll("div");
    expect(childSkeletons.length).toBe(3);
    expect(childSkeletons[2].className).toContain("w-1/2");
  });

  it("renders SkeletonAvatar with correct size maps and shapes", () => {
    const { rerender } = render(<SkeletonAvatar size="sm" data-testid="avatar-sm" />);
    expect(screen.getByTestId("avatar-sm").className).toContain("h-8 w-8 rounded-full");

    rerender(<SkeletonAvatar size="xl" shape="rounded" data-testid="avatar-xl" />);
    expect(screen.getByTestId("avatar-xl").className).toContain("h-16 w-16 rounded-lg");
  });

  it("renders SkeletonBadge with custom width", () => {
    render(<SkeletonBadge width="w-24" data-testid="badge" />);
    const badge = screen.getByTestId("badge");
    expect(badge.className).toContain("h-5 rounded-full w-24");
  });

  it("renders SkeletonButton with sizes matching UrPlaced button tokens", () => {
    const { rerender } = render(<SkeletonButton size="sm" data-testid="btn" />);
    expect(screen.getByTestId("btn").className).toContain("h-8");
    expect(screen.getByTestId("btn").className).toContain("rounded-lg");

    rerender(<SkeletonButton size="default" data-testid="btn" />);
    expect(screen.getByTestId("btn").className).toContain("h-10");
    expect(screen.getByTestId("btn").className).toContain("rounded-lg");
  });

  it("renders SkeletonCard with header and structure", () => {
    render(<SkeletonCard data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(card.className).toContain("rounded-xl border border-border bg-card");
    expect(card).toHaveAttribute("aria-hidden", "true");
  });
});
