"use client";

import { useState } from "react";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeGrid } from "@/features/badges/components/BadgeGrid";
import { useBadges } from "@/hooks/use-badges";
import type { BadgeRarity } from "@/types/gitrank";

export function BadgesPageClient() {
  const { data, isLoading, isError } = useBadges();
  const [rarity, setRarity] = useState<BadgeRarity | "All">("All");
  const [visibility, setVisibility] = useState<"All" | "Unlocked" | "Locked">("All");

  const filtered =
    data?.filter((badge) => {
      const rarityMatch = rarity === "All" || badge.rarity === rarity;
      const visibilityMatch =
        visibility === "All" ||
        (visibility === "Unlocked" && badge.unlocked) ||
        (visibility === "Locked" && !badge.unlocked);
      return rarityMatch && visibilityMatch;
    }) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Badge shelf"
        description="Unlocked proof, locked milestones, and the evidence each badge expects before it means anything."
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={rarity} onValueChange={(value) => setRarity(value as BadgeRarity | "All")}>
          <SelectTrigger aria-label="Filter by rarity">
            <SelectValue placeholder="Filter by rarity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All rarities</SelectItem>
            {["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"].map((item) => (
              <SelectItem key={item} value={item}>{item}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={visibility} onValueChange={(value) => setVisibility(value as typeof visibility)}>
          <SelectTrigger aria-label="Filter by unlock state">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All badges</SelectItem>
            <SelectItem value="Unlocked">Unlocked</SelectItem>
            <SelectItem value="Locked">Locked</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isLoading ? <LoadingState message="Polishing your badge shelf..." /> : null}
      {isError ? (
        <ErrorState
          title="Badge sync failed"
          description="Some badge evidence could not be verified from GitHub. Retry sync or use partial profile data."
        />
      ) : null}
      {!isLoading && !isError && filtered.length === 0 ? (
        <EmptyState
          title="Your badge shelf is waiting."
          description="Complete your first meaningful merged PR to start unlocking visible reputation proof."
          actionLabel="Open quests"
        />
      ) : null}
      {!isLoading && !isError && filtered.length ? <BadgeGrid badges={filtered} /> : null}
    </div>
  );
}
