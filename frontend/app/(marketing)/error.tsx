"use client";

import { RouteErrorCard } from "@/components/shared/RouteErrorCard";

type MarketingRouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
  unstable_retry?: () => void;
};

export default function MarketingRouteError({
  error,
  reset,
  unstable_retry,
}: MarketingRouteErrorProps) {
  return (
    <RouteErrorCard
      centered
      eyebrow="Marketing route error"
      title="GitRank landing route failed to render"
      description="Retry this route now. If the issue persists, open login directly and continue with GitHub OAuth."
      retryLabel="Retry route"
      actions={[
        { label: "Open login", href: "/login", variant: "secondary" },
        { label: "Start onboarding", href: "/onboarding/connect-github", variant: "default" },
      ]}
      analyticsTarget="marketing:route-error"
      errorDigest={error.digest}
      reset={reset}
      unstableRetry={unstable_retry}
    />
  );
}
