import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMySyncRuns } from "@/lib/api/account-api";

describe("listMySyncRuns normalization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("preserves terminal partial and failed statuses when finished_at is present", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          last_updated_at: "2026-05-27T10:00:00.000Z",
          runs: [
            {
              id: "run-partial",
              run_type: "user",
              status: "partial",
              subject: "octocat",
              started_at: "2026-05-27T09:59:00.000Z",
              finished_at: "2026-05-27T09:59:30.000Z",
              metrics: {},
            },
            {
              id: "run-failed",
              run_type: "user",
              status: "failed",
              subject: "octocat",
              started_at: "2026-05-27T09:58:00.000Z",
              finished_at: "2026-05-27T09:58:45.000Z",
              metrics: {},
            },
            {
              id: "run-running-finished",
              run_type: "user",
              status: "running",
              subject: "octocat",
              started_at: "2026-05-27T09:57:00.000Z",
              finished_at: "2026-05-27T09:57:50.000Z",
              metrics: {},
            },
            {
              id: "run-completed-with-partial-metrics",
              run_type: "user",
              status: "completed",
              subject: "octocat",
              started_at: "2026-05-27T09:56:00.000Z",
              finished_at: "2026-05-27T09:56:45.000Z",
              metrics: {
                authored_pull_request_discovery_empty: 1,
              },
            },
            {
              id: "run-queued-stale",
              run_type: "user",
              status: "queued",
              subject: "octocat",
              started_at: "2026-05-27T09:40:00.000Z",
              metrics: {},
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const payload = await listMySyncRuns(10);
    const statusByID = new Map(payload.runs?.map((run) => [run.id, run.status]));

    expect(statusByID.get("run-partial")).toBe("partial");
    expect(statusByID.get("run-failed")).toBe("failed");
    expect(statusByID.get("run-running-finished")).toBe("failed");
    expect(statusByID.get("run-completed-with-partial-metrics")).toBe("partial");
    expect(statusByID.get("run-queued-stale")).toBe("failed");
  });

  it("forwards optional sync-run filters in query params", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          last_updated_at: "2026-05-27T10:00:00.000Z",
          runs: [],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await listMySyncRuns(25, {
      runType: "user",
      user: "Ayush3941",
    });

    const call = fetchMock.mock.calls[0]?.[0];
    expect(typeof call).toBe("string");
    expect(call).toContain("/api/sync/runs?");
    expect(call).toContain("run_type=user");
    expect(call).toContain("user=ayush3941");
  });
});
