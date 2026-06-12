import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CopyTextButton } from "@/components/shared/CopyTextButton";

const emitAnalyticsEventMock = vi.fn();

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: (...args: unknown[]) => emitAnalyticsEventMock(...args),
}));

describe("CopyTextButton", () => {
  const writeTextMock = vi.fn();
  const promptMock = vi.fn();
  const originalPrompt = window.prompt;

  beforeEach(() => {
    emitAnalyticsEventMock.mockReset();
    writeTextMock.mockReset();
    promptMock.mockReset();
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    Object.defineProperty(window, "prompt", {
      configurable: true,
      value: promptMock,
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "prompt", {
      configurable: true,
      value: originalPrompt,
    });
  });

  it("keeps idle state when manual prompt is cancelled", async () => {
    promptMock.mockReturnValueOnce(null);

    render(<CopyTextButton text="example-text" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(promptMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeTruthy();
    expect(emitAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("shows manual state and analytics when prompt fallback proceeds", async () => {
    promptMock.mockReturnValueOnce("example-text");

    render(<CopyTextButton text="example-text" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy manually" })).toBeTruthy();
    });
    expect(emitAnalyticsEventMock).toHaveBeenCalledTimes(1);
  });

  it("keeps manual fallback names contextual when the copy target is specific", async () => {
    promptMock.mockReturnValueOnce("profile summary");

    render(<CopyTextButton text="profile summary" label="Copy summary" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy summary manually" })).toBeTruthy();
    });
    expect(screen.getByRole("status").textContent).toBe("Copy summary manually");
  });

  it("keeps copied state names contextual when the visible copied label is generic", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    writeTextMock.mockResolvedValueOnce(undefined);

    render(<CopyTextButton text="profile summary" label="Copy summary" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Summary copied" })).toBeTruthy();
    });
    expect(screen.getByRole("status").textContent).toBe("Summary copied");
  });

  it("keeps failure state names contextual when clipboard copy fails", async () => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    writeTextMock.mockRejectedValueOnce(new Error("clipboard unavailable"));

    render(<CopyTextButton text="profile summary" label="Copy summary" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy summary" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Copy summary failed" })).toBeTruthy();
    });
    expect(screen.getByRole("status").textContent).toBe("Copy summary failed");
  });
});
