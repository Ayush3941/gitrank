"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { contributionDisplayConfig } from "@/lib/runtime/contribution-display-config";
import { deduplicateContributionsByPullRequest } from "@/lib/presentation/contribution-dedup";
import type { Contribution } from "@/types/gitrank";
import type { ProfileViewData } from "@/types/gitrank";

type ContributionParams = {
  filter?: string;
  search?: string;
  sort?: "Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact";
};

type ContributionsQueryData = {
  rows: Contribution[];
  profile: ProfileViewData;
};

export function useContributions(params: ContributionParams) {
  return useQuery<ProfileViewData, Error, ContributionsQueryData>({
    queryKey: ["contributions", "profile"],
    retry: false,
    queryFn: getMyProfile,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    select: (profile) => ({
      rows: filterContributions(
        profile.user.contributions,
        params,
        profile.highXPThreshold ?? contributionDisplayConfig.highXPThreshold,
      ),
      profile,
    }),
  });
}

function filterContributions(
  rows: Contribution[],
  params: ContributionParams,
  highXPThreshold: number,
) {
  const deduplicatedRows = deduplicateContributionsByPullRequest(rows);
  const normalizedFilter = (params.filter ?? "All").toLowerCase();
  const term = (params.search ?? "").trim().toLowerCase();
  const sort = params.sort ?? "Newest";

  const filtered = deduplicatedRows.filter((item) => {
    const categoryMatch =
      normalizedFilter === "all" ||
      normalizedFilter === "high xp" ||
      normalizedFilter === item.status ||
      normalizedFilter === item.category.toLowerCase();

    const highXpMatch =
      normalizedFilter !== "high xp" ||
      item.xpEarned >= highXPThreshold;
    const searchMatch =
      term.length === 0 ||
      item.title.toLowerCase().includes(term) ||
      `${item.owner}/${item.repo}`.toLowerCase().includes(term);

    return categoryMatch && highXpMatch && searchMatch;
  });

  const sorters = {
    Newest: (a: Contribution, b: Contribution) =>
      new Date(b.mergedAt).getTime() - new Date(a.mergedAt).getTime(),
    "Highest XP": (a: Contribution, b: Contribution) => b.xpEarned - a.xpEarned,
    "Highest Difficulty": (a: Contribution, b: Contribution) =>
      b.difficultyScore - a.difficultyScore,
    "Highest Impact": (a: Contribution, b: Contribution) => b.impactScore - a.impactScore,
  };

  return [...filtered].sort(sorters[sort]);
}
