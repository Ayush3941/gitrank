import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RelativeTime } from "@/components/shared/RelativeTime";

describe("RelativeTime", () => {
  it("renders a semantic relative timestamp with screen-reader exact time", () => {
    withFrozenNow("2026-05-25T12:00:00.000Z", () => {
      render(
        <RelativeTime
          value="2026-05-25T10:30:00.000Z"
          exactLabel="Last refreshed"
        />,
      );
    });

    const timeNode = screen.getByText("1h ago").closest("time");
    expect(timeNode?.getAttribute("datetime")).toBe("2026-05-25T10:30:00.000Z");
    expect(timeNode?.hasAttribute("title")).toBe(false);
    expect(screen.getByText(/Last refreshed:/).className).toContain("sr-only");
  });

  it("can expose exact time visually on wider layouts without duplicating spoken text", () => {
    withFrozenNow("2026-05-25T12:00:00.000Z", () => {
      render(
        <RelativeTime
          value="2026-05-25T10:30:00.000Z"
          exactLabel="Exact sync time"
          exactVisibility="responsive"
        />,
      );
    });

    const visibleExact = screen.getByText(/\(.+\)/);
    expect(visibleExact.getAttribute("aria-hidden")).toBe("true");
    expect(visibleExact.className).toContain("sm:inline");
  });
});

function withFrozenNow(isoTimestamp: string, run: () => void) {
  const mocked = vi.useFakeTimers();
  vi.setSystemTime(new Date(isoTimestamp));
  try {
    run();
  } finally {
    mocked.useRealTimers();
  }
}
