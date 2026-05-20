import React, { type ReactNode } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";
import { DashboardTopBar } from "@/components/shared/DashboardTopBar";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StaleState } from "@/components/shared/StaleState";
import type { UserProfile } from "@/types/gitrank";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("frontend accessibility guardrails", () => {
  const userFixture = {
    username: "octocat",
    displayName: "Octo Cat",
    title: "Systems Builder",
    weeklyXp: 120,
    syncStatus: {
      state: "synced",
      lastSyncedAt: "2026-05-17T17:30:00.000Z",
      partialProfileAvailable: false,
    },
    level: {
      rankTier: "Bronze I",
    },
  } as const;

  it("keeps shared empty/error/stale patterns accessible", async () => {
    const rendered = render(
      <div>
        <PageHeader
          title="Accessibility guard"
          description="Guard test for shared a11y patterns."
        />
        <EmptyState
          title="No data yet"
          description="Retry after sync completes."
          actionLabel="Open dashboard"
          actionHref="/dashboard"
        />
        <ErrorState
          title="Sync failed"
          description="Try again after a short delay."
          retryLabel="Retry"
          fallbackLabel="Open settings"
          fallbackHref="/dashboard/settings"
        />
        <StaleState
          message="Snapshot is stale."
          actionLabel="Open settings"
          actionHref="/dashboard/settings"
        />
      </div>,
    );

    const result = await axe(rendered.container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    expect(result.violations).toHaveLength(0);
  }, 15_000);

  it("keeps dashboard navigation components accessible", async () => {
    const rendered = render(
      <div>
        <DashboardTopBar user={userFixture as unknown as UserProfile} />
        <DashboardRouteNav />
      </div>,
    );
    const result = await axe(rendered.container, {
      rules: {
        "color-contrast": { enabled: false },
      },
    });
    expect(result.violations).toHaveLength(0);
  }, 15_000);
});
