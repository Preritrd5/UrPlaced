import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Button } from "./button";

describe("Button component", () => {
  it("renders with default primary variant and text", () => {
    render(<Button>Click Me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("bg-primary");
  });

  it("applies the secondary variant class correctly", () => {
    render(<Button variant="secondary">Secondary Action</Button>);
    const button = screen.getByRole("button", { name: /secondary action/i });
    expect(button).toHaveClass("bg-secondary");
  });

  it("applies the destructive variant class correctly", () => {
    render(<Button variant="destructive">Delete Item</Button>);
    const button = screen.getByRole("button", { name: /delete item/i });
    expect(button).toHaveClass("bg-status-danger");
  });

  it("disables the button when disabled prop is provided", () => {
    render(<Button disabled>Disabled Action</Button>);
    const button = screen.getByRole("button", { name: /disabled action/i });
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled:opacity-50");
  });

  it("shows loading spinner and disables button when isLoading is true", () => {
    render(<Button isLoading>Submitting</Button>);
    const button = screen.getByRole("button", { name: /submitting/i });
    expect(button).toBeDisabled();
    expect(button.querySelector("img, [data-brand-loader]")).toBeInTheDocument();
  });
});
