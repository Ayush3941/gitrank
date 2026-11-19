import { describe, expect, it, vi } from "vitest";
import { getLeaderboard } from "@/lib/api/leaderboard-api";

describe("getLeaderboard", () => {
  it("requests a server-ranked skill lane and keeps contributors whose primary focus differs", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      lane: "testing",
      ranking_metric: "skill_xp",
      entries: [{
        rank: 1, handle: "cross-skill-contributor", display_name: "Cross Skill Contributor",
        level_label: "Builder", rank_tier: "Bronze I", total_xp: 1000,
        weekly_xp: 1000, ranking_value: 300, movement: 0, focus: "backend",
        refreshed_at: "2026-06-08T00:00:00.000Z", is_stale: false,
      }],
    }), { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetcher);

    const snapshot = await getLeaderboard("Testing");

    expect(fetcher.mock.calls[0]?.[0]).toBe("/api/leaderboard?lane=testing");
    expect(snapshot.rows).toHaveLength(1);
    expect(snapshot.rows[0]).toMatchObject({ username: "cross-skill-contributor", rank: 1, rankingValue: 300 });
    expect(snapshot.season.rankingLabel).toBe("Testing XP");
  });

  it("keeps a zero weekly ranking value instead of substituting lifetime XP", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      lane: "weekly", ranking_metric: "weekly_xp",
      entries: [{ rank: 1, handle: "inactive", display_name: "Inactive", level_label: "Builder",
        rank_tier: "Gold I", total_xp: 10000, weekly_xp: 0, ranking_value: 0,
        movement: 0, focus: "backend", refreshed_at: "2026-06-08T00:00:00.000Z", is_stale: true }],
    }), { headers: { "Content-Type": "application/json" } })));

    const snapshot = await getLeaderboard("Weekly XP");

    expect(snapshot.rows[0]?.rankingValue).toBe(0);
  });

  it("rejects a global response to a scoped lane request", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ lane: "global", entries: [] }))));

    await expect(getLeaderboard("Weekly XP")).rejects.toThrow("requested leaderboard lane");
  });

  it("uses configured score-version fallback when leaderboard metadata is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            generated_at: "2026-06-08T00:00:00.000Z",
            season_key: "weekly-2026-06-08",
            window: {
              label: "weekly-2026-06-08",
              bucket: "week",
              start_at: "2026-06-08T00:00:00.000Z",
              end_at: "2026-06-14T23:59:59.999Z",
            },
            entries: [
              {
                rank: 1,
                handle: "octocat",
                display_name: "Octo Cat",
                level_label: "Systems Builder",
                rank_tier: "Bronze I",
                total_xp: 1200,
                weekly_xp: 320,
                movement: 1,
                focus: "Backend",
                refreshed_at: "2026-06-08T00:00:00.000Z",
                is_stale: false,
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );

    const snapshot = await getLeaderboard("Global");

    expect(snapshot.season.scoringVersion).toBe("v1alpha1");
    expect(snapshot.rows[0]?.scoreFormulaVersion).toBe("v1alpha1");
    expect(snapshot.season.scoringVersion).not.toBe("unknown");
  });
});
