import { describe, expect, it } from "vitest";
import {
  buildInFlightSyncRefreshFeedback,
  selectLatestInFlightSyncRun,
} from "@/lib/sync-refresh-guard";

describe("selectLatestInFlightSyncRun", () => {
  it("returns the newest queued or running row", () => {
    const selected = selectLatestInFlightSyncRun([
      {
        id: "run_1",
        run_type: "user",
        status: "queued",
        started_at: "2026-05-30T10:00:00Z",
      },
      {
        id: "run_2",
        run_type: "user",
        status: "completed",
        started_at: "2026-05-30T09:59:00Z",
      },
    ]);

    expect(selected?.id).toBe("run_1");
  });

  it("returns null when no in-flight rows exist", () => {
    const selected = selectLatestInFlightSyncRun([
      {
        id: "run_2",
        run_type: "user",
        status: "completed",
        started_at: "2026-05-30T09:59:00Z",
      },
      {
        id: "run_3",
        run_type: "user",
        status: "failed",
        started_at: "2026-05-30T09:58:00Z",
      },
    ]);

    expect(selected).toBeNull();
  });
});

describe("buildInFlightSyncRefreshFeedback", () => {
  it("uses queued wording for queued rows", () => {
    const feedback = buildInFlightSyncRefreshFeedback({
      id: "run_queued",
      run_type: "user",
      status: "queued",
      started_at: "2026-05-30T10:00:00Z",
    });

    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toMatch(/already queued/i);
  });

  it("uses in-progress wording for running rows", () => {
    const feedback = buildInFlightSyncRefreshFeedback({
      id: "run_running",
      run_type: "user",
      status: "running",
      started_at: "2026-05-30T10:00:00Z",
    });

    expect(feedback.tone).toBe("warning");
    expect(feedback.message).toMatch(/already in progress/i);
  });
});
