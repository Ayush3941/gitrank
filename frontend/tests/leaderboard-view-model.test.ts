import { describe, expect, it } from "vitest";
import {
  buildLeaderboardArenaModel,
  buildLeaderboardNearbyRows,
  buildLeaderboardPageModel,
  buildLeaderboardStaleNotice,
  resolveLeaderboardRowPageSize,
} from "@/features/leaderboard/lib/leaderboard-view-model";
import type {
  LeaderboardEntry,
  LeaderboardSeason,
  LeaderboardSnapshot,
} from "@/types/gitrank";

describe("buildLeaderboardPageModel", () => {
  it("marks the current user and builds control state for full-board detail view", () => {
    const snapshot = buildSnapshot(12);
    const model = buildLeaderboardPageModel({
      snapshot,
      currentUsername: "PLAYER-6",
      tab: "Backend",
      visibleRowCount: 6,
      constrainedNetwork: true,
      preferNearbyMode: false,
      showLaneDetails: true,
      displaySyncState: "partially_synced",
      latestSyncOutcome: {
        code: "backfill_incomplete",
        message: "Historical authored PR backfill is still in progress.",
      },
      profileRefreshedAt: "2026-06-08T10:00:00.000Z",
      hasProfile: true,
      isFetching: true,
    });

    expect(model.rowPageSize).toBe(resolveLeaderboardRowPageSize(true));
    expect(model.snapshot?.currentUser?.username).toBe("player-6");
    expect(model.rows.find((row) => row.username === "player-6")?.isCurrentUser).toBe(true);
    expect(model.safeVisibleRowCount).toBe(6);
    expect(model.hasMoreRows).toBe(true);
    expect(model.remainingRows).toBe(6);
    expect(model.supportsNearbyMode).toBe(true);
    expect(model.effectiveMode).toBe("full");
    expect(model.activeFilterCount).toBe(3);
    expect(model.canClearAllControls).toBe(true);
    expect(model.isBusy).toBe(true);
    expect(model.shouldShowStaleState).toBe(true);
    expect(model.staleNotice.message).toContain("scored PR evidence is still empty");
    expect(model.staleNotice.reasonMessage).toContain("Historical authored PR backfill");
  });

  it("falls back to full mode when nearby view has no current-user context", () => {
    const model = buildLeaderboardPageModel({
      snapshot: buildSnapshot(12),
      currentUsername: "",
      tab: "Global",
      visibleRowCount: 20,
      constrainedNetwork: false,
      preferNearbyMode: true,
      showLaneDetails: false,
    });

    expect(model.supportsNearbyMode).toBe(false);
    expect(model.effectiveMode).toBe("full");
    expect(model.hasViewFilter).toBe(false);
    expect(model.activeFilterCount).toBe(0);
    expect(model.canClearAllControls).toBe(false);
    expect(model.isBusy).toBe(false);
    expect(model.shouldShowStaleState).toBe(false);
  });

  it("reports busy state while URL lane state is settling even before rows load", () => {
    const model = buildLeaderboardPageModel({
      snapshot: null,
      currentUsername: "player-1",
      tab: "Global",
      visibleRowCount: 12,
      constrainedNetwork: false,
      preferNearbyMode: true,
      showLaneDetails: false,
      isSwitchingTab: true,
      isFetching: false,
    });

    expect(model.snapshot).toBeNull();
    expect(model.isBusy).toBe(true);
  });
});

describe("buildLeaderboardStaleNotice", () => {
  it("builds app-access-aware leaderboard stale copy", () => {
    const notice = buildLeaderboardStaleNotice({
      displaySyncState: "stale",
      refreshedAt: "2026-06-08T10:00:00.000Z",
      latestSyncOutcome: {
        code: "app_installation_required",
        message: "GitHub App installation is required before leaderboard evidence can update.",
      },
    });

    expect(notice.message).toContain("blocked until GitHub App access is restored");
    expect(notice.reasonMessage).toContain("installation is required");
  });
});

describe("buildLeaderboardArenaModel", () => {
  it("builds nearby rows from podium plus the current user's local bracket", () => {
    const rows = buildRows(12).map((row) =>
      row.rank === 6 ? { ...row, isCurrentUser: true } : row,
    );
    const snapshot = buildSnapshotFromRows(rows);
    const model = buildLeaderboardArenaModel({ snapshot, viewMode: "nearby" });

    expect(model.currentUser?.username).toBe("player-6");
    expect(model.localBracketRows.map((row) => row.rank)).toEqual([4, 5, 6, 7, 8]);
    expect(model.nextAboveRow?.rank).toBe(5);
    expect(model.nextAboveGap).toBe(100);
    expect(model.visibleRows.map((row) => row.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("applies row limits only to the selected source rows", () => {
    const snapshot = buildSnapshot(8);
    const model = buildLeaderboardArenaModel({
      snapshot,
      rowLimit: 3,
      viewMode: "full",
    });

    expect(model.visibleRows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });
});

describe("buildLeaderboardNearbyRows", () => {
  it("deduplicates podium rows that also appear in the local bracket", () => {
    const rows = buildRows(5);
    const nearbyRows = buildLeaderboardNearbyRows(rows, rows.slice(1, 4));

    expect(nearbyRows.map((row) => row.rank)).toEqual([1, 2, 3, 4]);
  });
});

function buildSnapshot(count: number): LeaderboardSnapshot {
  return buildSnapshotFromRows(buildRows(count));
}

function buildSnapshotFromRows(rows: LeaderboardEntry[]): LeaderboardSnapshot {
  return {
    season: buildSeason(),
    rows,
    currentUser: rows.find((row) => row.isCurrentUser),
  };
}

function buildRows(count: number): LeaderboardEntry[] {
  return Array.from({ length: count }, (_, index) => buildRow(index + 1));
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

function buildSeason(): LeaderboardSeason {
  return {
    id: "weekly-2026-06-08",
    name: "Weekly arena Jun 8",
    windowLabel: "Jun 8 - Jun 14",
    startsAt: "2026-06-08T00:00:00.000Z",
    endsAt: "2026-06-14T23:59:59.999Z",
    status: "Active",
    scoringVersion: "v1alpha1",
    promotionRule: "Top contributors move toward the next rank tier.",
    resetRule: "Weekly XP resets after the window.",
    promotionCutoffRank: 3,
    safetyCutoffRank: 10,
    explanation: "Leaderboard rows are backed by persisted season snapshots.",
  };
}
