"use client";

import { RouteErrorCard } from "@/components/shared/RouteErrorCard";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorCard
      centered
      eyebrow="Dashboard route error"
      title="Dashboard panel failed to render"
      description="Retry this panel now. If the issue persists, open settings and re-run profile sync."
      retryLabel="Retry panel"
      actions={[{ label: "Open settings", href: "/dashboard/settings", variant: "default" }]}
      analyticsTarget="dashboard:route-error"
      errorDigest={error.digest}
      reset={reset}
    />
  );
}
