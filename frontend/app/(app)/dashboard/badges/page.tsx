import type { Metadata } from "next";
import { BadgesPageClient } from "@/features/badges/components/BadgesPageClient";

export const metadata: Metadata = {
  title: "Badges",
  description: "Track unlocked and upcoming achievement badges, rarity tiers, and story-backed progress.",
};

export default function BadgesPage() {
  return <BadgesPageClient />;
}
