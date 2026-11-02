import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { BrandLoader } from "./brand-loader";

describe("BrandLoader Component", () => {
  it("renders with role='status' and canonical brand-loader image", () => {
    render(<BrandLoader />);
    const status = screen.getByRole("status");
    expect(status).toBeInTheDocument();
    
    const img = status.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "/brand/brand-loader.png");
    expect(img).toHaveClass("animate-brand-loader");
    expect(img).toHaveStyle({ width: "24px", height: "24px" });
  });

  it("applies the button size preset (18px)", () => {
    render(<BrandLoader size="button" />);
    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "18px", height: "18px" });
  });

  it("applies the card size preset (36px)", () => {
    render(<BrandLoader size="card" />);
    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "36px", height: "36px" });
  });

  it("applies the section size preset (48px)", () => {
    render(<BrandLoader size="section" />);
    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "48px", height: "48px" });
  });

  it("applies the page size preset (56px)", () => {
    render(<BrandLoader size="page" />);
    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "56px", height: "56px" });
  });

  it("applies custom numeric pixel size", () => {
    render(<BrandLoader size={42} />);
    const img = screen.getByRole("status").querySelector("img");
    expect(img).toHaveStyle({ width: "42px", height: "42px" });
  });

  it("provides accessible hidden screen reader label when showLabel is false", () => {
    render(<BrandLoader label="Authenticating session..." />);
    const srText = screen.getByText("Authenticating session...");
    expect(srText).toBeInTheDocument();
    expect(srText).toHaveClass("sr-only");
  });

  it("renders visible label text when showLabel is true", () => {
    render(<BrandLoader label="Please wait..." showLabel />);
    const visibleText = screen.getByText("Please wait...");
    expect(visibleText).toBeInTheDocument();
    expect(visibleText).not.toHaveClass("sr-only");
  });
});
