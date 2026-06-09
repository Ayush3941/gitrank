import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelativeTime } from "@/components/shared/RelativeTime";
import { StaleState } from "@/components/shared/StaleState";

describe("StaleState", () => {
  it("renders exact verification timestamp hint when updatedAt is provided", () => {
    render(
      <StaleState
        message="Leaderboard context refreshed 2h ago."
        updatedAt="2026-05-17T18:10:00.000Z"
        actionLabel="Open settings"
        actionHref="/dashboard/settings"
      />,
    );

    expect(screen.getByText(/Last verified at/i)).toBeTruthy();
    expect(screen.getByRole("status").getAttribute("aria-atomic")).toBe("true");
    const exactTime = screen.getByText((_content, element) => element?.tagName.toLowerCase() === "time");
    expect(exactTime.getAttribute("datetime")).toMatch(/2026-05-17T18:10:00/);
  });

  it("accepts semantic relative timestamp content in the status message", () => {
    render(
      <StaleState
        message={(
          <>
            Profile snapshot refreshed{" "}
            <RelativeTime
              value="2026-05-17T18:10:00.000Z"
              exactLabel="Profile snapshot refreshed"
            />
            .
          </>
        )}
        updatedAt="2026-05-17T18:10:00.000Z"
      />,
    );

    const status = screen.getByRole("status");
    const relativeTime = status.querySelector("time");
    expect(relativeTime?.getAttribute("datetime")).toBe("2026-05-17T18:10:00.000Z");
    expect(status.textContent).toContain("Profile snapshot refreshed");
  });

  it("shows refresh feedback when refresh is requested", async () => {
    render(
      <StaleState
        message="Profile data is stale."
        updatedAt="2026-05-17T18:10:00.000Z"
        onRefresh={async () => ({
          tone: "success",
          message: "Refresh queued successfully.",
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(screen.getByText("Refresh queued successfully.")).toBeTruthy();
    });
  });

  it("marks refresh action busy with concise pending copy", () => {
    render(
      <StaleState
        message="Profile data is stale."
        updatedAt="2026-05-17T18:10:00.000Z"
        isRefreshing
        onRefresh={() => undefined}
      />,
    );

    const refresh = screen.getByRole("button", { name: "Refreshing data" });
    expect(refresh.getAttribute("aria-busy")).toBe("true");
  });

  it("shows sanitized refresh errors when refresh fails", async () => {
    render(
      <StaleState
        message="Profile data is stale."
        updatedAt="2026-05-17T18:10:00.000Z"
        onRefresh={async () => {
          throw new Error("context deadline exceeded");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(
        screen.getByText("GitHub did not respond in time. Wait about a minute, then retry."),
      ).toBeTruthy();
    });
  });

  it("renders optional sync reason copy when provided", () => {
    render(
      <StaleState
        message="Profile data is stale."
        reasonMessage="Latest sync was partial because historical backfill is still in progress."
        updatedAt="2026-05-17T18:10:00.000Z"
      />,
    );

    expect(
      screen.getByText("Latest sync was partial because historical backfill is still in progress."),
    ).toBeTruthy();
  });

  it("uses an evidence-pending headline for partially synced state", () => {
    render(
      <StaleState
        message="Profile snapshot exists, but evidence hydration is still in progress."
        updatedAt="2026-05-17T18:10:00.000Z"
        syncState="partially_synced"
      />,
    );

    expect(screen.getByText("Evidence pending")).toBeTruthy();
    expect(
      screen.getByText("Latest verified data stays visible while remaining PR evidence syncs."),
    ).toBeTruthy();
  });
});
