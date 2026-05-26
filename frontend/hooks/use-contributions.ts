"use client";

import { useQuery } from "@tanstack/react-query";
import { getMyProfile } from "@/lib/api/profile-api";
import { contributionDisplayConfig } from "@/lib/runtime/contribution-display-config";
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
  const deduplicatedRows = deduplicateContributions(rows);
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

function deduplicateContributions(rows: Contribution[]): Contribution[] {
  const byPullRequest = new Map<string, Contribution>();
  for (const row of rows) {
    const key = `${row.owner}/${row.repo}#${row.number}`;
    const current = byPullRequest.get(key);
    if (!current) {
      byPullRequest.set(key, {
        ...row,
        evidenceSignals: uniqueEvidenceSignals(row.evidenceSignals),
      });
      continue;
    }

    const shouldReplace =
      row.xpEarned > current.xpEarned ||
      (row.xpEarned === current.xpEarned &&
        new Date(row.mergedAt).getTime() > new Date(current.mergedAt).getTime());

    if (!shouldReplace) {
      byPullRequest.set(key, {
        ...current,
        evidenceSignals: uniqueEvidenceSignals([
          ...current.evidenceSignals,
          ...row.evidenceSignals,
        ]),
      });
      continue;
    }

    byPullRequest.set(key, {
      ...row,
      aiSummary: row.aiSummary.trim() ? row.aiSummary : current.aiSummary,
      evidenceSignals: uniqueEvidenceSignals([
        ...current.evidenceSignals,
        ...row.evidenceSignals,
      ]),
    });
  }
  return Array.from(byPullRequest.values());
}

function uniqueEvidenceSignals(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) {
      continue;
    }
    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    next.push(normalized);
  }
  return next;
}
