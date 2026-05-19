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
      description="Retry this profile route now. If it still fails, return to dashboard sync settings and refresh the account snapshot."
      retryLabel="Retry profile route"
      actions={[
        { label: "Open settings", href: "/dashboard/settings", variant: "secondary" },
        { label: "Open dashboard", href: "/dashboard", variant: "default" },
      ]}
      analyticsTarget="public-profile:route-error"
      errorDigest={error.digest}
      reset={reset}
      unstableRetry={unstable_retry}
    />
  );
}
