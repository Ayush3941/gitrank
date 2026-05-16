import type { Metadata } from "next";
import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Seasonal ranking snapshots weighted by meaningful merged work, review depth, and quality signals.",
};

export default function LeaderboardPage() {
  return <LeaderboardPageClient />;
}
