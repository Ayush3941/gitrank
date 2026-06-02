import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MarketingLoading from "@/app/(marketing)/loading";
import { MarketingLayout } from "@/components/shared/MarketingLayout";
import { LandingPage } from "@/features/marketing/components/LandingPage";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
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
    expect(
      screen.getByText(
        "GitRank rewards merged evidence, review depth, tests, and project impact. Repeated low-signal PRs receive reduced weight.",
      ),
    ).not.toBeNull();
    expect(screen.queryByText(/do not make you powerful/i)).toBeNull();
  });

  it("uses a product-focused first-load label", () => {
    render(<MarketingLoading />);

    expect(screen.getByRole("heading", { name: "Preparing GitRank" })).not.toBeNull();
    expect(screen.queryByText(/contributor arena/i)).toBeNull();
  });
});
