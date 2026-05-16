export const marketingSample = {
  report: {
    owner: "open-source-labs",
    repo: "runtime-core",
    number: 482,
    title: "Stabilize scheduler recovery under retry storms",
    category: "Infrastructure",
    xpEarned: 840,
    difficultyScore: 91,
    impactScore: 86,
    reviewDepthScore: 78,
    aiSummary:
      "High-signal infrastructure work with bounded uncertainty: recovery paths, tests, and maintainer review all support a strong contribution classification.",
  },
  highlightedBadges: [
    {
      id: "sample-runtime-cartographer",
      name: "Runtime Cartographer",
      rarity: "Epic",
      description: "Earned by shipping sustained architecture and recovery-path improvements.",
    },
    {
      id: "sample-regression-marshal",
      name: "Regression Marshal",
      rarity: "Rare",
      description: "Unlocked by pairing behavior fixes with focused regression coverage.",
    },
    {
      id: "sample-review-anchor",
      name: "Review Anchor",
      rarity: "Uncommon",
      description: "Awarded when contribution evidence includes credible maintainer review.",
    },
    {
      id: "sample-signal-smith",
      name: "Signal Smith",
      rarity: "Legendary",
      description: "Reserved for multi-signal work that is difficult, reviewed, and reusable.",
    },
  ],
} as const;
