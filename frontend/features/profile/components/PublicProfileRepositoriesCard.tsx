import { Award } from "lucide-react";
import { CompactEmptyState } from "@/components/shared/CompactEmptyState";
import { GlowCard } from "@/components/shared/GlowCard";
import { formatPluralCount, formatXp } from "@/lib/formatters";
import { buildStableRenderRows } from "@/lib/presentation/render-identity";
import type { ProfileRepositorySummary } from "@/types/gitrank";

export function PublicProfileRepositoriesCard({
  repositories,
}: {
  repositories: ProfileRepositorySummary[];
}) {
  const repositoryRows = buildStableRenderRows(
    repositories.slice(0, 3),
    (repository) => `${repository.owner}/${repository.repo}:${repository.totalXp}:${repository.contributionCount}`,
  );

  return (
    <GlowCard className="space-y-5">
      <div className="inline-flex rounded-[var(--radius-universal)] bg-primary/12 p-3 text-primary">
        <Award className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-xs font-medium text-primary">Repositories</p>
        <h2 className="mt-2 text-xl font-semibold text-white">Top repositories</h2>
      </div>
      <div className="space-y-3">
        {repositories.length === 0 ? (
          <CompactEmptyState
            title="Repository signal needs PR evidence"
            description="Top repositories appear after public scored PR evidence is synced."
            primaryAction={{
              label: "Open contributions",
              href: "/dashboard/contributions",
              prefetchMode: "never",
            }}
          />
        ) : (
          <ul role="list" className="space-y-3">
            {repositoryRows.map(({ renderId, item: repository }, index) => (
              <li
                key={renderId}
                className="render-opt-card neon-surface rounded-[var(--radius-universal)] px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="neon-chip neon-chip-muted inline-flex min-w-10 justify-center rounded-full px-2 py-1 text-xs font-semibold">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="break-anywhere font-medium text-white">{repository.name}</p>
                      <p className="break-anywhere text-sm text-muted">
                        {formatPluralCount(repository.contributionCount, "scored contribution")}
                        {repository.primarySkill ? ` \u2022 ${repository.primarySkill}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-medium text-primary">XP</p>
                    <p className="mt-1 text-lg font-semibold text-white">
                      {formatXp(repository.totalXp)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlowCard>
  );
}
