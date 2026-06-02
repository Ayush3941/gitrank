import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarketingLayout } from "@/components/shared/MarketingLayout";
import { LandingPage } from "@/features/marketing/components/LandingPage";
import { LoginPanel } from "@/features/onboarding/components/LoginPanel";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

describe("main landmark policy", () => {
  it("keeps the marketing landing route inside one AppShell main landmark", () => {
    const { container } = render(
      <MarketingLayout>
        <LandingPage />
      </MarketingLayout>,
    );

    expectSingleMainLandmark(container);
    expect(screen.getByRole("navigation", { name: "Marketing routes" })).toBeTruthy();
  });

  it("keeps onboarding content inside the shared AppShell main landmark", () => {
    const { container } = render(
      <MarketingLayout>
        <LoginPanel />
      </MarketingLayout>,
    );

    expectSingleMainLandmark(container);
    expect(screen.getByRole("heading", { name: "Sign in to unlock your GitRank profile." })).toBeTruthy();
  });
});

function expectSingleMainLandmark(container: HTMLElement) {
  const mains = container.querySelectorAll("main");
  expect(mains).toHaveLength(1);
  expect(mains[0]?.getAttribute("id")).toBe("main-content");
  expect(mains[0]?.getAttribute("tabindex")).toBe("-1");
}
