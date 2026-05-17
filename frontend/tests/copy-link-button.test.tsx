import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CopyLinkButton } from "@/components/shared/CopyLinkButton";

const emitAnalyticsEventMock = vi.fn(async () => undefined);

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: (input: unknown) => emitAnalyticsEventMock(input),
}));

describe("CopyLinkButton", () => {
  it("copies an absolute URL derived from current origin and relative href", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <CopyLinkButton
        href="/dashboard/leaderboard?lane=global#leaderboard-arena"
        label="Copy lane"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy lane" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        `${window.location.origin}/dashboard/leaderboard?lane=global#leaderboard-arena`,
      );
    });
  });
});
