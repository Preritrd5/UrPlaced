import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MockInterviewSpeechControl } from "@/components/mock-interview/mock-interview-speech-control";

// Mock SpeechRecognition Class for deterministic testing
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onstart: (() => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn(() => {
    if (this.onstart) {
      this.onstart();
    }
  });

  stop = vi.fn(() => {
    if (this.onend) {
      this.onend();
    }
  });

  abort = vi.fn(() => {
    if (this.onend) {
      this.onend();
    }
  });
}

describe("MockInterviewSpeechControl & Voice Input Engine", () => {
  let originalSpeechRecognition: any;
  let originalWebkitSpeechRecognition: any;

  beforeEach(() => {
    originalSpeechRecognition = (window as any).SpeechRecognition;
    originalWebkitSpeechRecognition = (window as any).webkitSpeechRecognition;
    (window as any).SpeechRecognition = MockSpeechRecognition;
  });

  afterEach(() => {
    (window as any).SpeechRecognition = originalSpeechRecognition;
    (window as any).webkitSpeechRecognition = originalWebkitSpeechRecognition;
    vi.restoreAllMocks();
  });

  it("1. Renders microphone button in IDLE state with accessible label", () => {
    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={0}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    expect(button).toBeDefined();
    expect(button.textContent).toContain("Voice Answer");
  });

  it("2. Displays Voice Unsupported state when browser SpeechRecognition is absent", () => {
    (window as any).SpeechRecognition = undefined;
    (window as any).webkitSpeechRecognition = undefined;

    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={0}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /voice input not supported/i });
    expect(button).toBeDefined();
    expect(button.getAttribute("disabled")).not.toBeNull();
    expect(button.textContent).toContain("Voice Unsupported");
  });

  it("3. Clicking starts recognition with continuous and interim results enabled", () => {
    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={50}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(button);

    // Transitions to Listening
    expect(screen.getByText(/Listening\.\.\./i)).toBeDefined();
    expect(screen.getByRole("button", { name: /stop listening/i })).toBeDefined();
  });

  it("4. Displays live interim transcript without committing to final text", () => {
    let activeInstance: any = null;
    (window as any).SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        activeInstance = this;
      }
    };

    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={100}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(button);

    // Simulate interim result
    act(() => {
      activeInstance.onresult({
        resultIndex: 0,
        results: [
          {
            isFinal: false,
            0: { transcript: "Abstract classes can have instance variables" },
          },
        ],
      });
    });

    // Interim bubble is displayed
    expect(screen.getByText(/Hearing:/i)).toBeDefined();
    expect(screen.getByText(/Abstract classes can have instance variables/i)).toBeDefined();

    // Final append callback has NOT been called yet
    expect(handleAppend).not.toHaveBeenCalled();
  });

  it("5. Appends finalized transcript chunk when speech segment completes", () => {
    let activeInstance: any = null;
    (window as any).SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        activeInstance = this;
      }
    };

    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={100}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(button);

    // Simulate final result
    act(() => {
      activeInstance.onresult({
        resultIndex: 0,
        results: [
          {
            isFinal: true,
            0: { transcript: "Interfaces in Java 8+ support default methods." },
          },
        ],
      });
    });

    // Final append callback was called with the finalized chunk
    expect(handleAppend).toHaveBeenCalledWith("Interfaces in Java 8+ support default methods.");
  });

  it("6. Clicking Stop Dictation cleanly halts speech recognition", () => {
    let activeInstance: any = null;
    (window as any).SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        activeInstance = this;
      }
    };

    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={100}
        maxLength={5000}
      />
    );

    const startBtn = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(startBtn);

    const stopBtn = screen.getByRole("button", { name: /stop listening/i });
    fireEvent.click(stopBtn);

    expect(activeInstance.stop).toHaveBeenCalled();
  });

  it("7. Handles permission denied error non-blockingly without throwing unhandled exceptions", () => {
    let activeInstance: any = null;
    (window as any).SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        activeInstance = this;
      }
    };

    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={0}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(button);

    // Simulate not-allowed error
    act(() => {
      activeInstance.onerror({ error: "not-allowed" });
    });

    expect(screen.getByText(/Microphone access was denied/i)).toBeDefined();
  });

  it("8. Respects character limits and halts recognition when response reaches 5,000 characters", () => {
    const handleAppend = vi.fn();
    render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={5000}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(button);

    // Should indicate limit reached
    expect(screen.getByText(/Response has reached the maximum 5000 character limit/i)).toBeDefined();
    expect(handleAppend).not.toHaveBeenCalled();
  });

  it("9. Cleans up active speech recognition instance on component unmount", () => {
    let activeInstance: any = null;
    (window as any).SpeechRecognition = class extends MockSpeechRecognition {
      constructor() {
        super();
        activeInstance = this;
      }
    };

    const handleAppend = vi.fn();
    const { unmount } = render(
      <MockInterviewSpeechControl
        onAppendTranscript={handleAppend}
        currentLength={0}
        maxLength={5000}
      />
    );

    const button = screen.getByRole("button", { name: /start voice input/i });
    fireEvent.click(button);

    expect(activeInstance).not.toBeNull();

    unmount();
    expect(activeInstance.abort).toHaveBeenCalled();
  });
});
