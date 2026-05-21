import { Minus, Plus } from "lucide-react";
import { GlowCard } from "@/components/shared/GlowCard";
import type { UserProfile } from "@/types/gitrank";

export function ScoreExplanationCard({ user }: { user: UserProfile }) {
  return (
    <GlowCard className="space-y-5">
      <div>
        <p className="text-xs font-medium text-primary">Why your score changed this week</p>
        <h2 className="mt-2 text-xl font-semibold text-white">XP sources and penalties</h2>
      </div>
      <div className="space-y-3">
        {user.scoreChanges.map((change, index) => {
          const positive = change.type === "gain";
          const Icon = positive ? Plus : Minus;
          return (
            <div key={`${change.label}-${index}`} className="neon-surface flex items-start gap-4 rounded-[1.75rem] p-4">
              <div className={`rounded-2xl p-2 ${positive ? "bg-emerald-400/12 text-emerald-200" : "bg-rose-400/12 text-rose-100"}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-medium text-white">{change.label}</p>
                  <p className={`text-sm font-semibold ${positive ? "text-emerald-200" : "text-rose-100"}`}>
                    {positive ? "+" : ""}
                    {change.deltaXp} XP
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">{formatScoreChangeReason(change.reason)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </GlowCard>
  );
}

function formatScoreChangeReason(reason: string): string {
  let value = reason.trim();
  if (!value) {
    return "Score replay metadata is available for this entry.";
  }
  const lower = value.toLowerCase();
  if (lower.startsWith("summary=[")) {
    const endBracket = value.lastIndexOf("]");
    if (endBracket > "summary=[".length) {
      value = value.slice("summary=[".length, endBracket);
    } else {
      value = value.slice("summary=[".length);
    }
  }
  value = value
    .replace(/\bscore version\s+[a-z0-9._-]+/gi, "Deterministic scoring replay")
    .replace(/\bfinal xp\s+\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) {
    return "Deterministic scoring replay metadata was recorded for this contribution.";
  }
  const sentence = value.charAt(0).toUpperCase() + value.slice(1);
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}
