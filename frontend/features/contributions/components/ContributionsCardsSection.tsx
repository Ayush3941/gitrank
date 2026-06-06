"use client";

import dynamic from "next/dynamic";
import { EmptyState } from "@/components/shared/EmptyState";
import { PanelLoadingPlaceholder } from "@/components/shared/PanelLoadingPlaceholder";
import { Button } from "@/components/ui/button";
import type { ContributionNarrative } from "@/lib/ai/abra-insights-types";
import type { Contribution } from "@/types/gitrank";

const ContributionList = dynamic(
  () =>
    import("@/features/contributions/components/ContributionList").then(
      (mod) => mod.ContributionList,
    ),
  {
    loading: () => <ContributionListPlaceholder />,
  },
);

export function ContributionsCardsSection({
  regionId,
  filteredRows,
  visibleRows,
  narratives,
  isFiltering,
  isFilteredNoResults,
  hasMoreRows,
  remainingRows,
  cardPageSize,
  useLiteCards,
  showDetails,
  onResetFilters,
  onShowMoreRows,
}: {
  regionId: string;
  filteredRows: Contribution[];
  visibleRows: Contribution[];
  narratives?: Record<string, ContributionNarrative>;
  isFiltering: boolean;
  isFilteredNoResults: boolean;
  hasMoreRows: boolean;
  remainingRows: number;
  cardPageSize: number;
  useLiteCards: boolean;
  showDetails: boolean;
  onResetFilters: () => void;
  onShowMoreRows: () => void;
}) {
  return (
    <section
      id="contributions-cards"
      data-scroll-target="true"
      className="render-opt-section space-y-4"
    >
      {filteredRows.length === 0 ? (
        <EmptyState
          eyebrow={isFilteredNoResults ? "Filter results" : "Contribution evidence"}
          title={
            isFilteredNoResults
              ? "No contributions match current filters."
              : "No merged PRs found yet."
          }
          description={
            isFilteredNoResults
              ? "Reset filters or widen search."
              : "Keep this page open while auto-sync loads recent PR evidence."
          }
          actionLabel={isFilteredNoResults ? "Reset filters" : "Open sync settings"}
          actionHref={isFilteredNoResults ? undefined : "/dashboard/settings"}
          onAction={isFilteredNoResults ? onResetFilters : undefined}
          analyticsTarget={
            isFilteredNoResults ? "contributions:empty-filtered" : "contributions:empty"
          }
        />
      ) : null}
      {filteredRows.length ? (
        <div className="space-y-4">
          <div id={regionId}>
            <ContributionList
              items={visibleRows}
              narratives={narratives}
              isBusy={isFiltering}
              totalCount={filteredRows.length}
              startPosition={1}
              useLiteCards={useLiteCards}
              showDetails={showDetails}
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {hasMoreRows ? (
              <Button
                type="button"
                variant="secondary"
                aria-controls={regionId}
                aria-label={`Show ${Math.min(cardPageSize, remainingRows)} more contribution cards. ${remainingRows} remaining.`}
                onClick={onShowMoreRows}
              >
                Show more cards ({remainingRows} left)
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContributionListPlaceholder() {
  return (
    <PanelLoadingPlaceholder
      label="Loading contribution cards"
      minHeightClassName="min-h-[18rem]"
      skeletons={[
        { className: "h-9 w-1/2" },
        { className: "h-24 w-full" },
        { className: "h-24 w-full" },
      ]}
    />
  );
}
