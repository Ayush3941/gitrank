import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";

describe("ContributionFilters", () => {
  it("shows no removable chips for default controls", () => {
    render(
      <ContributionFilters
        value="All"
        onValueChange={() => undefined}
        search=""
        onSearchChange={() => undefined}
        sort="Newest"
        onSortChange={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: /Remove .* filter/i })).toBeNull();
    expect(screen.getByRole("tablist", { name: "Contribution status filters" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("tablist", { name: "Contribution sort options" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Newest" })).toBeTruthy();
  });

  it("renders category and sort summaries with removable search chip", () => {
    const clearSearch = vi.fn();

    render(
      <ContributionFilters
        value="Docs"
        onValueChange={() => undefined}
        search="very-specific-repo-name"
        onSearchChange={() => undefined}
        sort="Highest XP"
        onSortChange={() => undefined}
        onClearSearch={clearSearch}
      />,
    );

    expect(screen.getByText("Active filters")).toBeTruthy();
    expect(screen.getByText("Category: Docs")).toBeTruthy();
    expect(screen.getByText("Sort: Highest XP")).toBeTruthy();
    expect(screen.getByText("Search · very-specific-repo-name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remove Focus · Docs filter/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove Sort · Highest XP filter/i })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Remove Search · very-specific-repo-name filter/i }),
    );
    expect(clearSearch).toHaveBeenCalledTimes(1);
  });
});
