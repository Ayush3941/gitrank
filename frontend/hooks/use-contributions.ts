"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
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
  return useQuery<ContributionsQueryData>({
    queryKey: ["contributions", params],
    queryFn: async () => {
      const profile = await getMyProfile();
      return {
        rows: filterContributions(profile.user.contributions, params),
        profile,
      };
    },
  });
}

function filterContributions(rows: Contribution[], params: ContributionParams) {
  const normalizedFilter = (params.filter ?? "All").toLowerCase();
  const term = (params.search ?? "").trim().toLowerCase();
  const sort = params.sort ?? "Newest";

  const filtered = rows.filter((item) => {
    const categoryMatch =
      normalizedFilter === "all" ||
      normalizedFilter === "high xp" ||
      normalizedFilter === item.status ||
      normalizedFilter === item.category.toLowerCase();

    const highXpMatch = normalizedFilter !== "high xp" || item.xpEarned >= 500;
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
