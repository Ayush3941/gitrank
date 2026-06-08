import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildInitialVisibleQuestGroupCounts,
  buildQuestGroupMap,
  buildQuestsPageModel,
  buildQuestsStaleNotice,
  dayOfYearUTC,
  resolveQuestGroupPageSize,
} from "@/features/quests/lib/quests-page-model";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import { buildQuest } from "@/tests/helpers/quest-fixture";
import {
  buildProfileViewData,
  buildUserProfile,
} from "@/tests/helpers/gitrank-fixtures";

describe("buildQuestsPageModel", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds cadence groups, journey metrics, spotlights, and stale notice copy", () => {
    const quests = [
      buildQuest({
        id: "daily-low",
        cadence: "Daily",
        status: "Active",
        progress: 1,
        goal: 10,
        rewardXp: 200,
      }),
      buildQuest({
        id: "daily-high",
        cadence: "Daily",
        status: "Active",
        progress: 8,
        goal: 10,
        rewardXp: 100,
      }),
      buildQuest({ id: "weekly", cadence: "Weekly" }),
      buildQuest({ id: "long-term", cadence: "Long-term" }),
      buildQuest({ id: "skill", cadence: "Skill-based" }),
    ];
    const visibleGroupCounts = buildInitialVisibleQuestGroupCounts(5);
    const profile = buildProfileViewData({
      user: buildUserProfile({
        contributions: [
          buildContribution({ id: "today", mergedAt: "2026-06-08T09:00:00.000Z" }),
          buildContribution({ id: "yesterday", mergedAt: "2026-06-07T09:00:00.000Z" }),
        ],
      }),
      refreshedAt: "2026-06-08T10:00:00.000Z",
    });

    const model = buildQuestsPageModel({
      quests,
      profile,
      cadenceFilter: "Weekly",
      deferredCadenceFilter: "Weekly",
      visibleGroupCounts,
      constrainedNetwork: false,
      displaySyncState: "partially_synced",
      latestSyncOutcome: {
        code: "backfill_incomplete",
        message: "Historical authored PR backfill is still in progress.",
      },
      questSnapshotRefreshedAt: "2026-06-08T10:30:00.000Z",
      now: new Date("2026-06-08T12:00:00.000Z"),
    });

    expect(model.questGroupPageSize).toBe(resolveQuestGroupPageSize(false));
    expect(model.questCadenceCounts).toEqual({
      Daily: 2,
      Weekly: 1,
      "Long-term": 1,
      "Skill-based": 1,
    });
    expect(model.visibleGroups).toEqual(["Weekly"]);
    expect(model.canResetCadenceFilter).toBe(true);
    expect(model.isFiltering).toBe(false);
    expect(model.streak.currentStreakDays).toBe(2);
    expect(model.dayOfYear).toBe(159);
    expect(model.dayProgress).toBe(44);
    expect(model.todayQuest?.id).toBe("daily-high");
    expect(model.weeklyQuest?.id).toBe("weekly");
    expect(model.longTermQuest?.id).toBe("long-term");
    expect(model.shouldShowStaleState).toBe(true);
    expect(model.staleNotice.message).toContain("scored PR evidence is still empty");
    expect(model.staleNotice.reasonMessage).toContain("Historical authored PR backfill");
  });

  it("uses constrained page sizes and hides stale state for synced empty quest data", () => {
    const model = buildQuestsPageModel({
      quests: [],
      cadenceFilter: "All",
      deferredCadenceFilter: "All",
      visibleGroupCounts: buildInitialVisibleQuestGroupCounts(resolveQuestGroupPageSize(true)),
      constrainedNetwork: true,
      displaySyncState: "synced",
      now: new Date("2026-01-01T12:00:00.000Z"),
    });

    expect(model.questGroupPageSize).toBe(3);
    expect(model.visibleGroups).toEqual([]);
    expect(model.canResetCadenceFilter).toBe(false);
    expect(model.todayQuest).toBeNull();
    expect(model.shouldShowStaleState).toBe(false);
    expect(model.dayOfYear).toBe(1);
  });
});

describe("quest page helpers", () => {
  it("builds app-access-aware quest stale copy", () => {
    const notice = buildQuestsStaleNotice({
      displaySyncState: "stale",
      refreshedAt: "2026-06-08T10:00:00.000Z",
      latestSyncOutcome: {
        code: "app_installation_required",
        message: "GitHub App installation is required before quest evidence can update.",
      },
    });

    expect(notice.message).toContain("blocked until GitHub App access is restored");
    expect(notice.reasonMessage).toContain("installation is required");
  });

  it("keeps group map and UTC day calculations deterministic", () => {
    const questMap = buildQuestGroupMap([
      buildQuest({ cadence: "Daily" }),
      buildQuest({ cadence: "Skill-based" }),
    ]);

    expect(questMap.Daily).toHaveLength(1);
    expect(questMap.Weekly).toHaveLength(0);
    expect(questMap["Skill-based"]).toHaveLength(1);
    expect(dayOfYearUTC(new Date("2026-12-31T23:59:59.000Z"))).toBe(365);
  });
});
