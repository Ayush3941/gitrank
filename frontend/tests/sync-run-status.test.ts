import { describe, expect, it } from "vitest";
import { isActiveSyncRunStatus, syncRunStatusLabel } from "@/features/settings/lib/sync-run-status";

describe("syncRunStatusLabel", () => {
  it("maps queue statuses to Queued and active execution statuses to Running", () => {
    expect(syncRunStatusLabel("queued")).toBe("Queued");
    expect(syncRunStatusLabel("pending")).toBe("Queued");
    expect(syncRunStatusLabel("running")).toBe("Running");
    expect(syncRunStatusLabel("syncing")).toBe("Running");
    expect(syncRunStatusLabel("in_progress")).toBe("Running");
  });

  it("maps terminal success statuses to Completed and partial to Partial", () => {
    expect(syncRunStatusLabel("completed")).toBe("Completed");
    expect(syncRunStatusLabel("partial")).toBe("Partial");
    expect(syncRunStatusLabel("succeeded")).toBe("Completed");
    expect(syncRunStatusLabel("success")).toBe("Completed");
    expect(syncRunStatusLabel("done")).toBe("Completed");
  });

  it("maps terminal failure statuses to Failed", () => {
    expect(syncRunStatusLabel("failed")).toBe("Failed");
    expect(syncRunStatusLabel("cancelled")).toBe("Failed");
    expect(syncRunStatusLabel("canceled")).toBe("Failed");
    expect(syncRunStatusLabel("timed_out")).toBe("Failed");
    expect(syncRunStatusLabel("timeout")).toBe("Failed");
  });

  it("returns Other for unknown values", () => {
    expect(syncRunStatusLabel("unknown")).toBe("Other");
    expect(syncRunStatusLabel("")).toBe("Other");
  });
});

describe("isActiveSyncRunStatus", () => {
  it("returns true only for actively running statuses", () => {
    expect(isActiveSyncRunStatus("queued")).toBe(false);
    expect(isActiveSyncRunStatus("in_progress")).toBe(true);
    expect(isActiveSyncRunStatus("pending")).toBe(false);
    expect(isActiveSyncRunStatus("completed")).toBe(false);
    expect(isActiveSyncRunStatus("failed")).toBe(false);
  });

  it("normalizes casing and whitespace", () => {
    expect(isActiveSyncRunStatus("  RUNNING  ")).toBe(true);
    expect(syncRunStatusLabel("  SUCCESS  ")).toBe("Completed");
  });
});
