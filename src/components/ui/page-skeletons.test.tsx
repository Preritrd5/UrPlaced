import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import {
  SkeletonContainer,
  DashboardSkeleton,
  TableSkeleton,
  ProfileSkeleton,
  AnalyticsSkeleton,
  DetailViewSkeleton,
  AssessmentTakeSkeleton,
} from "./page-skeletons";

describe("Page Skeletons & Async Feedback Suite", () => {
  it("renders SkeletonContainer with accessible role='status', aria-busy='true', and screen reader label", () => {
    render(
      <SkeletonContainer label="Fetching records...">
        <div data-testid="child-content">Content</div>
      </SkeletonContainer>
    );

    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toBeInTheDocument();
    expect(statusRegion).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Fetching records...")).toHaveClass("sr-only");
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  it("renders DashboardSkeleton with accessible status and metric cards", () => {
    render(<DashboardSkeleton />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Loading dashboard workspace...")).toBeInTheDocument();
  });

  it("renders TableSkeleton with customizable title, subtitle, and column structure", () => {
    render(
      <TableSkeleton
        title="Student Directory"
        subtitle="Enrolled candidates in college"
        rows={5}
      />
    );
    expect(screen.getByText("Student Directory")).toBeInTheDocument();
    expect(screen.getByText("Enrolled candidates in college")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("renders ProfileSkeleton with account overview placeholders", () => {
    render(<ProfileSkeleton />);
    expect(screen.getByText("Loading profile and account settings...")).toBeInTheDocument();
  });

  it("renders AnalyticsSkeleton with chart placeholders", () => {
    render(<AnalyticsSkeleton />);
    expect(screen.getByText("Loading analytics and performance metrics...")).toBeInTheDocument();
  });

  it("renders DetailViewSkeleton for record viewing", () => {
    render(<DetailViewSkeleton />);
    expect(screen.getByText("Loading record details...")).toBeInTheDocument();
  });

  it("renders AssessmentTakeSkeleton with secure workspace label", () => {
    render(<AssessmentTakeSkeleton />);
    expect(screen.getByText("Initializing assessment workspace...")).toBeInTheDocument();
  });
});
