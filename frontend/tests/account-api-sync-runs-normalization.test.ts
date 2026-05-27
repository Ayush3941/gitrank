import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listMySyncRuns } from "@/lib/api/account-api";

describe("listMySyncRuns normalization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("normalizes stale active and queued rows into terminal failed states", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            last_updated_at: "2026-05-27T12:00:00.000Z",
            runs: [
              {
                id: "queued-stale",
                run_type: "user",
                status: "queued",
                started_at: "2026-05-27T11:54:00.000Z",
              },
              {
                id: "running-no-start",
                run_type: "user",
                status: "running",
                started_at: "",
              },
              {
                id: "running-stale",
                run_type: "user",
                status: "running",
                started_at: "2026-05-27T11:40:00.000Z",
              },
              {
                id: "syncing-finished",
                run_type: "user",
                status: "syncing",
                started_at: "2026-05-27T11:50:00.000Z",
                finished_at: "2026-05-27T11:51:00.000Z",
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

    const payload = await listMySyncRuns(25);
    const runs = payload.runs ?? [];
    expect(runs).toHaveLength(4);

    const byID = new Map(runs.map((run) => [run.id, run]));
    expect(byID.get("queued-stale")?.status).toBe("failed");
    expect(byID.get("queued-stale")?.last_error).toContain("remained queued");
    expect(byID.get("running-no-start")?.status).toBe("failed");
    expect(byID.get("running-no-start")?.last_error).toContain("missing started_at");
    expect(byID.get("running-stale")?.status).toBe("failed");
    expect(byID.get("running-stale")?.last_error).toContain("exceeded active window");
    expect(byID.get("syncing-finished")?.status).toBe("completed");
  });

  it("sorts normalized runs by started_at descending for stable UI rendering", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            last_updated_at: "2026-05-27T12:00:00.000Z",
            runs: [
              {
                id: "older",
                run_type: "user",
                status: "completed",
                started_at: "2026-05-27T10:00:00.000Z",
              },
              {
                id: "latest",
                run_type: "user",
                status: "completed",
                started_at: "2026-05-27T11:59:59.000Z",
              },
              {
                id: "middle",
                run_type: "user",
                status: "completed",
                started_at: "2026-05-27T11:00:00.000Z",
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

    const payload = await listMySyncRuns();
    const ids = (payload.runs ?? []).map((run) => run.id);
    expect(ids).toEqual(["latest", "middle", "older"]);
  });
});
