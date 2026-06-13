"use client";

import { RouteErrorCard } from "@/components/shared/RouteErrorCard";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
};

export default function PublicPRReportRouteError({
  error,
  reset,
  unstable_retry,
}: RouteErrorProps) {
  return (
    <RouteErrorCard
      centered
      eyebrow="PR report route error"
      title="Battle report view failed to render"
      description="Retry this report route now. If the issue continues, open the leaderboard or return to landing while report evidence refreshes."
      retryLabel="Retry report route"
      actions={[
        { label: "Open leaderboard", href: "/dashboard/leaderboard", variant: "default" },
        { label: "Open landing", href: "/", variant: "secondary" },
      ]}
      analyticsTarget="public-pr-report:route-error"
      errorDigest={error.digest}
      reset={reset}
      unstableRetry={unstable_retry}
    />
  );
}
