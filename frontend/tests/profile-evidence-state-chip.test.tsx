import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";

describe("ProfileEvidenceStateChip", () => {
  it("shows pending label when freshness is not available", () => {
    render(<ProfileEvidenceStateChip showFreshness={false} />);

    const chip = screen.getByText("Evidence pending");
    const descriptionId = chip.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(chip.hasAttribute("title")).toBe(false);

    const description = document.getElementById(descriptionId ?? "");
    expect(description?.textContent).toBe("No scored PR evidence has been materialized yet.");
    expect(description?.className).toContain("sr-only");
  });

  it("shows state-aware pending copy for partial sync", () => {
    render(
      <ProfileEvidenceStateChip
        showFreshness={false}
        syncState="partially_synced"
      />,
    );

    expect(screen.getByText("Partially synced")).not.toBeNull();
  });

  it("shows explicit failure copy when latest sync failed", () => {
    render(
      <ProfileEvidenceStateChip
        showFreshness={false}
        syncState="failed"
      />,
    );

    const chip = screen.getByText("Sync failed");
    expect(chip).not.toBeNull();
    expect(chip.hasAttribute("title")).toBe(false);

    const descriptionId = chip.getAttribute("aria-describedby");
    const description = document.getElementById(descriptionId ?? "");
    expect(description?.textContent).toMatch(/latest sync failed/i);
  });

  it("renders freshness pill when enabled", () => {
    const rendered = withFrozenNow("2026-05-25T12:00:00.000Z", () =>
      render(
        <ProfileEvidenceStateChip
          showFreshness
          refreshedAt="2026-05-25T10:30:00.000Z"
          refreshedLabel="Refreshed"
        />,
      ),
    );

    expect(screen.queryByText("Refreshed")).not.toBeNull();
    const timeNode = rendered.container.querySelector("time");
    if (!timeNode) {
      throw new Error("Expected ProfileEvidenceStateChip to render a semantic time element.");
    }
    expect(timeNode.getAttribute("datetime")).toBe("2026-05-25T10:30:00.000Z");
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
