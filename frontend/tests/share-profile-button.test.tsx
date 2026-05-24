import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ShareProfileButton } from "@/components/shared/ShareProfileButton";

const emitAnalyticsEventMock = vi.fn();

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: (...args: unknown[]) => emitAnalyticsEventMock(...args),
}));

describe("ShareProfileButton", () => {
  const shareMock = vi.fn();
  const writeTextMock = vi.fn();
  const promptMock = vi.fn();
  const originalPrompt = window.prompt;

  beforeEach(() => {
    emitAnalyticsEventMock.mockReset();
    shareMock.mockReset();
    writeTextMock.mockReset();
    promptMock.mockReset();
    Object.defineProperty(window, "prompt", {
      configurable: true,
      value: promptMock,
    });
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      value: shareMock,
    });
    Object.defineProperty(window.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: writeTextMock,
      },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "prompt", {
      configurable: true,
      value: originalPrompt,
    });
  });

  it("does not fallback to clipboard when native share is cancelled", async () => {
    shareMock.mockRejectedValueOnce({ name: "AbortError" });

    render(
      <ShareProfileButton
        username="octocat"
        displayName="Octo Cat"
        shareHeadline="Share headline"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share profile" }));

    await waitFor(() => {
      expect(shareMock).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("button", { name: "Share profile" }),
    ).toBeTruthy();
    expect(writeTextMock).not.toHaveBeenCalled();
    expect(promptMock).not.toHaveBeenCalled();
    expect(emitAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it("falls back to clipboard copy when native share fails for non-cancel errors", async () => {
    shareMock.mockRejectedValueOnce(new Error("share failed"));
    writeTextMock.mockResolvedValueOnce(undefined);

    render(
      <ShareProfileButton
        username="octocat"
        displayName="Octo Cat"
        shareHeadline="Share headline"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share profile" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    expect(writeTextMock).toHaveBeenCalledWith(
      `${window.location.origin}/u/octocat`,
    );
    expect(promptMock).not.toHaveBeenCalled();
  });

  it("keeps idle state when manual prompt fallback is cancelled", async () => {
    shareMock.mockRejectedValueOnce(new Error("share failed"));
    writeTextMock.mockRejectedValueOnce(new Error("clipboard unavailable"));
    promptMock.mockReturnValueOnce(null);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });

    render(
      <ShareProfileButton
        username="octocat"
        displayName="Octo Cat"
        shareHeadline="Share headline"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share profile" }));

    await waitFor(() => {
      expect(promptMock).toHaveBeenCalledTimes(1);
    });
    expect(
      screen.getByRole("button", { name: "Share profile" }),
    ).toBeTruthy();
    expect(emitAnalyticsEventMock).not.toHaveBeenCalled();
  });
});
