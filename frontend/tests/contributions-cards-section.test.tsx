import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContributionsCardsSection } from "@/features/contributions/components/ContributionsCardsSection";
import { buildContribution } from "@/tests/helpers/contribution-fixture";

describe("ContributionsCardsSection", () => {
  it("renders filtered empty state with reset action", () => {
    const onResetFilters = vi.fn();

    render(
      <ContributionsCardsSection
        regionId="contribution-cards"
        filteredRows={[]}
        visibleRows={[]}
        isFiltering={false}
        isFilteredNoResults
        hasMoreRows={false}
        remainingRows={0}
        cardPageSize={10}
        useLiteCards={false}
        showDetails={false}
        onResetFilters={onResetFilters}
        onShowMoreRows={vi.fn()}
      />,
    );

    expect(screen.getByText("No contributions match current filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reset filters" }));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
  });

  it("renders visible rows and delegates show-more pagination", async () => {
    const onShowMoreRows = vi.fn();

    render(
      <ContributionsCardsSection
        regionId="contribution-cards"
        filteredRows={[buildContribution(), buildContribution({ id: "contribution-2", number: 43 })]}
        visibleRows={[buildContribution()]}
        isFiltering={false}
        isFilteredNoResults={false}
        hasMoreRows
        remainingRows={1}
        cardPageSize={10}
        useLiteCards={false}
        showDetails={false}
        onResetFilters={vi.fn()}
        onShowMoreRows={onShowMoreRows}
      />,
    );

    expect(await screen.findByText("Semantic signal")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Show 1 contribution card. 1 contribution card remaining.",
      }),
    );
    expect(onShowMoreRows).toHaveBeenCalledTimes(1);
  });
});
