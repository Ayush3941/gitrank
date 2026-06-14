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

  it("builds plural-aware repository visibility reasons from top repositories", async () => {
    const payload = buildPrivateProfileResponse({
      top_repositories: [
        {
          full_name: "owner/repo",
          owner: "owner",
          name: "repo",
          total_xp: 1000,
          contribution_count: 1,
          merged_pull_requests: 1,
          primary_skill: "Backend",
          last_contribution_at: "2026-05-27T12:00:00Z",
          visibility: "public",
        },
      ],
    });
    delete (payload as { repository_visibility?: unknown }).repository_visibility;

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    const adapted = await getMyProfile();
    expect(adapted.user.repositories[0]?.reason).toBe("1 scored contribution, 1,000 XP.");
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
          event_id: "score-unknown",
          event_type: "score.computed",
          delta_xp: 7,
          created_at: "2026-05-27T12:07:00Z",
          score_version: "v1alpha1",
          formula_version: "v1alpha1",
          pull_request_id: "pr-unknown",
          pull_request: {
            repository: "owner/repo-unknown",
            number: 121,
            title: "unknown lifecycle payload",
            state: "",
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
    expect(byRepo.get("repo-unknown")).toBe("open");
    expect(byRepo.get("repo-merged")).toBe("merged");
  });

  it("keeps PR contribution XP canonical when quest rewards reference the same PR", async () => {
    const payload = buildPrivateProfileResponse({
      score_history: [
        {
          event_id: "quest-reward",
          event_type: "quest.reward",
          delta_xp: 240,
          created_at: "2026-05-27T12:30:00Z",
          score_version: "quest-rewards/v1",
          formula_version: "quest-rewards/v1",
          pull_request_id: "pr-merged",
          analysis_id: "analysis-merged",
          evidence_state: "complete",
          pull_request: {
            repository: "owner/repo-merged",
            number: 13,
            title: "merged change",
            state: "closed",
            merged: true,
          },
          explanation: ["Quest reward: testing streak."],
        },
        {
          event_id: "score-merged",
          event_type: "score.computed",
          delta_xp: 120,
          created_at: "2026-05-27T12:10:00Z",
          score_version: "v1alpha1",
          formula_version: "score-components/v1",
          pull_request_id: "pr-merged",
          analysis_id: "analysis-merged",
          evidence_state: "complete",
          pull_request: {
            repository: "owner/repo-merged",
            number: 13,
            title: "merged change",
            state: "closed",
            merged: true,
          },
          explanation: ["Final deterministic PR score."],
        },
      ],
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })),
    );

    const adapted = await getMyProfile();
    expect(adapted.user.contributions).toHaveLength(1);
    expect(adapted.user.contributions[0]).toMatchObject({
      id: "score-merged",
      scoreEventId: "score-merged",
      xpEarned: 120,
      scoreVersion: "v1alpha1",
      formulaVersion: "score-components/v1",
    });
    expect(adapted.user.contributions[0]?.evidenceSignals).toEqual([
      "Quest reward: testing streak.",
      "Final deterministic PR score.",
    ]);
  });
});
