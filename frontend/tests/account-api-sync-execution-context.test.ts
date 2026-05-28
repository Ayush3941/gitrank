import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  runCommitSync,
  runPullRequestSync,
  runRepositorySync,
} from "@/lib/api/account-api";

describe("account sync execution context api", () => {
  beforeEach(() => {
    document.cookie = "gitrank_csrf=test-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends optional user and installation context for repository execute sync", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "completed",
          mode: "repository",
          repository: "octo/repo",
          started_at: "2026-05-28T01:00:00Z",
          finished_at: "2026-05-28T01:00:01Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await runRepositorySync("octo/repo", {
      user: "@Ayush3941",
      installationId: 12001,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/sync/repository",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          repository: "octo/repo",
          user: "@Ayush3941",
          installation_id: 12001,
        }),
      }),
    );
  });

  it("omits invalid installation context and preserves core payload for pull-request and commit execute sync", async () => {
    const fetchMock = vi.fn(async (_input: unknown, init?: RequestInit) => {
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
      const mode = Object.prototype.hasOwnProperty.call(body, "number") ? "pull_request" : "commit";
      return new Response(
        JSON.stringify({
          status: "completed",
          mode,
          repository: "octo/repo",
          number: body.number,
          sha: body.sha,
          started_at: "2026-05-28T01:00:00Z",
          finished_at: "2026-05-28T01:00:01Z",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await runPullRequestSync("octo/repo", 77, { installationId: 0 });
    await runCommitSync("octo/repo", "abc123", { installationId: -3 });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/sync/pull-request",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          repository: "octo/repo",
          number: 77,
        }),
      }),
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/sync/commit",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          repository: "octo/repo",
          sha: "abc123",
        }),
      }),
    );
  });
});

