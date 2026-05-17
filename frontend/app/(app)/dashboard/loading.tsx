import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

export default function DashboardLoading() {
  return (
    <RouteLoadingState
      eyebrow="Dashboard loading"
      title="Building your command center"
      description="GitRank is loading contribution signals, scores, quests, and leaderboard context for this view."
      cardCount={6}
    />
  );
}
