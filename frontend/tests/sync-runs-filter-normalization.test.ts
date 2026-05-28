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

  it("preserves sync-run watermark timestamps from API payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runs: [],
            last_updated_at: "2026-05-27T00:00:00Z",
            last_attempted_at: "2026-05-27T00:05:00Z",
            last_successful_at: "2026-05-27T00:03:00Z",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const payload = await listMySyncRuns(5, { runType: "user" });
    expect(payload.last_attempted_at).toBe("2026-05-27T00:05:00Z");
    expect(payload.last_successful_at).toBe("2026-05-27T00:03:00Z");
  });

  it("marks finished active-status runs as failed instead of completed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            runs: [
              {
                id: "run-1",
                run_type: "user",
                status: "running",
                subject: "@Ayush3941",
                requested_user: "Ayush3941",
                started_at: "2026-05-27T00:00:00Z",
                finished_at: "2026-05-27T00:00:30Z",
                metrics: {},
              },
            ],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const payload = await listMySyncRuns(5, { runType: "user" });
    const run = payload.runs?.[0];
    expect(run?.status).toBe("failed");
    expect(run?.last_error).toContain("non-terminal status");
  });
});
