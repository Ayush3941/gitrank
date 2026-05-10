import { cn } from "@/lib/cn";
import type { BadgeRarity } from "@/types/gitrank";

const rarityStyles: Record<BadgeRarity, string> = {
  Common: "border-white/12 bg-white/8 text-slate-200",
  Uncommon: "border-emerald-400/30 bg-emerald-400/12 text-emerald-200",
  Rare: "border-sky-400/30 bg-sky-400/12 text-sky-200",
  Epic: "border-violet-400/30 bg-violet-400/12 text-violet-200",
  Legendary: "border-amber-400/30 bg-amber-400/12 text-amber-100",
  Mythic: "border-rose-400/30 bg-rose-400/12 text-rose-100",
};

export function RarityBadge({
  rarity,
  className,
}: {
  rarity: BadgeRarity;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase",
        rarityStyles[rarity],
        className,
      )}
    >
      {rarity}
    </span>
  );
}
