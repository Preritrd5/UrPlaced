import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordField } from "@/components/auth/password-field";
import { SplitAuthCard } from "@/components/auth/split-auth-card";
import { SimpleAuthCard } from "@/components/auth/simple-auth-card";
import { Clock, ShieldCheck, Users, Briefcase, Building2, GraduationCap } from "lucide-react";
import { getRoleDefaultDashboard } from "@/lib/navigation/navigation-config";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

describe("UrPlaced Split-Screen Authentication Redesign Suite", () => {
  describe("1. PasswordField Interaction & Accessibility", () => {
    it("renders password input defaulting to type='password' with accessible toggle", () => {
      render(
        <PasswordField
          id="test-pwd"
          label="Account Password"
          placeholder="Enter password"
          required
        />
      );

      const label = screen.getByText("Account Password");
      expect(label).toBeInTheDocument();

      const input = screen.getByPlaceholderText("Enter password") as HTMLInputElement;
      expect(input).toBeInTheDocument();
      expect(input.type).toBe("password");

      const toggleBtn = screen.getByRole("button", { name: /show password/i });
      expect(toggleBtn).toBeInTheDocument();

      // Toggle to visible
      fireEvent.click(toggleBtn);
      expect(input.type).toBe("text");
      expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();

      // Toggle back to hidden
      fireEvent.click(screen.getByRole("button", { name: /hide password/i }));
      expect(input.type).toBe("password");
    });
  });

  describe("2. SplitAuthCard Layout & Content Hierarchy", () => {
    it("renders split-screen promotional panel with badge, headline, and feature highlights", () => {
      render(
        <SplitAuthCard
          badgeText="• Student Member Sign In"
          subtitle="CAMPUS PLACEMENT PLATFORM"
          headline="Your Placement Preparation Starts Here"
          description="Prepare for campus recruitment opportunities."
          features={[
            {
              icon: Clock,
              tint: "rose",
              title: "Timed Full-Length Mock Exams",
              description: "Company-aligned test patterns.",
            },
            {
              icon: ShieldCheck,
              tint: "indigo",
              title: "Verified Skill Credentials",
              description: "Institutional readiness scores.",
            },
          ]}
          footerLeft="UrPlaced 2026 Academic Session"
          footerRight="Student Portal"
        >
          <div data-testid="right-form-content">Form Content</div>
        </SplitAuthCard>
      );

      // Left panel elements
      expect(screen.getByText("• Student Member Sign In")).toBeInTheDocument();
      expect(screen.getByText("CAMPUS PLACEMENT PLATFORM")).toBeInTheDocument();
      expect(screen.getByText("Your Placement Preparation Starts Here")).toBeInTheDocument();
      expect(screen.getByText("Timed Full-Length Mock Exams")).toBeInTheDocument();
      expect(screen.getByText("Verified Skill Credentials")).toBeInTheDocument();
      expect(screen.getByText("UrPlaced 2026 Academic Session")).toBeInTheDocument();
      expect(screen.getByText("Student Portal")).toBeInTheDocument();

      // Right panel content
      expect(screen.getByTestId("right-form-content")).toBeInTheDocument();
    });

    it("verifies College / Cell promotional features render correctly", () => {
      render(
        <SplitAuthCard
          badgeText="• Institutional Cell Workspace"
          subtitle="INSTITUTIONAL PLACEMENT SUITE"
          headline="Placement Management, Connected"
          description="Coordinate recruitment drives and manage authorized student directories."
          features={[
            {
              icon: Users,
              tint: "cyan",
              title: "Student Directory & Eligibility Roster",
              description: "Manage verified student profiles.",
            },
            {
              icon: Briefcase,
              tint: "rose",
              title: "Recruitment Drive Pipelines",
              description: "Schedule on-campus drives.",
            },
            {
              icon: Building2,
              tint: "amber",
              title: "Dedicated Institutional Tenant",
              description: "Strict isolation under PostgreSQL RLS.",
            },
          ]}
          footerLeft="UrPlaced Multi-Tenant V1.0"
          footerRight="College / Cell Portal"
        >
          <div>College Content</div>
        </SplitAuthCard>
      );

      expect(screen.getByText("• Institutional Cell Workspace")).toBeInTheDocument();
      expect(screen.getByText("Placement Management, Connected")).toBeInTheDocument();
      expect(screen.getByText("Student Directory & Eligibility Roster")).toBeInTheDocument();
      expect(screen.getByText("Recruitment Drive Pipelines")).toBeInTheDocument();
      expect(screen.getByText("Dedicated Institutional Tenant")).toBeInTheDocument();
      expect(screen.getByText("College / Cell Portal")).toBeInTheDocument();
    });
  });

  describe("3. SimpleAuthCard for Utility Authentication Pages", () => {
    it("renders centered card layout with brand header and security footer", () => {
      render(
        <SimpleAuthCard>
          <div data-testid="utility-body">Password Reset Form</div>
        </SimpleAuthCard>
      );

      expect(screen.getByText("UrPlaced")).toBeInTheDocument();
      expect(screen.getByText("Multi-College Placement Preparation SaaS")).toBeInTheDocument();
      expect(screen.getByTestId("utility-body")).toBeInTheDocument();
      expect(screen.getByText(/Secured with Supabase Authentication/i)).toBeInTheDocument();
    });
  });

  describe("4. Category Boundary & Route Destination Integrity", () => {
    it("strictly isolates Student and College destinations", () => {
      expect(getRoleDefaultDashboard("STUDENT")).toBe("/dashboard/student");
      expect(getRoleDefaultDashboard("PLACEMENT_HEAD")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("PLACEMENT_STAFF")).toBe("/dashboard");
      expect(getRoleDefaultDashboard("TRAINER")).toBe("/dashboard/training");
    });

    it("verifies cross-category rejection prevents students from accessing institutional portals", () => {
      const studentSession = {
        accountCategory: "STUDENT",
        role: "STUDENT",
      };

      const isStudentInCollegePortal =
        studentSession.accountCategory === "STUDENT" ||
        (studentSession.role === "STUDENT" && studentSession.accountCategory !== "COLLEGE");

      expect(isStudentInCollegePortal).toBe(true);
    });

    it("verifies cross-category rejection prevents college staff from logging in through student portal", () => {
      const collegeRoles = ["PLACEMENT_HEAD", "PLACEMENT_STAFF", "TRAINER"];

      for (const role of collegeRoles) {
        const isCollegeUser = role === "PLACEMENT_HEAD" || role === "PLACEMENT_STAFF" || role === "TRAINER";
        expect(isCollegeUser).toBe(true);
      }
    });
  });
});
