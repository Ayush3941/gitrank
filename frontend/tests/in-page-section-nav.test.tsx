import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InPageSectionNav } from "@/components/shared/InPageSectionNav";

describe("InPageSectionNav", () => {
  beforeEach(() => {
    window.location.hash = "";
  });

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

  it("normalizes and deduplicates section ids before rendering anchor links", () => {
    render(
      <InPageSectionNav
        sections={[
          { id: " overview ", label: "Overview" },
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
    expect(overviewLink.getAttribute("aria-current")).toBe("location");
    expect(evidenceLink.getAttribute("aria-current")).toBeNull();
  });

  it("updates the current location marker after in-page navigation", async () => {
    window.location.hash = "#evidence";
    render(
      <InPageSectionNav
        sections={[
          { id: "overview", label: "Overview" },
          { id: "evidence", label: "Evidence" },
        ]}
      />,
    );

    const overviewLink = screen.getByRole("link", { name: "Overview" });
    const evidenceLink = screen.getByRole("link", { name: "Evidence" });
    await waitFor(() => {
      expect(evidenceLink.getAttribute("aria-current")).toBe("location");
    });

    window.location.hash = "#overview";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => {
      expect(overviewLink.getAttribute("aria-current")).toBe("location");
      expect(evidenceLink.getAttribute("aria-current")).toBeNull();
    });

    window.location.hash = "#evidence";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await waitFor(() => {
      expect(evidenceLink.getAttribute("aria-current")).toBe("location");
    });
  });
});
