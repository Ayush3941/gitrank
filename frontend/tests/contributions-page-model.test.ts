import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildContributionShelfModel } from "@/features/contributions/lib/contribution-shelf-model";
import { buildContributionsPageModel } from "@/features/contributions/lib/contributions-page-model";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import {
  buildBadge,
  buildProfileViewData,
  buildRepositoryVisibility,
  buildUserProfile,
} from "@/tests/helpers/gitrank-fixtures";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";

describe("buildContributionsPageModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds contribution summaries, stale notice copy, and ABRA request inputs", () => {
    const contributions = [
      buildContribution({
        id: "today",
        owner: "octo",
        repo: "gitrank",
        mergedAt: "2026-06-08T09:00:00.000Z",
      }),
      buildContribution({
        id: "yesterday",
        owner: "octo",
        repo: "api",
        mergedAt: "2026-06-07T09:00:00.000Z",
      }),
    ];
    const profile = buildProfileViewData({
      user: buildUserProfile({
        contributions,
        badges: [buildBadge({ id: "ship", unlocked: true })],
        repositories: [
          buildRepositoryVisibility({ name: "octo/gitrank" }),
          buildRepositoryVisibility({ name: "octo/api" }),
        ],
      }),
      refreshedAt: "2026-06-08T10:00:00.000Z",
    });
    const contributionShelf = buildContributionShelfModel({
      rows: contributions,
      contributions,
      filter: "All",
      search: "",
      sort: "Newest",
      debouncedSearch: "",
      deferredFilter: "All",
      deferredSearch: "",
      deferredSort: "Newest",
      visibleCardCount: 2,
      useLiteCards: false,
      showCardDetails: true,
    });
    const latestSyncOutcome: SyncRunDiagnostic = {
      code: "backfill_incomplete",
      message: "Historical authored PR backfill is still in progress.",
    };

    const model = buildContributionsPageModel({
      profile,
      contributionShelf,
      displaySyncState: "partially_synced",
      latestSyncOutcome,
      isLoading: false,
      isError: false,
    });

    expect(model.repositories.map((repo) => repo.fullName)).toEqual(["octo/gitrank", "octo/api"]);
    expect(model.streak.currentStreakDays).toBe(2);
    expect(model.shouldShowStaleState).toBe(true);
    expect(model.staleNotice.message).toContain("scored PR evidence is still empty");
    expect(model.staleNotice.reasonMessage).toContain("Historical authored PR backfill");
    expect(model.abraPayload?.profile).toMatchObject({
      username: "octocat",
      repositoriesTouched: 2,
      streakDays: 2,
    });
    expect(model.abraPayload?.contributions.map((row) => row.id)).toEqual(["today", "yesterday"]);
  });

  it("keeps cached profile visible during background refresh errors", () => {
    const contributionShelf = buildContributionShelfModel({
      rows: [buildContribution()],
      contributions: [buildContribution()],
      filter: "All",
      search: "",
      sort: "Newest",
      debouncedSearch: "",
      deferredFilter: "All",
      deferredSearch: "",
      deferredSort: "Newest",
      visibleCardCount: 1,
      useLiteCards: false,
      showCardDetails: false,
    });

    const model = buildContributionsPageModel({
      profile: buildProfileViewData(),
      contributionShelf,
      displaySyncState: "synced",
      latestSyncOutcome: null,
      isLoading: false,
      isError: true,
      errorMessage: "fetch failed with status 500 token details",
    });

    expect(model.hasCachedProfile).toBe(true);
    expect(model.shouldBlockOnError).toBe(false);
    expect(model.backgroundRefreshError).toContain("Refresh request failed for now");
    expect(model.backgroundRefreshError).toContain("Showing latest verified contribution data.");
    expect(model.abraPayload).toBeNull();
  });

  it("blocks first-load loading and error states when no cached profile exists", () => {
    const contributionShelf = buildContributionShelfModel({
      rows: [],
      contributions: [],
      filter: "All",
      search: "",
      sort: "Newest",
      debouncedSearch: "",
      deferredFilter: "All",
      deferredSearch: "",
      deferredSort: "Newest",
      visibleCardCount: 1,
      useLiteCards: true,
      showCardDetails: true,
    });

    expect(
      buildContributionsPageModel({
        contributionShelf,
        displaySyncState: "syncing",
        latestSyncOutcome: null,
        isLoading: true,
        isError: false,
      }),
    ).toMatchObject({
      hasCachedProfile: false,
      shouldBlockOnLoading: true,
      shouldBlockOnError: false,
      shouldShowStaleState: false,
      backgroundRefreshError: "",
      abraPayload: null,
    });
    expect(
      buildContributionsPageModel({
        contributionShelf,
        displaySyncState: "failed",
        latestSyncOutcome: null,
        isLoading: false,
        isError: true,
      }),
    ).toMatchObject({
      hasCachedProfile: false,
      shouldBlockOnLoading: false,
      shouldBlockOnError: true,
      shouldShowStaleState: false,
      backgroundRefreshError: "",
      abraPayload: null,
    });
  });
});
