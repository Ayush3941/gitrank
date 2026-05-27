import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runUserSync } from "@/lib/api/account-api";

describe("account sync in-progress messaging", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
});
