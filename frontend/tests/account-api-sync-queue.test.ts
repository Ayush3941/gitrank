import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queueSyncRequest } from "@/lib/api/account-api";

describe("account sync queue api", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends installation_id when queueing installation sync", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "accepted",
          accepted_at: "2026-05-26T01:00:00Z",
          correlation_id: "sync-install-1",
        }),
        {
          status: 202,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await queueSyncRequest({ mode: "installation", installationId: 42 });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          mode: "installation",
          installation_id: 42,
          user: undefined,
          repository: undefined,
          number: undefined,
          sha: undefined,
        }),
      }),
    );
  });
});
