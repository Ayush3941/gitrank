import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";

let pathname = "/dashboard";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

describe("DashboardRouteNav", () => {
  beforeEach(() => {
    pathname = "/dashboard";
  });

  it("marks dashboard as active when on root dashboard route", () => {
    render(<DashboardRouteNav />);
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/ });
    expect(dashboardLink.getAttribute("aria-current")).toBe("page");
  });

  it("marks contributions as active on nested contribution route", () => {
    pathname = "/dashboard/contributions/pr/owner/repo/123";
    render(<DashboardRouteNav />);
    const contributionsLink = screen.getByRole("link", { name: /Contributions/ });
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/ });
    expect(contributionsLink.getAttribute("aria-current")).toBe("page");
    expect(dashboardLink.getAttribute("aria-current")).toBeNull();
  });

  it("keeps all primary dashboard lanes visible", () => {
    render(<DashboardRouteNav />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((link) => link.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/dashboard/contributions");
    expect(hrefs).toContain("/dashboard/badges");
    expect(hrefs).toContain("/dashboard/quests");
    expect(hrefs).toContain("/dashboard/settings");
  });
});
