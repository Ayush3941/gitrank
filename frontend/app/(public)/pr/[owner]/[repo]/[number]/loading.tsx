import { RouteLoadingState } from "@/components/shared/RouteLoadingState";

export default function PublicPRReportLoading() {
  return (
    <RouteLoadingState
      eyebrow="PR report loading"
      title="Preparing contribution battle report"
      description="GitRank is collecting scored evidence, impact signals, and explanation data for this pull request."
      cardCount={4}
    />
  );
}
