import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";

describe("Button primitive", () => {
  it("defaults plain buttons to type button", () => {
    render(<Button>Open panel</Button>);

    expect(screen.getByRole("button", { name: "Open panel" }).getAttribute("type")).toBe("button");
  });

  it("preserves explicit submit buttons for forms", () => {
    render(<Button type="submit">Save settings</Button>);

    expect(screen.getByRole("button", { name: "Save settings" }).getAttribute("type")).toBe("submit");
  });

  it("does not leak button type attributes onto polymorphic links", () => {
    render(
      <Button asChild>
        <a href="/dashboard">Dashboard</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Dashboard" });
    expect(link.getAttribute("href")).toBe("/dashboard");
    expect(link.hasAttribute("type")).toBe(false);
  });
});
