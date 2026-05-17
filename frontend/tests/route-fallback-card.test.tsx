import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RouteFallbackCard } from "@/components/shared/RouteFallbackCard";

describe("RouteFallbackCard", () => {
  it("renders action links with their labels", () => {
    render(
      <RouteFallbackCard
        eyebrow="Not found"
        title="Missing route"
        description="Route is unavailable."
        actions={[
          { label: "Dashboard", href: "/dashboard", variant: "secondary" },
          { label: "Home", href: "/" },
        ]}
      />,
    );

    expect(screen.getByText("Missing route")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Dashboard" }).getAttribute("href")).toBe("/dashboard");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("href")).toBe("/");
  });
});
