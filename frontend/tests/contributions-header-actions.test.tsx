import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContributionsHeaderActions } from "@/features/contributions/components/ContributionsHeaderActions";
import { downloadContributionsCSV } from "@/features/contributions/lib/contribution-csv-export";
import { buildContribution } from "@/tests/helpers/contribution-fixture";

vi.mock("@/features/contributions/lib/contribution-csv-export", () => ({
  downloadContributionsCSV: vi.fn(),
}));

const downloadContributionsCSVMock = vi.mocked(downloadContributionsCSV);

describe("ContributionsHeaderActions", () => {
  beforeEach(() => {
    downloadContributionsCSVMock.mockClear();
  });

  it("shows evidence state and routes the detail toggle", () => {
    const onToggleCardDetails = vi.fn();

    render(
      <ContributionsHeaderActions
        cardsRegionId="contribution-cards"
        rows={[buildContribution()]}
        showFreshness={false}
        syncState="partially_synced"
        useLiteCards={false}
        showCardDetails={false}
        onToggleCardDetails={onToggleCardDetails}
        onExportStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Partially synced")).toBeTruthy();
    const toggle = screen.getByRole("button", { name: "Show details" });
    expect(toggle.getAttribute("aria-controls")).toBe("contribution-cards");
    fireEvent.click(toggle);
    expect(onToggleCardDetails).toHaveBeenCalledTimes(1);
  });

  it("hides the detail toggle in lite mode and reports an empty export", () => {
    const onExportStatusChange = vi.fn();

    render(
      <ContributionsHeaderActions
        cardsRegionId="contribution-cards"
        rows={[]}
        showFreshness={false}
        syncState="synced"
        useLiteCards
        showCardDetails={false}
        onToggleCardDetails={vi.fn()}
        onExportStatusChange={onExportStatusChange}
      />,
    );

    expect(screen.queryByRole("button", { name: "Show details" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(downloadContributionsCSVMock).not.toHaveBeenCalled();
    expect(onExportStatusChange).toHaveBeenCalledWith(
      "No contribution rows are available to export.",
    );
  });

  it("downloads populated rows and reports exported count", () => {
    const row = buildContribution();
    const onExportStatusChange = vi.fn();

    render(
      <ContributionsHeaderActions
        cardsRegionId="contribution-cards"
        rows={[row]}
        showFreshness={false}
        syncState="synced"
        useLiteCards={false}
        showCardDetails
        onToggleCardDetails={vi.fn()}
        onExportStatusChange={onExportStatusChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(downloadContributionsCSVMock).toHaveBeenCalledWith([row]);
    expect(onExportStatusChange).toHaveBeenCalledWith(
      "Exported 1 contribution rows as CSV.",
    );
  });
});
