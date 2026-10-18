import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Badge } from "./badge";

describe("Badge component", () => {
  it("renders with default primary variant", () => {
    render(<Badge>Default Badge</Badge>);
    const badge = screen.getByText("Default Badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("bg-primary");
  });

  it("renders with secondary accent variant", () => {
    render(<Badge variant="secondary">Verified Accent</Badge>);
    const badge = screen.getByText("Verified Accent");
    expect(badge).toHaveClass("bg-secondary");
  });

  it("renders semantic success and danger variants", () => {
    render(
      <div>
        <Badge variant="success">Eligible</Badge>
        <Badge variant="danger">Disqualified</Badge>
      </div>
    );
    expect(screen.getByText("Eligible")).toHaveClass("text-status-success");
    expect(screen.getByText("Disqualified")).toHaveClass("text-status-danger");
  });
});
