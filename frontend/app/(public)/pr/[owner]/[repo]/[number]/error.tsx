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
      description="Retry this report route now. If the issue continues, return to contribution drill-down and refresh sync settings before opening the report again."
      retryLabel="Retry report route"
      actions={[
        { label: "Open contributions", href: "/dashboard/contributions", variant: "secondary" },
        { label: "Open settings", href: "/dashboard/settings", variant: "default" },
      ]}
      analyticsTarget="public-pr-report:route-error"
      errorDigest={error.digest}
      reset={reset}
      unstableRetry={unstable_retry}
    />
  );
}
