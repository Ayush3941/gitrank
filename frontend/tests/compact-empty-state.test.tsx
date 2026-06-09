import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

describe("CompactEmptyState", () => {
  it("renders an embedded absence note with decorative icon and recovery actions", () => {
    const { container } = render(
      <CompactEmptyState
        title="No battle reports yet"
        description="New merged PR reports appear here after auto-sync settles."
        primaryAction={{
          label: "Inspect contributions",
          href: "/dashboard/contributions",
        }}
        secondaryAction={{
          label: "Open sync settings",
          href: "/dashboard/settings",
        }}
      />,
    );

    expect(screen.getByRole("note")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "No battle reports yet" })).toBeTruthy();
    expect(container.querySelector(".lucide-inbox")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("link", { name: "Inspect contributions" }).getAttribute("href")).toBe(
      "/dashboard/contributions",
    );
    expect(screen.getByRole("link", { name: "Open sync settings" }).getAttribute("href")).toBe(
      "/dashboard/settings",
    );
  });

  it("keeps repeated action labels separate through explicit action roles", () => {
    render(
      <CompactEmptyState
        title="No reports"
        description="Retry from either destination."
        primaryAction={{
          label: "Open",
          href: "/dashboard/contributions",
        }}
        secondaryAction={{
          label: "Open",
          href: "/dashboard/settings",
        }}
      />,
    );

    const links = screen.getAllByRole("link", { name: "Open" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/dashboard/contributions",
      "/dashboard/settings",
    ]);
  });
});
