import React, { type ReactNode } from "react";
import { render } from "@testing-library/react";
import { computeAccessibleName } from "dom-accessibility-api";
import { describe, expect, it, vi } from "vitest";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { PrivacyRepositoryToggleList } from "@/features/settings/components/PrivacyRepositoryToggleList";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

describe("accessibility control naming", () => {
  it("keeps interactive controls discoverable with non-empty accessible names", () => {
    const rendered = render(
      <div>
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
              tracked: true,
              visibility: "Public",
              reason: "Public by default",
            },
            {
              name: "octo/private-lab",
              tracked: true,
              visibility: "Hidden",
              reason: "Hidden by owner preference",
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
        "[role='radio']",
      ].join(","),
    );

    for (const element of interactive) {
      if (element.getAttribute("aria-hidden") === "true") {
        continue;
      }
      const name = computeAccessibleName(element);
      expect(
        name.trim().length,
        `${element.outerHTML} should expose an accessible name`,
      ).toBeGreaterThan(0);
    }

    expect(rendered.getAllByText("Dashboard").length).toBeGreaterThan(0);
    expect(rendered.getAllByText("2 of 2 repositories").length).toBeGreaterThan(0);
    expect(
      rendered.getByRole("switch", {
        name: "Hide octo/gitrank from public profile",
      }),
    ).toBeTruthy();
    expect(
      rendered.getByRole("switch", {
        name: "Show octo/private-lab on public profile",
      }),
    ).toBeTruthy();
  }, 15_000);

  it("exposes actionable controls when repository privacy list is empty", () => {
    const rendered = render(
      <PrivacyRepositoryToggleList repositories={[]} />
    );

    const syncAction = rendered.getByRole("link", { name: /Open dashboard/i });
    const search = rendered.getByRole("searchbox", { name: "Search repositories" });

    expect(rendered.queryByRole("button", { name: "Reset filters" })).toBeNull();
    expect(rendered.getByText("Repository visibility will appear after sync.")).toBeTruthy();
    expect(syncAction).toBeTruthy();
    expect(syncAction.getAttribute("href")).toBe("/dashboard");
    const describedById = search.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    const escapedId = describedById
      ? describedById.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1")
      : "";
    const statusNode = describedById
      ? rendered.container.querySelector(`#${escapedId}`)
      : null;
    expect(statusNode).toBeTruthy();
    expect(statusNode?.getAttribute("role")).toBe("status");
  });
});
