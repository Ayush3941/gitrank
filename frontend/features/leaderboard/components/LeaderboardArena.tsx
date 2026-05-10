import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import type { LeaderboardEntry } from "@/types/gitrank";

export function LeaderboardArena({ rows }: { rows: LeaderboardEntry[] }) {
  return (
    <div className="grid gap-4">
      {rows.map((row) => {
        const positive = row.movement >= 0;
        return (
          <GlowCard
            key={`${row.rank}-${row.username}`}
            className={row.isCurrentUser ? "border border-primary/22 bg-primary/8" : undefined}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-3xl border border-white/8 bg-white/5 text-xl font-semibold text-white">
                  #{row.rank}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xl font-semibold text-white">{row.displayName}</p>
                    <RankBadge rank={row.rankTier} />
                    {row.isCurrentUser ? (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        You
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted">@{row.username} • {row.title}</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric label="Weekly XP" value={row.weeklyXp} />
                <Metric label="Total XP" value={row.totalXp} />
                <Metric
                  label="Movement"
                  value={`${positive ? "+" : ""}${row.movement}`}
                  icon={positive ? <ArrowUpRight className="h-4 w-4 text-emerald-300" /> : <ArrowDownRight className="h-4 w-4 text-rose-100" />}
                />
              </div>
            </div>
          </GlowCard>
        );
      })}
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        <span>{value}</span>
        {icon}
      </div>
    </div>
  );
}
