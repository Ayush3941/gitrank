import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";

describe("ContributionFilters", () => {
  it("shows explicit no-active-filters state for default controls", () => {
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

    expect(screen.getByText("No active filters")).toBeTruthy();
  });

  it("renders removable active chips and fires clear handlers", () => {
    const clearCategory = vi.fn();
    const clearSearch = vi.fn();
    const clearSort = vi.fn();

    render(
      <ContributionFilters
        value="Docs"
        onValueChange={() => undefined}
        search="very-specific-repo-name"
        onSearchChange={() => undefined}
        sort="Highest XP"
        onSortChange={() => undefined}
        onClearCategory={clearCategory}
        onClearSearch={clearSearch}
        onClearSort={clearSort}
      />,
    );

    expect(screen.getByText("Category: Docs")).toBeTruthy();
    expect(screen.getByText("Search: very-specific-repo-name")).toBeTruthy();
    expect(screen.getByText("Sort: Highest XP")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remove category filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove search filter" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove sort filter" }));

    expect(clearCategory).toHaveBeenCalledTimes(1);
    expect(clearSearch).toHaveBeenCalledTimes(1);
    expect(clearSort).toHaveBeenCalledTimes(1);
  });
});
