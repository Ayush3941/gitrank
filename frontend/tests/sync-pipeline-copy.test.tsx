import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SyncPipeline } from "@/features/onboarding/components/SyncPipeline";
import { buildProfileViewData } from "@/tests/helpers/gitrank-fixtures";

const mutateProfileSyncMock = vi.fn();
const refetchProfileMock = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-profile", () => ({
  useMyProfile: () => ({
    data: buildProfileViewData(),
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
  it("renders concise onboarding analysis progress copy", () => {
    render(<SyncPipeline />);

    expect(
      screen.getByRole("heading", { name: "Reading your GitHub history" }),
    ).toBeTruthy();
    expect(screen.queryByText("Reading your GitHub history...")).toBeNull();
    expect(screen.getByRole("progressbar", { name: "GitHub sync pipeline progress" })).toBeTruthy();
  });
});
