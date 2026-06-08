import { describe, expect, it } from "vitest";
import {
  CONNECT_DATA_NOT_READ_ROWS,
  CONNECT_DATA_READ_ROWS,
  CONNECT_GITHUB_STEPS,
  CONNECT_PRIVACY_CONTROLS,
  LOGIN_PANEL_STEPS,
  LOGIN_SCORE_RULES,
  type OnboardingCopyLine,
} from "@/features/onboarding/lib/onboarding-entry-model";

function expectStableIds(items: readonly OnboardingCopyLine[], section: string) {
  const ids = items.map((item) => item.id);

  expect(ids.every((id) => id.length > 0), `${section} ids should be non-empty`).toBe(true);
  expect(new Set(ids).size, `${section} ids should be unique`).toBe(ids.length);
}

describe("onboarding entry model", () => {
  it("keeps sign-in and connection steps in stable order", () => {
    expect(LOGIN_PANEL_STEPS.map((item) => item.text)).toEqual([
      "Sign in with GitHub OAuth.",
      "GitRank syncs contribution evidence.",
      "Open your dashboard and quests.",
    ]);
    expect(CONNECT_GITHUB_STEPS.map((item) => item.title)).toEqual([
      "Authorize GitHub",
      "Sync evidence",
      "Reveal profile",
    ]);
    expectStableIds(LOGIN_PANEL_STEPS, "login panel steps");
    expectStableIds(CONNECT_GITHUB_STEPS, "connect GitHub steps");
  });

  it("keeps data access and privacy copy explicit", () => {
    expect(LOGIN_SCORE_RULES.map((item) => item.text)).toEqual([
      "Merged work outranks streak volume.",
      "Review depth matters.",
      "Tests and repo context affect XP.",
      "Spam-like PR floods get reduced multipliers.",
    ]);
    expect(CONNECT_DATA_READ_ROWS.map((item) => item.text)).toContain(
      "Merged PR metadata, reviews, and changed-file context.",
    );
    expect(CONNECT_DATA_NOT_READ_ROWS.map((item) => item.text)).toContain(
      "Private repository code content in v1.",
    );
    expect(CONNECT_PRIVACY_CONTROLS.map((item) => item.text)).toContain(
      "Repository visibility can be hidden without deleting the account.",
    );

    expectStableIds(LOGIN_SCORE_RULES, "login score rules");
    expectStableIds(CONNECT_DATA_READ_ROWS, "data read rows");
    expectStableIds(CONNECT_DATA_NOT_READ_ROWS, "data not read rows");
    expectStableIds(CONNECT_PRIVACY_CONTROLS, "privacy controls");
  });
});
