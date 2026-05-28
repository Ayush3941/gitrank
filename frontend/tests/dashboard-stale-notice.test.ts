import { describe, expect, it, vi } from "vitest";
import { buildDashboardStaleNotice } from "@/features/dashboard/lib/stale-notice";
import type { SyncRunDiagnostic } from "@/lib/presentation/sync-run-diagnostics";

describe("buildDashboardStaleNotice", () => {
  it("attaches latest sync reason for partially synced state", () => {
    const outcome: SyncRunDiagnostic = {
      code: "backfill_incomplete",
      message: "Recent PR evidence is synced. Historical authored PR backfill is still in progress.",
    };

    const notice = buildDashboardStaleNotice(
      "partially_synced",
      "2026-05-27T10:00:00Z",
      outcome,
    );

    expect(notice.message).toContain("Profile snapshot exists");
    expect(notice.reasonMessage).toContain("Historical authored PR backfill");
  });

  it("builds stale-timestamp message and omits empty reason", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T11:00:00Z"));

    const notice = buildDashboardStaleNotice(
      "stale",
      "2026-05-27T10:00:00Z",
      { code: "none", message: "" },
    );

    expect(notice.message).toContain("1h ago");
    expect(notice.reasonMessage).toBeUndefined();
    vi.useRealTimers();
  });
});
