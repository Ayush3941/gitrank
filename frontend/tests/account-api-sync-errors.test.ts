import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runRepositorySync, runUserSync } from "@/lib/api/account-api";

describe("account sync error messaging", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps timeout-heavy user sync errors to plain-language recovery copy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(
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
    }));

    await expect(runUserSync("octocat")).rejects.toThrow(
      "GitHub took too long to respond. User sync kept any available evidence and dashboard auto-sync will retry in the background.",
    );
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
