import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CurrentLeagueCard } from "@/features/dashboard/components/CurrentLeagueCard";
import { QuestPanel } from "@/features/dashboard/components/QuestPanel";
import { RecentBattleReports } from "@/features/dashboard/components/RecentBattleReports";
import type { PullRequestAnalysis, Quest, UserProfile } from "@/types/gitrank";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("dashboard card icon semantics", () => {
  it("keeps league, quest, and report icons decorative", () => {
    const rendered = render(
      <div>
        <CurrentLeagueCard user={buildLeagueUser()} />
        <QuestPanel quests={[buildQuest()]} />
        <RecentBattleReports reports={[buildReport()]} />
      </div>,
    );

    const icons = rendered.container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      expect(icon.getAttribute("aria-hidden")).toBe("true");
    }
  });
});

function buildLeagueUser(): UserProfile {
  return {
    movement: 2,
    leaguePosition: 4,
    weeklyXp: 320,
    level: {
      rankTier: "Gold III",
    },
    rankProgress: {
      evidenceSignals: [],
      nextTier: "Platinum I",
      seasonXp: 400,
      xpToNextTier: 100,
      season: {
        windowLabel: "May 25 - May 31",
        status: "Active",
        endsAt: "2026-05-31T23:59:59Z",
      },
    },
  } as unknown as UserProfile;
}

function buildQuest(): Quest {
  return {
    id: "quest-1",
    title: "Land reviewed work",
    description: "Complete one reviewed contribution.",
    rewardXp: 120,
    progress: 0,
    goal: 1,
    weakAreaTarget: "Review",
    cadence: "Weekly",
    evidenceSignals: ["review_depth=0"],
    linkedContributionIds: [],
  } as unknown as Quest;
}

function buildReport(): PullRequestAnalysis {
  return {
    contribution: {
      id: "pr-1",
      owner: "octo",
      repo: "gitrank",
      number: 42,
      title: "Add deterministic scoring evidence",
      category: "Backend",
      xpEarned: 320,
      aiSummary: "Persisted report summary.",
    },
    aiConfidence: 0.8,
    evidenceState: {
      status: "complete",
      analysisSource: "openai",
    },
  } as unknown as PullRequestAnalysis;
}
