import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAbraInsights } from "@/lib/ai/abra-insights";
import type { AbraInsightsRequest } from "@/lib/ai/abra-insights-types";

vi.mock("server-only", () => ({}));

describe("buildAbraInsights", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("pluralizes deterministic badge evidence PR references", async () => {
    vi.stubEnv("AI_PROVIDER", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("GEMINI_API_KEY", "");

    const insights = await buildAbraInsights({
      ...baseRequest(),
      badges: [
        buildBadge({
          id: "single-evidence",
          evidencePrIds: ["octo/gitrank#1"],
        }),
        buildBadge({
          id: "multi-evidence",
          evidencePrIds: ["octo/gitrank#1", "octo/gitrank#2"],
        }),
      ],
    });

    expect(insights.generatedBy).toBe("deterministic");
    expect(insights.badgeStories["single-evidence"]?.trigger).toBe(
      "Unlocked with verified evidence from 1 PR reference.",
    );
    expect(insights.badgeStories["multi-evidence"]?.trigger).toBe(
      "Unlocked with verified evidence from 2 PR references.",
    );
  });
});

function baseRequest(): AbraInsightsRequest {
  return {
    profile: {
      username: "octocat",
      displayName: "Octo Cat",
      currentTitle: "Systems Builder",
      rankTier: "Bronze I",
      level: 4,
      totalXp: 1200,
      mergedPrCount: 2,
      strongestSignals: ["Testing"],
      repositoriesTouched: 1,
      badgeCount: 2,
      streakDays: 3,
    },
    contributions: [],
    badges: [],
  };
}

function buildBadge(overrides: Partial<AbraInsightsRequest["badges"][number]> = {}) {
  return {
    id: "badge-1",
    name: "Evidence Badge",
    rarity: "Rare",
    unlocked: true,
    description: "Evidence-backed badge.",
    unlockCondition: "Land evidence-backed work.",
    progress: 100,
    evidencePrIds: [],
    ...overrides,
  };
}
