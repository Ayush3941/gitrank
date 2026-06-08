import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketingLoading from "@/app/(marketing)/loading";
import { MarketingLayout } from "@/components/shared/MarketingLayout";
import { LandingPage } from "@/features/marketing/components/LandingPage";
import {
  MARKETING_ANTI_SPAM_PROMISE,
  MARKETING_NAV_ITEMS,
} from "@/lib/presentation/marketing-shell";

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
        name: MARKETING_ANTI_SPAM_PROMISE.title,
      }),
    ).not.toBeNull();
    expect(screen.getAllByText(MARKETING_ANTI_SPAM_PROMISE.body).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/do not make you powerful/i)).toBeNull();

    const nav = screen.getByRole("navigation", { name: "Marketing routes" });
    expect(nav.querySelector("ul")?.className).toContain("overflow-x-auto");
    expect(nav.querySelectorAll(".min-h-11")).toHaveLength(MARKETING_NAV_ITEMS.length);
  });

  it("uses a product-focused first-load label", () => {
    render(<MarketingLoading />);

    expect(screen.getByRole("heading", { name: "Preparing GitRank" })).not.toBeNull();
    expect(screen.queryByText(/contributor arena/i)).toBeNull();
  });
});
