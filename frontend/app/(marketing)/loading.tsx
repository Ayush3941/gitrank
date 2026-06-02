import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

export default function MarketingLoading() {
  return (
    <RouteLoadingState
      eyebrow="GitRank loading"
      title="Preparing GitRank"
      description="Preparing onboarding, profile preview, and live sync entry points."
      cardCount={3}
      variant="marketing"
    />
  );
}
