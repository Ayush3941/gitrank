import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SnapshotFreshnessPill } from "@/components/shared/SnapshotFreshnessPill";

describe("SnapshotFreshnessPill", () => {
  it("renders nothing when refreshedAt is missing", () => {
    const rendered = render(<SnapshotFreshnessPill />);
    expect(rendered.container.firstChild).toBeNull();
  });

  it("renders default label with normalized datetime", () => {
    const rendered = withFrozenNow("2026-05-25T12:00:00.000Z", () =>
      render(<SnapshotFreshnessPill refreshedAt="2026-05-25T10:30:00.000Z" />),
    );

    expect(screen.queryByText("Snapshot")).not.toBeNull();
    const timeNode = rendered.container.querySelector("time");
    if (!timeNode) {
      throw new Error("Expected SnapshotFreshnessPill to render a semantic time element.");
    }
    expect(timeNode.getAttribute("datetime")).toBe("2026-05-25T10:30:00.000Z");
    expect(timeNode.hasAttribute("title")).toBe(false);
  });

  it("renders custom label", () => {
    withFrozenNow("2026-05-25T12:00:00.000Z", () => {
      render(
        <SnapshotFreshnessPill
          refreshedAt="2026-05-24T09:00:00.000Z"
          label="Refreshed"
        />,
      );
    });

    expect(screen.queryByText("Refreshed")).not.toBeNull();
  });
});

function withFrozenNow<T>(isoTimestamp: string, run: () => T): T {
  const mocked = vi.useFakeTimers();
  vi.setSystemTime(new Date(isoTimestamp));
  try {
    return run();
  } finally {
    mocked.useRealTimers();
  }
}
