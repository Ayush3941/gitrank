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

  it("refreshes session once and retries user sync when OAuth token is expired", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("/api/sync/user")) {
        if (fetchMock.mock.calls.filter((call) => String(call[0]).includes("/api/sync/user")).length === 1) {
          return new Response(
            JSON.stringify({
              error: {
                code: "github_user_oauth_required",
                message: "github oauth token unavailable for user sync; reconnect github",
              },
            }),
            {
              status: 401,
              headers: { "Content-Type": "application/json" },
            },
          );
        }
        return new Response(
          JSON.stringify({
            status: "completed",
            mode: "user",
            user: "octocat",
            correlation_id: "session-refresh-retry-ok",
            started_at: "2026-05-27T00:00:00Z",
            finished_at: "2026-05-27T00:00:03Z",
            fetched: {},
            persisted: {},
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (target.includes("/api/session/refresh")) {
        return new Response(
          JSON.stringify({
            session: {
              subject: "user-1",
            },
            csrf_header: "X-CSRF-Token",
            csrf_hint: "gitrank_csrf",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      throw new Error(`unexpected fetch target: ${target}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await runUserSync("octocat");
    expect(response.correlation_id).toBe("session-refresh-retry-ok");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/sync/user");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/session/refresh");
    expect(String(fetchMock.mock.calls[2][0])).toContain("/api/sync/user");
  });

  it("surfaces installation-bootstrap login-token recovery guidance when session refresh cannot recover token", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const target = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (target.includes("/api/sync/user")) {
        return new Response(
          JSON.stringify({
            error: {
              code: "github_user_oauth_required",
              message: "github oauth token unavailable for user sync; reconnect github",
            },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      if (target.includes("/api/session/refresh")) {
        return new Response(
          JSON.stringify({
            error: { message: "session refresh failed" },
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
      throw new Error(`unexpected fetch target: ${target}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub login token is unavailable for installation discovery. Reconnect GitHub from Settings, then retry.",
    );
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

  it("maps unsupported GitHub API version failures to actionable copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "invalid_request",
            message: "GitHub API request failed with status 400: Not a supported version",
          },
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }));

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub API version is not supported by GitHub. Update backend GITHUB_API_VERSION and retry sync.",
    );
  });

  it("maps GitHub App installation required failures to actionable copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "github_app_installation_required",
            message: "github app installation is required for user sync; install app and retry",
          },
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        },
      );
    }));

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub App installation is required for PR sync. Install GitRank GitHub App for your account and retry.",
    );
  });

  it("maps GitHub App installation token failures to actionable copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: "github_app_installation_unavailable",
            message: "github app installation token unavailable for user sync; verify app credentials and installation",
          },
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }));

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub App installation token is unavailable. Verify GitHub App credentials/private key and installation state, then retry sync.",
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
