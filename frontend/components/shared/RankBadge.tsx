import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";

export function RankBadge({ rank, className }: { rank: string; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/12 px-3 py-1.5 text-sm font-medium text-amber-100",
        className,
      )}
    >
      <Crown className="h-4 w-4" />
      <span>{rank}</span>
    </div>
  );
}
