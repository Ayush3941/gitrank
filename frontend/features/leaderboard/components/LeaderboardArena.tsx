import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Flame, ShieldCheck } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import type { LeaderboardSnapshot } from "@/types/gitrank";

export function LeaderboardArena({ snapshot }: { snapshot: LeaderboardSnapshot }) {
  const rows = snapshot.rows;

  return (
    <div className="grid gap-4">
      <GlowCard strong className="season-arena-card cyber-hero-shell overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold tracking-[0.22em] text-primary uppercase">
              <CalendarClock className="h-3.5 w-3.5" />
              {snapshot.season.status} season
            </div>
            <h2 className="mt-4 break-words text-3xl font-semibold text-white">{snapshot.season.name}</h2>
            <p className="mt-2 break-words text-sm leading-7 text-slate-200/82">{snapshot.season.explanation}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
            <Metric label="Window" value={snapshot.season.windowLabel} />
            <Metric label="Formula" value={snapshot.season.scoringVersion} />
            <Metric label="Current rank" value={snapshot.currentUser ? `#${snapshot.currentUser.rank}` : "Unranked"} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <Rule icon={<Flame className="h-4 w-4" />} label="Promotion" value={snapshot.season.promotionRule} />
          <Rule icon={<ShieldCheck className="h-4 w-4" />} label="Reset" value={snapshot.season.resetRule} />
        </div>
      </GlowCard>
      {rows.map((row) => {
        const positive = row.movement >= 0;
        const podiumTone =
          row.rank === 1
            ? "cyber-podium-gold"
            : row.rank === 2
              ? "cyber-podium-silver"
                : row.rank === 3
                ? "cyber-podium-bronze"
                : "";
        const rowTone = [
          "cyber-sheen",
          row.isCurrentUser ? "ring-glow border border-primary/22 bg-primary/8" : "",
          podiumTone,
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <GlowCard
            key={`${row.rank}-${row.username}`}
            className={["render-opt-card", rowTone].filter(Boolean).join(" ")}
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <div className="neon-surface numeric-readout flex h-14 w-14 items-center justify-center rounded-3xl text-xl font-semibold text-white">
                  #{row.rank}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="break-words text-xl font-semibold text-white">{row.displayName}</p>
                    <RankBadge rank={row.rankTier} />
                    {row.isCurrentUser ? (
                      <span className="neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold">
                        You
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-sm text-muted">@{row.username} • {row.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill>{row.division}</Pill>
                    {row.promotionZone ? <Pill tone="success">Promotion zone</Pill> : null}
                    {row.demotionRisk ? <Pill tone="warning">Safety watch</Pill> : null}
                    {row.rankEvidenceState ? <Pill tone="warning">Evidence {row.rankEvidenceState}</Pill> : null}
                  </div>
                  <p className="mt-3 max-w-2xl break-words text-sm leading-6 text-slate-200/76">{row.evidenceSummary}</p>
                  <p className="mt-2 max-w-2xl text-xs text-muted">
                    Snapshot {row.profileSnapshotVersion || "unknown"} / Score {row.scoreFormulaVersion}
                    {row.sourceWatermark ? ` / Watermark ${new Date(row.sourceWatermark).toLocaleDateString()}` : ""}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Season XP" value={row.seasonXp} />
                <Metric label="To next rank" value={row.xpToNextRank ? `${row.xpToNextRank} XP` : "Lead"} />
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

function Rule({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="neon-surface rounded-[1.5rem] px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-primary uppercase">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-sm leading-6 text-slate-200/80">{value}</p>
    </div>
  );
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning";
}) {
  const toneClass = {
    neutral: "neon-chip neon-chip-muted text-slate-200",
    success: "neon-chip neon-chip-success",
    warning: "neon-chip neon-chip-warning",
  }[tone];

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {children}
    </span>
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
    <div className="neon-metric rounded-3xl px-4 py-3">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <div className="numeric-readout mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        <span>{value}</span>
        {icon}
      </div>
    </div>
  );
}
