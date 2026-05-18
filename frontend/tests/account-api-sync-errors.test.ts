import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runRepositorySync, runUserSync } from "@/lib/api/account-api";

describe("account sync error messaging", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("falls back to queued user sync when execution times out", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "upstream_timeout",
              message:
                "Get \"https://api.github.com/repos/llvm/llvm-project/pulls/182707/reviews?per_page=20\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)",
            },
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "accepted",
            job_id: "job-123",
            correlation_id: "sync-123",
            accepted_at: "2026-05-17T20:15:00Z",
          }),
          {
            status: 202,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await runUserSync("octocat");
    expect(result.status).toBe("queued");
    expect(result.mode).toBe("user");
    expect(result.user).toBe("octocat");
    expect(result.correlation_id).toBe("sync-123");
    expect(result.started_at).toBe("2026-05-17T20:15:00Z");
    expect(result.fetched?.fallback_queued).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/sync", expect.any(Object));
  });

  it("maps rate-limit repository sync errors to actionable copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "github_rate_limited",
            message: "GitHub API GET https://api.github.com/repos/octo/repo failed with status 429",
          },
        }),
        {
          status: 429,
          headers: { "Content-Type": "application/json" },
        },
      );
    }));

    await expect(runRepositorySync("octo/repo")).rejects.toThrow(
      "GitHub rate limits are active right now. Repository sync kept any available evidence. Retry soon or run full dashboard auto-sync.",
    );
  });
});
