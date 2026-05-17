import React, { type ReactNode } from "react";
import { render } from "@testing-library/react";
import { computeAccessibleName } from "dom-accessibility-api";
import { describe, expect, it, vi } from "vitest";
import { DashboardSidebar } from "@/components/shared/DashboardSidebar";
import { MobileNav } from "@/components/shared/MobileNav";
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
        <DashboardSidebar />
        <MobileNav />
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
  });
});
