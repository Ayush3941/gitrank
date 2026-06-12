import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeDetailDialog } from "@/features/badges/components/BadgeDetailDialog";
import { buildBadge } from "@/tests/helpers/gitrank-fixtures";

describe("BadgeDetailDialog", () => {
  it("explains missing locked-badge evidence without generic no-PR copy", async () => {
    render(
      <BadgeDetailDialog
        badge={buildBadge({
          id: "locked-evidence",
          name: "Locked Evidence Badge",
          unlocked: false,
          evidencePrIds: [],
        })}
      >
        <button type="button">View locked badge</button>
      </BadgeDetailDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View locked badge" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    const evidenceStatus = screen.getByRole("note", {
      name: "Locked Evidence Badge evidence status",
    });
    expect(evidenceStatus.textContent).toContain("No qualifying PR evidence attached");
    expect(evidenceStatus.textContent).toContain("Open contributions to inspect scored PRs");
    expect(screen.getByRole("link", { name: "Open contributions" }).getAttribute("href")).toBe(
      "/dashboard/contributions",
    );
    expect(screen.getByRole("link", { name: "Open quests" }).getAttribute("href")).toBe(
      "/dashboard/quests",
    );
    expect(screen.queryByText("No qualifying PRs yet")).toBeNull();
  });

  it("distinguishes unlocked badges whose PR links are pending", async () => {
    render(
      <BadgeDetailDialog
        badge={buildBadge({
          id: "unlocked-pending-links",
          name: "Unlocked Evidence Badge",
          unlocked: true,
          evidencePrIds: [],
        })}
      >
        <button type="button">View unlocked badge</button>
      </BadgeDetailDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View unlocked badge" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    const evidenceStatus = screen.getByRole("note", {
      name: "Unlocked Evidence Badge evidence status",
    });
    expect(evidenceStatus.textContent).toContain("Badge unlocked, PR links pending");
    expect(evidenceStatus.textContent).toContain(
      "the current snapshot has not attached the qualifying PR IDs yet",
    );
  });

  it("renders repeated evidence PR chips when persisted evidence contains duplicates", async () => {
    render(
      <BadgeDetailDialog
        badge={buildBadge({
          id: "badge-evidence",
          name: "Evidence Badge",
          evidencePrIds: ["octo/api#42", "octo/api#42"],
        })}
      >
        <button type="button">View details</button>
      </BadgeDetailDialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "View details" }));

    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Earned date pending")).toBeTruthy();
    expect(screen.queryByText("Earned Never")).toBeNull();
    expect(screen.getAllByText("octo/api#42")).toHaveLength(2);
  });
});
