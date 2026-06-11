import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SyncPipeline } from "@/features/onboarding/components/SyncPipeline";
import { buildProfileViewData, buildUserProfile } from "@/tests/helpers/gitrank-fixtures";

const mutateProfileSyncMock = vi.fn();
const refetchProfileMock = vi.fn();
let profileViewData = buildProfileViewData();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-profile", () => ({
  useMyProfile: () => ({
    data: profileViewData,
    isLoading: false,
    isError: false,
    refetch: refetchProfileMock,
  }),
}));

vi.mock("@/hooks/use-account-actions", () => ({
  useRequestProfileSync: () => ({
    error: null,
    isPending: false,
    mutate: mutateProfileSyncMock,
  }),
}));

vi.mock("@/lib/api/analytics-api", () => ({
  emitAnalyticsEvent: vi.fn(),
}));

describe("SyncPipeline", () => {
  beforeEach(() => {
    mutateProfileSyncMock.mockReset();
    refetchProfileMock.mockReset();
    profileViewData = buildProfileViewData();
  });

  it("renders concise onboarding analysis progress copy", () => {
    render(<SyncPipeline />);

    expect(
      screen.getByRole("heading", { name: "Reading your GitHub history" }),
    ).toBeTruthy();
    expect(screen.queryByText("Reading your GitHub history...")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "GitHub sync pipeline progress" })).toBeTruthy();
  });

  it("renders readable auto-refresh cadence copy while sync is pending", async () => {
    profileViewData = buildProfileViewData({
      user: buildUserProfile({
        mergedPrCount: 0,
        contributions: [],
        syncStatus: {
          state: "stale",
          progress: 0,
          partialProfileAvailable: false,
        },
      }),
      isStale: true,
      partialProfileAvailable: false,
    });
    mutateProfileSyncMock.mockImplementation((_variables, options) => {
      options?.onSuccess?.({
        started_at: "2026-06-08T12:00:00.000Z",
        status: "started",
      });
    });

    render(<SyncPipeline />);

    expect(
      await screen.findByText(
        "Auto-refresh slows from 5 seconds up to 20 seconds while sync is pending. Current cadence: about 5 seconds.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Poll cadence ~5 seconds")).toBeTruthy();
  });
});
