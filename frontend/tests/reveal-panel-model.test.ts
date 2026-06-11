import { describe, expect, it } from "vitest";
import { buildRevealPanelModel } from "@/features/onboarding/lib/reveal-panel-model";
import { buildContribution } from "@/tests/helpers/contribution-fixture";
import {
  buildBadge,
  buildUserProfile,
} from "@/tests/helpers/gitrank-fixtures";

describe("buildRevealPanelModel", () => {
  it("summarizes active profile evidence and de-duplicates unlocked badges", () => {
    const user = buildUserProfile({
      displayName: "Ada Builder",
      title: "Systems Builder",
      strongestSignals: ["Testing", "Backend", "Testing", "Security", "Review"],
      mergedPrCount: 3,
      reviewedPrCount: 2,
      contributions: [
        buildContribution({ id: "one" }),
        buildContribution({ id: "two" }),
      ],
      badges: [
        buildBadge({ id: "builder-common", name: "Builder", rarity: "Common", unlocked: false }),
        buildBadge({ id: "builder-rare", name: "Builder", rarity: "Rare", unlocked: true }),
        buildBadge({ id: "tester", name: "Tester", rarity: "Epic", unlocked: true }),
        buildBadge({ id: "locked", name: "Locked", rarity: "Legendary", unlocked: false }),
      ],
    });

    const model = buildRevealPanelModel({ user, aiMode: "openai" });

    expect(model.aiSourceLabel).toBe("ChatGPT");
    expect(model.strongestSignalSummary).toBe("Testing, Backend, Security, Review");
    expect(model.unlockedBadges.map((badge) => badge.id)).toEqual(["builder-rare", "tester"]);
    expect(model.metrics).toEqual([
      { id: "merged-prs", label: "Merged PRs", value: "3" },
      { id: "reviewed-prs", label: "Reviewed PRs", value: "2" },
      { id: "unlocked-badges", label: "Unlocked badges", value: "2" },
      { id: "evidence-rows", label: "Evidence rows", value: "2" },
    ]);
    expect(model.evidenceRowsLabel).toContain("2 persisted contribution evidence rows");
    expect(model.needsSyncRecovery).toBe(false);
    expect(model.unlockPreviewLabel).toBe("2 earned");
    expect(model.xpProgressLabel).toBe("1,200 XP toward 1,500 XP");
    expect(model.shareHeadline).toBe("Ada Builder is Systems Builder on GitRank.");
    expect(model.nextActionsLabel).toBe("3 steps");
    expect(model.nextActions.map((action) => action.id)).toEqual([
      "open-dashboard",
      "review-contributions",
      "share-public-profile",
    ]);
    expect(model.nextActions[0]).toEqual({
      id: "open-dashboard",
      text: "Open dashboard to inspect score movement and weekly XP.",
    });
  });

  it("routes empty or degraded evidence to sync recovery copy", () => {
    const user = buildUserProfile({
      mergedPrCount: 0,
      reviewedPrCount: 0,
      strongestSignals: [],
      contributions: [],
      badges: [buildBadge({ unlocked: false })],
      syncStatus: {
        state: "rate_limited",
        progress: 25,
        partialProfileAvailable: true,
      },
    });

    const model = buildRevealPanelModel({ user, aiMode: "deterministic" });

    expect(model.strongestSignalSummary).toBe("recent contribution");
    expect(model.evidenceRows).toBe(0);
    expect(model.evidenceRowsLabel).toContain("No scored contribution evidence");
    expect(model.needsSyncRecovery).toBe(true);
    expect(model.effectiveSyncState).toBe("partially_synced");
    expect(model.recoveryActionLabel).toBe("Continue sync analysis");
    expect(model.unlockPreviewLabel).toBe("next badge targets");
    expect(model.nextActions.map((action) => action.id)).toEqual([
      "merge-first-pr",
      "refresh-evidence",
      "open-quests",
    ]);
    expect(model.nextActions[0]).toEqual({
      id: "merge-first-pr",
      text: "Merge your first meaningful PR so score movement can activate.",
    });
  });

  it("uses retry copy for failed sync recovery", () => {
    const user = buildUserProfile({
      contributions: [],
      syncStatus: {
        state: "failed",
        progress: 10,
        partialProfileAvailable: true,
      },
    });

    const model = buildRevealPanelModel({ user });

    expect(model.effectiveSyncState).toBe("failed");
    expect(model.needsSyncRecovery).toBe(true);
    expect(model.recoveryActionLabel).toBe("Retry sync analysis");
  });
});
