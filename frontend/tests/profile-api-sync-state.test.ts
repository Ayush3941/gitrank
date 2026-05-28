import { afterEach, describe, expect, it, vi } from "vitest";
import { getMyProfile } from "@/lib/api/profile-api";

function buildPrivateProfileResponse(overrides?: Record<string, unknown>) {
  return {
    summary: {
      handle: "ayush3941",
      display_name: "Ayush Kumar Gaur",
      avatar_url: "",
      bio: "",
      total_xp: 1000,
      strength_summary: "Backend momentum",
      top_skills: ["Backend"],
      badges_earned: 1,
      merged_pull_requests: 3,
      updated_at: "2026-05-27T12:00:00Z",
    },
    top_skill_areas: [],
    top_repositories: [
      {
        full_name: "owner/repo",
        owner: "owner",
        name: "repo",
        total_xp: 1000,
        contribution_count: 3,
        merged_pull_requests: 3,
        primary_skill: "Backend",
        last_contribution_at: "2026-05-27T12:00:00Z",
        visibility: "public",
      },
    ],
    level: {
      label: "Specialist",
      current_level: 4,
      current_xp: 1000,
      next_level_xp: 1300,
      rank_tier: "Gold III",
    },
    badges: [],
    score_history: [],
    timeline: {
      window: {
        label: "last_6_weeks",
        bucket: "week",
        start_at: "2026-04-15T00:00:00Z",
        end_at: "2026-05-27T12:00:00Z",
      },
      points: [],
      updated_at: "2026-05-27T12:00:00Z",
    },
    share_card: {
      headline: "Evidence-backed contributor signal.",
    },
    staleness: {
      refreshed_at: "2026-05-27T12:00:00Z",
      stale_after: "2026-05-27T14:00:00Z",
      source_watermark: "2026-05-27T12:00:00Z",
      is_stale: false,
      partial_profile_available: false,
    },
    privacy: {
      public_profile_enabled: true,
      show_exact_prs: true,
      show_ai_summaries: true,
      show_leaderboard_participation: true,
      reduced_gamification: false,
    },
    repository_visibility: [],
    recent_pr_reports: [],
    ...(overrides ?? {}),
  };
}

describe("profile API sync-state adaptation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks sync state as partially_synced when backend reports partial_profile_available", async () => {
    const payload = buildPrivateProfileResponse({
      staleness: {
        refreshed_at: "2026-05-27T12:00:00Z",
        stale_after: "2026-05-27T14:00:00Z",
        source_watermark: "2026-05-27T12:00:00Z",
        is_stale: false,
        partial_profile_available: true,
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    const adapted = await getMyProfile();
    expect(adapted.user.syncStatus.state).toBe("partially_synced");
  });
});
