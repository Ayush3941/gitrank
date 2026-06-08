import { describe, expect, it } from "vitest";
import {
  buildLandingPageModel,
  type LandingIconKey,
} from "@/features/marketing/lib/landing-page-model";

const antiSpamCopy =
  "GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.";

function expectUniqueIds(items: Array<{ id: string }>, section: string) {
  const ids = items.map((item) => item.id);

  expect(ids.every((id) => id.length > 0), `${section} ids should be non-empty`).toBe(true);
  expect(new Set(ids).size, `${section} ids should be unique`).toBe(ids.length);
}

describe("landing page model", () => {
  it("keeps mapped landing sections keyed by stable presentation ids", () => {
    const model = buildLandingPageModel();
    const supportedIcons = new Set<LandingIconKey>(["chart", "pull-request", "shield"]);

    expectUniqueIds(model.loopSteps, "loop steps");
    expectUniqueIds(model.problemCards, "problem cards");
    expectUniqueIds(model.coreJourneys, "core journeys");
    expectUniqueIds(model.solutionLines, "solution lines");
    expectUniqueIds(model.badgeTracks, "badge tracks");

    expect(model.loopSteps.map((step) => step.id)).toEqual([
      "connect-github",
      "analyze-prs",
      "reveal-rank",
      "unlock-badges",
      "complete-quests",
      "share-profile",
    ]);
    expect(model.problemCards.every((card) => supportedIcons.has(card.icon))).toBe(true);
    expect(model.coreJourneys.every((journey) => journey.href.startsWith("/"))).toBe(true);
  });

  it("keeps the anti-spam promise direct and evidence-focused", () => {
    const model = buildLandingPageModel();

    expect(model.antiSpamPromise.title).toBe("Low-signal volume does not outrank meaningful work.");
    expect(model.antiSpamPromise.body).toBe(antiSpamCopy);
    expect(model.antiSpamPromise.body).not.toMatch(/powerful|arena/i);
  });
});
