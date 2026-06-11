import { describe, expect, it, vi } from "vitest";
import { getLeaderboard } from "@/lib/api/leaderboard-api";

describe("getLeaderboard", () => {
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
