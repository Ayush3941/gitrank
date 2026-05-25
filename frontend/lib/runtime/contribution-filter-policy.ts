import type { Contribution } from "@/types/gitrank";

export const CONTRIBUTION_DEFAULT_FILTER = "All" as const;
export const CONTRIBUTION_DEFAULT_SORT = "Newest" as const;

export const contributionStatusFilters = ["All", "Merged", "Open"] as const;
export const contributionFocusFilters = [
  "Any",
  "Docs",
  "Tests",
  "Bug Fixes",
  "Infra",
  "Security",
  "Performance",
  "High XP",
] as const;
export const contributionSortOptions = [
  "Newest",
  "Highest XP",
  "Highest Difficulty",
  "Highest Impact",
] as const;

export type ContributionStatusFilter = (typeof contributionStatusFilters)[number];
export type ContributionFocusFilter = (typeof contributionFocusFilters)[number];
export type ContributionSortOption = (typeof contributionSortOptions)[number];
export type ContributionFilterValue =
  | ContributionStatusFilter
  | ContributionFocusFilter;

const focusCategoryMatchers: Record<
  Exclude<ContributionFocusFilter, "Any" | "High XP">,
  (row: Contribution) => boolean
> = {
  Docs: (row) => row.category === "Documentation",
  Tests: (row) => row.category === "Testing",
  "Bug Fixes": (row) => row.category === "Bug Fix",
  Infra: (row) => row.category === "Infrastructure",
  Security: (row) => row.category === "Security",
  Performance: (row) => row.category === "Performance",
};

export function toContributionQueryFilter(value: ContributionFilterValue): string {
  switch (value) {
    case "Merged":
      return "merged";
    case "Open":
      return "open";
    case "Docs":
      return "Documentation";
    case "Tests":
      return "Testing";
    case "Bug Fixes":
      return "Bug Fix";
    case "Infra":
      return "Infrastructure";
    case "Security":
      return "Security";
    case "Performance":
      return "Performance";
    case "High XP":
      return "High XP";
    case "Any":
    case "All":
    default:
      return "All";
  }
}

export function resolveContributionStatusFilter(value: string): ContributionStatusFilter {
  if (value === "Merged" || value === "Open") {
    return value;
  }
  return "All";
}

export function resolveContributionFocusFilter(value: string): ContributionFocusFilter {
  if (
    value === "Docs" ||
    value === "Tests" ||
    value === "Bug Fixes" ||
    value === "Infra" ||
    value === "Security" ||
    value === "Performance" ||
    value === "High XP"
  ) {
    return value;
  }
  return "Any";
}

export function isContributionSortOption(value: string): value is ContributionSortOption {
  return contributionSortOptions.includes(value as ContributionSortOption);
}

export function buildContributionStatusCounts(contributions: Contribution[]): Record<ContributionStatusFilter, number> {
  return {
    All: contributions.length,
    Merged: contributions.filter((row) => row.status === "merged").length,
    Open: contributions.filter((row) => row.status === "open").length,
  };
}

export function buildContributionFocusCounts(
  contributions: Contribution[],
  highXPThreshold: number,
): Record<ContributionFocusFilter, number> {
  return {
    Any: contributions.length,
    Docs: contributions.filter(focusCategoryMatchers.Docs).length,
    Tests: contributions.filter(focusCategoryMatchers.Tests).length,
    "Bug Fixes": contributions.filter(focusCategoryMatchers["Bug Fixes"]).length,
    Infra: contributions.filter(focusCategoryMatchers.Infra).length,
    Security: contributions.filter(focusCategoryMatchers.Security).length,
    Performance: contributions.filter(focusCategoryMatchers.Performance).length,
    "High XP": contributions.filter((row) => row.xpEarned >= highXPThreshold).length,
  };
}
