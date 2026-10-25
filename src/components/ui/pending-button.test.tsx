import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import * as React from "react";
import { PendingButton } from "./pending-button";

describe("PendingButton Suite", () => {
  it("renders idle button with normal label and active state", () => {
    render(<PendingButton variant="primary">Dispatch Invitation</PendingButton>);
    const btn = screen.getByRole("button", { name: /Dispatch Invitation/i });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
    expect(btn).not.toHaveAttribute("aria-busy", "true");
  });

  it("renders pending state with spinner, pending text, and disabled interaction", () => {
    render(
      <PendingButton
        variant="secondary"
        isLoading={true}
        pendingText="Dispatching invitation via SMTP..."
      >
        Dispatch Invitation
      </PendingButton>
    );

    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Dispatching invitation via SMTP...")).toBeInTheDocument();
    expect(screen.queryByText("Dispatch Invitation")).not.toBeInTheDocument();
  });
});
