import { beforeEach, describe, expect, it, vi } from "vitest";

const useSyncRunsMock = vi.fn(() => ({ data: undefined }));

vi.mock("@/hooks/use-sync-runs", () => ({
  useSyncRuns: (...args: unknown[]) => useSyncRunsMock(...args),
}));

vi.mock("@/lib/runtime/sync-polling-policy", () => ({
  syncPollingPolicy: {
    profileSyncRunLookbackLimit: 73,
  },
}));

import { useProfileSyncRuns } from "@/hooks/use-profile-sync-runs";

describe("useProfileSyncRuns", () => {
  beforeEach(() => {
    useSyncRunsMock.mockClear();
  });

  it("uses policy-driven default lookback and user run_type filter", () => {
    useProfileSyncRuns();

    expect(useSyncRunsMock).toHaveBeenCalledTimes(1);
    expect(useSyncRunsMock).toHaveBeenCalledWith(73, { runType: "user" });
  });

  it("accepts explicit lookback overrides", () => {
    useProfileSyncRuns(15);

    expect(useSyncRunsMock).toHaveBeenCalledTimes(1);
    expect(useSyncRunsMock).toHaveBeenCalledWith(15, { runType: "user" });
  });
});
