import React from "react";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TableContainer, Table } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ToastContainer, toast } from "@/components/ui/dialog-system";
import tailwindConfig from "../../tailwind.config";

describe("Mobile Responsiveness Architecture & Component Invariants", () => {
  it("verifies tailwind screens configuration includes xs (480px) breakpoint", () => {
    const screens = (tailwindConfig as any).theme?.extend?.screens;
    expect(screens).toBeDefined();
    expect(screens.xs).toBe("480px");
  });

  it("verifies TableContainer has overflow-x-auto and Table has min-w-[540px] to prevent mobile squashing", () => {
    const { container } = render(
      <TableContainer>
        <Table>
          <tbody>
            <tr><td>Cell</td></tr>
          </tbody>
        </Table>
      </TableContainer>
    );

    const tableContainerEl = container.firstChild as HTMLElement;
    expect(tableContainerEl.className).toContain("overflow-x-auto");
    expect(tableContainerEl.className).toContain("max-w-full");

    const tableEl = tableContainerEl.querySelector("table");
    expect(tableEl).not.toBeNull();
    expect(tableEl?.className).toContain("min-w-[540px]");
  });

  it("verifies TabsList has horizontal scrolling and bounds on mobile viewports", () => {
    const { container } = render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
      </Tabs>
    );

    const tabsListEl = container.querySelector('[role="tablist"]');
    expect(tabsListEl).not.toBeNull();
    expect(tabsListEl?.className).toContain("overflow-x-auto");
    expect(tabsListEl?.className).toContain("max-w-full");
    expect(tabsListEl?.className).toContain("scrollbar-none");
  });

  it("verifies DialogContent has bounds of w-[calc(100%-1.5rem)] and max-h-[90dvh] with overflow-y-auto", () => {
    const { getByRole } = render(
      <Dialog open={true}>
        <DialogContent>
          <p>Dialog body</p>
        </DialogContent>
      </Dialog>
    );

    const dialogContentEl = getByRole("dialog");
    expect(dialogContentEl).not.toBeNull();
    expect(dialogContentEl.className).toContain("w-[calc(100%-1.5rem)]");
    expect(dialogContentEl.className).toContain("max-h-[90dvh]");
    expect(dialogContentEl.className).toContain("overflow-y-auto");
    expect(dialogContentEl.className).toContain("p-4");
    expect(dialogContentEl.className).toContain("sm:p-6");
  });

  it("verifies ToastContainer is responsive and docked safely with inset-x-3 on mobile screens", () => {
    toast.success("Test notification");
    const { container } = render(<ToastContainer />);
    const toastContainerEl = container.firstChild as HTMLElement;
    expect(toastContainerEl).not.toBeNull();
    expect(toastContainerEl.className).toContain("inset-x-3");
    expect(toastContainerEl.className).toContain("sm:inset-x-auto");
    expect(toastContainerEl.className).toContain("sm:right-4");
  });
});
