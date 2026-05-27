import { afterEach, describe, expect, it, vi } from "vitest";
import { listMySyncRuns } from "@/lib/api/account-api";

describe("sync-run list filter normalization", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("canonicalizes mixed-case and @-prefixed filter values", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          runs: [],
          last_updated_at: "2026-05-27T00:00:00Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listMySyncRuns(10, {
      runType: " User ",
      status: " Completed ",
      user: " @Ayush3941 ",
      repository: " Octo/Repo ",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestURL = String(fetchMock.mock.calls[0][0]);
    expect(requestURL).toContain("/api/sync/runs?");
    expect(requestURL).toContain("run_type=user");
    expect(requestURL).toContain("status=completed");
    expect(requestURL).toContain("user=ayush3941");
    expect(requestURL).toContain("repository=octo%2Frepo");
  });
});
