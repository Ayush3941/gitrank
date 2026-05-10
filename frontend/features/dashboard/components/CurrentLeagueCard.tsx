import type { ReactNode } from "react";
import { CalendarClock, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import { Progress } from "@/components/ui/progress";
import type { UserProfile } from "@/types/gitrank";

export function CurrentLeagueCard({ user }: { user: UserProfile }) {
  const positive = user.movement >= 0;
  const MovementIcon = positive ? TrendingUp : TrendingDown;

  return (
    <GlowCard className="season-arena-card space-y-5 overflow-hidden">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Current league</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{user.level.rankTier}</h2>
          <p className="mt-2 text-sm text-muted">{user.rankProgress.season.windowLabel}</p>
        </div>
        <div className="rounded-3xl bg-white/6 p-3 text-primary">
          <Trophy className="h-5 w-5" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric label="Position" value={`#${user.leaguePosition}`} />
        <Metric label="Weekly XP" value={`${user.weeklyXp}`} />
        <Metric label="Movement" value={`${positive ? "+" : ""}${user.movement}`} icon={<MovementIcon className="h-4 w-4" />} />
      </div>
      <div className="rounded-[1.75rem] border border-white/8 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.24em] text-muted uppercase">Promotion track</p>
            <p className="mt-2 text-sm text-slate-200">
              {user.rankProgress.nextTier
                ? `${user.rankProgress.xpToNextTier.toLocaleString("en-US")} XP to ${user.rankProgress.nextTier}`
                : "Highest tier reached"}
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CalendarClock className="h-3.5 w-3.5" />
            {user.rankProgress.season.status}
          </div>
        </div>
        <Progress
          className="mt-4"
          value={Math.min(
            100,
            Math.round(
              (user.rankProgress.seasonXp /
                Math.max(1, user.rankProgress.seasonXp + user.rankProgress.xpToNextTier)) *
                100,
            ),
          )}
        />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <p className="text-xs leading-5 text-muted">{user.rankProgress.season.promotionRule}</p>
          <p className="text-xs leading-5 text-muted">{user.rankProgress.season.resetRule}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {user.rankProgress.evidenceSignals.map((signal) => (
          <span key={signal} className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs text-slate-200">
            {signal}
          </span>
        ))}
      </div>
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
    <div className="rounded-3xl border border-white/8 bg-white/5 p-4">
      <p className="text-xs tracking-[0.24em] text-muted uppercase">{label}</p>
      <div className="mt-2 flex items-center gap-2 text-xl font-semibold text-white">
        <span>{value}</span>
        {icon}
      </div>
    </div>
  );
}
