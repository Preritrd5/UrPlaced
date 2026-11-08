import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StudentActivityHeatmap } from "@/components/student/student-activity-heatmap";
import type { StudentActivityHeatmapPayload } from "@/modules/students/services/student-activity-heatmap-service";

const samplePayload: StudentActivityHeatmapPayload = {
  studentId: "student-123",
  totalSubmissions: 14,
  totalActiveDays: 14,
  maxStreak: 9,
  currentStreak: 4,
  startDate: "2025-11-09",
  endDate: "2026-11-08",
  days: {
    "2026-11-06": {
      date: "2026-11-06",
      count: 3,
      level: 3,
      breakdown: { assessments: 3, applications: 0, mistakeRemediations: 0 },
    },
  },
  months: [
    {
      monthKey: "2025-11",
      monthLabel: "Nov",
      year: 2025,
      columns: [
        [
          null,
          null,
          null,
          null,
          null,
          null,
          {
            date: "2025-11-09",
            dayOfMonth: 9,
            dayOfWeek: 0,
            isFuture: false,
            activity: {
              date: "2025-11-09",
              count: 0,
              level: 0,
              breakdown: { assessments: 0, applications: 0, mistakeRemediations: 0 },
            },
          },
        ],
      ],
    },
    {
      monthKey: "2026-11",
      monthLabel: "Nov",
      year: 2026,
      columns: [
        [
          {
            date: "2026-11-06",
            dayOfMonth: 6,
            dayOfWeek: 5,
            isFuture: false,
            activity: {
              date: "2026-11-06",
              count: 3,
              level: 3,
              breakdown: { assessments: 3, applications: 0, mistakeRemediations: 0 },
            },
          },
        ],
      ],
    },
  ],
};

const emptyPayload: StudentActivityHeatmapPayload = {
  studentId: "student-empty",
  totalSubmissions: 0,
  totalActiveDays: 0,
  maxStreak: 0,
  currentStreak: 0,
  startDate: "2025-11-09",
  endDate: "2026-11-08",
  days: {},
  months: [
    {
      monthKey: "2025-11",
      monthLabel: "Nov",
      year: 2025,
      columns: [],
    },
  ],
};

describe("StudentActivityHeatmap Component UI Tests", () => {
  it("renders with sample data matching user reference layout", () => {
    render(<StudentActivityHeatmap initialData={samplePayload} />);

    // Header metrics
    expect(screen.getByText(/14 submissions in the past one year/i)).toBeDefined();
    expect(screen.getByText("14")).toBeDefined(); // Total active days
    expect(screen.getByText("9")).toBeDefined(); // Max streak

    // Month labels
    expect(screen.getAllByText("Nov").length).toBeGreaterThanOrEqual(1);

    // Contribution grid
    expect(screen.getByRole("grid")).toBeDefined();
  });

  it("toggles the explanatory info tooltip on click or hover", () => {
    render(<StudentActivityHeatmap initialData={samplePayload} />);

    const infoBtn = screen.getByLabelText(/About activity submissions/i);
    expect(infoBtn).toBeDefined();

    // Hover or click
    fireEvent.mouseEnter(infoBtn);
    expect(screen.getByText(/Qualifying Submissions/i)).toBeDefined();
    expect(screen.getByText(/Completed & scored assessment attempts/i)).toBeDefined();

    fireEvent.mouseLeave(infoBtn);
    expect(screen.queryByText(/Qualifying Submissions/i)).toBeNull();
  });

  it("renders empty state with zero submissions and guidance message", () => {
    render(<StudentActivityHeatmap initialData={emptyPayload} />);

    expect(screen.getByText(/0 submissions in the past one year/i)).toBeDefined();
    expect(screen.getByText("Total active days:")).toBeDefined();
    expect(screen.getByText("Max streak:")).toBeDefined();
    expect(
      screen.getByText(/No submissions recorded in the past year/i)
    ).toBeDefined();
  });

  it("displays hover tooltip on grid cell interaction", () => {
    render(<StudentActivityHeatmap initialData={samplePayload} />);

    const cell = screen.getByLabelText(/2026-11-06: 3 submissions/i);
    expect(cell).toBeDefined();

    fireEvent.mouseEnter(cell);
    expect(screen.getByText(/Level 3/i)).toBeDefined();
    expect(screen.getByText("3")).toBeDefined(); // Assessments count in breakdown
  });
});
