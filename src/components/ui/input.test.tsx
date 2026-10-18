import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Input } from "./input";

describe("Input component", () => {
  it("renders with placeholder and standard styles", () => {
    render(<Input placeholder="Enter roll number" />);
    const input = screen.getByPlaceholderText("Enter roll number");
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass("bg-input");
  });

  it("applies error styling and aria-invalid when error is true", () => {
    render(<Input placeholder="Enter CGPA" error />);
    const input = screen.getByPlaceholderText("Enter CGPA");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("border-status-danger");
  });

  it("applies disabled attributes when disabled", () => {
    render(<Input placeholder="Disabled input" disabled />);
    const input = screen.getByPlaceholderText("Disabled input");
    expect(input).toBeDisabled();
    expect(input).toHaveClass("disabled:cursor-not-allowed");
  });
});
