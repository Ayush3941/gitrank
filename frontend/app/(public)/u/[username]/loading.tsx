import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

export default function PublicProfileLoading() {
  return (
    <RouteLoadingState
      eyebrow="Public profile loading"
      title="Assembling contributor card"
      description="GitRank is preparing profile evidence, strengths, timeline data, and visible achievements."
      cardCount={4}
    />
  );
}
