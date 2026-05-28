import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runPullRequestSync, runRepositorySync, runUserSync } from "@/lib/api/account-api";

describe("account sync error messaging", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns actionable timeout copy when user sync execution times out", async () => {
    const timeoutResponse = new Response(
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
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(timeoutResponse.clone())
      .mockResolvedValueOnce(timeoutResponse.clone());
    vi.stubGlobal("fetch", fetchMock);

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub took too long to respond. User sync did not complete. Retry sync from Settings after a short delay.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not queue fallback when execution fails", async () => {
    const unavailableResponse = new Response(
      JSON.stringify({
        error: {
          code: "dependency_unavailable",
          message: "API gateway is unavailable. Retry after backend services are running.",
        },
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json" },
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unavailableResponse.clone())
      .mockResolvedValueOnce(unavailableResponse.clone());
    vi.stubGlobal("fetch", fetchMock);

    await expect(runUserSync("octocat")).rejects.toThrow(
      "Sync services are temporarily unavailable. User sync did not complete. Retry sync from Settings after a short delay.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps aborted direct execution to timeout recovery copy", async () => {
    const abortedError = Object.assign(new Error("The operation was aborted."), {
      name: "AbortError",
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(abortedError)
      .mockRejectedValueOnce(abortedError);
    vi.stubGlobal("fetch", fetchMock);

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub took too long to respond. User sync did not complete. Retry sync from Settings after a short delay.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("maps concurrent user-sync conflicts to actionable copy", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          error: {
            code: "github_user_sync_in_progress",
            message: "user sync already in progress; wait for current run to finish",
          },
        }),
        {
          status: 409,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(runUserSync("octocat")).rejects.toThrow(
      "A GitHub sync for this account is already running. Wait for it to finish, then refresh.",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries transient rate-limit failures and succeeds when next attempt completes", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "github_rate_limited",
              message: "GitHub API GET https://api.github.com/search/issues failed with status 429",
            },
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json", "Retry-After": "0" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "completed",
            mode: "user",
            user: "octocat",
            correlation_id: "retry-ok",
            started_at: "2026-05-27T00:00:00Z",
            finished_at: "2026-05-27T00:00:03Z",
            fetched: {},
            persisted: {},
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await runUserSync("octocat");
    expect(response.correlation_id).toBe("retry-ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
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

  it("maps upstream pull-request sync timeouts to actionable copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "upstream_timeout",
            message:
              "Get \"https://api.github.com/repos/octo/repo/pulls/77\": context deadline exceeded (Client.Timeout exceeded while awaiting headers)",
          },
        }),
        {
          status: 504,
          headers: { "Content-Type": "application/json" },
        },
      );
    }));

    await expect(runPullRequestSync("octo/repo", 77)).rejects.toThrow(
      "GitHub took too long to respond. Pull-request sync kept any available evidence. Retry soon with the same owner/repo and PR number.",
    );
  });

});
