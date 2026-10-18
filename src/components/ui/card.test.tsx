import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "./card";

describe("Card component suite", () => {
  it("renders card hierarchy with title, description, content, and footer", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Drive Title</CardTitle>
          <CardDescription>Drive Description</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Card body content</p>
        </CardContent>
        <CardFooter>
          <p>Card footer actions</p>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText("Drive Title")).toBeInTheDocument();
    expect(screen.getByText("Drive Description")).toBeInTheDocument();
    expect(screen.getByText("Card body content")).toBeInTheDocument();
    expect(screen.getByText("Card footer actions")).toBeInTheDocument();
  });
});
