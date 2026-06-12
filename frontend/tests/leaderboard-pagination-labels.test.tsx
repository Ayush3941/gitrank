import React, { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";
import { buildLeaderboardSeason, buildProfileViewData } from "@/tests/helpers/gitrank-fixtures";
import type { LeaderboardEntry, LeaderboardSnapshot } from "@/types/gitrank";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refetchLeaderboard: vi.fn(),
  refetchProfile: vi.fn(),
  requestSync: vi.fn(),
  useLeaderboard: vi.fn(),
  useMyProfile: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard/leaderboard",
  useSearchParams: () => new URLSearchParams("lane=global"),
}));

vi.mock("@/features/leaderboard/components/LeaderboardArena", () => ({
  LeaderboardArena: ({
    snapshot,
    rowLimit,
  }: {
    snapshot: LeaderboardSnapshot;
    rowLimit?: number;
  }) => (
    <ul aria-label="Mock leaderboard rows">
      {snapshot.rows.slice(0, rowLimit ?? snapshot.rows.length).map((row) => (
        <li key={row.username}>{row.username}</li>
      ))}
    </ul>
  ),
}));

vi.mock("@/hooks/use-account-actions", () => ({
  useRunUserSync: () => ({
    isPending: false,
    mutateAsync: mocks.requestSync,
  }),
}));

vi.mock("@/hooks/use-gamification-preference", () => ({
  useNetworkConstraintPreference: () => false,
}));

vi.mock("@/hooks/use-leaderboard", () => ({
  useLeaderboard: (...args: unknown[]) => mocks.useLeaderboard(...args),
}));

vi.mock("@/hooks/use-profile", () => ({
  useMyProfile: () => mocks.useMyProfile(),
}));

vi.mock("@/hooks/use-profile-sync-runs", () => ({
  useProfileSyncRuns: () => ({
    data: { runs: [] },
  }),
}));

vi.mock("@/hooks/use-profile-sync-state", () => ({
  useProfileSyncState: () => ({
    syncStateForDisplay: "synced",
    showRefreshPill: false,
  }),
}));

vi.mock("@/hooks/use-stale-sync-refresh", () => ({
  useStaleSyncRefresh: () => ({
    isRefreshing: false,
    refreshLabel: "Refresh",
    onRefresh: vi.fn(),
  }),
}));

describe("LeaderboardPageClient pagination labels", () => {
  beforeEach(() => {
    mocks.replace.mockReset();
    mocks.refetchLeaderboard.mockReset();
    mocks.refetchProfile.mockReset();
    mocks.requestSync.mockReset();
    mocks.useLeaderboard.mockReset();
    mocks.useMyProfile.mockReset();
    mocks.useLeaderboard.mockReturnValue({
      data: buildSnapshot(13),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetchLeaderboard,
    });
    mocks.useMyProfile.mockReturnValue({
      data: buildProfileViewData(),
      refetch: mocks.refetchProfile,
    });
  });

  it("announces the exact ranked-row batch before expanding the full board", async () => {
    render(<LeaderboardPageClient />);

    expect(await screen.findByText("player-12")).toBeTruthy();
    expect(screen.queryByText("player-13")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Show 1 ranked row. 1 ranked row remaining.",
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("player-13")).toBeTruthy();
    });
  });

  it("renders evidence-specific empty copy when no ranked rows are available", async () => {
    mocks.useLeaderboard.mockReturnValue({
      data: buildSnapshot(0),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: mocks.refetchLeaderboard,
    });

    render(<LeaderboardPageClient />);

    expect(
      await screen.findByRole("region", {
        name: "Leaderboard needs visible scored profiles",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Rows appear after contributors sync scored PR evidence and keep leaderboard participation visible.",
      ),
    ).toBeTruthy();
  });
});

function buildSnapshot(count: number): LeaderboardSnapshot {
  const rows = Array.from({ length: count }, (_, index) => buildRow(index + 1));

  return {
    season: buildLeaderboardSeason(),
    rows,
  };
}

function buildRow(rank: number): LeaderboardEntry {
  return {
    rank,
    username: `player-${rank}`,
    displayName: `Player ${rank}`,
    title: "Systems Builder",
    rankTier: rank <= 3 ? "Gold III" : "Bronze I",
    weeklyXp: 1500 - rank * 100,
    totalXp: 4000 - rank * 100,
    movement: rank % 2 === 0 ? 2 : -1,
    focus: "Backend",
    division: "Backend",
    seasonXp: 1500 - rank * 100,
    xpToNextRank: rank === 1 ? 0 : 101,
    promotionZone: rank <= 3,
    demotionRisk: rank >= 10,
    evidenceSummary: "Persisted leaderboard evidence.",
    scoreFormulaVersion: "v1alpha1",
  };
}
