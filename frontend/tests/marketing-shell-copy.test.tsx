import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketingLoading from "@/app/(marketing)/loading";
import { MarketingLayout } from "@/components/shared/MarketingLayout";
import { LandingPage } from "@/features/marketing/components/LandingPage";

const antiSpamCopy =
  "GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

describe("marketing shell copy", () => {
  it("uses direct anti-spam language without power-fantasy filler", () => {
    render(
      <MarketingLayout>
        <LandingPage />
      </MarketingLayout>,
    );

    expect(
      screen.getByRole("heading", {
        name: "Low-signal volume does not outrank meaningful work.",
      }),
    ).not.toBeNull();
    expect(screen.getAllByText(antiSpamCopy).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/do not make you powerful/i)).toBeNull();

    const nav = screen.getByRole("navigation", { name: "Marketing routes" });
    expect(nav.querySelector("ul")?.className).toContain("overflow-x-auto");
    expect(nav.querySelectorAll(".min-h-11")).toHaveLength(4);
  });

  it("uses a product-focused first-load label", () => {
    render(<MarketingLoading />);

    expect(screen.getByRole("heading", { name: "Preparing GitRank" })).not.toBeNull();
    expect(screen.queryByText(/contributor arena/i)).toBeNull();
  });
});
