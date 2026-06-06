import { describe, expect, it } from "vitest";
import {
  badgeUnlockRecoveryHref,
  badgeUnlockRecoveryLabel,
} from "@/lib/presentation/badge-unlock-route";

describe("badge unlock recovery routing", () => {
  it("routes streak and quest-oriented conditions to quests", () => {
    expect(badgeUnlockRecoveryHref("Maintain a weekly contribution streak")).toBe(
      "/dashboard/quests",
    );
    expect(badgeUnlockRecoveryLabel("Finish one quest")).toBe("Open quests");
  });

  it("routes general contribution conditions to contributions", () => {
    expect(badgeUnlockRecoveryHref("Merge a security PR")).toBe(
      "/dashboard/contributions",
    );
    expect(badgeUnlockRecoveryLabel("Merge a test PR")).toBe("Open contributions");
  });
});
