import React, { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPageClient } from "@/features/dashboard/components/DashboardPageClient";
import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";
import { PRBattleReportPageClient } from "@/features/pr-report/components/PRBattleReportPageClient";
import { PublicProfilePageClient } from "@/features/profile/components/PublicProfilePageClient";
import { QuestsPageClient } from "@/features/quests/components/QuestsPageClient";
import { SettingsPageClient } from "@/features/settings/components/SettingsPageClient";

const requestedPaths: string[] = [];

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt,
    src,
  }: {
    alt: string;
    src: string;
    width?: number;
    height?: number;
    className?: string;
  }) => React.createElement("img", { alt, src }),
}));

vi.mock("@/components/shared/SkillRadarChart", () => ({
  SkillRadarChart: () => <div>Live skill radar fixture rendered</div>,
}));

vi.mock("@/components/shared/TimelineChart", () => ({
  TimelineChart: () => <div>Live timeline fixture rendered</div>,
}));

describe("live fixture frontend smoke coverage", () => {
  beforeEach(() => {
    requestedPaths.length = 0;
    vi.stubGlobal("fetch", vi.fn(liveFixtureFetch));
  });

  it("renders dashboard from profile and quest BFF fixtures", async () => {
    renderWithClient(<DashboardPageClient />);

    await waitFor(() =>
      expect(requestedPaths).toEqual(expect.arrayContaining(["/api/profile/me", "/api/profile/me/quests"])),
    );
    expect(await screen.findByText("Live Fixture Maintainer", undefined, { timeout: 5000 })).toBeTruthy();
    expect(await screen.findByText("Live Skill Sprint")).toBeTruthy();
    expect(await screen.findByText("Live PR fixture report")).toBeTruthy();
  });

  it("renders quest board from the live quest fixture route", async () => {
    renderWithClient(<QuestsPageClient />);

    expect(await screen.findByText("Live Skill Sprint")).toBeTruthy();
    expect(await screen.findByText("Backed by live quest fixture evidence.")).toBeTruthy();
    expect(requestedPaths).toEqual(["/api/profile/me/quests"]);
  });

  it("renders PR battle report from the live PR report fixture route", async () => {
    renderWithClient(<PRBattleReportPageClient owner="octo" repo="gitrank" number={42} />);

    expect(await screen.findByText("Live PR fixture report")).toBeTruthy();
    expect(await screen.findByText("Live bounded diff summary from persisted evidence.")).toBeTruthy();
    expect(await screen.findByText("Backed by live PR report evidence.")).toBeTruthy();
    expect(requestedPaths).toEqual(["/api/pr/octo/gitrank/42/report"]);
  });

  it("renders public profile from the public profile BFF fixture", async () => {
    renderWithClient(<PublicProfilePageClient username="live-maintainer" />);

    expect(await screen.findByText("Live Fixture Maintainer")).toBeTruthy();
    expect(await screen.findByText("Live fixture profile rendered through BFF-shaped JSON.")).toBeTruthy();
    expect(requestedPaths).toEqual(["/api/profile/public/live-maintainer"]);
  });

  it("renders leaderboard from the live leaderboard fixture route", async () => {
    renderWithClient(<LeaderboardPageClient />);

    expect(await screen.findByText("v2-smoke")).toBeTruthy();
    expect(await screen.findByText("Live Leaderboard Maintainer")).toBeTruthy();
    expect(requestedPaths).toEqual(["/api/leaderboard"]);
  });

  it("renders settings from the authenticated profile fixture", async () => {
    renderWithClient(<SettingsPageClient />);

    expect(await screen.findByText("Settings and privacy")).toBeTruthy();
    expect(await screen.findByText("@live-maintainer")).toBeTruthy();
    expect(await screen.findByText("octo/gitrank")).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem("gitrank:reduced-gamification")).toBe("true"));
    fireEvent.click(await screen.findByText("Export data"));
    expect(await screen.findByText("Account export generated. Token secrets and secret hashes are excluded from the file.")).toBeTruthy();
    expect(requestedPaths).toEqual(["/api/profile/me", "/api/account/export"]);
  });
});

function renderWithClient(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
}

