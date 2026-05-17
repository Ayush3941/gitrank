import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

export default function MarketingLoading() {
  return (
    <RouteLoadingState
      eyebrow="GitRank loading"
      title="Booting your contributor arena"
      description="Preparing onboarding, profile preview, and live sync entry points."
      cardCount={3}
    />
  );
}
