import { describe, expect, it } from "vitest";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import type { Badge, UserProfile } from "@/types/gitrank";

describe("buildAbraInsightsRequest", () => {
  it("returns null when ABRA insights should not run", () => {
    const contribution = buildContribution();
    const badge = buildBadge();

    expect(
      buildAbraInsightsRequest({
        user: null,
        contributions: [contribution],
        badges: [badge],
        repositoriesTouched: 1,
        streakDays: 1,
      }),
    ).toBeNull();
    expect(
      buildAbraInsightsRequest({
        user: buildUserProfile(),
        contributions: [contribution],
        badges: [badge],
        repositoriesTouched: 1,
        streakDays: 1,
        enabled: false,
      }),
    ).toBeNull();
    expect(
      buildAbraInsightsRequest({
        user: buildUserProfile({
          privacy: buildPrivacy({ showAiSummaries: false }),
        }),
        contributions: [contribution],
        badges: [badge],
        repositoriesTouched: 1,
        streakDays: 1,
      }),
    ).toBeNull();
    expect(
      buildAbraInsightsRequest({
        user: buildUserProfile({ mergedPrCount: 0 }),
        contributions: [contribution],
        badges: [badge],
        repositoriesTouched: 1,
        streakDays: 1,
      }),
    ).toBeNull();
  });

  it("projects profile, contribution, and badge evidence with stable limits", () => {
    const request = buildAbraInsightsRequest({
      user: buildUserProfile(),
      contributions: [
        buildContribution({ id: "pr-1", title: "First PR", xpEarned: 120 }),
        buildContribution({ id: "pr-2", title: "Second PR", xpEarned: 90 }),
      ],
      badges: [
        buildBadge({ id: "badge-common", name: "Builder", rarity: "Common", unlocked: false }),
        buildBadge({ id: "badge-rare", name: "Builder", rarity: "Rare", unlocked: true }),
        buildBadge({ id: "badge-testing", name: "Tester", unlocked: false, progress: undefined }),
      ],
      repositoriesTouched: 4,
      streakDays: 6,
      contributionLimit: 1,
      badgeLimit: 2,
    });

    expect(request?.profile).toMatchObject({
      username: "octo",
      displayName: "Octo Cat",
      repositoriesTouched: 4,
      badgeCount: 1,
      streakDays: 6,
    });
    expect(request?.contributions).toEqual([
      expect.objectContaining({
        id: "pr-1",
        title: "First PR",
        xpEarned: 120,
        summary: "Deterministic summary.",
      }),
    ]);
    expect(request?.badges).toEqual([
      expect.objectContaining({
        id: "badge-rare",
        name: "Builder",
        progress: 100,
      }),
      expect.objectContaining({
        id: "badge-testing",
        name: "Tester",
        progress: 0,
      }),
    ]);
  });
});

function buildUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    username: "octo",
    displayName: "Octo Cat",
    title: "Systems Builder",
    mergedPrCount: 2,
    strongestSignals: ["Testing"],
    level: {
      currentLevel: 3,
      title: "Builder",
      currentXp: 900,
      nextLevelXp: 1200,
      rankTier: "Silver II",
    },
    privacy: buildPrivacy(),
    ...overrides,
  } as UserProfile;
}

function buildBadge(overrides: Partial<Badge> = {}): Badge {
  return {
    id: "badge-1",
    name: "Builder",
    rarity: "Common",
    description: "Evidence-backed badge.",
    unlockCondition: "Earn scored contribution evidence.",
    icon: "bolt",
    unlocked: true,
    earnedAt: "2026-05-25T00:00:00.000Z",
    progress: 100,
    evidencePrIds: ["pr-1"],
    ...overrides,
  };
}

function buildPrivacy(overrides: Partial<UserProfile["privacy"]> = {}): UserProfile["privacy"] {
  return {
    publicProfileEnabled: true,
    showExactPRs: true,
    showAiSummaries: true,
    showLeaderboardParticipation: true,
    badgeUnlockedNotifications: true,
    levelUpNotifications: true,
    weeklyReportNotifications: true,
    reducedGamification: false,
    ...overrides,
  };
}
