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
  SuperAdminDashboardSkeleton,
  BillingSkeleton,
  KanbanPipelineSkeleton,
  DriveListSkeleton,
  FormSkeleton,
  QuestionBankSkeleton,
  AssessmentListSkeleton,
  MistakeAnalyticsSkeleton,
  AnnouncementListSkeleton,
  ApplicationListSkeleton,
  OfferListSkeleton,
  TrainingSkeleton,
  AuditLogsSkeleton,
  SystemHealthSkeleton,
  StudentDirectorySkeleton,
  AuthSplitSkeleton,
  AuthCardSkeleton,
  LandingPageSkeleton,
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

  it("renders SuperAdminDashboardSkeleton, BillingSkeleton and KanbanPipelineSkeleton", () => {
    const { unmount: u1 } = render(<SuperAdminDashboardSkeleton />);
    expect(screen.getByText("Loading platform command center...")).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<BillingSkeleton />);
    expect(screen.getByText("Loading billing and subscription workspace...")).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<KanbanPipelineSkeleton />);
    expect(screen.getByText("Loading recruitment candidate pipeline...")).toBeInTheDocument();
    u3();
  });

  it("renders DriveListSkeleton, FormSkeleton and QuestionBankSkeleton", () => {
    const { unmount: u1 } = render(<DriveListSkeleton />);
    expect(screen.getByText("Loading recruitment drives...")).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<FormSkeleton title="Create Drive" />);
    expect(screen.getByText("Create Drive")).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<QuestionBankSkeleton />);
    expect(screen.getByText("Loading question repository...")).toBeInTheDocument();
    u3();
  });

  it("renders AssessmentListSkeleton, MistakeAnalyticsSkeleton and AnnouncementListSkeleton", () => {
    const { unmount: u1 } = render(<AssessmentListSkeleton />);
    expect(screen.getByText("Loading assessments...")).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<MistakeAnalyticsSkeleton />);
    expect(screen.getByText("Loading mistake and mastery analytics...")).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<AnnouncementListSkeleton />);
    expect(screen.getByText("Loading announcements...")).toBeInTheDocument();
    u3();
  });

  it("renders ApplicationListSkeleton, OfferListSkeleton, TrainingSkeleton, AuditLogsSkeleton and SystemHealthSkeleton", () => {
    const { unmount: u1 } = render(<ApplicationListSkeleton />);
    expect(screen.getByText("Loading applications...")).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<OfferListSkeleton />);
    expect(screen.getByText("Loading placement offers...")).toBeInTheDocument();
    u2();

    const { unmount: u3 } = render(<TrainingSkeleton />);
    expect(screen.getByText("Loading training programs...")).toBeInTheDocument();
    u3();

    const { unmount: u4 } = render(<AuditLogsSkeleton />);
    expect(screen.getByText("Loading security audit records...")).toBeInTheDocument();
    u4();

    const { unmount: u5 } = render(<SystemHealthSkeleton />);
    expect(screen.getByText("Loading infrastructure telemetry...")).toBeInTheDocument();
    u5();

    const { unmount: u6 } = render(<StudentDirectorySkeleton />);
    expect(screen.getByText("Student Directory")).toBeInTheDocument();
    u6();

    const { unmount: u7 } = render(<AuthSplitSkeleton />);
    expect(screen.getByText("Loading authentication portal...")).toBeInTheDocument();
    u7();

    const { unmount: u8 } = render(<AuthCardSkeleton />);
    expect(screen.getByText("Loading authorization session...")).toBeInTheDocument();
    u8();

    const { unmount: u9 } = render(<LandingPageSkeleton />);
    expect(screen.getByText("Loading UrPlaced platform...")).toBeInTheDocument();
    u9();
  });
});
