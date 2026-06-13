import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PublicPRReportRouteError from "@/app/(public)/pr/[owner]/[repo]/[number]/error";
import PublicPRReportNotFound from "@/app/(public)/pr/[owner]/[repo]/[number]/not-found";
import PublicProfileRouteError from "@/app/(public)/u/[username]/error";
import PublicProfileNotFound from "@/app/(public)/u/[username]/not-found";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: vi.fn(),
}));

describe("public route recovery", () => {
  it("keeps public profile not-found recovery visitor-safe", () => {
    render(<PublicProfileNotFound />);

    expect(
      screen.getByRole("heading", { name: "This contributor profile is unavailable" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "This public profile is hidden, missing, or has not published scored PR evidence yet. Open the leaderboard or return to landing.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.getByRole("link", { name: "Open landing" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: "Open dashboard" })).toBeNull();
  });

  it("keeps public profile route errors out of authenticated recovery paths", () => {
    const reset = vi.fn();
    render(<PublicProfileRouteError error={new Error("boom")} reset={reset} />);

    expect(screen.getByRole("heading", { name: "Profile view failed to render" })).toBeTruthy();
    expect(
      screen.getByText(
        "Retry this public profile route now. If it still fails, open the leaderboard or return to landing while evidence refreshes.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.queryByRole("link", { name: "Open settings" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry profile route" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("keeps public PR report route recovery focused on public evidence destinations", () => {
    render(<PublicPRReportNotFound />);

    expect(
      screen.getByRole("heading", { name: "This battle report route is unavailable" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "This battle report may be private, still syncing, or not published yet. Open the leaderboard or return to landing.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.getByRole("link", { name: "Open landing" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: "Open contributions" })).toBeNull();
  });

  it("keeps public PR report route errors out of sync-settings recovery", () => {
    const reset = vi.fn();
    render(<PublicPRReportRouteError error={new Error("boom")} reset={reset} />);

    expect(
      screen.getByRole("heading", { name: "Battle report view failed to render" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Retry this report route now. If the issue continues, open the leaderboard or return to landing while report evidence refreshes.",
      ),
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Open leaderboard" }).getAttribute("href")).toBe(
      "/dashboard/leaderboard",
    );
    expect(screen.queryByRole("link", { name: "Open settings" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry report route" }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
