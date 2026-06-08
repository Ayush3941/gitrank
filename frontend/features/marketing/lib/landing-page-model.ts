export type LandingIconKey =
  | "chart"
  | "pull-request"
  | "shield";

export type LandingProblemCard = {
  id: string;
  icon: LandingIconKey;
  title: string;
  text: string;
};

export type LandingJourney = {
  id: string;
  persona: string;
  mission: string;
  success: string;
  href: string;
  cta: string;
};

export type LandingTextLine = {
  id: string;
  text: string;
};

export type LandingLoopStep = {
  id: string;
  label: string;
};

export type LandingBadgeTrack = {
  id: string;
  title: string;
};

export type LandingPageModel = {
  loopSteps: LandingLoopStep[];
  problemCards: LandingProblemCard[];
  coreJourneys: LandingJourney[];
  solutionLines: LandingTextLine[];
  badgeTracks: LandingBadgeTrack[];
  antiSpamPromise: {
    title: string;
    body: string;
  };
};

export function buildLandingPageModel(): LandingPageModel {
  return {
    loopSteps: [
      { id: "connect-github", label: "Connect GitHub" },
      { id: "analyze-prs", label: "Analyze merged PRs" },
      { id: "reveal-rank", label: "Reveal rank" },
      { id: "unlock-badges", label: "Unlock badges" },
      { id: "complete-quests", label: "Complete quests" },
      { id: "share-profile", label: "Share profile" },
    ],
    problemCards: [
      {
        id: "skill-needs-evidence",
        icon: "chart",
        title: "Skill needs evidence.",
        text: "Commits, stars, and streaks miss difficulty and real impact.",
      },
      {
        id: "prs-vary-impact",
        icon: "pull-request",
        title: "PRs carry different impact.",
        text: "A typo fix and a deep runtime patch deserve different score weight.",
      },
      {
        id: "quality-needs-evidence",
        icon: "shield",
        title: "Quality needs evidence.",
        text: "GitRank weights merged outcomes, review depth, tests, and repo context.",
      },
    ],
    coreJourneys: [
      {
        id: "new-contributor",
        persona: "New contributor",
        mission: "Connect GitHub and unlock your first score snapshot.",
        success: "First synced PR appears with XP and evidence status.",
        href: "/onboarding/connect-github",
        cta: "Start onboarding",
      },
      {
        id: "returning-contributor",
        persona: "Returning contributor",
        mission: "Track weekly movement, quests, and impact quality.",
        success: "Rank movement updates after a merged high-signal PR.",
        href: "/dashboard/contributions",
        cta: "Open contributions",
      },
      {
        id: "profile-sharer",
        persona: "Profile sharer",
        mission: "Turn contribution history into a public credibility card.",
        success: "Public headline and share-ready profile card update.",
        href: "/dashboard",
        cta: "Open dashboard",
      },
    ],
    solutionLines: [
      {
        id: "classifies-pr-work",
        text: "Classifies documentation, tests, bug fixes, backend, infra, performance, and architecture work.",
      },
      {
        id: "turns-work-into-proof",
        text: "Turns verified work into XP, badge unlocks, league position, and public proof.",
      },
      {
        id: "explains-score-changes",
        text: "Explains score changes so maintainers and recruiters can inspect the evidence instead of trusting a black box.",
      },
    ],
    badgeTracks: [
      { id: "merge-cadence", title: "Merged contribution cadence" },
      { id: "review-depth", title: "Review depth consistency" },
      { id: "testing-reliability", title: "Testing and reliability signal" },
      { id: "cross-repo-impact", title: "Cross-repository impact" },
    ],
    antiSpamPromise: {
      title: "Low-signal volume does not outrank meaningful work.",
      body: "GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.",
    },
  };
}
