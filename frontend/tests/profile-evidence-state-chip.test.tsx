import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileEvidenceStateChip } from "@/components/shared/ProfileEvidenceStateChip";

describe("ProfileEvidenceStateChip", () => {
  it("shows pending label when freshness is not available", () => {
    render(<ProfileEvidenceStateChip showFreshness={false} />);

    expect(screen.getByText("Evidence pending")).not.toBeNull();
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
    expect(chip.getAttribute("title")).toMatch(/latest sync failed/i);
  });

  it("renders freshness pill when enabled", () => {
    withFrozenNow("2026-05-25T12:00:00.000Z", () => {
      render(
        <ProfileEvidenceStateChip
          showFreshness
          refreshedAt="2026-05-25T10:30:00.000Z"
          refreshedLabel="Refreshed"
        />,
      );
    });

    expect(screen.queryByText("Refreshed")).not.toBeNull();
    const timeNode = screen.getByText((content, node) => {
      return node?.tagName.toLowerCase() === "time" && content.trim().length > 0;
    });
    expect(timeNode.getAttribute("datetime")).toBe("2026-05-25T10:30:00.000Z");
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
