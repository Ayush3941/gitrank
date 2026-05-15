import { cn } from "@/lib/cn";
import type { BadgeRarity } from "@/types/gitrank";

const rarityStyles: Record<BadgeRarity, string> = {
  Common: "neon-chip neon-chip-muted text-slate-200",
  Uncommon: "neon-chip neon-chip-success",
  Rare: "neon-chip border-sky-400/30 bg-sky-400/12 text-sky-200",
  Epic: "neon-chip border-violet-400/30 bg-violet-400/12 text-violet-200",
  Legendary: "neon-chip neon-chip-warning",
  Mythic: "neon-chip neon-chip-mythic",
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
        "rarity-badge inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-[0.2em] uppercase",
        rarityStyles[rarity],
        className,
      )}
    >
      {rarity}
    </span>
  );
}
