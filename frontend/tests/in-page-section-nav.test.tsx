import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";

describe("InPageSectionNav", () => {
  it("does not render when fewer than two valid sections exist", () => {
    const { container } = render(
      <InPageSectionNav
        sections={[
          { id: "only-section", label: "Only section" },
        ]}
      />,
    );

    expect(container.firstChild).toBeNull();
  });

  it("deduplicates section ids and renders anchor links", () => {
    render(
      <InPageSectionNav
        sections={[
          { id: "overview", label: "Overview" },
          { id: "overview", label: "Duplicate overview" },
          { id: "evidence", label: "Evidence" },
          { id: "   ", label: "Ignored blank" },
        ]}
      />,
    );

    const nav = screen.getByRole("navigation", { name: /on this page/i });
    expect(nav).not.toBeNull();
    expect(screen.getByText("2 sections")).not.toBeNull();

    const overviewLink = screen.getByRole("link", { name: "Overview" });
    const evidenceLink = screen.getByRole("link", { name: "Evidence" });
    expect(overviewLink.getAttribute("href")).toBe("#overview");
    expect(evidenceLink.getAttribute("href")).toBe("#evidence");
  });
});
