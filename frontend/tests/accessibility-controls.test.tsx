import React, { type ReactNode } from "react";
import { render } from "@testing-library/react";
import { computeAccessibleName } from "dom-accessibility-api";
import { describe, expect, it, vi } from "vitest";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";
import { DashboardTopBar } from "@/components/shared/DashboardTopBar";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { PrivacyRepositoryToggleList } from "@/features/settings/components/PrivacyRepositoryToggleList";
import type { UserProfile } from "@/types/gitrank";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("accessibility control naming", () => {
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

  it("keeps interactive controls discoverable with non-empty accessible names", () => {
    const rendered = render(
      <div>
        <DashboardTopBar user={userFixture as unknown as UserProfile} />
        <DashboardRouteNav />
        <ContributionFilters
          value="All"
          onValueChange={() => undefined}
          search=""
          onSearchChange={() => undefined}
          sort="Newest"
          onSortChange={() => undefined}
        />
        <PrivacyRepositoryToggleList
          repositories={[
            {
              name: "octo/gitrank",
              visibility: "Public",
              reason: "Public by default",
            },
          ]}
        />
      </div>,
    );

    const interactive = rendered.container.querySelectorAll(
      [
        "button",
        "input",
        "select",
        "[role='button']",
        "[role='switch']",
        "[role='tab']",
      ].join(","),
    );

    for (const element of interactive) {
      if (element.getAttribute("aria-hidden") === "true") {
        continue;
      }
      const name = computeAccessibleName(element);
      expect(name.trim().length, `${element.outerHTML} should expose an accessible name`).toBeGreaterThan(0);
    }

    expect(rendered.getAllByText("Dashboard").length).toBeGreaterThan(0);
  });

  it("exposes actionable controls when repository privacy list is empty", () => {
    const rendered = render(
      <PrivacyRepositoryToggleList repositories={[]} />
    );

    const reset = rendered.getByRole("button", { name: "Reset" });
    const syncAction = rendered.getByRole("link", { name: "Run sync in account section" });
    const search = rendered.getByRole("textbox", { name: "Search repositories" });

    expect(reset).toBeTruthy();
    expect(reset.hasAttribute("disabled")).toBe(true);
    expect(syncAction).toBeTruthy();
    expect(syncAction.getAttribute("href")).toBe("/dashboard/settings");
    expect(search.getAttribute("aria-describedby")).toBe("settings-repositories-filter-status");
  });
});
