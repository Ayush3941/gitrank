import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";

export function RankBadge({ rank, className }: { rank: string; className?: string }) {
  return (
    <div
      className={cn(
        "hud-pill inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium text-amber-100",
        className,
      )}
    >
      <Crown className="h-4 w-4" aria-hidden="true" />
      <span>{rank}</span>
    </div>
  );
}
