import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import {
  toast,
  toastStore,
  confirmDialog,
  promptDialog,
  alertDialog,
  dialogStore,
  ToastContainer,
  DialogSystemHost,
} from "@/components/ui/dialog-system";
import fs from "fs";
import path from "path";

describe("UrPlaced Professional Dialog & Notification System", () => {
  beforeEach(() => {
    toastStore.clear();
    dialogStore.dismissCurrent(null);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("1. Toast Notifications", () => {
    it("renders success toast with correct content", () => {
      render(<ToastContainer />);

      act(() => {
        toast.success("Assessment blueprint created successfully.");
      });

      expect(screen.getByText("Assessment blueprint created successfully.")).toBeInTheDocument();
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("renders error toast with alert role", () => {
      render(<ToastContainer />);

      act(() => {
        toast.error("Assessment title must be at least 3 characters.");
      });

      expect(screen.getByText("Assessment title must be at least 3 characters.")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("renders warning and info toasts", () => {
      render(<ToastContainer />);

      act(() => {
        toast.warning("Title and Question Set are required.", "Validation Warning");
        toast.info("Assessment autosave in progress...");
      });

      expect(screen.getByText("Validation Warning")).toBeInTheDocument();
      expect(screen.getByText("Title and Question Set are required.")).toBeInTheDocument();
      expect(screen.getByText("Assessment autosave in progress...")).toBeInTheDocument();
    });

    it("deduplicates identical toasts instead of creating redundant DOM nodes", () => {
      render(<ToastContainer />);

      act(() => {
        toast.error("Network timeout. Please check your connection.");
        toast.error("Network timeout. Please check your connection.");
        toast.error("Network timeout. Please check your connection.");
      });

      const elements = screen.getAllByText("Network timeout. Please check your connection.");
      expect(elements.length).toBe(1);
    });

    it("dismisses toast when close button is clicked", () => {
      render(<ToastContainer />);

      act(() => {
        toast.info("Temporary notice to dismiss");
      });

      expect(screen.getByText("Temporary notice to dismiss")).toBeInTheDocument();

      const closeBtn = screen.getByLabelText("Dismiss notification");
      act(() => {
        fireEvent.click(closeBtn);
      });

      expect(screen.queryByText("Temporary notice to dismiss")).not.toBeInTheDocument();
    });

    it("automatically dismisses toast after its duration expires", () => {
      render(<ToastContainer />);

      act(() => {
        toast.success("Self-dismissing message", { duration: 3000 });
      });

      expect(screen.getByText("Self-dismissing message")).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3001);
      });

      expect(screen.queryByText("Self-dismissing message")).not.toBeInTheDocument();
    });
  });

  describe("2. Confirmation Dialogs (confirmDialog)", () => {
    it("resolves true when the user clicks confirm", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      let resolvedValue: boolean | null = null;
      let promise: Promise<void>;
      act(() => {
        promise = confirmDialog({
          title: "Freeze & Publish Question Set",
          description: "Freeze and publish this question set as an immutable snapshot?",
          confirmText: "Freeze & Publish",
          variant: "primary",
        }).then((val) => {
          resolvedValue = val;
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Freeze & Publish Question Set")).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole("button", { name: "Freeze & Publish" });
      await act(async () => {
        fireEvent.click(confirmBtn);
        await promise;
      });

      expect(resolvedValue).toBe(true);
    });

    it("resolves false when the user clicks cancel", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      let resolvedValue: boolean | null = null;
      let promise: Promise<void>;
      act(() => {
        promise = confirmDialog({
          title: "Archive Question",
          description: "Are you sure you want to archive this question?",
          confirmText: "Archive",
          variant: "destructive",
        }).then((val) => {
          resolvedValue = val;
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Archive Question")).toBeInTheDocument();
      });

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      await act(async () => {
        fireEvent.click(cancelBtn);
        await promise;
      });

      expect(resolvedValue).toBe(false);
    });

    it("supports async onConfirm with loading state", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      let asyncActionCompleted = false;
      const onConfirmAction = vi.fn().mockImplementation(async () => {
        await new Promise((r) => setTimeout(r, 50));
        asyncActionCompleted = true;
      });

      act(() => {
        confirmDialog({
          title: "Release Assessment Results",
          description: "Release results now?",
          confirmText: "Release Results",
          onConfirm: onConfirmAction,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Release Assessment Results")).toBeInTheDocument();
      });

      const confirmBtn = screen.getByRole("button", { name: "Release Results" });
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      await waitFor(() => {
        expect(asyncActionCompleted).toBe(true);
      });
    });
  });

  describe("3. Input Prompts (promptDialog)", () => {
    it("resolves with user input when submitted", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      let enteredValue: string | null = null;
      let promise: Promise<void>;
      act(() => {
        promise = promptDialog({
          title: "Cancel Recruitment Drive",
          description: "Please provide a reason for cancelling this recruitment drive.",
          label: "Cancellation Reason",
          placeholder: "e.g. Hiring freeze",
          required: true,
        }).then((val) => {
          enteredValue = val;
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Cancel Recruitment Drive")).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("e.g. Hiring freeze");
      act(() => {
        fireEvent.change(input, { target: { value: "Client cancelled recruitment quota" } });
      });

      const submitBtn = screen.getByRole("button", { name: "Submit" });
      await act(async () => {
        fireEvent.click(submitBtn);
        await promise;
      });

      expect(enteredValue).toBe("Client cancelled recruitment quota");
    });

    it("resolves with null when prompt is cancelled", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      let enteredValue: string | null = "INITIAL";
      let promise: Promise<void>;
      act(() => {
        promise = promptDialog({
          title: "Reason Required",
          placeholder: "Enter details",
        }).then((val) => {
          enteredValue = val;
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Reason Required")).toBeInTheDocument();
      });

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      await act(async () => {
        fireEvent.click(cancelBtn);
        await promise;
      });

      expect(enteredValue).toBe(null);
    });

    it("prevents submission and displays error when required field is empty", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      act(() => {
        promptDialog({
          title: "Provide Feedback",
          required: true,
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Provide Feedback")).toBeInTheDocument();
      });

      const submitBtn = screen.getByRole("button", { name: "Submit" });
      act(() => {
        fireEvent.click(submitBtn);
      });

      expect(screen.getByText("This field is required.")).toBeInTheDocument();
    });
  });

  describe("4. Alert Notice Dialogs (alertDialog)", () => {
    it("resolves when the user acknowledges the alert", async () => {
      vi.useRealTimers();
      render(<DialogSystemHost />);

      let acknowledged = false;
      let promise: Promise<void>;
      act(() => {
        promise = alertDialog({
          title: "Time Limit Expired",
          description: "Your allotted assessment duration has expired.",
          confirmText: "Understood",
          variant: "warning",
        }).then(() => {
          acknowledged = true;
        });
      });

      await waitFor(() => {
        expect(screen.getByText("Time Limit Expired")).toBeInTheDocument();
      });

      const okBtn = screen.getByRole("button", { name: "Understood" });
      await act(async () => {
        fireEvent.click(okBtn);
        await promise;
      });

      expect(acknowledged).toBe(true);
    });
  });

  describe("5. Zero Browser-Native Pop-ups in Application Codebase", () => {
    it("verifies no alert(), confirm(), prompt(), or window.* pop-up calls remain in src/ (excluding security tests)", () => {
      function scanDir(dir: string, fileList: string[] = []): string[] {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat.isDirectory()) {
            scanDir(filePath, fileList);
          } else if (/\.(ts|tsx|js|jsx)$/.test(file)) {
            fileList.push(filePath);
          }
        }
        return fileList;
      }

      const allFiles = scanDir(path.resolve(__dirname, "../"));
      const violations: string[] = [];

      const nativePattern = /\b(alert|confirm|prompt)\s*\(/;
      const windowPattern = /\bwindow\.(alert|confirm|prompt)\b/;

      for (const file of allFiles) {
        // Skip security unit tests specifically asserting against XSS injection strings and dialog-system.tsx itself
        if (
          file.endsWith("notifications-service.test.ts") ||
          file.endsWith("ssrf-protection.test.ts") ||
          file.endsWith("dialog-system-and-modal-alignment.test.tsx") ||
          file.endsWith("dialog-system.tsx")
        ) {
          continue;
        }

        const content = fs.readFileSync(file, "utf-8");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          // Ignore comments
          const trimmed = line.trim();
          if (trimmed.startsWith("//") || trimmed.startsWith("*")) return;

          if (nativePattern.test(line) || windowPattern.test(line)) {
            violations.push(`${file}:${index + 1}: ${trimmed}`);
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });
});
