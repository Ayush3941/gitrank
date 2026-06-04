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
    expect(screen.queryByText(/Active:/)).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Contribution status filters" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "All" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Contribution sort options" })).toBeNull();
    expect(screen.getByRole("button", { name: "Advanced filters" })).toBeTruthy();
  }, 15_000);

  it("renders active-filter summary with removable search chip", () => {
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

    expect(screen.getByText("Active filters: 3")).toBeTruthy();
    expect(screen.getByText("Lane: Docs")).toBeTruthy();
    expect(screen.queryByText(/Order:/)).toBeNull();
    expect(screen.getByText("Search: very-specific-repo-name")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "Contribution sort options" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Remove Focus · Docs filter/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Remove Sort · Highest XP filter/i })).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Remove Search · very-specific-repo-name filter/i }),
    );
    expect(clearSearch).toHaveBeenCalledTimes(1);
  });

  it("falls back to onSearchChange when no onClearSearch handler is provided", () => {
    const onSearchChange = vi.fn();

    render(
      <ContributionFilters
        value="All"
        onValueChange={() => undefined}
        search="llvm"
        onSearchChange={onSearchChange}
        sort="Newest"
        onSortChange={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Clear contribution search/i }));
    expect(onSearchChange).toHaveBeenCalledWith("");
  });
});
