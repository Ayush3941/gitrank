import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CalendarClock, Flame, ShieldCheck } from "lucide-react";
import { ClampedText } from "@/components/shared/ClampedText";
import { GlowCard } from "@/components/shared/GlowCard";
import { RankBadge } from "@/components/shared/RankBadge";
import { formatDate, formatTimeUntil } from "@/lib/formatters";
import type { LeaderboardSnapshot } from "@/types/gitrank";

export function LeaderboardArena({
  snapshot,
  rowLimit,
  showDetails = true,
  viewMode = "full",
}: {
  snapshot: LeaderboardSnapshot;
  rowLimit?: number;
  showDetails?: boolean;
  viewMode?: "nearby" | "full";
}) {
  const rows = snapshot.rows;
  const currentUser =
    snapshot.currentUser ?? rows.find((row) => row.isCurrentUser) ?? null;
  const currentUserIndex = currentUser
    ? rows.findIndex((row) => row.username === currentUser.username)
    : -1;
  const localBracketRows =
    currentUser && currentUserIndex >= 0
      ? rows.slice(
          Math.max(0, currentUserIndex - 2),
          Math.min(rows.length, currentUserIndex + 3),
        )
      : [];
  const nextAboveRow =
    currentUserIndex > 0 ? rows[currentUserIndex - 1] : null;
  const nextAboveGap =
    currentUser && nextAboveRow
      ? Math.max(0, nextAboveRow.seasonXp - currentUser.seasonXp)
      : 0;
  const nearbyRows = buildNearbyRows(rows, localBracketRows);
  const sourceRows = viewMode === "nearby" ? nearbyRows : rows;
  const visibleRows =
    typeof rowLimit === "number" && rowLimit > 0
      ? sourceRows.slice(0, rowLimit)
      : sourceRows;

  return (
    <div className="grid gap-4">
      <GlowCard strong className="season-arena-card cyber-hero-shell overflow-hidden">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="cyber-data-badge inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-primary">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {snapshot.season.status} season
            </div>
            <h2 className="mt-4 break-anywhere text-2xl font-semibold text-white">{snapshot.season.name}</h2>
            <div className="mt-2">
              <ClampedText
                text={snapshot.season.explanation}
                lines={1}
                className="text-sm leading-7 text-muted"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[32rem]">
            <Metric label="Window" value={snapshot.season.windowLabel} />
            <Metric label="Formula" value={snapshot.season.scoringVersion} />
            <Metric label="Current rank" value={snapshot.currentUser ? `#${snapshot.currentUser.rank}` : "Unranked"} />
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <CompactRule icon={<Flame className="h-4 w-4" aria-hidden="true" />} label="Promotion" value={snapshot.season.promotionRule} />
          <CompactRule icon={<ShieldCheck className="h-4 w-4" aria-hidden="true" />} label="Reset" value={snapshot.season.resetRule} />
        </div>
        <ul role="list" className="mt-3 flex flex-wrap gap-2">
          <li>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs font-semibold">
              Season ends {formatDate(snapshot.season.endsAt)}
            </span>
          </li>
          <li>
            <span className="neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold">
              {formatTimeUntil(snapshot.season.endsAt)}
            </span>
          </li>
        </ul>
      </GlowCard>
      {viewMode === "nearby" ? (
        <div className="neon-surface rounded-[1rem] px-4 py-3">
          <p className="text-sm font-semibold text-white">Nearby rank view</p>
          <p className="mt-1 text-xs text-muted">
            Showing podium plus your local bracket to keep comparisons focused.
          </p>
        </div>
      ) : null}
      {currentUser && localBracketRows.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-white">
            Neighbor ranks
          </h2>
          <GlowCard className="space-y-4 border border-primary/22">
            <div className="neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold">
              {nextAboveRow
                ? `${nextAboveGap.toLocaleString("en-US")} XP to pass #${nextAboveRow.rank}`
                : "You lead this lane"}
            </div>
            <ol className="grid gap-2">
              {localBracketRows.map((row) => {
                const gapToCurrent = row.seasonXp - currentUser.seasonXp;
                const movementLabel = `${row.movement >= 0 ? "+" : ""}${row.movement}`;
                return (
                  <li
                    key={`local-${row.rank}-${row.username}`}
                    value={row.rank}
                    aria-posinset={row.rank}
                    aria-setsize={rows.length}
                    className={`list-none neon-surface flex flex-wrap items-center justify-between gap-3 px-4 py-3 ${
                      row.isCurrentUser ? "border-primary/42 bg-primary/10" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="break-anywhere text-sm font-semibold text-white">
                        #{row.rank} {row.displayName}
                        {row.isCurrentUser ? " (You)" : ""}
                      </p>
                      <p className="mt-1 break-anywhere text-xs text-muted">
                        @{row.username} • {row.title}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                        {row.seasonXp.toLocaleString("en-US")} XP
                      </span>
                      <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                        Move {movementLabel}
                      </span>
                      {!row.isCurrentUser && showDetails ? (
                        <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 font-semibold">
                          {gapToCurrent > 0
                            ? `+${gapToCurrent.toLocaleString("en-US")} vs you`
                            : `${Math.abs(gapToCurrent).toLocaleString("en-US")} behind you`}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </GlowCard>
        </div>
      ) : null}
      <ol className="grid gap-4">
        {visibleRows.map((row) => {
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
            row.isCurrentUser ? "border border-primary/22 bg-primary/8" : "",
            podiumTone,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <li
              key={`${row.rank}-${row.username}`}
              value={row.rank}
              className="list-none"
              aria-posinset={visibleRows.length < rows.length ? row.rank : undefined}
              aria-setsize={visibleRows.length < rows.length ? rows.length : undefined}
            >
              <GlowCard
                className={["render-opt-card", rowTone].filter(Boolean).join(" ")}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="neon-surface numeric-readout flex h-14 w-14 items-center justify-center rounded-3xl text-xl font-semibold text-white">
                      #{row.rank}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="break-anywhere text-xl font-semibold text-white">{row.displayName}</p>
                        <RankBadge rank={row.rankTier} />
                        {row.isCurrentUser ? (
                          <span className="neon-chip neon-chip-info rounded-full px-3 py-1 text-xs font-semibold">
                            You
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 break-anywhere text-sm text-muted">@{row.username} • {row.title}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Pill>{row.division}</Pill>
                        {row.promotionZone ? <Pill tone="success">Promotion zone</Pill> : null}
                        {row.demotionRisk ? <Pill tone="warning">Safety watch</Pill> : null}
                        {showDetails && row.rankEvidenceState ? <Pill tone="warning">Evidence {row.rankEvidenceState}</Pill> : null}
                      </div>
                      {showDetails ? (
                        <div className="mt-3 max-w-2xl">
                          <ClampedText
                            text={row.evidenceSummary}
                            lines={2}
                            className="text-sm leading-6 text-muted"
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Metric label="Season XP" value={row.seasonXp} />
                    <Metric label="To next rank" value={row.xpToNextRank ? `${row.xpToNextRank} XP` : "Lead"} />
                    {showDetails ? <Metric label="Total XP" value={row.totalXp} /> : null}
                    <Metric
                      label="Movement"
                      value={`${positive ? "+" : ""}${row.movement}`}
                      icon={positive ? <ArrowUpRight className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : <ArrowDownRight className="h-4 w-4 text-rose-100" aria-hidden="true" />}
                    />
                  </div>
                </div>
              </GlowCard>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function buildNearbyRows(
  allRows: LeaderboardSnapshot["rows"],
  localBracketRows: LeaderboardSnapshot["rows"],
) {
  const topRows = allRows.slice(0, 3);
  const merged = new Map<string, (typeof allRows)[number]>();
  for (const row of [...topRows, ...localBracketRows]) {
    merged.set(row.username, row);
  }
  return Array.from(merged.values()).sort((a, b) => a.rank - b.rank);
}

function CompactRule({
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
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <span aria-hidden="true">{icon}</span>
        {label}
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">{value}</p>
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
    neutral: "neon-chip neon-chip-muted text-muted",
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
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="numeric-readout mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        <span>{typeof value === "number" ? value.toLocaleString("en-US") : value}</span>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
    </div>
  );
}
