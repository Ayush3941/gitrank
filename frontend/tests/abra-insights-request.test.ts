import { describe, expect, it } from "vitest";
import { buildAbraInsightsRequest } from "@/lib/ai/abra-insights-request";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import { buildBadge, buildPrivacy, buildUserProfile } from "@/tests/helpers/gitrank-fixtures";

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
      username: "octocat",
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
