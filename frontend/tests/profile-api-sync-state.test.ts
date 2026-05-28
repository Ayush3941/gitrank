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

  it("marks sync state as partially_synced when scored PR evidence is still absent", async () => {
    const payload = buildPrivateProfileResponse({
      summary: {
        handle: "ayush3941",
        display_name: "Ayush Kumar Gaur",
        avatar_url: "",
        bio: "",
        total_xp: 0,
        strength_summary: "Backend momentum",
        top_skills: ["Backend"],
        badges_earned: 1,
        merged_pull_requests: 0,
        updated_at: "2026-05-27T12:00:00Z",
      },
      top_repositories: [],
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

  it("keeps sync state as synced when evidence exists even if backend partial hint is set", async () => {
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
    expect(adapted.user.syncStatus.state).toBe("synced");
  });

  it("maps contribution status from PR lifecycle fields", async () => {
    const payload = buildPrivateProfileResponse({
      score_history: [
        {
          event_id: "score-open",
          event_type: "score.computed",
          delta_xp: 42,
          created_at: "2026-05-27T12:00:00Z",
          score_version: "v1alpha1",
          formula_version: "v1alpha1",
          pull_request_id: "pr-open",
          pull_request: {
            repository: "owner/repo-open",
            number: 11,
            title: "open change",
            state: "open",
            merged: false,
          },
        },
        {
          event_id: "score-closed",
          event_type: "score.computed",
          delta_xp: 15,
          created_at: "2026-05-27T12:05:00Z",
          score_version: "v1alpha1",
          formula_version: "v1alpha1",
          pull_request_id: "pr-closed",
          pull_request: {
            repository: "owner/repo-closed",
            number: 12,
            title: "closed change",
            state: "closed",
            merged: false,
          },
        },
        {
          event_id: "score-merged",
          event_type: "score.computed",
          delta_xp: 120,
          created_at: "2026-05-27T12:10:00Z",
          score_version: "v1alpha1",
          formula_version: "v1alpha1",
          pull_request_id: "pr-merged",
          pull_request: {
            repository: "owner/repo-merged",
            number: 13,
            title: "merged change",
            state: "closed",
            merged: true,
          },
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    const adapted = await getMyProfile();
    const byRepo = new Map(adapted.user.contributions.map((row) => [row.repo, row.status]));
    expect(byRepo.get("repo-open")).toBe("open");
    expect(byRepo.get("repo-closed")).toBe("closed");
    expect(byRepo.get("repo-merged")).toBe("merged");
  });
});
