import type { RankTier } from "@/types/gitrank";

const defaultRankTierOrder: RankTier[] = [
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

function parseRankTier(raw: string | undefined, fallback: RankTier): RankTier {
  if (!raw) {
    return fallback;
  }
  const normalized = normalizeRankTierToken(raw);
  return aliasToTier[normalized] ?? fallback;
}

const configuredOrder: RankTier[] = [
  parseRankTier(process.env.NEXT_PUBLIC_GITRANK_RANK_TIER_BRONZE_LABEL, "Bronze I"),
  parseRankTier(process.env.NEXT_PUBLIC_GITRANK_RANK_TIER_SILVER_LABEL, "Silver II"),
  parseRankTier(process.env.NEXT_PUBLIC_GITRANK_RANK_TIER_GOLD_LABEL, "Gold III"),
  parseRankTier(process.env.NEXT_PUBLIC_GITRANK_RANK_TIER_PLATINUM_LABEL, "Platinum I"),
  parseRankTier(process.env.NEXT_PUBLIC_GITRANK_RANK_TIER_DIAMOND_LABEL, "Diamond"),
];

function buildRankTierOrder(): RankTier[] {
  const deduped: RankTier[] = [];
  for (const tier of configuredOrder) {
    if (!deduped.includes(tier)) {
      deduped.push(tier);
    }
  }
  for (const tier of defaultRankTierOrder) {
    if (!deduped.includes(tier)) {
      deduped.push(tier);
    }
  }
  return deduped;
}

const rankTierOrder = buildRankTierOrder();

const divisionNameByTier: Record<RankTier, string> = {
  "Bronze I": process.env.NEXT_PUBLIC_GITRANK_DIVISION_BRONZE || "Bronze Foundry",
  "Silver II": process.env.NEXT_PUBLIC_GITRANK_DIVISION_SILVER || "Silver Workshop",
  "Gold III": process.env.NEXT_PUBLIC_GITRANK_DIVISION_GOLD || "Gold Forge",
  "Platinum I": process.env.NEXT_PUBLIC_GITRANK_DIVISION_PLATINUM || "Platinum Crucible",
  Diamond: process.env.NEXT_PUBLIC_GITRANK_DIVISION_DIAMOND || "Diamond Arena",
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
