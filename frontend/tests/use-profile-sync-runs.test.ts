import { beforeEach, describe, expect, it, vi } from "vitest";

const useSyncRunsMock = vi.fn((limit?: unknown, options?: unknown) => ({
  data: undefined,
  limit,
  options,
}));

vi.mock("@/hooks/use-sync-runs", () => ({
  useSyncRuns: (limit?: unknown, options?: unknown) => useSyncRunsMock(limit, options),
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

  it("uses policy-driven default lookback", () => {
    useProfileSyncRuns();

    expect(useSyncRunsMock).toHaveBeenCalledTimes(1);
    expect(useSyncRunsMock).toHaveBeenCalledWith(73, undefined);
  });

  it("accepts explicit lookback overrides", () => {
    useProfileSyncRuns(15);

    expect(useSyncRunsMock).toHaveBeenCalledTimes(1);
    expect(useSyncRunsMock).toHaveBeenCalledWith(15, undefined);
  });
});
