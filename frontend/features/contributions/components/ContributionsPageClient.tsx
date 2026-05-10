"use client";

import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { ContributionFilters } from "@/features/contributions/components/ContributionFilters";
import { ContributionList } from "@/features/contributions/components/ContributionList";
import { useContributions } from "@/hooks/use-contributions";
import type { PreviewMode } from "@/types/gitrank";

const filterMap: Record<string, string> = {
  All: "All",
  Merged: "merged",
  Open: "open",
  Docs: "Documentation",
  Tests: "Testing",
  "Bug Fixes": "Bug Fix",
  Infra: "Infrastructure",
  Security: "Security",
  Performance: "Performance",
  "High XP": "High XP",
};

export function ContributionsPageClient({ preview }: { preview?: PreviewMode }) {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"Newest" | "Highest XP" | "Highest Difficulty" | "Highest Impact">("Newest");
  const { data, isLoading, isError } = useContributions({
    filter: filterMap[filter],
    search,
    sort,
    preview,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contribution drill-down"
        description="Filter by category, status, and score to inspect the work that actually moved your reputation."
      />
      <ContributionFilters
        value={filter}
        onValueChange={setFilter}
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
      />
      {isLoading ? <LoadingState message="Checking review depth and PR intensity..." /> : null}
      {isError ? (
        <ErrorState
          title="Contribution sync failed"
          description="GitHub rate limit reached or the PR analysis cache expired. Retry or inspect the last synced profile snapshot."
        />
      ) : null}
      {!isLoading && !isError && data?.length === 0 ? (
        <EmptyState
          title="No merged PRs found yet."
          description="Start with a small real contribution: docs, tests, or a bug fix. Meaningful work unlocks the shelf."
          actionLabel="Review quest queue"
        />
      ) : null}
      {!isLoading && !isError && data?.length ? <ContributionList items={data} /> : null}
    </div>
  );
}
