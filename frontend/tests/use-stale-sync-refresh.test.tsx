import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStaleSyncRefresh } from "@/hooks/use-stale-sync-refresh";
import type { RefreshFeedback } from "@/lib/refresh-feedback";

describe("useStaleSyncRefresh", () => {
  it("returns in-flight feedback without requesting a new sync when a run is queued", async () => {
    const requestSync = vi.fn(async () => ({
      status: "completed",
      mode: "user",
      started_at: "2026-05-30T10:00:00Z",
      finished_at: "2026-05-30T10:00:10Z",
    }));
    const refetchAfterSync = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useStaleSyncRefresh({
        runs: [
          {
            id: "run_queued",
            run_type: "user",
            status: "queued",
            started_at: "2026-05-30T10:00:00Z",
          },
        ],
        isSyncPending: false,
        requestSync,
        refetchAfterSync,
      }),
    );

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.hasInFlightSync).toBe(true);
    expect(result.current.refreshLabel).toBe("Check sync status");

    let feedback: RefreshFeedback | undefined;
    await act(async () => {
      feedback = await result.current.onRefresh();
    });

    expect(requestSync).not.toHaveBeenCalled();
    expect(refetchAfterSync).not.toHaveBeenCalled();
    expect(feedback?.message).toMatch(/already queued/i);
  });

  it("requests sync and refetches when no in-flight run exists", async () => {
    const requestSync = vi.fn(async () => ({
      status: "completed",
      mode: "user",
      started_at: "2026-05-30T10:00:00Z",
      finished_at: "2026-05-30T10:00:10Z",
      fetched: { authored_pull_requests_selected: 2 },
    }));
    const refetchAfterSync = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useStaleSyncRefresh({
        runs: [],
        isSyncPending: false,
        requestSync,
        refetchAfterSync,
      }),
    );

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.hasInFlightSync).toBe(false);
    expect(result.current.refreshLabel).toBe("Refresh");

    let feedback: RefreshFeedback | undefined;
    await act(async () => {
      feedback = await result.current.onRefresh();
    });

    expect(requestSync).toHaveBeenCalledTimes(1);
    expect(refetchAfterSync).toHaveBeenCalledTimes(1);
    expect(feedback?.message).toMatch(/refresh completed/i);
  });

  it("marks refresh as busy only while this page mutation is pending", () => {
    const { result } = renderHook(() =>
      useStaleSyncRefresh({
        runs: [
          {
            id: "run_running",
            run_type: "user",
            status: "running",
            started_at: "2026-05-30T10:00:00Z",
          },
        ],
        isSyncPending: true,
        requestSync: async () => ({
          status: "completed",
          mode: "user",
          started_at: "2026-05-30T10:00:00Z",
          finished_at: "2026-05-30T10:00:10Z",
        }),
        refetchAfterSync: async () => undefined,
      }),
    );

    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.refreshLabel).toBe("Check sync status");
  });
});
