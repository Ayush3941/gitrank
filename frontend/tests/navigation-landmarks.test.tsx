import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardRouteNav } from "@/components/shared/DashboardRouteNav";
import { MarketingLayout } from "@/components/shared/MarketingLayout";
import { OnboardingStepper } from "@/features/onboarding/components/OnboardingStepper";

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

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/contributions",
}));

describe("navigation landmarks", () => {
  it("names the shared dashboard, marketing, and onboarding nav regions", () => {
    render(
      <div>
        <DashboardRouteNav />
        <MarketingLayout>
          <OnboardingStepper currentStep="connect" />
        </MarketingLayout>
      </div>,
    );

    expect(screen.getByRole("navigation", { name: "Dashboard routes" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Marketing routes" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Onboarding progress" })).toBeTruthy();
  });
});
