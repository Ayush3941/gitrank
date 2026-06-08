import { describe, expect, it } from "vitest";
import {
  SOCIAL_IMAGE_CHIP_GROUPS,
  type SocialImageChip,
  type SocialImageChipGroup,
} from "@/lib/presentation/social-image-chips";

const expectedLabels: Record<SocialImageChipGroup, string[]> = {
  homeOpenGraph: ["PR Impact", "XP + Levels", "Badges + Quests", "Public Profile"],
  homeTwitter: ["Sync GitHub", "Analyze PRs", "Earn XP", "Climb Leaderboard"],
  profileOpenGraph: ["PR Impact", "XP Movement", "Badge Story", "Rank Progression"],
  profileTwitter: ["Contributions", "Badges", "Quests", "Leaderboard"],
  prOpenGraph: ["Difficulty", "Impact", "Review Depth", "XP Drivers"],
  prTwitter: ["Score Matrix", "Evidence Signals", "XP Breakdown", "Recommendations"],
};

describe("social image chip presentation data", () => {
  it("keeps share-card chip labels stable by route surface", () => {
    for (const [group, labels] of Object.entries(expectedLabels) as Array<[SocialImageChipGroup, string[]]>) {
      expect(SOCIAL_IMAGE_CHIP_GROUPS[group].map((chip) => chip.label)).toEqual(labels);
    }
  });

  it("uses stable ids instead of render-order keys", () => {
    for (const [group, chips] of Object.entries(SOCIAL_IMAGE_CHIP_GROUPS) as Array<
      [SocialImageChipGroup, readonly SocialImageChip[]]
    >) {
      const ids = chips.map((chip) => chip.id);

      expect(chips).toHaveLength(4);
      expect(ids.every((id) => id.length > 0), `${group} chip ids should be non-empty`).toBe(true);
      expect(new Set(ids).size, `${group} chip ids should be unique`).toBe(ids.length);
    }
  });
});
