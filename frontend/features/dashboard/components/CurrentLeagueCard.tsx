import type { ReactNode } from "react";
import { CalendarClock, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatSignedNumber, formatTimeUntil, formatXp, formatXpLabel, toRatioPercent } from "@/lib/formatters";
import { buildEvidenceSignalChips } from "@/lib/presentation/evidence-signal";
import type { UserProfile } from "@/types/gitrank";

export function CurrentLeagueCard({ user }: { user: UserProfile }) {
  const positive = user.movement >= 0;
  const MovementIcon = positive ? TrendingUp : TrendingDown;
  const evidenceSignals = buildEvidenceSignalChips(user.rankProgress.evidenceSignals, 3);

  return (
    <GlowCard className="season-arena-card space-y-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary">Current league</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{user.level.rankTier}</h2>
          <p className="mt-2 text-sm text-muted">{user.rankProgress.season.windowLabel}</p>
        </div>
        <div className="neon-tile rounded-[var(--radius-universal)] p-3 text-primary">
          <Trophy className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          label="Position"
          value={user.leaguePosition > 0 ? `#${user.leaguePosition}` : "Unranked"}
        />
        <Metric label="Weekly XP" value={formatXp(user.weeklyXp)} />
        <Metric
          label="Movement"
          value={formatSignedNumber(user.movement)}
          icon={<MovementIcon className="h-4 w-4" aria-hidden="true" />}
        />
      </div>
      <div className="neon-tile rounded-[var(--radius-universal)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-muted">Promotion</p>
            <p className="mt-2 text-sm text-muted">
              {user.rankProgress.nextTier
                ? `${formatXpLabel(user.rankProgress.xpToNextTier)} to ${user.rankProgress.nextTier}`
                : "Top tier"}
            </p>
          </div>
          <div className="neon-chip neon-chip-info inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
            {user.rankProgress.season.status}
          </div>
        </div>
        <Progress
          className="mt-4"
          aria-label="Season XP progress toward next rank tier"
          value={toRatioPercent(
            user.rankProgress.seasonXp /
              Math.max(1, user.rankProgress.seasonXp + user.rankProgress.xpToNextTier),
          )}
        />
        <p className="mt-3 text-xs text-muted">
          Ends {formatDate(user.rankProgress.season.endsAt)} •{" "}
          {formatTimeUntil(user.rankProgress.season.endsAt)}
        </p>
      </div>
      <ul role="list" className="flex flex-wrap gap-2">
        {evidenceSignals.map((signal) => (
          <li key={`${user.level.rankTier}-${signal}`}>
            <span className="neon-chip neon-chip-muted rounded-full px-3 py-1 text-xs">
              {signal}
            </span>
          </li>
        ))}
      </ul>
    </GlowCard>
  );
}

function Metric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="neon-metric rounded-[var(--radius-universal)] p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <div className="numeric-readout mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        <span>{value}</span>
        {icon}
      </div>
    </div>
  );
}
