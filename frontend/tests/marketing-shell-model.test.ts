import { describe, expect, it } from "vitest";
import {
  MARKETING_ANTI_SPAM_PROMISE,
  MARKETING_NAV_ITEMS,
} from "@/lib/presentation/marketing-shell";

describe("marketing shell model", () => {
  it("keeps marketing navigation keyed by stable ids and in-page targets", () => {
    const ids = MARKETING_NAV_ITEMS.map((item) => item.id);

    expect(new Set(ids).size).toBe(MARKETING_NAV_ITEMS.length);
    expect(MARKETING_NAV_ITEMS.map((item) => item.href)).toEqual([
      "/#why-gitrank",
      "/#core-journeys",
      "/#battle-reports",
      "/#start-reveal",
    ]);
    expect(MARKETING_NAV_ITEMS.every((item) => item.label.length > 0)).toBe(true);
  });

  it("keeps anti-spam copy evidence-focused for shell and landing surfaces", () => {
    expect(MARKETING_ANTI_SPAM_PROMISE.title).toBe("Low-signal volume does not outrank meaningful work.");
    expect(MARKETING_ANTI_SPAM_PROMISE.body).toBe(
      "GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.",
    );
    expect(MARKETING_ANTI_SPAM_PROMISE.body).not.toMatch(/powerful|arena/i);
  });
});
