import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runUserSync } from "@/lib/api/account-api";

function buildUserSyncResponse(overrides: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({
      status: "completed",
      mode: "user",
      started_at: "2026-05-27T00:00:00Z",
      finished_at: "2026-05-27T00:00:03Z",
      ...overrides,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("runUserSync deduplication", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("deduplicates concurrent requests for the same user", async () => {
    const fetchControl: {
      resolve?: (value: Response) => void;
    } = {};
    const fetchPromise = new Promise<Response>((resolve) => {
      fetchControl.resolve = resolve;
    });
    const fetchMock = vi.fn().mockReturnValue(fetchPromise);
    vi.stubGlobal("fetch", fetchMock);

    const first = runUserSync("octocat");
    const second = runUserSync("octocat");

    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchControl.resolve?.(buildUserSyncResponse({ correlation_id: "sync-1" }));
    const [a, b] = await Promise.all([first, second]);
    expect(a.correlation_id).toBe("sync-1");
    expect(b.correlation_id).toBe("sync-1");
  });

  it("does not deduplicate across different users", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(buildUserSyncResponse({ correlation_id: "sync-a" }))
      .mockResolvedValueOnce(buildUserSyncResponse({ correlation_id: "sync-b" }));
    vi.stubGlobal("fetch", fetchMock);

    const [a, b] = await Promise.all([runUserSync("octo"), runUserSync("hub")]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(a.correlation_id).toBe("sync-a");
    expect(b.correlation_id).toBe("sync-b");
  });

  it("clears dedupe state after failure so retries can re-execute", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "dependency_unavailable",
              message: "sync backend unavailable",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "dependency_unavailable",
              message: "sync backend unavailable",
            },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(buildUserSyncResponse({ correlation_id: "sync-retry" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(runUserSync("octocat")).rejects.toThrow();
    const retry = await runUserSync("octocat");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(retry.correlation_id).toBe("sync-retry");
  });
});
