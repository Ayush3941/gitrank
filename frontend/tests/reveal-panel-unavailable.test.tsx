import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RevealPanelUnavailable } from "@/features/onboarding/components/RevealPanel";

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

describe("RevealPanelUnavailable", () => {
  it("uses recovery-focused copy without implementation details", () => {
    render(<RevealPanelUnavailable />);

    expect(
      screen.getByText(
        "GitRank needs a live authenticated profile snapshot before it can show your reveal. Connect GitHub or refresh your connection to generate one.",
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/static sample data/i)).toBeNull();
    expect(screen.getByRole("link", { name: /Connect GitHub/i }).getAttribute("href")).toBe(
      "/oauth/github/start?return_to=/dashboard",
    );
  });
});
