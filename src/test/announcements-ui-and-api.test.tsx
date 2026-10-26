import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { AnnouncementCompose } from "@/components/announcements/announcement-compose";
import { AnnouncementHistory } from "@/components/announcements/announcement-history";
import type { AnnouncementRecord } from "@/modules/notifications/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("UrPlaced Announcements UI & Integration Suite", () => {
  const mockCollegeId = "660e8400-e29b-41d4-a716-446655440001";
  const mockDepartments = [
    { id: "dept-1", name: "Computer Science & Engineering", code: "CSE" },
    { id: "dept-2", name: "Information Technology", code: "IT" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("1. AnnouncementCompose Component", () => {
    it("renders headline, body, category selectors, and audience options", () => {
      render(
        <AnnouncementCompose
          collegeId={mockCollegeId}
          departments={mockDepartments}
          allStudentsCount={120}
        />
      );

      expect(screen.getByText("Compose Institutional Announcement")).toBeDefined();
      expect(screen.getByPlaceholderText(/Campus Placement Drive:/i)).toBeDefined();
      expect(screen.getByPlaceholderText(/Detail the announcement,/i)).toBeDefined();
      expect(screen.getAllByText("General Notice").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Placement Drive")).toBeDefined();
      expect(screen.getByText("Academic & Prep")).toBeDefined();
      expect(screen.getByText("Urgent Alert")).toBeDefined();
      expect(screen.getAllByText("All Students").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("By Department")).toBeDefined();
      expect(screen.getByText("Selected Students")).toBeDefined();
    });

    it("updates character counter and live notification card preview when typing", () => {
      render(
        <AnnouncementCompose
          collegeId={mockCollegeId}
          departments={mockDepartments}
          allStudentsCount={120}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Campus Placement Drive:/i);
      fireEvent.change(titleInput, { target: { value: "Amazon Campus Drive 2026" } });

      const bodyInput = screen.getByPlaceholderText(/Detail the announcement,/i);
      fireEvent.change(bodyInput, {
        target: { value: "Eligible students must register before Friday 5 PM." },
      });

      // Character count indicator
      expect(screen.getByText("24/255")).toBeDefined();
      expect(screen.getByText("51/2000")).toBeDefined();

      // Student Bell Dropdown Preview reflects inputs
      expect(screen.getByText("Amazon Campus Drive 2026")).toBeDefined();
      expect(
        screen.getAllByText("Eligible students must register before Friday 5 PM.").length
      ).toBeGreaterThanOrEqual(1);
    });

    it("populates action destination input when clicking quick action chip", () => {
      render(
        <AnnouncementCompose
          collegeId={mockCollegeId}
          departments={mockDepartments}
          allStudentsCount={120}
        />
      );

      const quickChip = screen.getByText("Company Drive Insights");
      fireEvent.click(quickChip);

      const urlInput = screen.getByPlaceholderText("/dashboard/student/assessments") as HTMLInputElement;
      expect(urlInput.value).toBe("/dashboard/student/memory");
      expect(screen.getByText("Valid internal link")).toBeDefined();
    });

    it("validates action destination URL and displays warning on external URL", () => {
      render(
        <AnnouncementCompose
          collegeId={mockCollegeId}
          departments={mockDepartments}
          allStudentsCount={120}
        />
      );

      const urlInput = screen.getByPlaceholderText("/dashboard/student/assessments");
      fireEvent.change(urlInput, { target: { value: "https://external.com" } });

      expect(screen.getByText("Must start with '/'")).toBeDefined();
    });

    it("displays estimated reach of college-wide students", () => {
      render(
        <AnnouncementCompose
          collegeId={mockCollegeId}
          departments={mockDepartments}
          allStudentsCount={245}
        />
      );

      expect(screen.getAllByText(/245/).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("students")).toBeDefined();
      expect(screen.getByText("College-wide (All Departments)")).toBeDefined();
    });

    it("opens confirmation modal when clicking review button with valid form", () => {
      render(
        <AnnouncementCompose
          collegeId={mockCollegeId}
          departments={mockDepartments}
          allStudentsCount={50}
        />
      );

      const titleInput = screen.getByPlaceholderText(/Campus Placement Drive:/i);
      fireEvent.change(titleInput, { target: { value: "Placement Workshop" } });

      const bodyInput = screen.getByPlaceholderText(/Detail the announcement,/i);
      fireEvent.change(bodyInput, { target: { value: "Join the mock interview workshop." } });

      const reviewBtn = screen.getByText(/Review & Broadcast to 50 Students/i);
      expect(reviewBtn).toBeDefined();
      fireEvent.click(reviewBtn);

      expect(screen.getByText("Confirm Announcement Broadcast")).toBeDefined();
      expect(screen.getByText(/This announcement will immediately notify/i)).toBeDefined();
      expect(screen.getByText("Yes, Broadcast Now")).toBeDefined();
    });
  });

  describe("2. AnnouncementHistory Component", () => {
    const mockHistory: AnnouncementRecord[] = [
      {
        id: "ann-mock-1",
        college_id: mockCollegeId,
        created_by: "user-1",
        title: "TCS Ninja Registration",
        body: "Registration closes tomorrow at midnight. Please submit your verified resumes.",
        category: "PLACEMENT_DRIVE",
        audience_type: "ALL_STUDENTS",
        audience_filter: {},
        action_url: "/dashboard/student/memory",
        status: "SENT",
        recipient_count: 140,
        created_at: "2026-10-25T10:00:00.000Z",
        sent_at: "2026-10-25T10:00:00.000Z",
      },
      {
        id: "ann-mock-2",
        college_id: mockCollegeId,
        created_by: "user-1",
        title: "Math Mock Assessment",
        body: "Department assessment is scheduled for Monday 10 AM.",
        category: "ACADEMIC",
        audience_type: "DEPARTMENT",
        audience_filter: { department_name: "Computer Science & Engineering" },
        action_url: "/dashboard/student/assessments",
        status: "SENT",
        recipient_count: 60,
        created_at: "2026-10-24T10:00:00.000Z",
        sent_at: "2026-10-24T10:00:00.000Z",
      },
    ];

    it("renders history cards with category badges, delivery counts, and timestamps", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ announcements: mockHistory, total: 2 }),
      });

      render(<AnnouncementHistory collegeId={mockCollegeId} />);

      await waitFor(() => {
        expect(screen.getByText("TCS Ninja Registration")).toBeDefined();
        expect(screen.getByText("Math Mock Assessment")).toBeDefined();
        expect(screen.getByText("140 delivered")).toBeDefined();
        expect(screen.getByText("60 delivered")).toBeDefined();
      });
    });

    it("filters announcements by keyword in search input", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ announcements: mockHistory, total: 2 }),
      });

      render(<AnnouncementHistory collegeId={mockCollegeId} />);

      await waitFor(() => {
        expect(screen.getByText("TCS Ninja Registration")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Search history by headline/i);
      fireEvent.change(searchInput, { target: { value: "Math" } });

      expect(screen.queryByText("TCS Ninja Registration")).toBeNull();
      expect(screen.getByText("Math Mock Assessment")).toBeDefined();
    });

    it("opens announcement details dialog when clicking view details", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ announcements: mockHistory, total: 2 }),
      });

      render(<AnnouncementHistory collegeId={mockCollegeId} />);

      await waitFor(() => {
        expect(screen.getAllByText("View Details")[0]).toBeDefined();
      });

      const viewBtns = screen.getAllByText("View Details");
      fireEvent.click(viewBtns[0]);

      expect(screen.getByText("Message Content")).toBeDefined();
      expect(
        screen.getAllByText(/Registration closes tomorrow at midnight/i).length
      ).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("140 students")).toBeDefined();
    });
  });
});
