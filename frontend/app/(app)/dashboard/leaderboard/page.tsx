import { LeaderboardPageClient } from "@/features/leaderboard/components/LeaderboardPageClient";
import { getPreviewMode } from "@/lib/preview";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  const preview = getPreviewMode((await searchParams).demo);
  return <LeaderboardPageClient preview={preview} />;
}
