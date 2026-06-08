import type { LeaderboardTab } from "@/lib/api/leaderboard-api";
import {
  buildStaleSyncNotice,
  type StaleSyncNotice,
} from "@/lib/presentation/stale-sync-notice";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";
import type { LeaderboardEntry, LeaderboardSnapshot, SyncState } from "@/types/gitrank";

const LEADERBOARD_ROW_PAGE_SIZE_DEFAULT = 12;
const LEADERBOARD_ROW_PAGE_SIZE_CONSTRAINED = 6;
const LEADERBOARD_NEARBY_DEFAULT_THRESHOLD = 10;

export type LeaderboardViewMode = "nearby" | "full";

export type LeaderboardPageModelInput = {
  snapshot?: LeaderboardSnapshot | null;
  currentUsername?: string;
  tab: LeaderboardTab;
  visibleRowCount: number;
  constrainedNetwork: boolean;
  preferNearbyMode: boolean;
  showLaneDetails: boolean;
  displaySyncState?: SyncState;
  latestSyncOutcome?: SyncRunDiagnostic | null;
  profileRefreshedAt?: string;
  hasProfile?: boolean;
  isSwitchingTab?: boolean;
  isFetching?: boolean;
};

export function resolveLeaderboardRowPageSize(constrainedNetwork: boolean): number {
  return constrainedNetwork
    ? LEADERBOARD_ROW_PAGE_SIZE_CONSTRAINED
    : LEADERBOARD_ROW_PAGE_SIZE_DEFAULT;
}

export function buildLeaderboardPageModel({
  snapshot,
  currentUsername,
  tab,
  visibleRowCount,
  constrainedNetwork,
  preferNearbyMode,
  showLaneDetails,
  displaySyncState = "synced",
  latestSyncOutcome = null,
  profileRefreshedAt,
  hasProfile = false,
  isSwitchingTab = false,
  isFetching = false,
}: LeaderboardPageModelInput) {
  const rowPageSize = resolveLeaderboardRowPageSize(constrainedNetwork);
  const rows = markCurrentUserRows(snapshot?.rows ?? [], currentUsername);
  const currentUser = rows.find((row) => row.isCurrentUser);
  const viewSnapshot = snapshot
    ? {
        ...snapshot,
        rows,
        currentUser,
      }
    : null;
  const safeVisibleRowCount = Math.min(rows.length, visibleRowCount);
  const hasMoreRows = rows.length > safeVisibleRowCount;
  const remainingRows = Math.max(0, rows.length - safeVisibleRowCount);
  const supportsNearbyMode =
    Boolean(currentUser) && rows.length >= LEADERBOARD_NEARBY_DEFAULT_THRESHOLD;
  const effectiveMode: LeaderboardViewMode =
    supportsNearbyMode && preferNearbyMode ? "nearby" : "full";
  const hasLaneFilter = tab !== "Global";
  const hasViewFilter = supportsNearbyMode && effectiveMode === "full";
  const hasDetailsFilter = showLaneDetails;
  const activeFilterCount =
    (hasLaneFilter ? 1 : 0) +
    (hasViewFilter ? 1 : 0) +
    (hasDetailsFilter ? 1 : 0);
  const canClearAllControls = hasLaneFilter || hasViewFilter || hasDetailsFilter;
  const shouldShowStaleState =
    hasProfile && (displaySyncState === "stale" || displaySyncState === "partially_synced");
  const staleNotice = buildLeaderboardStaleNotice({
    displaySyncState,
    refreshedAt: profileRefreshedAt,
    latestSyncOutcome,
  });
  const isBusy = isSwitchingTab || (isFetching && Boolean(viewSnapshot));

  return {
    rowPageSize,
    rows,
    snapshot: viewSnapshot,
    safeVisibleRowCount,
    hasMoreRows,
    remainingRows,
    supportsNearbyMode,
    effectiveMode,
    hasLaneFilter,
    hasViewFilter,
    hasDetailsFilter,
    activeFilterCount,
    canClearAllControls,
    shouldShowStaleState,
    staleNotice,
    isBusy,
  };
}

export function buildLeaderboardStaleNotice({
  displaySyncState,
  refreshedAt,
  latestSyncOutcome,
}: {
  displaySyncState: SyncState;
  refreshedAt?: string;
  latestSyncOutcome: SyncRunDiagnostic | null;
}): StaleSyncNotice {
  return buildStaleSyncNotice({
    syncState: displaySyncState === "partially_synced" ? "partially_synced" : "stale",
    refreshedAt,
    latestSyncOutcome,
    snapshotLabel: "Leaderboard context",
    partialFallback:
      "Leaderboard profile snapshot exists, but scored PR evidence is still empty. Keep auto-sync active and refresh after GitHub processing completes.",
    staleFallback:
      "Rank updates can lag until sync completes.",
  });
}

export function markCurrentUserRows(
  rows: LeaderboardEntry[],
  currentUsername?: string,
): LeaderboardEntry[] {
  const normalizedUsername = currentUsername?.trim().toLowerCase() ?? "";
  return rows.map((row) => ({
    ...row,
    isCurrentUser:
      normalizedUsername.length > 0 &&
      row.username.toLowerCase() === normalizedUsername,
  }));
}

export type LeaderboardArenaModelInput = {
  snapshot: LeaderboardSnapshot;
  rowLimit?: number;
  viewMode?: LeaderboardViewMode;
};

export function buildLeaderboardArenaModel({
  snapshot,
  rowLimit,
  viewMode = "full",
}: LeaderboardArenaModelInput) {
  const rows = snapshot.rows;
  const currentUser =
    snapshot.currentUser ?? rows.find((row) => row.isCurrentUser) ?? null;
  const currentUserIndex = currentUser
    ? rows.findIndex((row) => row.username === currentUser.username)
    : -1;
  const localBracketRows =
    currentUser && currentUserIndex >= 0
      ? rows.slice(
          Math.max(0, currentUserIndex - 2),
          Math.min(rows.length, currentUserIndex + 3),
        )
      : [];
  const nextAboveRow =
    currentUserIndex > 0 ? rows[currentUserIndex - 1] : null;
  const nextAboveGap =
    currentUser && nextAboveRow
      ? Math.max(0, nextAboveRow.seasonXp - currentUser.seasonXp)
      : 0;
  const nearbyRows = buildLeaderboardNearbyRows(rows, localBracketRows);
  const sourceRows = viewMode === "nearby" ? nearbyRows : rows;
  const visibleRows =
    typeof rowLimit === "number" && rowLimit > 0
      ? sourceRows.slice(0, rowLimit)
      : sourceRows;

  return {
    rows,
    currentUser,
    currentUserIndex,
    localBracketRows,
    nextAboveRow,
    nextAboveGap,
    nearbyRows,
    visibleRows,
  };
}

export function buildLeaderboardNearbyRows(
  allRows: LeaderboardEntry[],
  localBracketRows: LeaderboardEntry[],
): LeaderboardEntry[] {
  const topRows = allRows.slice(0, 3);
  const merged = new Map<string, LeaderboardEntry>();
  for (const row of [...topRows, ...localBracketRows]) {
    merged.set(row.username, row);
  }
  return Array.from(merged.values()).sort((a, b) => a.rank - b.rank);
}
