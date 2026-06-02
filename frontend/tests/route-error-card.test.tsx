import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RouteErrorCard } from "@/components/shared/RouteErrorCard";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("RouteErrorCard", () => {
  it("announces route error copy without folding recovery actions into the alert", () => {
    const reset = vi.fn();
    render(
      <RouteErrorCard
        eyebrow="Dashboard route error"
        title="Dashboard panel failed to render"
        description="Retry this panel."
        actions={[{ label: "Open settings", href: "/dashboard/settings" }]}
        analyticsTarget="dashboard:route-error"
        reset={reset}
      />,
    );

    const alert = screen.getByRole("alert");
    const retry = screen.getByRole("button", { name: "Retry route" });
    const fallback = screen.getByRole("link", { name: "Open settings" });
    expect(alert.textContent).toContain("Dashboard panel failed to render");
    expect(alert.contains(retry)).toBe(false);
    expect(alert.contains(fallback)).toBe(false);

    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
