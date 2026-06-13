"use client";

import { RouteErrorCard } from "@/components/shared/RouteErrorCard";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
};

export default function PublicProfileRouteError({
  error,
  reset,
  unstable_retry,
}: RouteErrorProps) {
  return (
    <RouteErrorCard
      centered
      eyebrow="Public profile route error"
      title="Profile view failed to render"
      description="Retry this public profile route now. If it still fails, open the leaderboard or return to landing while evidence refreshes."
      retryLabel="Retry profile route"
      actions={[
        { label: "Open leaderboard", href: "/dashboard/leaderboard", variant: "default" },
        { label: "Open landing", href: "/", variant: "secondary" },
      ]}
      analyticsTarget="public-profile:route-error"
      errorDigest={error.digest}
      reset={reset}
      unstableRetry={unstable_retry}
    />
  );
}
