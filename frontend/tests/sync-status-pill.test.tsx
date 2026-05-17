import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SyncStatusPill } from "@/components/shared/SyncStatusPill";

describe("SyncStatusPill", () => {
  it("shows visible exact sync timestamp text on wider layouts", () => {
    render(
      <SyncStatusPill
        status={{
          state: "synced",
          lastSyncedAt: "2026-05-17T18:20:00.000Z",
          partialProfileAvailable: false,
        }}
      />,
    );

    expect(screen.getByText("Synced")).toBeTruthy();
    expect(screen.getByText(/ago/)).toBeTruthy();
    expect(screen.getByText(/\(.+\)/)).toBeTruthy();
    const semanticTimes = screen.getAllByText((_content, element) => element?.tagName.toLowerCase() === "time");
    expect(semanticTimes.length).toBeGreaterThan(0);
    expect(semanticTimes[0]?.getAttribute("datetime")).toMatch(/2026-05-17T18:20:00/);
  });
});
