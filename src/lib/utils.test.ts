import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn utility", () => {
  it("merges standard class names correctly", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional class values", () => {
    const isError = true;
    const isSuccess = false;
    expect(cn("base-class", isError && "border-danger", isSuccess && "border-success")).toBe(
      "base-class border-danger"
    );
  });

  it("resolves conflicting Tailwind classes in favor of the latter", () => {
    expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
  });

  it("filters out falsy values like undefined, null, or false", () => {
    expect(cn("btn", null, undefined, false, "btn-primary")).toBe("btn btn-primary");
  });
});
