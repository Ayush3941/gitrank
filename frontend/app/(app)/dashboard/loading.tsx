import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

export default function DashboardLoading() {
  return (
    <RouteLoadingState
      eyebrow="Dashboard loading"
      title="Preparing your dashboard"
      description="Loading identity, contribution signals, and rank progress."
      cardCount={6}
      variant="dashboard"
    />
  );
}
