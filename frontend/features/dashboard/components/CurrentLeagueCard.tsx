import type { ReactNode } from "react";
import { TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import type { UserProfile } from "@/types/gitrank";

export function CurrentLeagueCard({ user }: { user: UserProfile }) {
  const positive = user.movement >= 0;
  const MovementIcon = positive ? TrendingUp : TrendingDown;

  return (
    <GlowCard className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs tracking-[0.24em] text-primary uppercase">Current league</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{user.level.rankTier}</h2>
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
