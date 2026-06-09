import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeDetailDialog } from "@/features/badges/components/BadgeDetailDialog";
import { buildBadge } from "@/tests/helpers/gitrank-fixtures";

describe("BadgeDetailDialog", () => {
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
    expect(screen.getAllByText("octo/api#42")).toHaveLength(2);
  });
});
