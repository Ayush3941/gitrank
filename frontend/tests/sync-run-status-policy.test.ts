import { describe, expect, it } from "vitest";
import {
  canonicalizeSyncRunStatus,
  normalizeSyncRunStatusToken,
} from "@/lib/sync/sync-run-status-policy";

describe("sync-run-status-policy", () => {
  it("normalizes whitespace and casing", () => {
    expect(normalizeSyncRunStatusToken("  RUNNING  ")).toBe("running");
  });

  it("canonicalizes completed variants", () => {
    expect(canonicalizeSyncRunStatus("completed")).toBe("completed");
    expect(canonicalizeSyncRunStatus("success")).toBe("completed");
  });

  it("canonicalizes partial, failed, queued, and running variants", () => {
    expect(canonicalizeSyncRunStatus("partial")).toBe("partial");
    expect(canonicalizeSyncRunStatus("timed_out")).toBe("failed");
    expect(canonicalizeSyncRunStatus("pending")).toBe("queued");
    expect(canonicalizeSyncRunStatus("in_progress")).toBe("running");
  });

  it("returns other for unknown statuses", () => {
    expect(canonicalizeSyncRunStatus("mystery-status")).toBe("other");
  });
});
