import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BadgeGrid } from "@/features/badges/components/BadgeGrid";
import { buildBadge } from "@/tests/helpers/gitrank-fixtures";

describe("BadgeGrid", () => {
  it("does not render ambiguous earned-date copy for unlocked badges missing timestamps", () => {
    render(<BadgeGrid badges={[buildBadge({ id: "missing-earned-date" })]} />);

    expect(screen.getByText("Earned date pending")).toBeTruthy();
    expect(screen.queryByText("Earned Never")).toBeNull();
  });
});
