import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TableContainer, Table } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ToastContainer, toast } from "@/components/ui/dialog-system";
import tailwindConfig from "../../tailwind.config";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/preritrd/dashboard",
}));

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

  it("verifies PlatformSidebar mobile drawer has responsive width, dvh bounds, isolate, and elevated z-index", async () => {
    const { PlatformSidebar } = await import("@/components/platform-admin/platform-nav");
    const { container } = render(
      <PlatformSidebar adminEmail="urplaced5@gmail.com" adminName="Platform Super Admin" />
    );

    const mobileHeader = container.querySelector("header.md\\:hidden");
    expect(mobileHeader).not.toBeNull();
    expect(mobileHeader?.className).toContain("z-30");

    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("isolate");
    expect(aside?.className).toContain("w-[min(310px,85vw)]");
    expect(aside?.className).toContain("h-[100dvh]");
    expect(aside?.className).toContain("z-50");
    expect(aside?.className).toContain("shadow-2xl");
    expect(aside?.className).toContain("pointer-events-none");
  });

  it("verifies mobile drawer backdrop uses solid high-contrast overlay without hardware-glitching backdrop blur", async () => {
    const { PlatformSidebar } = await import("@/components/platform-admin/platform-nav");
    const { container } = render(
      <PlatformSidebar adminEmail="urplaced5@gmail.com" adminName="Platform Super Admin" />
    );

    const toggleBtn = container.querySelector('button[aria-label="Toggle navigation menu"]');
    expect(toggleBtn).not.toBeNull();
    fireEvent.click(toggleBtn!);

    // After clicking toggle, backdrop should be present
    const backdrop = container.querySelector(".fixed.inset-0.z-40");
    expect(backdrop).not.toBeNull();
    expect(backdrop?.className).toContain("bg-[rgba(36,40,58,0.55)]");
    expect(backdrop?.className).not.toContain("backdrop-blur");
  });
});
