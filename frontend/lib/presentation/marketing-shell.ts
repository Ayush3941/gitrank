export type MarketingNavItem = {
  id: string;
  href: string;
  label: string;
};

export type MarketingAntiSpamPromise = {
  title: string;
  body: string;
};

export const MARKETING_ANTI_SPAM_PROMISE: MarketingAntiSpamPromise = {
  title: "Low-signal volume does not outrank meaningful work.",
  body: "GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.",
};

export const MARKETING_NAV_ITEMS: readonly MarketingNavItem[] = [
  { id: "why-gitrank", href: "/#why-gitrank", label: "Why GitRank" },
  { id: "core-journeys", href: "/#core-journeys", label: "Journeys" },
  { id: "battle-reports", href: "/#battle-reports", label: "Reports" },
  { id: "start-reveal", href: "/#start-reveal", label: "Start" },
];
