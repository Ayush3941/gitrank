import type { RankTier } from "@/types/gitrank";

const rankTierOrder: RankTier[] = [
  "Bronze I",
  "Silver II",
  "Gold III",
  "Platinum I",
  "Diamond",
];

const aliasToTier: Record<string, RankTier> = {
  bronze: "Bronze I",
  "bronze i": "Bronze I",
  silver: "Silver II",
  "silver ii": "Silver II",
  gold: "Gold III",
  "gold iii": "Gold III",
  platinum: "Platinum I",
  "platinum i": "Platinum I",
  diamond: "Diamond",
};

function normalizeRankTierToken(value: string): string {
  return value.trim().toLowerCase();
}

const divisionNameByTier: Record<RankTier, string> = {
  "Bronze I": "Bronze Foundry",
  "Silver II": "Silver Workshop",
  "Gold III": "Gold Forge",
  "Platinum I": "Platinum Crucible",
  Diamond: "Diamond Arena",
};

export function normalizeRankTier(value: string): RankTier {
  const normalized = normalizeRankTierToken(value);
  return aliasToTier[normalized] ?? rankTierOrder[0] ?? "Bronze I";
}

export function nextRankTier(rankTier: RankTier): RankTier | undefined {
  const index = rankTierOrder.indexOf(rankTier);
  return index >= 0 ? rankTierOrder[index + 1] : undefined;
}

export function divisionForRankTier(rankTier: RankTier): string {
  return divisionNameByTier[rankTier] ?? "Open Arena";
}
