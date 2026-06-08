import { deduplicateContributionsByPullRequest } from "@/lib/presentation/contribution-dedup";
import { contributionDisplayConfig } from "@/lib/runtime/contribution-display-config";
import {
  buildContributionFocusCounts,
  buildContributionStatusCounts,
  CONTRIBUTION_DEFAULT_FILTER,
  CONTRIBUTION_DEFAULT_SORT,
  type ContributionFilterValue,
  type ContributionSortOption,
} from "@/lib/runtime/contribution-filter-policy";
import type { Contribution } from "@/types/gitrank";

export type ContributionShelfModelInput = {
  rows?: Contribution[];
  contributions?: Contribution[];
  highXPThreshold?: number;
  scoreHistoryCap?: number;
  filter: ContributionFilterValue;
  search: string;
  sort: ContributionSortOption;
  debouncedSearch: string;
  deferredFilter: ContributionFilterValue;
  deferredSearch: string;
  deferredSort: ContributionSortOption;
  visibleCardCount: number;
  useLiteCards: boolean;
  showCardDetails: boolean;
};

export function resolveContributionCardPageSize(useLiteCards: boolean): number {
  return useLiteCards
    ? contributionDisplayConfig.constrainedCardPageSize
    : contributionDisplayConfig.cardPageSize;
}

export function buildContributionShelfModel({
  rows = [],
  contributions = [],
  highXPThreshold,
  scoreHistoryCap,
  filter,
  search,
  sort,
  debouncedSearch,
  deferredFilter,
  deferredSearch,
  deferredSort,
  visibleCardCount,
  useLiteCards,
  showCardDetails,
}: ContributionShelfModelInput) {
  const contributionUniverse = deduplicateContributionsByPullRequest(contributions);
  const effectiveHighXPThreshold = Math.max(
    1,
    highXPThreshold ?? contributionDisplayConfig.highXPThreshold,
  );
  const statusCounts = buildContributionStatusCounts(contributionUniverse);
  const focusCounts = buildContributionFocusCounts(
    contributionUniverse,
    effectiveHighXPThreshold,
  );
  const cardPageSize = resolveContributionCardPageSize(useLiteCards);
  const effectiveShowCardDetails = showCardDetails && !useLiteCards;
  const effectiveHistoryCap = Math.max(
    1,
    Math.min(
      contributionDisplayConfig.renderHardCap,
      scoreHistoryCap ?? contributionDisplayConfig.renderHardCap,
    ),
  );
  const filteredRows = deduplicateContributionsByPullRequest(rows).slice(
    0,
    effectiveHistoryCap,
  );
  const visibleRows = filteredRows.slice(0, visibleCardCount);
  const hasMoreRows = filteredRows.length > visibleRows.length;
  const remainingRows = Math.max(0, filteredRows.length - visibleRows.length);
  const isFiltering =
    deferredFilter !== filter ||
    deferredSearch !== debouncedSearch ||
    debouncedSearch !== search ||
    deferredSort !== sort;
  const canReset =
    filter !== CONTRIBUTION_DEFAULT_FILTER ||
    search.trim().length > 0 ||
    sort !== CONTRIBUTION_DEFAULT_SORT;
  const isFilteredNoResults =
    canReset && contributions.length > 0 && filteredRows.length === 0;
  const abraContributionSample = filteredRows.slice(
    0,
    contributionDisplayConfig.abraSampleLimit,
  );

  return {
    contributionUniverse,
    effectiveHighXPThreshold,
    statusCounts,
    focusCounts,
    cardPageSize,
    effectiveShowCardDetails,
    effectiveHistoryCap,
    filteredRows,
    visibleRows,
    hasMoreRows,
    remainingRows,
    isFiltering,
    canReset,
    totalContributionEvidence: contributions.length,
    isFilteredNoResults,
    abraContributionSample,
  };
}