async function liveFixtureFetch(input: RequestInfo | URL): Promise<Response> {
  const rawURL =
    typeof input === "string" || input instanceof URL ? input.toString() : input.url;
  const path = new URL(rawURL, "http://gitrank.test").pathname;
  requestedPaths.push(path);

  if (path === "/api/profile/me") {
    return jsonResponse(privateProfileFixture);
  }
  if (path === "/api/profile/public/live-maintainer") {
    return jsonResponse(publicProfileFixture);
  }
  if (path === "/api/profile/me/quests") {
    return jsonResponse(questFixture);
  }
  if (path === "/api/pr/octo/gitrank/42/report") {
    return jsonResponse(prReportFixture);
  }
  if (path === "/api/leaderboard") {
    return jsonResponse(leaderboardFixture);
  }
  if (path === "/api/account/export") {
    return jsonResponse(accountExportFixture);
  }

  return jsonResponse(
    { error: { message: `Unhandled live fixture route: ${path}` } },
    404,
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

const now = "2026-05-10T12:00:00Z";

const publicProfileFixture = {
  summary: {
    handle: "live-maintainer",
    display_name: "Live Fixture Maintainer",
    avatar_url: "https://example.com/avatar.png",
    bio: "Live fixture profile rendered through BFF-shaped JSON.",
    total_xp: 2468,
    strength_summary: "Backend and testing evidence from persisted score events.",
    top_skills: ["backend", "testing"],
    badges_earned: 1,
    merged_pull_requests: 12,
    updated_at: now,
  },
  top_skill_areas: [
    {
      key: "backend",
      total_xp: 1400,
      percentage: 72,
      summary: "Live backend evidence from persisted PR score events.",
    },
    {
      key: "testing",
      total_xp: 800,
      percentage: 48,
      summary: "Regression coverage appears in verified score history.",
    },
  ],
  top_repositories: [
    {
      full_name: "octo/gitrank",
      owner: "octo",
      name: "gitrank",
      total_xp: 1800,
      contribution_count: 5,
      merged_pull_requests: 5,
      primary_skill: "backend",
      last_contribution_at: now,
      visibility: "public",
    },
  ],
  level: {
    label: "Live Systems Builder",
    current_level: 7,
    current_xp: 2468,
    next_level_xp: 3000,
    rank_tier: "gold iii",
  },
  badges: [
    {
      key: "live-badge",
      name: "Live Evidence Badge",
      description: "Awarded from live fixture score evidence.",
      awarded_at: now,
      evidence: {
        source: "score_event_fixture",
      },
    },
  ],
  score_history: [
    {
      event_id: "score-live-1",
      event_type: "pull_request_scored",
      delta_xp: 320,
      created_at: now,
      pull_request: {
        repository: "octo/gitrank",
        number: 42,
        title: "Live PR fixture report",
      },
      explanation: ["score version v2-smoke", "Live fixture score event with backend evidence."],
    },
  ],
  timeline: {
    window: {
      label: "Last 30 days",
      bucket: "week",
      start_at: "2026-04-10T00:00:00Z",
      end_at: now,
    },
    points: [
      {
        bucket_start: "2026-05-03T00:00:00Z",
        bucket_end: "2026-05-09T23:59:59Z",
        delta_xp: 320,
        total_xp: 2468,
      },
    ],
    updated_at: now,
  },
  share_card: {
    headline: "Live profile fixture headline",
  },
  staleness: {
    refreshed_at: now,
    stale_after: "2026-05-11T12:00:00Z",
    source_watermark: now,
    is_stale: false,
    partial_profile_available: false,
  },
};

const questFixture = {
  quests: [
    {
      id: "quest-live-skill-sprint",
      title: "Live Skill Sprint",
      description: "Complete one backend PR with review evidence.",
      status: "active",
      cadence: "weekly",
      reward_xp: 250,
      reward_badge_key: "live-badge",
      progress: 1,
      goal: 3,
      weak_area_target: "backend",
      why_recommended: "Backed by live quest fixture evidence.",
      evidence_signals: ["score_event_fixture", "profile_snapshot_fixture"],
      linked_contribution_ids: ["score-live-1"],
    },
  ],
};

const prReportFixture = {
  contribution: {
    id: "score-live-1",
    owner: "octo",
    repo: "gitrank",
    number: 42,
    title: "Live PR fixture report",
    status: "merged",
    category: "backend",
    difficulty_score: 72,
    impact_score: 81,
    review_depth_score: 66,
    test_signal_score: 74,
    repo_weight: 1.2,
    anti_spam_multiplier: 1,
    xp_earned: 320,
    additions: 144,
    deletions: 32,
    changed_files_count: 6,
    merged_at: now,
    maintainer_reviewed: true,
    linked_issue: true,
    ci_passed: true,
    ai_summary: "Live bounded diff summary from persisted evidence.",
    evidence_signals: ["bounded_files", "maintainer_review", "ci_passed"],
  },
  base_value: 180,
  merged_bonus: 40,
  review_bonus: 45,
  test_bonus: 35,
  repo_bonus: 20,
  ai_confidence: 0.74,
  penalties: [
    {
      label: "No penalty",
      delta_xp: 0,
      type: "gain",
      reason: "Live fixture has sufficient review and test evidence.",
    },
  ],
  suggested_quest_id: "quest-live-skill-sprint",
  suggested_quest: {
    id: "quest-live-skill-sprint",
    title: "Live Skill Sprint",
    description: "Complete one backend PR with review evidence.",
    status: "active",
    weak_area_target: "backend",
    why_recommended: "Backed by live PR report evidence.",
    evidence_signals: ["test_signal=74", "review_depth=66"],
  },
};

const privateProfileFixture = {
  ...publicProfileFixture,
  recent_pr_reports: [prReportFixture],
  privacy: {
    public_profile_enabled: true,
    show_exact_prs: true,
    show_ai_summaries: true,
    show_leaderboard_participation: true,
    reduced_gamification: true,
  },
  repository_visibility: [
    {
      full_name: "octo/gitrank",
      visibility: "public",
      reason: "Visible because it has verified live fixture score evidence.",
    },
  ],
};

const leaderboardFixture = {
  generated_at: now,
  scoring_version: "v2-smoke",
  entries: [
    {
      rank: 1,
      handle: "live-maintainer",
      display_name: "Live Leaderboard Maintainer",
      avatar_url: "https://example.com/avatar.png",
      level_label: "Live Systems Builder",
      rank_tier: "gold iii",
      total_xp: 2468,
      weekly_xp: 320,
      movement: 3,
      focus: "backend",
      refreshed_at: now,
      is_stale: false,
    },
  ],
};

const accountExportFixture = {
  export_version: "account-export/v1",
  generated_at: now,
  user: {
    user_id: "11111111-1111-1111-1111-111111111111",
    public_handle: "live-maintainer",
    display_name: "Live Fixture Maintainer",
    status: "active",
    profile_visibility: "public",
    created_at: now,
    updated_at: now,
  },
  github_accounts: [
    {
      github_account_id: "22222222-2222-2222-2222-222222222222",
      github_user_id: 42,
      login: "live-maintainer",
      access_mode: "oauth",
      installation_count: 0,
      link_status: "linked",
      linked_at: now,
      created_at: now,
      updated_at: now,
    },
  ],
  profile: privateProfileFixture,
  sessions: [
    {
      session_id: "33333333-3333-3333-3333-333333333333",
      github_account_id: "22222222-2222-2222-2222-222222222222",
      roles: ["user"],
      github_authorization_status: "active",
      created_at: now,
      last_seen_at: now,
      last_refreshed_at: now,
      rotated_at: now,
      expires_at: "2026-05-11T12:00:00Z",
      idle_expires_at: "2026-05-10T13:00:00Z",
    },
  ],
  audit_events: [
    {
      id: "44444444-4444-4444-4444-444444444444",
      actor_type: "user",
      actor_id: "11111111-1111-1111-1111-111111111111",
      action: "auth.login.success",
      target_type: "github_account",
      target_id: "22222222-2222-2222-2222-222222222222",
      metadata: {
        github_login: "live-maintainer",
      },
      created_at: now,
    },
  ],
  redactions: [
    "session_token_hash, csrf_token_hash, encrypted GitHub access tokens, and encrypted refresh tokens are intentionally excluded",
  ],
};
